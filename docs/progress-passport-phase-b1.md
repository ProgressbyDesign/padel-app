# Progress Passport — Phase B.1 validation and hardening

**Follow-up, 3 November 2026:** the local Docker/Supabase blocker below is resolved. The complete available application chain, real Auth/JWT/REST/RLS, lifecycle and concurrency tests passed on an isolated local Supabase stack. See [the local validation follow-up](progress-passport-local-supabase.md) for the baseline/default-grant correction, loopback guard, evidence and remaining release decisions. The report below records the original 30 October results.

30 October 2026. **Local database validation passed; full Supabase staging validation remains blocked.** No production migration, production data mutation, deployment, push or merge occurred. No Cloudflare or payment calls were added. Stop here; Phase C is not started.

## Environment and migration identity

Read both Phase A/B handoffs and inspected `master`, its working tree, the migration chain, Passport domain modules, existing admin permissions, booking/payment code and tests. Phase B files were already untracked; `backups/` and `design-system/` were also already present. They were preserved. No tracked application/auth/booking/email implementation file changed in B.1.

Read-only Supabase project/branch/migration metadata identified `Padel Listing` / `uebhforyugmvpqvkzrbt` as the existing production project, PostgreSQL 17.6, with only its default `main` branch. It was **not** treated as staging. The unrelated project was not used. Production's latest recorded application migration was `20260928090000_claim_registration_admin_notification`; the three Passport migrations were absent. No remote mutation RPC, migration, fixture or test ran.

Docker Desktop could not start: its backend failed while opening the local `sailor-ingest.sock` file. No system socket/configuration was changed. Consequently a complete local Supabase stack could not be started.

Actual test database: a newly initialized native PostgreSQL **17.6**, bound only to **127.0.0.1:55439**, user `postgres`, synthetic data and local trust authentication. Cluster directory:

`C:/Users/Mateusz Paliga/.codex/.chatgpt-projects/g-p-69d94c4047d88191abf5b95ae0d82436/.phase-b1-local/data`

The runner queries server address, port, database, version and the real cluster directory before any role/database creation. It refuses a different directory or non-loopback identity. It accepts no remote database URL and does not read app environment credentials. It creates only uniquely named `passport_b1_*` databases and drops only databases it created. Temporary PostgreSQL binaries (`@embedded-postgres/windows-x64@17.6.0-beta.15`) and `pg@8.16.3` live outside the app; no app dependency or lockfile changed.

### Full application schema replay

The repo's migration directory begins at Sprint 6A and does not contain the original empty-database baseline. Simply replaying those migrations on an empty database fails because `public.profiles` does not exist. The schema-only backup `backups/pre-sprint6a/schema.sql` supplies the missing public/private application baseline. Its SHA-256 is:

`3a3f1c3ce371a5c2bd1699d1824b13bf004f6baee969808c8750d403f47549f2`

**No customer-data backup was imported.** The runner pins that schema hash and requires review if it changes. The backup remains an existing untracked reference, not a newly committed baseline. A portable, reviewed baseline/history restoration is still needed for standard `supabase db reset` from a fresh checkout.

Native-platform compatibility is explicit: bootstrap `anon`, `authenticated`, `service_role` (BYPASSRLS) and platform roles; provide minimal `auth.users` and the standard JWT-setting-based `auth.uid/jwt/role` functions; create extension/publication namespaces. Load all baseline public/private tables, functions, policies, triggers, grants and default privileges. Omit only the unavailable, application-unused **Supabase Vault extension creation statement**. Other baseline extensions load normally. Two synthetic listings satisfy the historical Sprint 6A migration's embedded assertions. This is broader than the Phase B harness, but **does not recreate GoTrue, PostgREST, Storage, Vault or the complete managed Auth schema**.

All **20 repository migrations** replayed in filename order on **two fresh databases**, including the complete 17-file existing application chain and these three pending Passport files:

1. `20261030222020_progress_passport_foundation.sql`
2. `20261030222021_progress_passport_operations.sql`
3. `20261030222023_progress_passport_draft_curriculum.sql`

Ordering, foreign keys, constraints, indexes, functions, triggers, role grants, default privileges and RLS all loaded successfully. Comparing **253 legacy function/policy/relation/trigger definitions and ACL entries** immediately before and after Passport produced the same fingerprint. This verifies the inspected legacy objects are not rewritten; it is not a managed-project schema-drift certification.

Both fresh replay databases retain `private.pp_runtime.enabled=false`. The lifecycle fixture enables it inside a rolled-back transaction. Real concurrent operations necessarily need a committed enabled flag: **only a third, disposable synthetic test clone** was temporarily enabled, then explicitly disabled, checked and dropped. No application or production release switch was enabled. The runner removes all three databases, including on failure.

The two unapplied foundation/operations migrations were hardened **in place**, because production metadata confirms neither has been applied. The third sample-content migration is unchanged. No historical/applied migration was edited. If another environment has already applied Phase B, use a reviewed additive correction migration there; do not repair history or assume these edited files will rerun.

## Issues found and fixes

1. **Eligibility race with legacy writes.** Passport's shared advisory lock serializes its own commands, but existing coach approval and membership changes do not take that lock. Added `private.pp_lock_eligible`: lock the explicit assessor grant, coach and named membership rows `FOR SHARE`, then recheck eligibility. Offer creation, order creation, review start/completion, reassignment and media readiness now use it. Legacy suspension/removal either commits first and blocks the decision, or waits for the authorised decision to commit. No lock is held across a network call.
2. **Review target included lock-wait time.** `now()` is the transaction-start timestamp. Readiness and review transitions now capture `clock_timestamp()` after relevant locks/validation. Availability, submitted/processed times and deadline use one accepted-transition timestamp. Replacement remaining time and recorded review/delivery timestamps also use actual transition time. A queued readiness test checks it does not start before the lock is released.
3. **Quotes could be mistaken for earnings.** The existing immutable order `commission_minor`/`coach_earnings_minor` fields are purchase quotes. Added the RLS-respecting, `security_invoker` view `pp_delivered_earnings`. It has no row until confirmed payment provenance and a completed Developing/Verified review exist. Refund requests conservatively hold recognised amounts at zero; confirmed full refunds retain the delivered provenance with zero commission/coach earnings. This is **reporting, not a settlement balance, payout ledger or transfer**. No earnings record is derived from a pending payment or undelivered paid order. Added a type comment to prevent consumers treating quotes as earned funds.
4. **Verification provenance lacked independent funding/evidence checks.** The insert guard now also requires a paid, non-refund-requested order, payment reference/time, its active playable valid attempt and availability timestamp. New verification after refund/cancellation is rejected. Existing legitimate verification is not silently deleted/revoked by a later refund or assessor suspension.
5. **Malformed provider metadata.** An explicit missing-provider check closes SQL NULL's three-valued validation gap before binding an upload reference.
6. **Foreign-key index coverage.** Added nine Passport indexes for scope/reviewer/publisher/revoker references, order skill/active attempt and escalation opener. Existing applied application indexes were preserved.

## Concurrent and security evidence

`scripts/passport/concurrency.mjs` uses independent TCP connections, a controlled advisory-lock barrier and observed `pg_stat_activity.wait_event_type='Lock'`. It does not emulate concurrency by serial calls to a single connection. Seventeen scenario groups pass:

- Disabled release gate rejects player commands and trusted events, before and after the synthetic run.
- Same actor/request UUID and payload concurrently create one order. A reused UUID with changed input fails. Different UUIDs represent separate requests; the future UI must preserve a request UUID across retries/double clicks. No speculative one-open-order-per-skill business rule was added.
- Duplicate payment event persists once; wrong amount/currency and reuse of a payment reference cannot fund an order. Paid but undelivered orders create no earnings projection.
- Concurrent technical retry allocates one new attempt. Both attempts remain under the original payment.
- Readiness queued behind a lock uses acceptance time. Same-ID webhook replay cannot restart the target; a new-ID stale transition is rejected without changing it.
- Same-ID replacement allocation is idempotent and free; an old attempt's delayed events cannot revive it. Missing provider is rejected.
- Player/anonymous/unassigned-coach isolation; no forged payment, player review, support assessor grant/refund, direct table mutation, worker release-switch write or private locking-helper invocation.
- Duplicate Developing completion gives one final review, no verification, and a delivered paid assessment. Reassessment is a distinct parent-linked pending order and cannot submit before new payment.
- Distinct concurrent Verified requests give exactly one final review and milestone; repeat final decisions fail.
- Legacy coach suspension committing first makes the waiting review fail and removes current assessor evidence access, while player history survives.
- Legacy membership deletion committing first also makes the waiting review fail.
- A valid review committing first holds eligibility rows; a later legacy suspension waits, then preserves the already-earned historical milestone.
- Explicit grant suspension and review completion have a valid serial outcome; later decisions by the suspended assessor fail.
- Admin refund request versus completion has a valid serial outcome. Duplicate confirmed refunds persist once; new reviews/attempts/recognised earnings are denied afterward.
- Payment versus refund-request transitions serialize. Unsolicited refunds and late payments after unpaid cancellation fail for later reconciliation.
- Refund after valid delivery preserves the existing milestone, zeros recognised earnings, and rejects a fresh verification insert even from a privileged fixture query.
- All Passport tables keep RLS and no direct client/service mutation grants, despite the baseline's permissive default privileges. The test switch returns to disabled.

The original lifecycle SQL also passes against the full application schema, including both replacement clock policies, admin reassignment/escalation/revocation and version/history immutability. Its old minimal-fixture INSERTs receive explicit column lists in the runner; no production function is substituted. All its fixture changes roll back.

Seven existing SQL regressions pass on that same schema: application-email-claim fallback, approval/publication separation, preserving existing coach data on approval, registration notification claiming, player favourites, private coaching venue catalogue, and coach-only booking payment attribution/immutability. A completed booking is seeded as synthetic historical data with triggers disabled **only during that local fixture setup**; triggers are restored before executing its actual permission/payment regression. No email is sent. Other historical SQL suites with their own era-specific harnesses were not claimed as executed; all existing Vitest files were executed.

### Advisor findings

Ran Supabase CLI **2.122.0** `db advisors` against the explicit loopback replay database, with TLS disabled only for that local server. The CLI prints “Connecting to remote database” for `--db-url`; its actual target was 127.0.0.1:55439, not Supabase production.

No Passport security ERROR/WARN finding was reported. Remaining informational findings are expected unused indexes on a fresh database, RLS-with-no-policy on the three private deny-all runtime/idempotency/event tables, and two composite-FK covering-index suggestions. Those composite references already start with a separately unique `pp_reviews.attempt_id` or `pp_skill_verifications.order_id`; the unique lookup bounds the referential check to at most one row. Extra duplicate wide indexes were deliberately not added.

The full application advisor is **not clean**: five pre-existing `security_definer_view` errors name `coach_public_profiles`, `venue_public_profiles`, `coach_public_reviews`, `coach_relationship_identities`, `venue_relationship_identities`; 4 `auth_rls_initplan` and 23 multiple-permissive-policy warnings concern legacy objects. The listing projections intentionally expose selected fields behind publication/membership filters while base-table access is restricted. These findings need explicit existing-design review/acceptance, not an automatic conversion to invoker views that would break discovery. No legacy view/policy was changed. Re-run advisors against a genuine complete Supabase staging stack before release; native checks cannot establish platform configuration safety.

## Phase C contracts — design only

Current authoritative entry points:

- Authenticated domain adapter `runPassportCommand` → `public.passport_command(command,payload,request_uuid)` → private transactional command implementation.
- Trusted worker adapter `recordTrustedPassportEvent` → `public.passport_provider_event(source,event_id,payload)` → private event implementation. Only `service_role` has execution rights; no HTTP route/action or service client is supplied.
- `loadOwnPassport` reads only the authenticated player's orders, reviews, skill records and verifications through RLS. Current UI remains Phase A mock data.
- Records: `pp_orders`, `pp_submission_attempts`, `pp_reviews`, `pp_skill_verifications`; private `pp_requests` and `pp_provider_events` supply replay protection. `pp_audit` stores domain transitions. `pp_delivered_earnings` supplies payment/delivery-backed reporting.

### Upload authorisation and provider identity

Future server route must authenticate through existing SSR auth, derive the actor server-side, validate consent, require player ownership plus a paid/non-refunded/open order, and allocate/reuse `begin_attempt` with a stable request UUID. Return only a short-lived upload capability scoped to that attempt, never a Stream account token. Technical failures and unusable footage use another attempt on the **same order**.

**Missing Phase C contract:** add a durable upload intent/reservation binding `{order_id, attempt_id, player_id, provider_account, provider_video_id, capability_expiry, client_request_id}` before returning a capability. Reserve/compensate idempotently around the external call; never hold a database transaction during that call. Existing `provider_reference` is globally unique and stable once a trusted event binds it, but currently starts NULL and is bound by the event worker. It is not by itself a safe direct-upload authorisation/ownership registry. Do not accept an arbitrary browser video ID or infer ownership from a webhook body.

### Processing confirmation and replay

Future webhook route must verify the provider signature against the raw body, enforce the provider's replay/time policy, validate the configured provider account, and resolve the video ID through the durable upload intent. Obtain trusted metadata; the browser must not assert duration or “ready”. Normalise to the existing `MediaEvent` stages `uploaded`, `processing`, `ready` or `failed`. Readiness requires available/playable evidence, allow-listed MIME, positive bytes and duration within both purchased rubric/policy limits (never >90 seconds), current active attempt, confirmed payment and eligible named assessor. Only that accepted transition starts the review target.

Namespace durable event keys by provider/account/event or canonical transition, within the 200-character limit. Same key requires **exact normalised payload** and returns its cached result. Different IDs for the same obsolete transition fail safely; the future adapter/reconciler must classify already-applied/stale state as acknowledged, without indefinitely retrying or changing a deadline. Persist/retry webhook work after transient failures and reconcile missed events against provider state. No public callback exists yet. Missing size limits/consent and signature validation remain release blockers, not features supplied by the current event RPC.

### Private playback

Future signing endpoint accepts an attempt ID, re-authenticates, and checks the current order/media permission in the database on every request: owning player, currently assigned eligible assessor, or authorised `bookings.manage` admin. Resolve the stored provider ID server-side. Require private signed playback and a short token lifetime; never expose permanent public playback URLs or credentials. Recheck grant/membership/coach status at token issuance. A token already issued cannot be invalidated by RLS alone; expiry/revocation handling and suspension exposure window require approval. Ownership alone does not authorise playback after a media deletion/tombstone.

### Replacement, deletion, retention and account erasure

Attempts are append-only history; replacement changes the active attempt, not historical feedback or payment. Stale processing events must not affect the replacement. Provider deletion needs an idempotent private outbox/job, retries, a tombstone/deleted timestamp and reconciliation with Stream, including cleanup of abandoned upload reservations. Delete provider media without deleting financial/review/verification provenance indiscriminately. Define authorised deletion requests, legal/dispute holds and retention per evidence/feedback/credential category before any live video is accepted.

Current history FKs to `auth.users`/coaches are restrictive. Existing account erasure cannot simply delete an identity after Passport records exist. Agree and implement media cleanup, consent withdrawal, session revocation, historical anonymisation/retention and FK handling within the existing deletion workflow **before enabling live records**. These jobs/fields and safeguarding policy are not implemented in B.1. No new public sharing or minors/guardian policy is invented.

### Test mode and financial integration

Use only explicit `mock:` media/payment references in isolated synthetic environments until a separately approved Stream test integration exists. Test signed/invalid/stale/duplicate callbacks, cross-account IDs, retry/resume/replacement, deletion failures and unauthorised playback without accepting funds. Existing adapters are gated by a local development-only flag that refuses Vercel/production builds; Phase C must introduce a reviewed staging-aware server flag before staging worker/UI integration. Never weaken the current guard as an incidental upload change.

Payment confirmation remains separate from media: a future trusted payment worker must verify provider events and match original order, amount, currency and payment identity. Refund acknowledgement must resolve the original payment/refund through trusted provider records, not a browser-supplied order ID. No checkout, payout, partial refund, chargeback or tax policy is implemented. Full-refund reporting preserves history; it does not imply a legally settled debt or automatic verification revocation.

## Validation results and changed files

- Full native schema replay: twice, 20 migrations each; release disabled and 253 legacy objects unchanged.
- Full-schema lifecycle SQL, 17 concurrent/security groups and seven selected legacy SQL regressions: passed. Synthetic test databases removed.
- All Vitest: **50 files / 439 tests passed** (existing Passport adapter/read-model tests included). New multi-session tests run separately through the native runner, not added to this Vitest count.
- TypeScript `--noEmit --incremental false`: passed.
- Repository ESLint excluding the existing untracked backup/design folders: **0 errors, 17 unchanged warnings**. New scripts have no lint errors.
- `npm run build`: passed. Existing route manifest includes discovery, booking, auth, admin and locally gated development routes; no new live endpoint. No real booking, auth email, upload or payment request was sent.
- Supabase local advisors executed, findings above. Full managed-stack authentication, HTTP/RPC JWT verification, schema-cache exposure, secure storage/playback and provider integration were **not** verified.

B.1 file changes:

- `supabase/migrations/20261030222020_progress_passport_foundation.sql`: locking helper, nine indexes, stronger verification insert guard, delivered-earnings view/permissions.
- `supabase/migrations/20261030222021_progress_passport_operations.sql`: guarded eligibility calls, transition timestamps, explicit missing-provider validation.
- `supabase/tests/progress_passport_lifecycle.sql`: clock assertions compare accepted start/remaining allowance instead of transaction start.
- `lib/passport/types.ts`: quote-versus-earned-money comment only.
- `scripts/passport/validate-local.mjs`, `scripts/passport/concurrency.mjs`: repeatable full-schema runner, identity safety, cleanup, legacy checks and separate-connection tests.
- `docs/progress-passport-phase-b1.md`: this handoff.
- `docs/progress-passport-phase-b1-evidence.json`: sanitised environment, migration hashes/replay results, scenario output and advisor summary from this run.

### Reproduction

Use a disposable native PostgreSQL 17 cluster bound to loopback, with a supplied external `pg` module and the reviewed baseline above. The runner deliberately does not provision/start an arbitrary database or load app secrets:

```powershell
node scripts/passport/validate-local.mjs --pg-module "<external-runtime>/node_modules/pg/lib/index.js" --cluster-dir "<disposable-cluster-data-directory>" --port 55439 --evidence "<local-output>/validation.json"
```

The expected cluster directory is mandatory. Do not point this at a shared cluster; role bootstrap is cluster-wide. The runner supplies bootstrap roles/Auth compatibility and two listings; all test records are synthetic. Its first replay starts from a new empty database plus the reviewed schema-only baseline, not the narrow Phase B harness. Advisors are a separate read-only CLI invocation against an identity-confirmed replay database; do not substitute `--linked` or a production URL. See the recorded evidence for file hashes and actual executed database names.

## Remaining blockers and next action

**Ready for code review and a controlled isolated staging run; not approved for production activation.** Restore Docker or provision an explicitly identified isolated Supabase project/branch, replay the complete reviewed baseline/history plus the three Passport migrations, keep release disabled outside synthetic tests, then run real JWT/HTTP/RPC, storage, Auth/account-erasure, configuration and advisor checks. Migration reset from a normal clean checkout remains blocked by the historical baseline missing from versioned migrations. Do not silently use the linked production project.

Approve curriculum and assessor credential/scope policy; commission/fees/tax/refunds/settlement terms; 72-calendar-hour/replacement clock choices; consent/safeguarding/minors; size/region/retention/deletion and history anonymisation; signed-token lifetime; and suspension/reassignment/verification correction rules before enabling live data. The conservative pilot-wide mutation lock passed the tested races but is not a throughput/load certification. Preserve SQLSTATE retry/reconciliation handling for transient lock/deadlock/serialization errors in a future adapter.

No Phase C implementation or external deployment follows this handoff automatically.
