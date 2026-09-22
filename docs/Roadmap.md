# Aurora Roadmap

Repository: sahildavid-dev/aurora-app  
Default branch: main  
Status: prioritized roadmap for MVP and productization

## Executive Summary

This roadmap is designed for a realistic implementation path from the current codebase to a production-ready Aurora product.

The repo is currently a working integration prototype, not a complete application. It already contains the critical architecture for:

- Twilio WhatsApp intake
- media extraction
- Trigger.dev task handoff
- internal callback to send replies
- secure secret handling

The highest-priority work is to stabilize this system, add tests, document contracts, add operational visibility, and then add persistence and user-facing product features.

---

## Roadmap Overview

### Phase 0: Local Dev Setup and End-to-End Validation

Priority: P0  
Effort: 0.5–1 day  
Goal: prove the repo works end to end in a local environment

### Phase 1: Stabilize the Existing Integration

Priority: P0  
Effort: 2–4 days  
Goal: make the current flow reliable and testable

### Phase 2: CI/CD and Observability

Priority: P0  
Effort: 2–4 days  
Goal: prevent regressions and make failures diagnosable

### Phase 3: Formalize Cross-Repo Contracts

Priority: P0  
Effort: 2–5 days  
Goal: prevent drift between `aurora-app` and `aurora-agents`

### Phase 4: Improve User Feedback and Recovery

Priority: P1  
Effort: 3–6 days  
Goal: make the WhatsApp experience clear and robust under failures

### Phase 5: Add Persistence for Captured Places

Priority: P1  
Effort: 1–2 weeks  
Goal: move from integration layer to a real product foundation

### Phase 6: Build the Aurora Web Experience

Priority: P1  
Effort: 2–4 weeks  
Goal: replace placeholder UI with actual product app

### Phase 7: Support Follow-Up Conversations

Priority: P2  
Effort: 1–3 weeks  
Goal: allow clarification and retrieval flows

### Phase 8: Production Hardening and Scale

Priority: P2  
Effort: 1–3 weeks  
Goal: production readiness and operational safety

---

## Phase 0: Local Dev Setup and End-to-End Validation

### Objective

Make the repo run reliably in a developer environment and confirm the full WhatsApp-to-agent-to-reply flow works.

### Effort

0.5–1 day

### Tasks

- fork the repo
- clone and install dependencies
- create `.env` from `.env.example`
- configure Twilio credentials
- configure Trigger.dev access
- validate `capture-agent` exists and is accessible
- run Nuxt locally
- expose the app through ngrok
- set `PUBLIC_URL`
- verify Twilio webhook and callback behavior

### Deliverables

- working local environment
- authenticated end-to-end message flow
- documented setup guide
- deployment checklist

### Exit criteria

- inbound WhatsApp message triggers `capture-agent`
- valid callback reaches `/api/internal/notify`
- user receives Twilio outbound reply
- local environment can be reproduced by another developer

---

## Phase 1: Stabilize the Existing Integration

### Objective

Hardening the code that already exists so it is reliable and safe for repeated use.

### Effort

2–4 days

### Tasks

- add unit tests for validation logic
- add tests for Twilio webhook behavior
- add tests for internal notify flow
- register missing config validation
- add structured logs
- add health endpoint
- add handling for malformed input and unsupported media
- verify idempotency behavior with `MessageSid`
- test retry semantics with Twilio

### Deliverables

- automated test suite
- route-level test coverage
- health endpoint
- clearer failure handling
- robust config validation

### Exit criteria

- invalid requests are rejected or ignored safely
- duplicate Twilio deliveries do not trigger duplicate paid AI runs
- app fails closed and logs actionable errors
- core flow can be exercised without real payout events in tests

---

## Phase 2: CI/CD and Observability

### Objective

Prevent regression and improve production transparency.

### Effort

2–4 days

### Tasks

- add GitHub Actions workflow
- run lint, type-check, tests, and build in CI
- add structured logs
- add request IDs and traceability
- log Twilio message IDs and Trigger.dev run IDs
- define alerting strategy
- document production deployment verification
- add post-deploy smoke checks

### Deliverables

- CI pipeline
- build and test gates
- observability baseline
- deployment runbook

### Exit criteria

- no merge without passing checks
- errors can be traced across Twilio / app / Trigger.dev
- deployment success can be confirmed from logs and traces

---

## Phase 3: Formalize Cross-Repo Contracts

### Objective

Prevent contract drift between `aurora-app` and `aurora-agents`.

### Effort

2–5 days

> ### Tasks

- define shared request shape
- define shared response shape
- define contract for internal notification
- treat the payload schema as versioned API contract
- create shared TypeScript types or schema package
- add contract tests
- document compatibility expectations

### Deliverables

- shared contract package or schema
- versioning plan
- contract test suite
- compatibility doc

### Exit criteria

- both repos validate the same payload contract
- team can detect breaking changes before deployment
- API communication remains predictable

---

## Phase 4: Improve User Feedback and Recovery

### Objective

Make the product understandable and resilient when the AI flow is slow, ambiguous, or temporarily fails.

### Effort

3–6 days

### Tasks

- send acknowledgment like “I’m checking that place”
- define fallback behavior for empty results
- define failure responses for agent errors
- define handling for ambiguous place matches
- support short clarifying prompts
- improve message formatting and truncation rules
- define queue or retry strategy for transient provider errors

### Deliverables

- user-facing status messages
- failure handling scheme
- ambiguity resolution flow
- better message UX

### Exit criteria

- users receive helpful output when the agent cannot confidently resolve a place
- temporary failures are recoverable without silent failure
- the user sees a clear, low-friction chat experience

---

## Phase 5: Add Persistence for Captured Places

### Objective

Turn the system from a message bridge into a real place-memory product.

### Effort

1–2 weeks

### Tasks

- choose database and ORM/tooling
- define `User`, `Capture`, and `Place` models
- store incoming message metadata
- store AI-run status
- persist resolved place details
- store coordinates and external IDs
- create capture history
- add idempotency table or checks
- add place write endpoint if needed
- add migration tooling

### Suggested schemas

#### User

- id
- whatsappNumber
- createdAt
- updatedAt

#### Capture

- id
- userId
- messageSid
- rawText
- mediaMetadata
- status
- agentRunId
- createdAt
- completedAt

#### Place

- id
- userId
- name
- address
- latitude
- longitude
- externalPlaceId
- source
- notes
- createdAt
- updatedAt

### Deliverables

- database layer
- persistence APIs
- capture history
- place records
- idempotent save logic

### Exit criteria

- successful place captures persist cleanly
- duplicate requests do not duplicate place records
- place records are retrievable later

---

## Phase 6: Build the Aurora Web Experience

### Objective

Replace the placeholder landing page with a real product experience.

### Effort

2–4 weeks

### Tasks

- build app shell
- create saved places dashboard
- create place detail page
- add map visualization
- add search and filtering
- add edit/delete flows
- add mobile-responsive layout
- add empty states and loading states
- add accessible components
- add authentication or secure access if needed

### Deliverables

- functional web app for saved places
- map and detail experience
- user-friendly product interface
- mobile-friendly design

### Exit criteria

- users can view saved places outside WhatsApp
- users can search or filter place records
- users can inspect place details
- product feels like a real application, not a placeholder

---

## Phase 7: Support Follow-Up Conversations

### Objective

Allow users to ask clarifying or retrieval questions about previously captured places.

### Effort

1–3 weeks

### Tasks

- add conversation/session IDs
- store or summarize message history
- support place correction
- support retrieval queries
- support ambiguous-place prompts
- define context windows and conversation lifecycle
- define user privacy practices

### Deliverables

- conversation support for follow-up actions
- retrieval queries
- correction flows
- clearer agent memory management

### Exit criteria

- user can ask for correction or clarification
- user can revisit saved places
- conversation stays bounded and understandable

---

## Phase 8: Production Hardening and Scale

### Objective

Prepare the repo for broader real-world usage.

### Effort

1–3 weeks

### Tasks

- add rate limiting
- add request replay protection
- add secret rotation strategy
- add DB indexes
- add queue/backpressure strategy if needed
- add load test and performance baseline
- add cost monitoring for Twilio and Trigger.dev
- add deletion policy and privacy controls
- add incident runbook and failover documentation

### Deliverables

- production hardening plan
- operational docs
- security review
- scale plan

### Exit criteria

- system handles expected load safely
- costs are measurable
- privacy and deletion workflows exist
- critical failures are manageable

---

## Priority Summary

### P0 (must do first)

- local end-to-end validation
- integration stabilization
- CI/CD setup
- observability
- contract formalization

### P1 (important before productizing)

- persistence
- improved user feedback
- web experience
- metrics and operational readiness

### P2 (future product expansion)

- follow-up conversations
- heavy scaling/security work
- advanced product experience

---

## Recommended MVP Definition

A realistic MVP should include:

- valid inbound Twilio webhook handling
- secure Twilio signature validation
- support for text and image input
- Trigger.dev async task orchestration
- callback-based outbound reply
- internal secret authorization
- deployment-ready configuration
- basic observability
- tests and CI
- basic persistence for captures

### This repo already has the foundation for

- webhook intake
- media extract
- AI task handoff
- secure reply sending

### This repo still lacks

- tests
- CI
- persistence
- user-facing app
- operational hardening
- final product polish

---

## Final Recommendation

Do not treat this repository as a final product yet. Treat it as a robust integration foundation. The correct first milestone is:

1. prove the flow end-to-end
2. stabilize and test the current integration
3. formalize the contracts
4. add persistence
5. grow the app into a full Aurora experience

This roadmap gives a reasonable path from the current code to a product that can realistically serve users.
