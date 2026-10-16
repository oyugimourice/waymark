# Agent integration guide

**Author:** Oyugi Mourice · **Last updated:** 2026-10-07

What the `capture-agent` Trigger.dev task (a separate repository) must do so that users see their places in the web app,
get correct replies, and are never left waiting. Everything below is exercised by this repo's tests
(`tests/integration/internal.test.ts`, `journey.test.ts`) and by `npm run e2e:local`.

> **The web app stays empty until the agent calls `POST /api/internal/places`.** Waymark cannot save a place the agent has
> not told it about.

## 1. What the agent needs

| Setting | Value |
| --- | --- |
| Waymark base URL | the same origin as `PUBLIC_URL` |
| Secret | the **same** `INTERNAL_API_SECRET` as Waymark (≥ 32 chars). Send as `Authorization: Bearer <secret>` |

Copy `server/lib/contracts.ts` **and** `server/lib/text.ts` (it imports it) into the agent repo so both sides validate
the same schemas, or re-implement them from the tables below.

## 2. The flow the agent should follow

1. Receive the payload (`from`, `messageSid`, `receivedAt`, `text`, optional `image`) — see ARCHITECTURE §7.1.
2. Identify the place.
3. **`POST /api/internal/places`** with the result (idempotent per user and place).
4. **`POST /api/internal/notify`** with the reply text.
5. On any failure the agent cannot recover from: **`POST /api/internal/capture-status`** `{{status:"failed"}}` and **`notify`**
   an apology, so the user is never left waiting.

Save first, then notify: that way the reply can honestly say the place is saved.

## 3. `POST /api/internal/places`

```json
{{
  "from": "whatsapp:+254700000000",
  "messageSid": "SM0123456789abcdef0123456789abcdef",
  "place": {{
    "providerPlaceId": "ChIJ_abc-123",
    "name": "Cafe Javas",
    "address": "Kampala Road, Kampala",
    "lat": 0.3136,
    "lng": 32.5811,
    "category": "cafe",
    "mapsUrl": "https://maps.google.com/?cid=123"
  }},
  "note": "try the coffee"
}}
```

| Field | Rules |
| --- | --- |
| `from` | `whatsapp:+E.164`, as received. The user account is created if it does not exist |
| `messageSid` | optional; if it belongs to this user, the capture is linked and marked `done` |
| `place.name` | required, 1–200 chars |
| `place.lat` / `lng` | required numbers, −90…90 / −180…180 |
| `place.providerPlaceId` | optional, printable ASCII without spaces, ≤ 256. **When present, the place is shared between users and updated in place**, so only send it if it is a stable provider id |
| `place.address` / `category` / `note` | optional, ≤ 400 / 60 / 500 chars |
| `place.mapsUrl` | optional, **must be `https://`** (it becomes a link in the web app). `javascript:`, `data:` and `http:` are rejected |
| everything | control characters are stripped; unknown fields are ignored; max request 32 KB |

Response `200`: `{{ "ok": true, "savedPlaceId": "…", "created": true }}` — `created:false` means the user had already saved it
(the note and "saved at" time are refreshed). Treat the text fields as **untrusted** AI output: Waymark escapes everything it
renders, but do not put secrets or personal data of other people in them.

## 4. `POST /api/internal/notify`

`{{ "to": "whatsapp:+254700000000", "body": "Saved: Cafe Javas — Kampala Road" }}` → `{{ "ok": true, "sid": "SM…" }}`.
`to` must be a WhatsApp address. `body` is cut to 1600 characters on a character boundary.

## 5. `POST /api/internal/capture-status`

`{{ "messageSid": "SM…", "status": "handed_off" | "done" | "failed" }}` → `{{ "ok": true }}` or `404` if unknown.

## 6. Error handling and retries

| Status | Meaning | Action |
| --- | --- | --- |
| `200` | Done | — |
| `400` | Request invalid | Fix it. **Never retry** |
| `401` | Wrong secret | Fix configuration. Never retry |
| `413` | Too large | Never retry |
| `422` (`data.retryable:false`, `data.twilioCode`) | Twilio refused permanently. **63016** = the 24-hour window has closed | Never retry; a template message would be needed |
| `429`, `502`, `504` (`data.retryable:true`) | Transient | Retry with exponential back-off (e.g. 1 s, 2 s, 4 s, then give up) |

`places` is idempotent, so retrying it is always safe. **`notify` is not idempotent**: if a call times out you cannot tell
whether the message was sent, so a retry can deliver a duplicate (residual risk R4 in the threat model). Prefer retrying only
on the explicit `429/502/504` responses.

## 7. TypeScript helper

```ts
const BASE = process.env.WAYMARK_URL!            // e.g. https://waymark.example.com
const SECRET = process.env.INTERNAL_API_SECRET!

async function waymark(path: string, body: unknown, attempts = 4): Promise<Response> {{
  for (let i = 0; ; i++) {{
    const res = await fetch(`${{BASE}}${{path}}`, {{
      method: 'POST',
      headers: {{ authorization: `Bearer ${{SECRET}}`, 'content-type': 'application/json' }},
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000)
    }})
    const transient = res.status === 429 || res.status === 502 || res.status === 504
    if (res.ok || !transient || i >= attempts - 1) return res
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i))
  }}
}}

// after identifying the place:
await waymark('/api/internal/places', {{ from, messageSid, place, note }})
await waymark('/api/internal/notify', {{ to: from, body: `Saved: ${{place.name}}` }})
```

## 8. Trying it locally

```bash
# 1. start Postgres and migrate (see RUNBOOK §8), then: npm run dev
curl -sS -X POST http://localhost:3000/api/internal/places \
  -H "Authorization: Bearer $INTERNAL_API_SECRET" -H 'content-type: application/json' \
  -d '{{"from":"whatsapp:+254700000000","place":{{"name":"Test Cafe","lat":0.31,"lng":32.58}}}}'
```

Then sign in to `http://localhost:3000/app` with that number (the sign-in message must come from WhatsApp via the Twilio
sandbox) and the place appears.
