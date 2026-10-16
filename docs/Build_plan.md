# Waymark — Build Plan and Status

**Author:** Oyugi Mourice · **Last updated:** 2026-10-07 · Supersedes the status in [`Roadmap.md`](Roadmap.md).

✅ built and verified in this repository · 🔧 needs you / your accounts (cannot be done or verified here)

## 1. At a glance

| Phase | Outcome | Status |
| --- | --- | --- |
| 0 | Repository hygiene, dependency health, quality gates | ✅ (one manual git step, §5) |
| 1 | Stabilise the integration: validation, health, logging, tests, CI | ✅ |
| 2 | WhatsApp experience: failure messages, photo handling | ✅ · 🔧 agent adopts the contract |
| 3 | Public website with SEO and AEO | ✅ |
| 4 | Security hardening and operations | ✅ · 🔧 live verification, Secrets Manager (optional) |
| 5 | **Persistence** (PostgreSQL, migrations, encryption, erasure, export) | ✅ |
| 6 | **Sign-in and saved-places web app** | ✅ · 🔧 agent must call `/api/internal/places` for it to fill |
| 7 | **Abuse and cost controls** (per-sender + global limits) | ✅ · 🔧 provider spend caps |

## 2. What was built in this iteration (Phases 5–7)

* **Database:** 7 tables, constraints that do security work (`https`-only map links, coordinate ranges, length limits), forward-only
  checksummed migrations with an advisory lock, `npm run db:migrate` / `db:status`, a protected GitHub workflow for production,
  `/api/ready` that verifies connectivity **and** schema version.
* **Privacy by design:** phone numbers stored as a keyed hash + AES-256-GCM ciphertext; no message text or photos in the
  database; abuse-limit records are unlinked from accounts and pruned after ~48 h.
* **Sign-in:** WhatsApp-initiated, passwordless, single-use, browser-bound, rate-limited (ADR-005).
* **Web app (`/app`):** list, search, paginate, open in maps, remove, **download my data**, sign out, **delete my account**;
  own strict CSP; XSS-proof rendering.
* **Rate limits:** 20/hour and 100/day per sender, 5,000/day global, enforced before any paid work; notice once; fail-open on
  database trouble (ADR-008).
* **Agent endpoints:** `POST /api/internal/places` and `/capture-status`; [integration guide](AGENT-INTEGRATION.md).
* **Docs and policies:** architecture (7 diagrams), threat model (29 controls), runbook, ADRs, **privacy policy and terms updated
  to match what is stored**.

## 3. Remaining work — all needs you

1. **Agent adoption** (other repository): call `places` and `capture-status`; handle `notify`'s `422/429/5xx` semantics; apologise on failure.
2. **Provision and verify real infrastructure** (managed PostgreSQL, Amplify, Twilio production sender, Trigger.dev production) and
   tick the [launch checklist](LAUNCH-CHECKLIST.md) (§B items were impossible to run offline: client-IP header, CDN headers/caching,
   real-phone sign-in, real Trigger.dev idempotency).
3. **Legal review** and the **licence/provenance** question.
4. **Optional, later:** Secrets Manager (ADR-001 exit path); key-rotation migration script; idempotency key for `notify`;
   per-user copies of shared places (risk R7).

## 4. Corrections made to the earlier documents

| Where | It said | Reality |
| --- | --- | --- |
| README, PRE-README, Technical Spec | A 5xx makes Twilio retry; a 4xx would cause retries | Twilio's default retry policy covers connection failures only (ADR-003) |
| Technical Spec | `.env` written during the Amplify build | No longer written; variables reach the build as environment variables |
| Earlier `robots.txt` | Allowed everything including `/api/` | Generated; disallows `/api/` and `/app`, links the sitemap |
| `.gitignore` vs git | `node_modules`, `.output`, `.nuxt` were ignored | They were **committed** on `main` (~25,000 files); remove them (checklist E) |
| My own v0.1 privacy policy | "does not store your messages in a database" | Now false in spirit (phone numbers and saved places are stored); **rewritten** |

## 5. Verification evidence

| Check | Result |
| --- | --- |
| `npm ci` with stock npm 10 | ✅ reproducible |
| `npm run lint` · `npm run typecheck` | ✅ clean |
| `npm run test:coverage` | ✅ 518 tests; thresholds met (lines/functions ≥ 90 %, branches ≥ 80 %) |
| Database tests | ✅ run against a **real PostgreSQL 16**, in isolated schemas; they fail (not skip) if it is unreachable |
| Mutation checks | ✅ each disabled security control was caught (signature, internal auth, credential forwarding, deadlines, owner check, browser binding, rate limits, sign-in interception, CSRF, URL filter, stale-poll guard, capture scoping) |
| `npm run audit:gate` | ✅ passes; fails correctly when an exception is removed or expired |
| Production build, Amplify preset | ✅ runtime `nodejs22.x`; public pages have no executable script; `/app` has exactly one same-origin module script |
| `npm run smoke` against the built server | ✅ 38/38 |
| `npm run e2e:local` (real PostgreSQL, mock Trigger.dev, real signatures) | ✅ 43 checks, repeatable |
| YAML, Mermaid, markdown links | ✅ parsed / resolved |

**Not verifiable here:** real Twilio/WhatsApp/Trigger.dev/AWS/managed-Postgres behaviour, real mobile browsers, Lighthouse/axe,
Search Console. See [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md).
