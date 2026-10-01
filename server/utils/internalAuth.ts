import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

/**
 * Guards agent-to-app endpoints — the Trigger.dev capture-agent task calling
 * back into this app (notify, and later, place writes). Twilio credentials
 * never leave this app, so this is the only door back in; it fails closed
 * on every branch.
 */
export function assertInternalRequest(event: H3Event) {
  const secret = useRuntimeConfig(event).internalApiSecret
  if (!secret) {
    console.error('INTERNAL_API_SECRET is not set — refusing internal request')
    throw createError({ statusCode: 500, statusMessage: 'Internal API secret not configured' })
  }

  const header = getHeader(event, 'authorization')
  const provided = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

  if (!provided || !secretsMatch(provided, secret)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

// Constant-time comparison: a length mismatch fails immediately (without
// `timingSafeEqual`, which throws on unequal-length buffers) rather than
// falling back to `===`, so a wrong-length guess can't be timed either.
function secretsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided)
  const expectedBuf = Buffer.from(expected)
  if (providedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(providedBuf, expectedBuf)
}
