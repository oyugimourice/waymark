
# Aurora Product Requirements Document

> Repository: oyugimourice/waymark  
> Default branch: main  
> Status: Draft for MVP productization

## 1. Product Summary

Aurora is a WhatsApp-based place-capture assistant that helps users save places they discover in the real world. Users send a place description, a photo, or both through WhatsApp. An AI process interprets the input, identifies the likely real-world place, and responds with a structured confirmation or saved result.

This repository is the integration layer for the product. It handles inbound Twilio WhatsApp traffic, validates requests, fetches media, triggers the AI task, and sends the AI-generated reply back through Twilio. The actual reasoning and place interpretation happens in the separate `aurora-agents` project.

The product goal is to make place capture feel as easy as sending a normal WhatsApp message.

---

## 2. Problem Statement

People discover meaningful places in real time:

- coffee shops
- restaurants
- parks
- landmarks
- event venues
- favorite stores
- places recommended by friends

These moments are often hard to capture later because:

- users do not want to open a full app
- they may be on mobile and in transit
- the description may be vague or incomplete
- they may only have a photo, not a full address
- they may want to save a place without filling out forms

Aurora solves this by allowing users to send a WhatsApp message or photo and receive a reply without navigating a complex app.

---

## 3. Product Vision

Aurora should feel like a real-time place memory assistant:

- low-friction
- mobile-first
- chat-native
- AI-assisted
- sociable and lightweight
- deeply useful in everyday discovery moments

---

## 4. Product Goals

### Primary goals

- Accept inbound WhatsApp place requests
- Support text-only, photo-only, and text-plus-photo inputs
- Trigger AI-based place parsing and resolution
- Reply back to the user through Twilio
- Keep the webhook response fast and reliable
- Restrict outbound messaging to WhatsApp recipients only
- Deploy reliably on AWS Amplify

### Secondary goals

- Support future saved-place browsing
- Support future map and recall flows
- Support a richer multi-turn experience
- Add data persistence for captured places

---

## 5. Target Users

### Primary users

- people who want to save places quickly while mobile
- people who discover places in the moment
- people who prefer chat interfaces over forms
- travelers exploring neighborhoods
- people who want low-friction place recall

### Secondary users

- friends sending places to each other
- users discovering places from photos and messages
- users who want AI-assisted memory supplements

---

## 6. User Personas

### Persona 1: The Busy Explorer

- mobile
- wants to save a place quickly
- does not want to fill out forms
- sends a message or photo and expects a result

### Persona 2: The Memory Keeper

- wants to keep track of favorite or meaningful places
- values convenience and quiet recall
- wants low-friction, minimal-effort capture

### Persona 3: The Social Sharer

- often forwards recommendations
- wants to share place suggestions with minimal friction
- prefers a chat-native workflow

---

## 7. Core Use Cases

### Use case 1: Text-only place capture

User sends: “Cute coffee shop with a courtyard near the river.”
Aurora identifies the likely place and responds with confirmation or saved-place result.

### Use case 2: Photo-only place capture

User sends a photo of a storefront or landmark.
Aurora uses the image to infer the place and replies with the result.

### Use case 3: Text + photo

User sends a message and image.
Aurora combines both signals to increase confidence and accuracy.

### Use case 4: Outbound reply

The AI agent finishes processing and sends a WhatsApp reply through the app.

### Use case 5: Future saved-place retrieval

A user asks to revisit saved places or fetch details later.

---

## 8. In-Scope Functionality

- Twilio WhatsApp webhook validation
- message and media extraction
- Trigger.dev task invocation
- secure internal callback route
- outbound WhatsApp response sending
- environment-based configuration
- minimal landing-page web app

---

## 9. Out-of-Scope for MVP

The following are not part of the initial product scope:

- account creation
- login/auth flow
- user management
- search UI
- map UI
- database-backed place history
- place editing flow
- admin dashboard
- general-purpose AI conversation
- broad multi-turn messaging system

---

## 10. Functional Requirements

### 10.1 Inbound WhatsApp intake

The system must accept incoming WhatsApp messages from Twilio:

- `POST /api/webhooks/twilio`
- validate Twilio signature
- read `From`, `MessageSid`, `Body`
- accept optional media attachments
- reject invalid requests without processing

### 10.2 Media handling

If a supported image is attached:

- download the first supported image
- support JPEG, PNG, WEBP, and GIF
- cap file size
- convert the binary to base64
- forward base64 payload to the AI agent

### 10.3 Trigger pipeline

The system must hand the raw message to a long-running agent process:

- invoke Trigger.dev task `capture-agent`
- use `MessageSid` as idempotency key
- avoid blocking Twilio webhook response

### 10.4 Internal callback

When the AI worker is done:

- call `POST /api/internal/notify`
- use bearer-token authorization
- limit destination to `whatsapp:` addresses
- send message via Twilio

### 10.5 Message response constraints

The app must:

- return empty HTTP 200 to Twilio as acknowledgment
- ignore malformed input without causing endless retries
- truncate overlong body text to Twilio’s message size limit

### 10.6 Security requirements

The app must:

- validate Twilio signatures
- use constant-time comparison for internal secrets
- never expose secrets to browser bundles
- reject unauthorized internal requests
- keep secrets in deployment environment variables

---

## 11. Product Experience Requirements

- The system should feel instant from the user’s perspective
- users should not need to know the AI job is asynchronous
- responses should be concise and clear
- users should receive useful feedback when input is unusable
- the product should work in a chat-first context, not a form-heavy one

---

## 12. Business Requirements

- provide a frictionless way to save places from WhatsApp
- operate without requiring a user to open a full mobile app
- ensure low operational friction
- accommodate long-running AI work without violating Twilio webhook timeout constraints
- enable future place memory features on top of the same platform

---

## 13. User Journey

### Journey A: text-only

1. User sends a WhatsApp message describing a place
2. Twilio verifies and forwards the request
3. Aurora App validates the request
4. Aurora App triggers `capture-agent`
5. AI resolves the place
6. AI sends message back through Twilio
7. User receives the confirmation in WhatsApp

### Journey B: image upload

1. User sends a picture and optional caption
2. Twilio includes media metadata and URL
3. Aurora App downloads supported media
4. Aurora App triggers `capture-agent`
5. AI identifies the place
6. AI sends the final message

### Journey C: invalid input

1. User sends missing or unusable data
2. App logs the event
3. App acknowledges safely and avoids pointless retries

---

## 14. Data Requirements

The current repository does not include a persistent data layer. The future product will require:

- users
- saved places
- intake events
- AI-run metadata
- Twilio message metadata
- place resolution results

The current repo is intentionally minimal and integration-first.

---

## 15. Risks

### Risk 1: Webhook timeout

Twilio requests must complete quickly; AI tasks may take longer than the allowed window.

Mitigation:

- keep webhook thin
- trigger async external task
- return empty 200 quickly

### Risk 2: Duplicate processing

Twilio may retry the same webhook.

Mitigation:

- use `MessageSid` as idempotency key

### Risk 3: Large image payloads

Large media can exceed payload limits.

Mitigation:

- restrict supported file types
- limit file size
- skip oversized media

### Risk 4: Secret misconfiguration

If secrets are missing or wrong, the product fails closed.

Mitigation:

- fail closed
- use env vars
- validate config before build and deploy

### Risk 5: Drifting contracts

The app and the AI project may diverge in payload contract.

Mitigation:

- centralize shared schema
- add contract tests

---

## 16. Acceptance Criteria

### AC1: valid message triggers AI flow

Given a valid WhatsApp message, when the webhook receives it, then the app triggers `capture-agent`.

### AC2: invalid message is handled safely

Given a message with no valid text or supported media, then the app does not trigger a paid AI run and returns HTTP 200.

### AC3: invalid Twilio signature is rejected

Given a request with an incorrect signature, then the app rejects it with HTTP 403.

### AC4: internal callback requires authorization

Given an internal notify request without a valid bearer token, then the app rejects it with HTTP 401.

### AC5: valid internal callback sends WhatsApp reply

Given a valid request body and valid Twilio config, then the app sends a WhatsApp message.

### AC6: deployment is secure

Given configured environment variables, then the app can build and deploy without exposing secrets.

---

## 17. Success Metrics

- successful capture rate
- valid webhook acceptance rate
- rejection rate for invalid requests
- Twilio send success rate
- average time from webhook to task trigger
- average time from task completion to user reply
- duplicate-run prevention rate
- cost per successful capture

---

## 18. Product Scope Recommendation

The current repository should be treated as the integration shell for the MVP, not as the complete end-user product. The current product should focus on:

- WhatsApp capture
- AI triage
- reply delivery
- secure architecture
- build and deployment readiness

The product can expand later into:

- persisted place history
- maps
- retrieval
- editing
- richer conversations

---

## 19. Open Questions

- Should the product support saved-place retrieval only in WhatsApp or in a web app too?
- Should it allow multi-turn conversational follow-ups?
- Should all capture results be stored in a database immediately?
- Is the first version focused only on place capture, or also retrieval?
- Should future versions support explicit user accounts or anonymous capture?

---

## 20. Product Recommendation

> ### Purpose

This repository is best positioned as the WhatsApp integration and message delivery layer for Aurora. The MVP should be built around:

- secure intake
- AI handoff
- secure replay-safe response delivery
- deployment stability
- a clear contract with the AI project

The repository is not yet a complete end-user application. It is a strong foundation for a real product, but it still requires persistence, tests, observability, and user-facing product work before it can be described as a full product.

---
