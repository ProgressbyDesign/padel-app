# Progress Passport — Phase D: Coach assessment, feedback and verification

Started 3 November 2026. Local implementation only. No hosted database/configuration changes, live payments, Cloudflare activation, customer emails, deployment, push or merge. Earlier uncommitted Phase B/C work and unrelated backups/design files are preserved. Phase E is not started.

## Architecture and plan

Read the Phase A/B/B.1/local Supabase/C.1/C.2 handoffs, current `master` diff, existing coach/admin layouts, Passport operations/RLS, video providers and branded transactional templates. The initial 507-test baseline passed before editing. Reuse `passport_command`, existing orders/attempts/reviews/verifications, scoped individual assessor grants and current SSR authentication. Do not duplicate payment, booking or verification systems.

The implementation adds the missing coach and player presentation, a narrow identity projection, optional pre-submission notes and transactional notification intentions. There are no new dependencies or authentication replacements. The SQL lifecycle remains the authority, including its shared lock, current eligibility-row locks, immutable purchase/rubric snapshots and unique final review/verification constraints.

## Routes and components

- `/account/coaches/[coachId]/assessments`: assigned queue with Awaiting review, In review, Replacement, Completed and All assigned filters. Shows player, selected assessment pathway, skill, submitted date, remaining/overdue time and replacement count. Accessible from existing coach navigation; the overview links to existing assigned work.
- `/account/coaches/[coachId]/assessments/[orderId]`: private evidence, player question, purchased rubric, per-criterion verdicts, structured feedback, optional practice structure and three decisions. Existing coach parent layout and named-assessor/RLS checks both apply.
- `/account/development/assessments`: existing list now includes assessor and a feedback summary. Its order detail shows the full assessment feedback, criteria, attempts, next actions and verification provenance. Optional notes can be saved before the first upload.
- `/account/development/passport`: server-backed latest completed outcomes and verification history when the isolated backend is configured. Practice completion cannot create achievements. An earlier valid verification remains visible after a later Developing assessment.
- `/account/development/next-step`: latest completed feedback per skill, practice tasks and links to existing coaching/venue discovery. Replacement decisions are excluded from completed-practice recommendations.
- `/admin/passport/assessments`: active `bookings.manage` administrators see orders with at least two replacement requests and prepared notifications. The local admin overview provides a link. The page is explicitly authorised and does not inherit authority merely from its URL.

New components: `AssessmentQueue`, `AssessmentReview`, `AssessmentReviewForm`, `AssessmentFeedback`, `AssessmentVideo`, `PassportRecords`, `SubmissionNote`. Existing `StreamPlayback` accepts an optional attempt ID. Shared feedback and playback components serve both sides without implementing another lifecycle.

## Review workflow and integrity

Ready evidence means confirmed funding, no refund request, playable valid media and a current named/scoped assessor. A coach may start a review or complete it directly through the existing command. Starting does not reset the deadline. The efficient form gathers observations, strengths, improvements, technical recommendations, one or more exercises, next step and an explicit verdict for every purchased criterion.

Technical recommendations are stored with the existing improvement text, under a clear label; no parallel feedback table/column is invented. Optional practice templates provide editable structure only, never pre-filled verdicts or claimed observations. Draft content is explicitly labelled in its original wording; the screen shows purchased rubric version and current published/retired status. The selected pathway is an assessment level, not an invented global player rating.

- **Developing** requires at least one unmet criterion and meaningful improvements. It completes the paid service without a verified milestone.
- **Verified** requires every criterion and current explicit assessor eligibility. The existing transaction completes the order and creates exactly one provenance-linked milestone.
- **Replacement requested** requires a predefined issue and actionable guidance. It does not complete the service, create a charge or overwrite old attempts. Two or more requests become an admin watch item, without automatic sanction or refund.

The form holds feedback in the current tab only. No sensitive draft is written to browser storage; closing/navigating away can lose unsent text. The exact request ID is reused while an uncertain submission's payload is unchanged. Changing feedback creates a new request. Server commands repeat RLS/current eligibility and funding checks; a stale form grants no authority. A lost-response replay can reach the existing idempotency check after completion. Different conflicting final requests remain rejected.

Historical reviews retain their named assessor IDs, evidence and immutable rubric version. A narrow order-authorised name map avoids attributing an earlier assessor's review to the current assignment. Relevant prior reassessment feedback is fetched only if the caller independently has access to that parent order; assignment to a new order does not grant access to another coach's historical evidence.

## Timing

Use purchased `review_target_hours` (the agreed pilot proposal is 72 calendar hours) and stored timestamps. Readiness starts the target, not payment/upload selection. UTC is displayed explicitly; comparisons use absolute instants. Replacement pauses the deadline; valid replacement invokes the existing `reset` or `resume_remaining` policy. Reassignment retains the existing deadline. Completed/cancelled orders display no active countdown. No financial action is driven by a timer.

The reminder preview uses a proposed 24-hour approaching threshold; it is not a new SLA. Deadline intention keys use epoch instants, independent of session timezone. Operational notification schedule, reminder cadence and overdue resolution still require approval.

## Additive migration and operations

CLI-created `20261103232829_passport_review_experience.sql` follows C.2. No applied historical migration is modified and no release gate is opened. It adds:

- Optional `pp_orders.player_notes` (1,000 characters). Owner-only `passport_save_submission_note` permits updates only on funded, non-refunded orders before the first attempt. There are no client direct writes.
- `passport_review_context`: capped order-authorised identity/notes projection. It exposes names and rubric status only, with no contact details, credentials, provider IDs or capability URLs. Private definer implementation has an empty search path; public wrapper uses invoker rights.
- Private deny-all `pp_notification_intents`: transactional insert-only intentions, uniquely keyed to actual readiness/decision/verification or deadline events. No email addresses, footage, feedback body or sending credentials are stored there.
- `passport_notification_preview` and `passport_prepare_deadline_notifications`: explicit current `bookings.manage` permission and disabled-release-gate checks. Preparation is idempotent and initiates no delivery.
- RLS-respecting invoker view `pp_replacement_watch`, with explicit admin filter and threshold of two. Ordinary coaches/support/players cannot see the watch.

The local chain contains the schema-only bootstrap plus all 22 repository files: 23 entries. It does not reconstruct missing original production migration history, import customer backups or change hosted settings. All five Passport migration files remain local/pending release; hosted migration status was not queried in this phase.

## Media and optional coach response

Existing provider choice is server-controlled and local-only. Current and earlier attempts use the existing private mock/Stream endpoints, now with an optional attempt selector constrained to the same authorised order. No client-supplied provider UID is trusted. Deleted/unready media fails closed. Suspension/reassignment removes future playback permission without rewriting player history. C.2's already-issued signed-token exposure window remains unchanged (up to 120 seconds); instant revocation is not claimed.

`pp_reviews.response_video_reference` already exists and is retained as the future integration point. This phase displays a development-only explanation and never accepts or plays arbitrary references. Optional response media must later have its own private authorisation, ownership, retention and append-only binding to the immutable review; adding such media must not alter the decision. No live feedback upload or service is introduced.

## Notifications: preparation only

Reuses the existing branded email template/logo and `hello@padelpathways.com` sender identity. Pure preview generation covers review-ready, replacement, completion, verified achievement and approaching/overdue deadlines. Stable outbox/event IDs supply future delivery idempotency keys. There is deliberately no Resend send/recipient-resolution path, subscription or cron in Phase D.

Before delivery activation, add a reviewed outbox worker with provider idempotency, recipient consent/test routing, retry/claim auditing and last-moment current-assignment/permission/state checks. Discard superseded ready/deadline intentions. Preserve the established test-copy convention only after explicit delivery approval; this phase sends neither customers nor test-copy addresses any email.

## Validation

- Initial baseline: 57 Vitest files / 507 tests passed.
- Updated suite: 60 files / 540 tests passed, including 33 focused Phase D tests for feedback criteria/validation, timing, latest recommendations, preview templates, caller-scoped queries and mutation replay.
- Complete isolated Supabase replay and Phase D rolled-back SQL checks passed; original lifecycle and Stream suites, 21 independent-connection concurrency groups, real Auth/JWT/REST/RLS/Storage checks and seven legacy booking/discovery/approval regressions passed. No fake payment endpoint was added.
- TypeScript, targeted lint and production build passed. Repository lint: zero errors, the same 17 existing warnings.
- Local advisor check: the same five legacy definer-view errors and 27 legacy warnings; no new Phase D ERROR/WARN. These views are not used to authorise private assessment media.
- Real browser journey passed: private player notes/upload, coach queue and playback, incomplete-feedback errors, two free replacements/admin watch, Developing feedback/Next Step, new-funded reassessment/Verified Passport milestone, cross-account and substituted-attempt denial, and suspended-assessor denial with preserved player history. Mobile coach review and 320/390px player feedback were checked; synthetic screenshots were inspected. Next.js streamed not-found pages are checked by their denial boundary/content, not just their outer HTTP status.
- Browser tests caught and fixed a duplicate component key, file-input events being selectable before hydration and a coach sidebar grid wider than the mobile viewport. Test harness paths and accessible selectors were corrected; independent suites now require a clean local reset.
- Retained C.1 browser regression also passed: file/type/size checks, 320/390px layout, keyboard/action sizing, interrupted-upload retry, server validation/private ranged playback, replacement, suspension and Developing/reassessment isolation.
- Final clean reset confirms zero users, orders, Stream sessions and notification intentions, 23 local migration entries, and the database release switch disabled. All 22 repository migration hashes match the replay. Actual published bindings/Windows listeners were 127.0.0.1 only. The isolated stack was stopped; no user dev service was stopped.
- Live Cloudflare and physical-phone tests have not been performed. [Sanitised final evidence](progress-passport-phase-d-evidence.json) accompanies this handoff.

Reproduction uses the established guarded `Invoke-LocalSupabase.ps1`, unlinked `padel-b1-local` scratch workspace, CLI 3.0.0 and real PostgreSQL 17.11. `validate-supabase-local.mjs` now includes `progress_passport_review.sql`; `validate-review-local.mjs` checks local identity/tool paths before synthetic fixtures and forces Stream disabled, mock media enabled and outgoing Resend credentials empty. Do not run either harness against a hosted project. Finish with guarded Reset/Stop and verify zero users/orders and disabled runtime.

## Review instructions and limitations

Use the isolated browser runner's synthetic coach/player/admin accounts; passwords/tokens stay in process memory and are not retained in the handoff. Inspect coach queue/review, replacement watch, player assessment detail, Passport and Next Step screenshots from the companion evidence directory. The runner stops its Next process; no permanent paid demo account remains after cleanup. On a manually prepared isolated test dataset, sign in normally and open the routes above. Merely enabling a UI flag cannot fund an order, grant assessor scope or publish a rubric.

Inspected screenshots: [mobile coach review](progress-passport-phase-d/d-coach-review-mobile.png), [player Next Step](progress-passport-phase-d/d-player-next-step.png), [player Passport](progress-passport-phase-d/d-player-passport.png). All show synthetic local data.

Queues/projections show the latest 100 orders in the local pilot; production pagination and high-volume history loading need a separate pass. Coach drafts are not persisted. There is no public Passport sharing, certificate, optional feedback-video upload, notifications delivery, payment processor, refund transfer or financial settlement UI. Approved curriculum/criteria, assessor qualifications and clinical-quality feedback moderation remain business responsibilities.

## Remaining decisions and Phase E recommendation

Before any release, agree curriculum/rubric approval and assessor governance; 72-hour calendar/business interpretation, replacement/reassignment/escalation operations; coach-set pricing/currency/tax, commission/fees/rounding, cancellation/disputes/refunds; consent/safeguarding/minors; verification expiry/corrections/public sharing; and media/financial history retention and account erasure.

Recommended Phase E scope: separately approved payment-provider checkout with server-priced order snapshots; signature-verified, replay-safe confirmation/refund events through the existing trusted event boundary; reconciliation for late/duplicate/cancelled payments; operational refund/dispute handling and consented test-mode transactions. Do not connect a browser or administrator button to paid-state confirmation. Earnings reporting is not a payout ledger; settlement/provider onboarding needs its own approved design. No implementation begins here.

C.2 blockers remain: live Cloudflare/private raw-UID/expiry/webhook/codec/deletion tests, physical iPhone/Android interruption tests, five legacy security-view sign-offs, existing critical/high dependency remediation, approved retention/consent and signed-token policy, account-erasure integration, scheduled cleanup/monitoring and explicit production release review. Phase D does not resolve or waive those blockers.

## Changed files

- New `lib/passport/review/` access, models, queries, validation, mutation adapter, preview notifications and three test files.
- New coach assessments routes/action and `AssessmentQueue`, `AssessmentReview`, `AssessmentReviewForm`; conditional coach navigation/overview entry.
- New player `AssessmentFeedback`, `AssessmentVideo`, `PassportRecords`, `SubmissionNote` and note action; existing assessment/Passport/Next Step pages and summary/shell updated.
- Existing mock/Stream playback and `StreamPlayback` support order-scoped earlier attempts.
- New local-only admin watch page/action and conditional operations overview link.
- New additive migration, `supabase/tests/progress_passport_review.sql`, validator hook and isolated browser runner.
- This handoff, sanitised validation evidence and synthetic screenshots. No Phase D package changes.
