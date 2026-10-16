# Waymark — Threat Model

**Author:** Oyugi Mourice · **Last updated:** 2026-10-07 · **Scope:** this repository (web service, database, web app).
The `capture-agent` task has its own model.

## 1. Assets

| Asset | Why it matters |
| --- | --- |
| Twilio credentials | Send messages as Waymark, read media, spend money |
| `INTERNAL_API_SECRET` | Can make Waymark send WhatsApp messages and write users' saved places |
| `TRIGGER_SECRET_KEY` | Can start paid AI runs |
| `PHONE_HASH_KEY`, `DATA_ENCRYPTION_KEY` | Together with a database copy, reveal or confirm users' phone numbers. **Loss is unrecoverable** |
| Users' phone numbers and saved places | Personal data, possibly sensitive (home, clinics, workplaces) |
| Sessions | Equivalent to the user's identity in the web app |
| Availability and spend | A dropped message is a silent failure; AI runs cost money |

## 2. Trust boundaries and actors

* **Anonymous internet** — can reach every public URL. Must never start a run, send a message or read data.
* **Twilio** — trusted only when a valid `X-Twilio-Signature` proves it. Everything in a webhook body is untrusted input.
* **`capture-agent`** — trusted only with the shared bearer secret; even then it can only send WhatsApp messages and write
  *validated* places. Its data is still treated as untrusted when rendered.
* **A signed-in user** — can act only on their own rows, only from our origin.
* **Database provider and other third parties** — trusted to run their service, not to keep data forever.

## 3. Controls (each is tested)

| # | Threat (STRIDE) | Control | Code | Evidence |
| --- | --- | --- | --- | --- |
| C1 | **Spoofing** a WhatsApp sender / forged webhook | Twilio signature verified over PUBLIC URL + params before anything else | `twilio.post.ts`, `lib/twilioSignature.ts` | `webhook.test › authentication`; mutation-tested; e2e forged + tampered |
| C2 | Spoofing the agent | Bearer secret, constant-time compare on hashed values (no length leak), auth **before** body parsing; applies to `notify`, `places`, `capture-status` | `utils/internalAuth.ts`, `lib/internalAuth.ts` | `notify.test`, `internal.test › authentication`; mutation-tested |
| C3 | **Tampering** — malformed or oversized input | Zod contracts, `whatsapp:` addresses only, body-size caps checked before reading | `lib/contracts.ts`, handlers | `contracts.test`, `placeContracts.test`, handler tests |
| C4 | Secret abused to send SMS / spam | Destination must match `whatsapp:+E.164`; reply ≤ 1600 chars | `lib/contracts.ts` | `contracts.test` |
| C5 | **SSRF / credential theft** via `MediaUrl` | First hop pinned to `api*.twilio.com`; credentials on that hop only; manual, https-only, public-hostname redirects | `lib/twilioMedia.ts` | `twilioMedia.test`; mutation-tested |
| C6 | **DoS** via huge or slow media | 5 MB streamed cap; 3.5 s per hop, 5 s total; ≤ 3 redirects | `lib/twilioMedia.ts` | `twilioMedia.test` |
| C7 | Disguised file | Type from magic bytes | `sniffImageType` | `twilioMedia.test` |
| C8 | **Repudiation** | Request id on every request; structured logs with message SID | `middleware/00.request-context.ts`, `lib/logger.ts` | `ops.test` |
| C9 | **Information disclosure** via logs | Numbers masked everywhere (also inside third-party error text); no message text, credentials, sign-in codes or tokens | `lib/logger.ts` | `logger.test`, `journey.test` (code and tokens), `webhook*.test`, e2e |
| C10 | Disclosure via errors | Generic 500s; DB errors never returned; no hint which check failed (401/404 look alike) | handlers | `journey.test`, `internal.test`, `webhook.test` |
| C11 | Browser attacks on public pages | `script-src 'none'` CSP, HSTS, nosniff, frame, referrer, permissions; zero JS | `shared/security.ts` | smoke test; CI `check:headers` |
| C12 | **DoS** via a hung dependency | Hard deadlines: database 1.5 s, Trigger.dev 3.5 s, apology 2.5 s, readiness 2 s; bounded retries; DB statement timeout 5 s | `lib/deadline.ts`, `lib/db/pg.ts` | hang tests for each; mutation-tested; `pg.test` |
| C13 | Duplicate paid runs on redelivery | `MessageSid` idempotency key; rate events and captures are unique on it | `twilio.post.ts`, `repos/*` | e2e wire-level; `accounting.test` |
| C14 | **Elevation** via misconfiguration | Fail closed; build gate validates every secret incl. DB URL and keys (distinct, not placeholders); `/api/ready` also checks DB and schema version | `lib/config.ts`, `scripts/check-env.ts` | `config.test`, `ops.test`, gate run on bad values |
| C15 | Vulnerable dependencies | Audit gate with expiring exceptions; Dependabot; CodeQL | `scripts/audit-gate.mjs`, `.github/` | gate run both directions |
| C16 | Secrets in git | gitleaks in CI; `.env*` ignored; history scanned | CI | §5 |
| C17 | Indexing of operational/private routes | `/api/**` and `/app` `noindex` + `no-store`; `robots.txt` disallows both | `nuxt.config.ts`, `lib/seo.ts` | smoke, `seo.test` |
| C18 | **SQL injection** | Parameterised queries only; ids validated as UUIDs; pagination cursors validated; enums validated | `repos/*` | injection strings in `places.test`, `auth.test`, `internal.test` |
| C19 | **Broken access control (IDOR)** | Every user-data query is scoped by the session's `user_id`; "not yours" = 404; a user's `Origin`/ids never widen access | `repos/places.ts`, `users.ts`, handlers | `places.test`, `journey.test › isolation`; **mutation-tested** |
| C20 | **CSRF** | `Origin` must equal `PUBLIC_URL` on every state-changing route (Fetch Metadata fallback); `SameSite=Lax` session cookie | `lib/http.ts`, `utils/auth.ts` | `http.test`, `journey.test › CSRF`, smoke; **mutation-tested** |
| C21 | **Session theft / fixation** | 256-bit random token, only its SHA-256 stored; `__Host-` `HttpOnly` `Secure` cookie; 30-day absolute and 7-day idle expiry; server-side revocation; new token per sign-in | `repos/sessions.ts`, `utils/auth.ts` | `auth.test`, `journey.test` |
| C22 | **Sign-in attacks** (guessing, replay, someone else collecting the session) | Hashed single-use 5-min codes; browser-binding cookie; atomic consume; 10 attempts/hour/sender; per-IP and global challenge limits; ordinary messages cannot be mistaken for sign-in | `repos/challenges.ts`, `lib/login.ts` | `auth.test` (concurrency), `accounting.test`, `journey.test`; **mutation-tested** |
| C23 | **Cost abuse / flooding** | Per-sender hourly and daily limits and a global daily budget, enforced **before** media download and AI run; notice once; redelivery-safe | `lib/accounting.ts` | `accounting.test`, `webhook-db.test`, e2e (22 messages → 20 runs); **mutation-tested** |
| C24 | **Disclosure of phone numbers at rest** | Keyed HMAC for lookup + AES-256-GCM for the sendable copy; separate keys; no clear text in any table | `lib/crypto.ts` | `crypto.test`, `users.test`, e2e dump scan |
| C25 | **XSS in the web app** | Everything from the database/agent rendered with `textContent`; links only from validated `https` URLs; `script-src 'self'` CSP; banned APIs enforced by lint + source-scan test; DB `CHECK` on `maps_url` | `public/app-static/*`, migration | 54 client tests with XSS payloads in every field; `places.test` constraints; mutation-tested |
| C26 | **Untrusted agent data** | Zod validation (ranges, lengths, control characters, https) then DB constraints again | `lib/contracts.ts`, migration | `placeContracts.test`, `internal.test` |
| C27 | **Erasure and portability** | `DELETE /api/me` removes everything that cascades + orphaned places; export of all held data; limits survive erasure on purpose | `repos/users.ts` | `users.test`, `journey.test`, e2e |
| C28 | **Transport to the database** | TLS with verification forced for any non-loopback host (the URL cannot disable it); timeouts; pool of ≤ 3 | `lib/db/pg.ts` | `pg.test` |
| C29 | **Migration integrity** | Checksummed forward-only migrations; advisory lock; edited-after-apply is an error; failed migration rolls back fully | `lib/db/migrate.ts` | `migrate.test` |

## 4. Residual risks (ranked) and what to do

| ID | Risk | Severity | Mitigation today | Next step |
| --- | --- | --- | --- | --- |
| **R1** | **Cost flooding via many different numbers.** Per-sender and global limits exist (C23), but an attacker with many WhatsApp numbers is bounded only by the global budget; limits are not atomic (small overshoot); fail open during a DB outage (ADR-008) | **Medium** (was High) | 20/h, 100/day per sender; 5,000/day global | Set hard **spend caps at the AI provider and Twilio** (launch checklist C); alert on `rate limited` volume |
| **R2** | **Loss or leak of `PHONE_HASH_KEY` / `DATA_ENCRYPTION_KEY`.** Loss → users cannot be recognised or messaged; leak + database copy → numbers revealed | **Medium–High** | Keys validated, distinct, never logged; secrets are in the build artifact | Back both up in a secrets manager; restrict artifact access; plan a **key-rotation migration** (decrypt with old, re-encrypt and re-hash with new, in one transaction) — **not built** |
| R3 | Secrets are inside the build artifact; rotation needs a rebuild (ADR-001) | Medium | Config gate; no `.env` on the build disk | Secrets Manager (ADR-001 exit path) |
| R4 | `notify` retries after a timeout can send a message twice | Low–Medium | `422` stops retrying permanent errors | Idempotency key on `notify` (the database now makes this possible) |
| R5 | **Sign-in is only as strong as the user's WhatsApp account** (SIM swap, WhatsApp takeover) | Medium | 7-day idle expiry, revocable sessions, self-service erasure, signed-in-as number shown | Optional: re-authenticate before account deletion/export |
| R6 | Prompt injection through user text or photos | Medium | Content passed through unchanged and size-capped; replies go only to the sender | Agent-side: no side-effecting tools; treat model output as untrusted (this service already does) |
| R7 | **Shared place catalogue is overwritten by any capture** that carries the same `providerPlaceId`; a faulty agent could corrupt a place for all users | Low–Medium | Bearer-only; DB constraints on shape | Only send `providerPlaceId` for trusted provider ids; consider per-user copies |
| R8 | **Client-IP detection behind the CDN is unverified** (rightmost `X-Forwarded-For`). If wrong, sign-in rate limiting is either too loose or shares one bucket | Medium | Falls back to one generous bucket; per-sender limits unaffected | **Verify on the live site** (launch checklist B) |
| R9 | Personal data at providers: Trigger.dev payloads include the base64 photo; Twilio keeps messages/media; **database backups contain phone numbers and places and outlive erasure** | Medium | Disclosed in the Privacy Policy | Shortest sensible retention at each provider; document backup retention; check erasure-vs-backup policy with counsel |
| R10 | SSRF via DNS rebinding on redirect hostnames | Low | First hop pinned to Twilio; later hops Twilio-chosen, https-only | Resolve and validate IPs if redirects ever become attacker-influenced |
| R11 | One shared internal secret, no per-caller identity | Low–Medium | Long random secret, constant-time compare | HMAC-signed requests with timestamp |
| R12 | Webhook signature has no timestamp (replay) | Low | `MessageSid` idempotency neutralises replays | — |
| R13 | Build-tooling advisories with no upstream fix (`braces`, `node-forge`, `simple-git`) | Low | Not in the deployed bundle (gate-checked); exceptions expire 2026-12-01 | Re-review on expiry |
| R14 | Application logs retained indefinitely by default | Medium | Logs hold no content and masked numbers | Set CloudWatch retention (~30 days) |
| R15 | Single region; cold starts; Twilio will not retry 5xx; managed-database outage | Low–Medium | Fail-open accounting; user told to resend | Uptime check on `/api/ready`; provider HA options |
| R16 | The web app has no framework-level type checking and a manually maintained bundle-less module set | Low | Lint rules, source-scan test, 54 client tests | Revisit if the app grows beyond one screen |

## 5. What was verified, and what could not be

**Verified in development:** 518 automated tests across unit, **real-PostgreSQL**, HTTP-integration and
simulated-browser suites, with mutation checks that disable a control (Twilio signature, internal auth, credential
forwarding, deadlines, owner check on delete, browser-binding check, rate limits, sign-in interception, CSRF check, client
URL filter, stale-poll guard, capture-status scoping) and confirm the tests fail; the dependency audit gate both ways; a
clean `npm ci`; lint and typecheck; the built server probed by `npm run smoke` (38 checks) and by
`npm run e2e:local` (43 checks: real Twilio signatures, mock Trigger.dev API, real PostgreSQL, full sign-in → save →
rate-limit → export → erase journey, and a scan showing no phone number, code or token at rest); git history scanned.

**Not verifiable without your accounts** (launch tasks): behaviour on real Amplify (static header delivery, CDN caching,
client-IP header), real Twilio/WhatsApp delivery, real Trigger.dev idempotency, a managed PostgreSQL provider (pooler, TLS
chain), real mobile browsers, Lighthouse/axe, and Search Console. See [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md).
