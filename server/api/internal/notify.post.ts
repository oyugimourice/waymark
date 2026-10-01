import { z } from 'zod'
import twilio from 'twilio'

// Twilio's message body limit. We truncate rather than reject — a long
// reply is still worth sending, just not in full.
const MAX_BODY_LENGTH = 1600

const notifySchema = z.object({
  // Restricted to whatsapp: so a leaked secret can't be used to send
  // arbitrary SMS through this account.
  to: z.string().min(1, 'to is required').startsWith('whatsapp:', 'to must start with "whatsapp:"'),
  body: z.string().min(1, 'body is required')
})

/**
 * Internal endpoint the capture-agent Trigger.dev task calls to send its
 * WhatsApp reply. Twilio credentials live only in this app — the agent has
 * none — and the inbound webhook can't wait on the agent (capture-agent
 * runs 30-90s; Twilio's webhook timeout is 15s), so this is how the reply
 * gets out to the user, out-of-band.
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'POST')
  assertInternalRequest(event)

  const raw = await readBody(event)
  const parsed = notifySchema.safeParse(raw)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues.map((issue) => issue.message).join('; ')
    })
  }

  const { to } = parsed.data
  const body =
    parsed.data.body.length > MAX_BODY_LENGTH
      ? `${parsed.data.body.slice(0, MAX_BODY_LENGTH - 1)}…`
      : parsed.data.body

  const config = useRuntimeConfig(event)
  const accountSid = config.twilioAccountSid
  const authToken = config.twilioAuthToken
  const from = config.twilioWhatsappFrom
  if (!accountSid || !authToken || !from) {
    console.error('Twilio env vars are not configured — cannot send notify reply')
    throw createError({ statusCode: 500, statusMessage: 'Twilio not configured' })
  }

  const client = twilio(accountSid, authToken)

  let sid: string
  try {
    const message = await client.messages.create({ from, to, body })
    sid = message.sid
  } catch (error) {
    console.error(`Failed to send WhatsApp message to ${to}:`, error)
    throw createError({ statusCode: 502, statusMessage: 'Failed to send WhatsApp message via Twilio' })
  }

  console.log(`Sent WhatsApp message to ${to}, sid=${sid}`)
  setResponseStatus(event, 200)
  return { ok: true, sid }
})
