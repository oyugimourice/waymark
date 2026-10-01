# Aurora Technical Specification

Repository: sahildavid-dev/aurora-app  
Primary stack: Nuxt 4 + TypeScript + Vue 3 + Nitro + Twilio + Trigger.dev  
Current status: working integration prototype

## 1. Objective

This repository provides the application layer for Aurora’s WhatsApp-driven place-capture pipeline. It handles inbound Twilio requests, downloads supported images, invokes the external `capture-agent`, and sends AI-generated replies back to users.

The repository does not contain the AI interpretation logic. That work is delegated to a separate Trigger.dev task usually implemented in `aurora-agents`.

---

## 2. System Context

The system sits between three major components:

1. Twilio WhatsApp
2. Aurora App
3. Trigger.dev `capture-agent`

The interaction model is asynchronous:

- Twilio sends an inbound webhook
- Aurora validates the request and triggers a background task
- `capture-agent` interprets the input
- `capture-agent` calls back into Aurora to send the reply
- Aurora sends the outbound message via Twilio

---

## 3. High-Level Architecture

```text
WhatsApp User
    │
    ▼
Twilio
    │
    ├─ inbound webhook -> POST /api/webhooks/twilio
    │
    ▼
Aurora App (this repo)
    │
    ├─ validates Twilio signature
    ├─ downloads supported media
    ├─ triggers capture-agent via Trigger.dev
    └─ replies via /api/internal/notify
          │
          ▼
    Trigger.dev capture-agent
          │
          ├─ interprets text/image
          ├─ resolves place
          └─ POST /api/internal/notify
                │
                ▼
          Aurora App
                │
                ▼
          Twilio REST API
                │
                ▼
          WhatsApp User
```

---

## 4. Repository Structure

```text
.github/
  workflows/       optional CI if added later

app/
  app.vue           minimal Aurora landing page

server/
  api/
    webhooks/
      twilio.post.ts
    internal/
      notify.post.ts
  plugins/
    trigger.ts
  utils/
    internalAuth.ts

public/
  favicon.ico
  robots.txt

.env.example
.gitignore
README.md
amplify.yml
nuxt.config.ts
package.json
package-lock.json
tsconfig.json
```

---

## 5. Runtime Stack

### Production runtime

- Nuxt 4
- Vue 3
- Nitro server
- Node.js
- TypeScript
- Twilio SDK
- Trigger.dev SDK
- Zod validation
- AWS Amplify deployment

### Package manifest

The repository dependencies are defined in `package.json`:

```json
{
  "name": "aurora-app",
  "type": "module",
  "private": true,
  "scripts": {
    "build": "nuxt build",
    "dev": "nuxt dev",
    "generate": "nuxt generate",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare"
  },
  "dependencies": {
    "@trigger.dev/sdk": "^4.5.11",
    "nuxt": "^4.5.2",
    "twilio": "^6.1.0",
    "vue": "^3.5.41",
    "vue-router": "^5.2.0",
    "zod": "^3.25.76"
  }
}
```

---

## 6. Configuration Specification

### Required runtime configuration

The app defines these server-only runtime configuration values in `nuxt.config.ts`:

```ts
runtimeConfig: {
  publicUrl: process.env.PUBLIC_URL ?? '',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? '',
  triggerSecretKey: process.env.TRIGGER_SECRET_KEY ?? '',
  internalApiSecret: process.env.INTERNAL_API_SECRET ?? ''
}
```

### Required environment variables

| Variable | Required | Purpose |
| --- | ---: | --- |
| `PUBLIC_URL` | Yes | reconstruct signed Twilio URL |
| `TWILIO_ACCOUNT_SID` | Yes | validate and fetch media, send outbound messages |
| `TWILIO_AUTH_TOKEN` | Yes | validate inbound requests and access media |
| `TWILIO_WHATSAPP_FROM` | Yes | sender ID for outbound WhatsApp messages |
| `TRIGGER_SECRET_KEY` | Yes | Trigger.dev auth |
| `INTERNAL_API_SECRET` | Yes | secure agent callback auth |

### Why runtimeConfig is used

The repo explicitly avoids runtime `process.env` reads in handlers because:

- on AWS Amplify SSR/Lambda, the runtime environment can differ from build-time environment
- `nuxt build` is the point where environment values are available reliably
- values are baked into server bundle at build time

This is a deployment-specific design requirement, not a generic Nuxt practice.

---

## 7. API Specification

## 7.1 Inbound webhook: `POST /api/webhooks/twilio`

### Purpose

Accept inbound WhatsApp messages from Twilio and trigger the AI place-capture task.

### Authentication

- Twilio request signature validation
- header: `X-Twilio-Signature`
- URL validated against `PUBLIC_URL`
- body parsed as form data

### Request constraints

The route accepts Twilio fields such as:

- `From`
- `MessageSid`
- `Body`
- `NumMedia`
- `MediaUrl0`
- `MediaContentType0`

### Processing flow

1. Validate HTTP method is `POST`
2. Read request body
3. Validate Twilio signature
4. Detect sender and message ID
5. Read trimmed text body
6. Detect supported media attachment
7. Download the first supported image if present
8. Skip unsupported media
9. Skip oversized media
10. Build payload
11. Trigger `capture-agent` with `MessageSid` idempotency key
12. Return HTTP 200 without TwiML

### Supported media types

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

### Payload structure

```ts
interface CaptureAgentPayload {
  from: string
  messageSid: string
  receivedAt: string
  text: string
  image?: { data: string; mediaType: string }
}
```

### Behavior for invalid or incomplete input

If:

- `From` is missing
- `MessageSid` is missing
- there is no text
- there is no supported media

then:

- log a warning
- return HTTP 200
- do not fail hard

This is intentional: a malformed or empty message should not generate useless Twilio retries.

---

## 7.2 Internal callback: `POST /api/internal/notify`

> ### Purpose

Allow the external `capture-agent` task to send a user-facing WhatsApp response.

### Authorization

```http
Authorization: Bearer <INTERNAL_API_SECRET>
```

### Request payload

```json
{
  "to": "whatsapp:+15551234567",
  "body": "Your place was captured."
}
```

### Validation rules

- `to` required
- `to` must start with `whatsapp:`
- `body` required and non-empty

### Response

```json
{
  "ok": true,
  "sid": "SM..."
}
```

### Message limits

If `body` exceeds 1600 characters:

- it is truncated
- not rejected

### Twilio sending logic

The route uses:

```ts
const client = twilio(accountSid, authToken)
await client.messages.create({ from, to, body })
```

---

## 8. Endpoint Behavior Matrix

| Endpoint | Method | Auth | Purpose | Success | Failure |
| --- | --- | --- | --- | --- | --- |
| `/api/webhooks/twilio` | POST | Twilio signature | receive inbound message | 200 | 403, 500 |
| `/api/internal/notify` | POST | bearer secret | send outbound WhatsApp reply | 200 | 400, 401, 500, 502 |

---

## 9. Security Specification

## 9.1 Twilio security

Requirements:

- reject invalid Twilio signatures
- reconstruct the public URL using `PUBLIC_URL`
- fail closed if `TWILIO_AUTH_TOKEN` is missing
- fail closed if `PUBLIC_URL` is missing

## 9.2 Internal security

The `internalAuth.ts` helper:

- reads the configured internal API secret
- reads `Authorization` header
- extracts bearer token
- checks secret length
- compares using `timingSafeEqual`
- rejects unauthorized requests with 401
- logs configuration errors if missing

### Security rationale

This prevents an internal callback from being used as an arbitrary outbound SMS route.

---

## 10. Media Handling Design

### Trigger.dev payload size constraint

Trigger.dev has a 10MB payload limit.
The code therefore:

- supports only first supported media
- caps media to 5MB
- base64 encodes the data
- avoids passing Twilio URLs directly

### Media fetch flow

1. `findFirstSupportedMedia` inspects `NumMedia` and supported content types
2. fetches `MediaUrlN`
3. authenticates with Twilio Basic Auth
4. reads download bytes
5. rejects if too large
6. returns `{ data, mediaType }`

This keeps the payload small and avoids exposing Twilio credentials to the AI project.

---

## 11. Error Handling Requirements

### Inbound request failures

| Condition | Result |
| --- | --- |
| invalid Twilio signature | 403 |
| missing Twilio token | 500 |
| missing public URL | 500 |
| missing From/MessageSid | 200 + log |
| no text/media | 200 + log |
| media download failure | 500 |
| Trigger.dev failure | 500 |

### Internal callback failures

| Condition | Result |
| --- | --- |
| missing `Authorization` header | 401 |
| invalid bearer token | 401 |
| missing `INTERNAL_API_SECRET` | 500 |
| invalid body | 400 |
| missing Twilio config | 500 |
| Twilio send failure | 502 |

---

## 12. Service Boundaries

### This repo owns

- webhook handling
- secret management
- outbound message dispatch
- Twilio integration
- Trigger.dev invocation
- minimal landing page
- deployment config

### External repo owns

- AI interpretation
- place resolution
- message generation
- external search and structured data creation

---

## 13. Contract with `aurora-agents`

This repo depends on a consistent contract with the external AI task. The schema is currently mirrored manually in code.

### Required contract

The external task must accept:

```ts
{
  from: string
  messageSid: string
  receivedAt: string
  text: string
  image?: { data: string; mediaType: string }
}
```

The external task should later call:

```http
POST /api/internal/notify
Authorization: Bearer <INTERNAL_API_SECRET>
```

with:

```json
{
  "to": "whatsapp:+15551234567",
  "body": "..."
}
```

### Contract risk

This repository currently duplicates the payload interface rather than importing a shared contract.

### Recommended future improvement

Create a shared package or schema definition:

- `aurora-contracts`
- TypeScript schema package
- JSON schema
- OpenAPI definitions

---

## 14. Observability Requirements

The repo currently uses console logging, but production hardening is needed.

### Required logging

- invalid Twilio requests
- missing env config
- outbound send failures
- media size warnings
- trigger failures
- unauthorized internal requests

### Recommended future logging fields

- `messageSid`
- `from`
- `requestId`
- `triggerRunId`
- `statusCode`
- `mediaType`
- `mediaBytes`
- `twilioOutboundSid`

### Log hygiene

Do not log:

- Twilio auth tokens
- bearer tokens
- raw image contents
- sensitive phone numbers in full if not needed

---

## 15. Deployment Specification

### Local development

```bash
npm install
cp .env.example .env
npm run dev
```

### Local webhook exposure

Use ngrok or another public tunnel:

```bash
ngrok http 3000
```

Set:

```bash
PUBLIC_URL=https://YOUR-NGROK-DOMAIN
```

Configure Twilio webhook:

```text
https://YOUR-NGROK-DOMAIN/api/webhooks/twilio
```

### Production deployment

This repo is designed for AWS Amplify.

Build process in `amplify.yml`:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - echo "PUBLIC_URL=$PUBLIC_URL" >> .env
        - echo "TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID" >> .env
        - echo "TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN" >> .env
        - echo "TWILIO_WHATSAPP_FROM=$TWILIO_WHATSAPP_FROM" >> .env
        - echo "TRIGGER_SECRET_KEY=$TRIGGER_SECRET_KEY" >> .env
        - echo "INTERNAL_API_SECRET=$INTERNAL_API_SECRET" >> .env
        - NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

---

## 16. Testing Requirements

The repo currently has no automated tests.

### Required unit tests

- bearer token parsing
- constant-time comparison behavior
- Twilio URL reconstruction
- invalid signature rejection
- content type filtering
- over-limit media handling
- body truncation
- request schema validation

### Required route tests

- valid inbound webhook
- invalid Twilio signature
- missing Twilio token
- missing `PUBLIC_URL`
- no text and no media
- unsupported media
- oversized media
- `capture-agent` trigger failure
- valid internal notify
- invalid internal notify
- unauthorized notify request

### Recommended tooling

- Vitest
- `@nuxt/test-utils`
- mock Twilio SDK
- mock Trigger.dev SDK

---

## 17. Current Gaps

The current repo is not a full product. Important gaps include:

- no database
- no user identity layer
- no saved-place history
- no place management APIs
- no web app beyond placeholder
- no test suite
- no CI
- no operational monitoring
- no production hardening

---

## 18. Recommended Engineering Priorities

### Immediate

1. Add tests
2. Add CI
3. Add config validation
4. Add structured logging
5. Add health endpoint
6. Add contract validation with the AI repo

### Near-term

1. Add persistence layer
2. Add captured-place storage
3. Add message history or capture status
4. Add rate limits and retries
5. Add better user feedback flow

### Medium-term

1. Add saved-place browsing UI
2. Add map and detail pages
3. Add search/filter UI
4. Add follow-up conversation support
5. Add scale and operational protections

---

## 19. Non-Functional Requirements

### Reliability

- no synchronous long work in the webhook
- fast return to Twilio
- idempotent triggers
- fail closed security posture

### Security

- Twilio request validation
- bearer-token auth
- no secret leaks to browser
- safe message destination restriction

### Performance

- quick webhook response
- small payloads
- media cap
- async task model

### Maintainability

- clear route boundaries
- route-based architecture
- explicit environment config
- shared contracts with AI project

---

## 20. Summary

`aurora-app` is an integration-focused Nuxt app whose purpose is to be the secure, asynchronous boundary between Twilio WhatsApp and Aurora’s AI place-capture engine. It is currently a working but limited MVP foundation rather than a complete end-user application.

Its core technical responsibilities are:

- validate Twilio webhook requests
- preprocess inbound text and media
- trigger `capture-agent`
- protect internal callback endpoints
- send outbound WhatsApp replies
- operate under an Amplify/Lambda deployment model

The next major engineering work is to add:

- tests
- contract validation
- monitoring
- persistence
- product UI
- operational hardening

---
