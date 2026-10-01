import type { H3Event } from 'h3'
import twilio from 'twilio'
import { tasks } from '@trigger.dev/sdk'

// Trigger.dev task identifier this app calls into. Payload shape below is
// mirrored from aurora-agents' src/trigger/capture-agent.ts — keep it in
// sync if that schema changes.
const CAPTURE_AGENT_TASK_ID = 'capture-agent'

// Trigger.dev has a hard 10MB payload limit and the image gets base64-inlined
// into it (~33% bigger than the raw file). Stay well clear of that. Fine for
// WhatsApp photos (compressed by WhatsApp, usually well under 1MB).
const MAX_MEDIA_BYTES = 5 * 1024 * 1024

const SUPPORTED_IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

interface CaptureAgentPayload {
  from: string
  messageSid: string
  receivedAt: string
  text: string
  image?: { data: string; mediaType: string }
}

interface MediaRef {
  url: string
  contentType: string
}

// --- Signature validation ----------------------------------------------
//
// Fails closed: a missing auth token or public URL means we can't verify
// the request came from Twilio, so we refuse to process it rather than
// skip validation. This endpoint triggers paid Claude runs and must never
// be publicly invokable.
function validateTwilioSignature(event: H3Event, body: Record<string, string>) {
  const config = useRuntimeConfig(event)
  const authToken = config.twilioAuthToken
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN is not set — refusing to process Twilio webhook')
    throw createError({ statusCode: 500, statusMessage: 'Twilio auth token not configured' })
  }

  const publicUrl = config.publicUrl
  if (!publicUrl) {
    console.error('PUBLIC_URL is not set — cannot validate Twilio signature')
    throw createError({ statusCode: 500, statusMessage: 'Public URL not configured' })
  }

  // Amplify sits behind CloudFront, so getRequestURL(event) resolves to the
  // internal host, not the public host Twilio signed the request against.
  // Rebuild the URL from PUBLIC_URL, keeping the pathname and query string
  // from the actual request, so it matches the webhook URL configured in
  // the Twilio console exactly.
  const requestUrl = getRequestURL(event)
  const url = new URL(requestUrl.pathname + requestUrl.search, publicUrl).toString()

  const signature = getHeader(event, 'x-twilio-signature')
  const isValid = !!signature && twilio.validateRequest(authToken, signature, url, body)

  if (!isValid) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid Twilio signature' })
  }
}

// --- Media ------------------------------------------------------------
//
// Twilio reports attachments as separate form fields — NumMedia, MediaUrl0,
// MediaContentType0, ... — not inside Body. Each MediaUrl requires HTTP
// Basic Auth with the Twilio Account SID/Auth Token to fetch, and Twilio
// only hosts it for a limited time, so we download it here and inline it
// into the capture-agent payload as base64 rather than passing the Twilio
// URL through (the agent deliberately has no Twilio credentials of its own).
function findFirstSupportedMedia(body: Record<string, string>): MediaRef | null {
  const count = Number(body.NumMedia ?? '0')
  for (let i = 0; i < count; i++) {
    const contentType = body[`MediaContentType${i}`]
    if (!contentType || !SUPPORTED_IMAGE_MEDIA_TYPES.has(contentType)) continue
    const url = body[`MediaUrl${i}`]
    if (url) return { url, contentType }
  }
  return null
}

async function fetchMedia(
  ref: MediaRef,
  accountSid: string,
  authToken: string
): Promise<{ data: string; mediaType: string } | null> {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const res = await fetch(ref.url, { headers: { Authorization: `Basic ${auth}` } })
  if (!res.ok) throw new Error(`Failed to fetch media ${ref.url}: ${res.status} ${res.statusText}`)

  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    console.warn(`Skipping media ${ref.url} — ${bytes.byteLength} bytes exceeds the ${MAX_MEDIA_BYTES} limit`)
    return null
  }

  return { data: bytes.toString('base64'), mediaType: ref.contentType }
}

/**
 * Inbound Twilio WhatsApp webhook.
 *
 * WhatsApp user -> Twilio -> this handler -> Trigger.dev `capture-agent`
 *
 * A thin, stateless handoff: validate the request came from Twilio, pull
 * the raw text and (at most) one image out of it, and hand both straight
 * to the `capture-agent` task. All interpretation (parsing URLs, splitting
 * name/notes, generating a reply) happens in the task — this Lambda-backed
 * handler can't defer anything past the response, so nothing durable
 * happens here.
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'POST')

  const body = (await readBody<Record<string, string>>(event)) ?? {}

  validateTwilioSignature(event, body)

  const from = body.From
  const messageSid = body.MessageSid
  const text = body.Body?.trim() ?? ''
  const mediaRef = findFirstSupportedMedia(body)

  // A photo sent with no caption has an empty Body — that's still a message
  // worth handling. But if we're missing the sender/id, or there's neither
  // text nor a supported attachment, there's nothing capture-agent can do
  // with it. Ack with 200 rather than a 4xx — a 4xx just produces pointless
  // Twilio retries for a message that can never succeed.
  if (!from || !messageSid || (!text && !mediaRef)) {
    console.warn('Twilio webhook missing From/MessageSid or has no text/media — ignoring', {
      from,
      messageSid,
      hasMedia: !!mediaRef
    })
    setResponseStatus(event, 200)
    return ''
  }

  let image: { data: string; mediaType: string } | undefined
  if (mediaRef) {
    const config = useRuntimeConfig(event)
    const media = await fetchMedia(mediaRef, config.twilioAccountSid, config.twilioAuthToken)
    if (media) image = media
  }

  const payload: CaptureAgentPayload = {
    from,
    messageSid,
    receivedAt: new Date().toISOString(),
    text,
    ...(image ? { image } : {})
  }

  // MessageSid as the idempotency key: a Twilio retry of the same message
  // returns the existing run instead of starting a second paid one.
  await tasks.trigger(CAPTURE_AGENT_TASK_ID, payload, { idempotencyKey: messageSid })

  // Empty body (as opposed to TwiML) tells Twilio not to auto-reply. The
  // actual WhatsApp reply is sent by capture-agent, not this handler.
  setResponseStatus(event, 200)
  return ''
})
