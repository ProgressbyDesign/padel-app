# Progress Passport — Phase C.1: mobile video submission

3 November 2026. Local mock provider only. No Cloudflare activation, remote migration, hosted configuration change, production mutation, deployment, push or merge. Stop after C.1.

## Inspection and boundaries

Read the Phase A, B, B.1 and local Supabase handoffs, the repository's Next.js guidance, installed Next 16.3.2 route-handler documentation, existing authentication, Passport commands/provider events/RLS and UI conventions. Work started on `master` with no tracked modifications. Phase B/B.1 files, scripts, migrations and unrelated `backups/` / `design-system/` were already untracked and are preserved. No package or lockfile changes.

Reused existing SSR login/cookies, authenticated account layout, development flag, purchased policy/rubric snapshots, order/attempt records, player commands, trusted media-event RPC, assessor eligibility and review/payment safeguards. No duplicate user/order/payment tables and no new migrations. The three pending Phase B migrations remain unchanged and unapplied remotely.

Existing `PADEL_PASSPORT_PREVIEW=true` still requires local development and rejects production/Vercel. Video additionally requires `PADEL_PASSPORT_MOCK_VIDEO=true` and the **exact** local Supabase API `http://127.0.0.1:55321`. Server-only `PADEL_PASSPORT_MOCK_SERVICE_KEY` must explicitly hold the generated local worker key; there is no fallback to existing project keys. `PADEL_PASSPORT_MOCK_FFPROBE` is an absolute path to separately installed local inspection tooling. Never set these mock settings on Vercel or point them at a hosted project. The tests pass overrides to one child process without reading/copying/editing the app's environment file.

The local database release gate is not enabled by application startup. Integration tests temporarily enable it only after checking the isolated local identity and synthetic setup, and restore it to false in cleanup. The final guarded reset removes synthetic records. No payment-confirmation endpoint or client-side paid toggle was added.

## Five existing advisor findings

All five have advisor severity **ERROR**, category `security_definer_view`. They are legacy owner-executed projections, not new Passport objects. A security barrier does not make a view obey underlying RLS. Their explicit filters, selected columns, grants and base-table restrictions are therefore security boundaries requiring deliberate review.

- `public.coach_public_profiles`: anonymous/authenticated public coach discovery. Explicit `published` filter and public-field allowlist, excluding contact details. Required before production activation: review/accept the owner-read boundary and retain private-coach/contact exclusion regressions, or implement a separately reviewed replacement.
- `public.venue_public_profiles`: analogous public venue projection and publication filter. Required before production: review the allowlist and publication boundary; preserve private venue exclusion and discovery compatibility.
- `public.coach_public_reviews`: reviews joined to published coaches, limited to review text, ratings, timestamps and public IDs. No requester/booking/contact identity. Required before production: review public review visibility and moderation/privacy expectations alongside the explicit projection.
- `public.coach_relationship_identities`: authenticated venue members see limited coach identity only for relevant unverified/pending/active relationships; membership is tied to `auth.uid()`. Required before production: review relationship states, membership isolation and column allowlist.
- `public.venue_relationship_identities`: corresponding authenticated coach-member view of limited venue identities. Required before production: review the reciprocal membership boundary and relationship-state exposure.

Sources: `20260828010000_sprint6a4_public_profile_projections.sql` and `20260909064447_verified_coach_reviews.sql`. No applied migration/view was changed. Blindly switching these views to invoker would break deliberately restricted base-table access and requires its own design and regression review. These errors do not prevent isolated C.1 development; they remain an explicit production review/acceptance requirement. The prior local advisor report also records four auth-initplan and 23 multiple-permissive-policy warnings. C.1 adds no SQL objects, so this is a review of the recorded findings/source rather than a claim of a newly clean remote advisor run.

## Routes and UI

- `/account/development/assessments`: own local order statuses from the existing RLS client, funding status, replacement guidance, review target and a submission link. Empty accounts cannot fabricate an order or funding. A bounded 50-order preview list uses batched related queries.
- `/account/development/assessments/[orderId]`: player-owned recording/submission screen. Skill name, camera placement, repetitions and stricter duration limit come from the purchased skill/rubric snapshot; the representative Bandeja is exercised in tests.
- `/account/development/assessments/[orderId]/video`: development/local-only POST and private authenticated GET. Other accounts receive no record, and playback rechecks RLS on every request. No public URLs, browser-supplied provider IDs or arbitrary filesystem paths.

`VideoSubmission` provides mobile camera capture/file selection, browser playback/length checks, an object-URL preview, actual transfer progress, server processing feedback, interruption/retry, same-order replacement guidance, submitted playback and a return to My Assessments. Inputs have labels, status/errors are announced, controls support keyboard use, touch actions are at least 44px, and object URLs/requests are cleaned up. File changes clear previous validation. The development banner distinguishes temporary practice state from local assessment test records. Reset preview resets practice, not orders or payments.

The provisional mock cap is **50 MiB** (labelled 50 MB for players), with MP4/MOV/WebM allowed. The purchased policy/rubric can impose a shorter limit; nothing can exceed **90 seconds**. HEVC-only MOV, unreadable/indefinite-duration recordings and unsupported codecs require an H.264 MP4 export. The size limit and codec support are local preview assumptions, not newly approved commercial entitlements.

## Mock media lifecycle and security

The browser provider interface receives an order, stable request UUID, file, cancellation signal and progress/processing callbacks. It never controls payment, validity or assessor authority. The current adapter transfers actual bytes over local HTTP; progress is not simulated with timers.

The server validates existing login and player ownership through the user's RLS client, checks same-origin Host/Origin and paid/non-refunded/accepting state, then bounds the received stream to 50 MiB. An interrupted transfer or invalid file before allocation creates no attempt or charge. Files use generated names under ignored `.next/cache/passport-private-mock`, never `public/`.

An explicitly configured local FFprobe decodes/counts frames with only file protocol and MOV/Matroska/WebM demuxers permitted, a 30-second timeout and bounded diagnostic output. The server rejects failed decoding, unsupported codecs and out-of-policy duration using inspected bytes, not a browser duration. The inspector is external validation tooling (`@ffprobe-installer/win32-x64@5.1.0` on this machine), not an application dependency or a recommended production media worker. A Cloudflare worker must replace it before live use.

After validation, existing `begin_attempt` authorises allocation and locks the financial/lifecycle state. The current active attempt is rechecked to reject stale request IDs. The server binds an attempt/content-digest reference, privately retains content-addressed bytes, and emits only `uploaded`, `processing`, then `ready` media events through the existing trusted RPC. Playback resolves only the digest actually bound by SQL, so a stale competing transfer cannot overwrite the accepted clip. SQL again checks current paid state, refund status, active attempt and assessor eligibility. Nothing is reviewable until ready/valid. Financial confirmation/refund events are not exposed by this route.

Retry uses the same order. Stable provider event IDs make a lost-response retry idempotent and do not restart the 72-hour target. Changed bytes cannot overwrite a bound attempt. An assessor's unusable-footage request opens a free new attempt on the same paid order. Developing still completes the professional assessment; Verified still requires the existing authorised final review and valid criteria. Reassessment remains a new parent-linked order awaiting a new confirmed payment.

Private GET supports byte ranges, uses `private, no-store`, `nosniff` and same-origin resource policy. Assigned-assessor visibility comes from existing RLS; suspension removes access immediately. Worker credentials are not used to decide playback visibility. Clients do not receive payment references, filesystem names or worker keys.

This mock is **single-process local tooling**, not a durable/resumable storage service. Its in-process per-order lock supplements, and does not replace, SQL transaction/idempotency protection. Local files can be lost when the cache is cleared. A missing file returns unavailable; the mock does not invent playback. The integration runner deletes its mock clip directory after stopping its own server, and a guarded reset clears the related synthetic records. Do not use actual customer footage. No automatic production retention policy is implied.

## Local environment and startup hardening

Reused the unlinked `padel-b1-local` workspace, dedicated Docker bridge, CLI 3.0.0 and PostgreSQL 17.11. No Docker Desktop/WSL/global settings or hosted configuration changed. A clean guarded reset replays the schema-only baseline plus all 20 repository migrations (21 local entries); migration hashes are compared with the repository.

Found a launcher defect: a one-element PowerShell switch result could become a scalar string and the CLI received character arguments (`s` rather than `start`). Declaring the argument array as `[string[]]` fixes it. The existing port-rewriting guard remains intact. Actual Docker bindings and Windows listeners are loopback-only on 55321–55324. Negative publish-all and IPv6-wildcard tests both fail before any container is created.

An existing dev server was already open. `PADEL_PASSPORT_C1_CHECK=true` selects `.next/passport-c1` only in development, allowing the test app to bind 127.0.0.1:3107 without stopping that server. Normal development/build output remains `.next`. Next-generated changes to AGENTS/TypeScript configuration are excluded from the delivered diff.

## Validation

No hosted test project or real payment/email/Stream service is used. Sanitised browser evidence is in `progress-passport-phase-c1-evidence.json`.

- Full Vitest: **52 files / 466 tests passed**, including 27 new C.1 checks. Coverage includes exact 90-second/size boundaries, incompatible/empty/indefinite clips, stricter purchased duration limits, chunked oversized bodies without Content-Length, interrupted transfer, simultaneous same-order uploads, retries, free replacements, stale request IDs, content binding, unpaid/refunded/terminal orders, private playback and production/hosted feature closure.
- TypeScript `--noEmit --incremental false`: passed. Final production build also type-checks and passes.
- Targeted ESLint on all C.1 TS/TSX/config/runner files: clean. Repository lint: **0 errors / 17 existing warnings** in unchanged search/listing/globe/join/gallery components.
- `npm run build`: passed with the existing coach, venue, booking, authentication and admin routes retained. No dependency/lockfile changes.
- The existing real-Supabase validation runner passes again: original lifecycle SQL, **17 separate-connection concurrency groups**, GoTrue signup/confirmation/login/refresh/recovery, forged-JWT and RLS tests, private Storage checks, trusted-only funding and seven legacy SQL regressions (including booking payment attribution and private venue catalogue).
- Headless Edge through the real Next login form and SSR cookies: Bandeja camera guidance, real synthetic MP4 selection/preview, file/type/size errors, 320px and 390px overflow checks, keyboard focus and touch target size, network interruption and retry, server rejection of fake MP4 bytes and cross-origin requests before allocation, actual decode/progress/processing/ready transitions, private playable byte-range delivery, lost-response replay without deadline reset, unpaid/client-funding-header denial, anonymous/other-player denial, free second attempt under the original payment, assigned-assessor playback, suspension denial, Developing delivery and payment-gated linked reassessment. No page errors in the submission flow. Screenshots inspected; files remain in private scratch, not the application assets.
- Guarded resets replay all **21 local entries**, and test cleanup leaves **0 Auth users, 0 orders, release disabled**. Container bindings and Windows listening sockets are 127.0.0.1 only; explicit publish-all/IPv6-wildcard probes are rejected before container creation. Local test services are stopped after validation, preserving the clean local setup.

To reproduce browser verification, use `scripts/passport/validate-video-local.mjs` with explicit `--cli`, `--workdir`, `--pg-module`, `--playwright-module`, `--probe`, and `--evidence` paths. Use the handoff's guarded Start/Reset first; the runner refuses linked workspaces, non-local endpoints and a database with existing users. Tooling stays outside the app. It creates synthetic confirmed accounts and funds a test order through the trusted local worker; no interactive payment bypass exists. It stops its own Next process, disables the gate and removes mock clips in cleanup. Finish with guarded Reset/Stop. There are deliberately no retained paid demo accounts in the final environment.

## Files changed in C.1

- `app/account/development/assessments/page.tsx`, `[orderId]/page.tsx`, `[orderId]/video/route.ts`.
- `components/development/MyAssessments.tsx`, `DevelopmentShell.tsx`, new `VideoSubmission.tsx`.
- `lib/passport/video/validation.ts`, `contracts.ts`, `browserProvider.ts`, `localConfig.ts`, `queries.ts`, `probe.ts`, `mockService.ts`, `video.test.ts`, `mockService.test.ts`.
- `scripts/passport/Invoke-LocalSupabase.ps1` (typed argument array), `validate-video-local.mjs` (isolated browser integration runner).
- `next.config.ts` (development-only separate test output).
- This handoff and sanitised C.1 test evidence.

## Phase C.2 requirements and remaining decisions

1. Add a durable server-owned upload-intent record binding player/order/active attempt/provider UID, policy limits, expiry and a stable creation idempotency key before issuing upload capabilities. Use the existing users, orders, attempts and trusted event ledger. The C.1 content digest is a mock binding, not a Cloudflare upload capability.
2. Implement a provider adapter for direct **resumable** mobile transfer, recoverable offsets/session expiry and retries without another charge. Never route live large video through a Vercel function like this mock. Keep credentials server-side. Resolve current Cloudflare documentation at implementation time; no endpoint/signature behaviour is hardcoded here.
3. Verify webhook signatures/authenticity, replay window and provider/account ownership server-side. Bind returned UID to the reserved intent, validate trusted processing duration/size/type/playability, deduplicate event IDs and reconcile delayed/out-of-order events. A client cannot submit a readiness event. Invalid footage must retain the existing free-replacement lifecycle.
4. Authorise each playback against current RLS/assignment/eligibility and issue short-lived signed playback only. Prevent public originals, unowned provider IDs and cross-account media. Reassignment/suspension/revocation must invalidate future access without rewriting historical review provenance.
5. Define replacement/deletion semantics: supersede only after the new attempt is accepted, revoke prior capabilities, record deletion requests/completion/retries, reconcile orphaned uploads, and reconcile DB readiness when media disappears. Account deletion requires an authorised erasure workflow for provider assets plus an approved history/anonymisation policy.
6. Approve retention windows for incomplete/rejected/completed footage, signed-playback lifetimes, video consent/minors/guardian requirements, safeguarding, rubric/assessor qualifications, 50 MiB or another file cap, codecs and commercial/refund rules. Keep a provider test mode and isolated synthetic accounts before live activation.

Physical iOS/Safari/Android capture and interrupted resumable uploads need device/provider testing in C.2. Desktop Edge mobile viewport tests do not establish native camera permissions, HEVC support, background upload survival or Stream behaviour. This is safe for review as disabled local development code, **not approved for production activation**. Do not begin C.2 automatically.
