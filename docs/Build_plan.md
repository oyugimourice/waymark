# Waymark — Build Plan and Status

**Author:** Oyugi Mourice · **Last updated:** 2026-10-07 · Supersedes the status in [`Roadmap.md`](Roadmap.md).

✅ built and verified · 📐 designed, not built · ⛔ blocked on a decision or an account only you have

## 1. At a glance

| Phase | Outcome | Status |
| --- | --- | --- |
| 0 | Repository hygiene, dependency health, quality gates | ✅ (one manual git step, §5) |
| 1 | Stabilise the integration: validation, health, logging, tests, CI | ✅ |
| 2 | WhatsApp experience: failure messages, photo handling | ✅ partly · 📐 acknowledgement, clarification (agent-side) |
| 3 | Public website with SEO and AEO | ✅ |
| 4 | Security hardening and operations | ✅ partly · 📐 Secrets Manager, alarms as code |
| 5 | Persistence | ⛔ needs ADR-004 |
| 6 | Sign-in and saved-places web app | ⛔ needs Phase 5 and ADR-005 |
| 7 | Abuse and cost controls (per-sender limits) | ⛔ needs Phase 5 (stopgap: provider spend caps) |

## 2. Phase detail

### Phase 0 — Foundations ✅
* Dependencies: every advisory with a compatible fix was applied (axios, undici, the `ws` chain, vitest, and
  `vue` / `@vue/server-renderer` 3.5.43, which fixed an SSR XSS advisory). Six distinct advisories remain, all in
  Nuxt build/dev tooling (`braces`, `node-forge`, `simple-git`), none present in the deployed bundle, each with an
  expiring exception ([ADR-007](DECISIONS.md#adr-007)).
  Never run `npm audit fix --force` here: it proposes *downgrading* Nuxt to 3.15.1.
* Lockfile verified reproducible with stock npm 10 (`npm ci`).
* Branding unified (Waymark), package renamed, Node 22 pinned (`.nvmrc`, `engines`, compute runtime).

### Phase 1 — Stabilise the integration ✅
Config validation + build gate · `/api/health` and `/api/ready` · structured, PII-safe logging with request ids ·
224 automated tests · ESLint + typecheck · GitHub Actions (CI, CodeQL, gitleaks, Dependabot) · local black-box
smoke and end-to-end tests against a mock Trigger.dev API.
*Not yet done:* confirming Trigger.dev idempotency against the **real** service (launch checklist B).

### Phase 2 — WhatsApp experience
✅ Failure messages when hand-off fails; clear message when a photo is unusable; bounded time budgets.
📐 **Immediate acknowledgement** ("Looking into it…") — best sent by the agent as its first step via `notify`, so it
adds no latency to the webhook. 📐 **Ambiguous-place clarification** and reply formatting — agent-side.
*Acceptance:* a user always receives either an answer or an explanation within 2 minutes.

### Phase 3 — Public website, SEO and AEO ✅
Home, Privacy, Terms; zero-JS pages; strict CSP; JSON-LD; sitemap, robots, `llms.txt`; social card; icons; WCAG AA
contrast enforced by test. Details in [`SEO-AEO.md`](SEO-AEO.md).
*Needs from you:* contact email, legal review, final domain (launch checklist A and D).

### Phase 4 — Security hardening and operations
✅ Threat model with 17 tested controls ([`THREAT-MODEL.md`](THREAT-MODEL.md)); runbook; launch checklist; smoke test.
📐 **Secrets Manager** (ADR-001 exit path) · 📐 **CloudWatch alarms as code** · 📐 **idempotency key for `notify`**.
*Acceptance:* a secret can be rotated without a rebuild; an error in production pages someone.

### Phase 5 — Persistence ⛔
Schema in ARCHITECTURE §10.1; PostgreSQL recommended (ADR-004). Work: migrations, repository layer, internal write
endpoints for the agent (`POST /api/internal/captures`, `/places`), retention and erasure jobs, backups.
*Size:* medium. *Acceptance:* every completed capture is stored once (idempotent on `message_sid`); a user's data can be
exported and erased.

### Phase 6 — Sign-in and web app ⛔
WhatsApp-initiated login (ADR-005), places list and map, delete, export. Separate nonce-based CSP; authorisation by
`user_id` on every query; CSRF protection on mutating routes. *Size:* large.

### Phase 7 — Abuse and cost controls ⛔
Per-sender and global rate limits with a shared counter; daily AI-run budget with a friendly "come back tomorrow"
reply; `notify` idempotency. *Size:* small once Phase 5 exists. **Until then, set provider spend caps.**

<a id="decisions-needed-from-you"></a>
## 3. Decisions needed from you

1. **Licence/provenance** — written permission from the original author, and how to attribute (launch checklist A).
2. **Database provider and region** (ADR-004), and whether storing phone numbers is acceptable (changes the privacy policy).
3. **Production WhatsApp sender** — number and display name.
4. **Final domain** and the contact mailbox.
5. **Spend limits** you are comfortable with for the AI provider and Twilio.
6. **Whether to move secrets to AWS Secrets Manager now** (ADR-001) or after launch.

## 4. What changed in this iteration

* **Security:** media download hardened (host allow-list, SSRF guard, no credential forwarding, streamed size cap, real
  type detection); constant-time auth without length leak; generic error messages; PII-safe logging (a real leak of a
  number inside a third-party error message was found by a test and fixed); body-size limits; hard time budgets.
* **Reliability:** user is told when processing fails (Twilio does not retry 5xx); precise `notify` error semantics;
  grapheme-safe truncation (the old `slice` could cut an emoji in half and produce an invalid message).
* **Site:** new pages, SEO and AEO surfaces, strict CSP, brand assets.
* **Tooling:** tests, lint, typecheck, CI, audit gate, config gate, header generator, smoke and e2e scripts.
* **Docs:** this set. The earlier README, PRD and Technical Spec remain as written, with corrections noted below.

## 5. Corrections to the earlier documents

| Where | It said | Reality |
| --- | --- | --- |
| README, PRE-README, Technical Spec | A 5xx makes Twilio retry; a 4xx would cause retries | Twilio's default retry policy covers connection failures only. Patched in README; see ADR-003 |
| Technical Spec | `.env` written during the Amplify build | No longer written; variables reach the build as environment variables |
| Earlier `robots.txt` | Allowed everything including `/api/` | Replaced by a generated file that disallows `/api/` and links the sitemap |
| `.gitignore` vs git | `node_modules`, `.output`, `.nuxt` were ignored | They were **committed** on `main` (~25,000 files). Remove them (launch checklist E) |

## 6. Verification evidence

| Check | Result |
| --- | --- |
| `npm ci` with stock npm 10 | ✅ reproducible |
| `npm run lint` · `npm run typecheck` | ✅ clean |
| `npm run test:coverage` | ✅ 224 tests; thresholds met (lines/functions ≥ 90 %, branches ≥ 80 %) |
| Mutation checks (signature, internal auth, credential forwarding, deadline) | ✅ each caught by the tests |
| `npm run audit:gate` | ✅ passes; fails correctly when an exception is removed or expired |
| Production build, Amplify preset | ✅ runtime `nodejs22.x`; home page has no executable script |
| `npm run smoke` against the built server | ✅ 25/25 (26 over HTTPS) |
| `npm run e2e:local` | ✅ real signature in; Trigger.dev wire format, auth and idempotency verified; outage → 502; logs leak-free |
| YAML (`amplify.yml`, workflows) | ✅ parsed (this caught a real error in an inline command) |
| Mermaid diagrams | ✅ parsed by the real Mermaid parser |

**Not verifiable here:** real Twilio/WhatsApp/Trigger.dev/AWS behaviour, Lighthouse/axe, Search Console. See
[`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md).
