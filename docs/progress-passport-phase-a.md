# Progress Passport — Phase A

## Inspection and implementation plan

Inspected 28 October 2026 on `master`. Initial tracked working tree was clean; unrelated untracked `backups/` and `design-system/` directories were preserved. Phase A stays local, with no push, deployment, migration or production data change.

Plan: reuse authenticated account routes and visual conventions; add an opt-in local preview; implement a small typed curriculum and temporary practice state; add Passport, assessments and next-step views; validate access, progression and existing regression coverage. No architecture blocker for this slice.

## Existing architecture and reuse

- Next.js 16.3.2 App Router, React 19.2.4, TypeScript 5, Tailwind 4. Vitest 3 and ESLint 9. No dependency changes.
- `app/layout.tsx` loads optional account navigation. `SiteChrome` supplies the public header and account footer. `/account/layout.tsx` requires authentication. Server session helpers use Supabase `getClaims`; the proxy refreshes session cookies. The preview reuses `requireAuthenticatedAccount`.
- `profiles` represents the existing auth-backed account. Coach and venue workspaces are controlled by memberships; admin access uses the existing admin permission system. Signup intent is presentation metadata, not authorization. A coach approval is not an assessor grant.
- Discovery reads the existing public coach/venue projections. Publication and approval are distinct. Existing booking availability, relationships, request state transitions and completed-session reviews are separate from Passport assessment outcomes.
- `coach_booking_requests` records session requests and manually confirmed `paid_at`/`paid_by_user_id`. Players arrange payment directly with a coach. There is no payment provider or assessment-order ledger to reuse as a paid video service.
- Existing migrations implement owner/member RLS and column-limited writes; public projections allow only approved public fields. Completed-booking reviews use ownership and completion checks. Passport data must adopt equivalent least-privilege boundaries, not public exposure.
- Supabase SSR 0.10.0 and Supabase JS 2.100.1 are installed. Resend-backed branded transactional email functions and recipient resolution can be reused later. Do not connect notifications to temporary preview actions.
- Reuse navy/lime/blue tokens, rounded white panels, Lucide icons, responsive account navigation patterns and existing Next links. There is no general-purpose course/component library; small typed components follow current Tailwind conventions.
- Existing tests cover auth recovery/signup/invitations, account routing, public profiles, availability, booking errors/email, reviews, approval/publication and administration. SQL regression tests are separate from Vitest; Phase A does not execute tests against production.

## Routes and local access

- `/account/development` — My Development, four pathway choices and sample skill cards.
- `/account/development/skills/improver-bandeja` — three sequential practice lessons. Other sample skill IDs use the same journey component.
- `/account/development/passport` — temporary learning status, empty assessment history and achievement placeholders; explains future Developing/Verified outcomes.
- `/account/development/assessments` — empty state; `?intent=submit` opens an explanatory submission preview.
- `/account/development/next-step` — next unfinished sample lesson, assessment entry and existing coach/venue links.

Set `PADEL_PASSPORT_PREVIEW=true` in your local development process and run the usual development server. Sign in with an existing test account, then open `/account/development`. The existing player dashboard shows a preview link only when enabled.

The flag is server-only, off by default, requires `NODE_ENV=development`, and refuses Vercel environments. Production builds return not-found for every preview page even if the opt-in variable is set. The existing parent account layout may redirect signed-out visitors to login first. This is intentional reuse of existing auth, not an authentication bypass. No flag was added to shared environment files.

Practice state lives only in a React provider keyed by the account ID. Navigation inside the development section preserves it; reload, leaving the section or Reset preview clears it. Nothing is saved to Supabase, cookies, browser storage or real player achievements. All screens carry a sample-content notice. Selected pathway is a learning preference, not a rating. Practice completion can only become `ready_for_assessment` (displayed as “Practice complete”), never Developing or Verified.

## Assumptions and limits

- Default sample pathway is Improver so the Bandeja example is easy to find. All four levels remain freely selectable. Five representative skills are supplied; this is not the proposed complete six-per-level syllabus.
- Sample lesson/drill text, estimated practice times, sequence and recommendations are provisional editorial content requiring coaching review. No approved video learning library or rubric has been supplied. This phase uses text practice instructions, not invented lesson videos.
- Current authenticated accounts can inspect the local player preview, including accounts that also manage a coach/venue. No new exclusive player role is invented.
- No assessments, orders, uploads, assessor approvals, notifications, signed media URLs, payments or real awards are created. No fixed review promise or price is charged.
- Future submission copy reflects the agreed free pilot Passport, suggested £35 coach-set price, 90-second maximum and 72-hour target measured from valid submission. Developing and Verified are delivered outcomes. Reassessment is paid again; replacement footage and failed-upload retries remain on the same order.
- Optional coach-recorded feedback, native apps, AI scoring, course builders and live video are excluded.

## UX reference interpretation

- [The Padel School](https://thepadelschool.com/players/court-ready): use a clear learning order with practical exercises. Phase A translates this into small lesson steps, a practice prompt and a reflection, using original sample copy.
- [Skillest](https://skillest.com/features/online-lessons): keep a future video submission, coach analysis and follow-up practice connected within one assessment. Phase A provides only the explanatory entry point; it adds none of Skillest's analysis, AI or live-call tooling.
- [England Football Learning](https://learn.englandfootball.com/profile?tab=my-learning): distinguish current learning, learning history and qualifications. Phase A separates temporary practice progress from future assessor outcomes and achievements.

These are product-pattern interpretations, not copied designs, credentials or a claim of partnership.

## Proposed database changes — design only, no SQL or migrations added

Reuse account and coach IDs. Add versioned curriculum levels/skills/lessons and assessment criteria, with stable IDs and an explicit publication state. Add player pathway preferences and self-reported lesson progress keyed to the existing account. Keep self-reported learning separate from assessor decisions.

Add a dedicated assessor authorization relation linking existing coaches/accounts to approved skill scopes, with grant/revoke audit metadata. Coach approval alone must not authorize verification. A future server-side assessment action and RLS must both check current scope; players must never write assessment outcomes.

Introduce a dedicated assessment service order (not a duplicate booking or user table), priced in integer minor units with currency, coach-set price and an agreed commission snapshot. Provider IDs/idempotency keys and delivered state must be recorded later. An order has multiple submission attempts so invalid footage and technical retries never create another charge. Validity accepted timestamp starts the review target; unusable/replacement-required footage cannot be a paid delivered outcome. A reassessment creates a new order. Developing/Verified are assessment outcomes independent of payment, upload and fulfilment status.

Add immutable completed assessment decisions/feedback, linked skill verification records and criteria versions. Maintain a read-only Passport projection and earned-achievement records with explicit provenance, revocation/correction policy and audit history.

RLS proposal: players read their own orders/progress/media; players may submit permitted footage and self-report learning but cannot verify; assigned active assessors read only relevant submissions and may issue permitted decisions; existing admin permission checks govern review and assessor management. Use private storage, short-lived authorized playback, least-privilege uploads and server-validated duration/type/size. Keep retention/deletion policies explicit. No public Passport until consent and sharing rules are approved.

## Decisions before a database/assessment phase

1. Approve the skill catalogue, coaching content and versioned verification rubric; define what qualifies an assessor and who grants/revokes each skill scope.
2. Confirm the suggested £35, currencies, tax handling, refunds/disputes and the proposed 20% commission (including fees and rounding). No commission calculation is implemented here.
3. Define the 72-hour service clock (calendar/business hours, timezone, replacement pauses, overdue handling) and valid-footage checks.
4. Agree video consent, minors/guardian access, maximum file size, retention/deletion, who may view footage and any future external media service.
5. Agree verification expiry, corrections, achievements, public sharing and reassessment policy details.

## Validation

Run TypeScript, targeted lint, full Vitest, production build and diff checks. Preview tests cover explicit local access, production/Vercel closure, existing auth requirement, sequential/idempotent lesson progress and separation from verification. Existing discovery, booking and auth implementation files are preserved; only an opt-in link was added to `PlayerDashboard`. Record actual command and browser verification outcomes in the final delivery, including any environment limits.

Results from this pass:

- TypeScript `--noEmit --incremental false`: passed.
- Targeted ESLint on new files and the modified dashboard: passed with no warnings. Repository lint (excluding the pre-existing untracked backup/design folders): passed with 0 errors and 17 warnings in unchanged search, listing, globe, join and gallery files.
- Full Vitest: 48 files / 425 tests passed, including 11 new Passport foundation tests and existing auth, discovery, booking, review and admin coverage.
- Production build: passed. No package or lockfile changes.
- Headless Edge checks on the actual new components in an isolated fixture router: pathway selection by mouse and keyboard; sequential lesson completion; 100% practice progress; navigation preserving temporary progress; Passport not granting verification; next recommendation; information-only assessment entry; reset; no horizontal overflow on all five views at 320px and 390px. No page errors. Desktop/mobile screenshots inspected. This fixture is outside the repository and contains no real user or production data; it is not proof of a signed-in live backend transaction.
- Local production HTTP smoke checks: coach/venue landing and search pages and login/signup/recovery request pages returned 200. Account booking and development pages retained login redirects. The coach booking page retained its streamed login redirect. No booking was submitted and no email was sent. Production denial for authenticated Passport access is covered by the server-guard tests, not by a live signed-in test.
- Git diff whitespace check passed. The existing untracked `backups/` and `design-system/` folders were untouched.

## Changed file manifest

- `components/account/PlayerDashboard.tsx` — conditional preview entry only.
- `app/account/development/layout.tsx` and `page.tsx`.
- `app/account/development/passport/page.tsx`, `assessments/page.tsx`, `next-step/page.tsx`, `skills/[skillId]/page.tsx`.
- `components/development/DevelopmentPreviewProvider.tsx`, `DevelopmentShell.tsx`, `DevelopmentUi.tsx`.
- `components/development/MyDevelopment.tsx`, `MyPassport.tsx`, `MyAssessments.tsx`, `MyNextStep.tsx`, `SkillJourney.tsx`.
- `lib/development/types.ts`, `samplePathways.ts`, `progress.ts`, `flags.ts`, `access.ts`, `development.test.ts`.
- `docs/progress-passport-phase-a.md` — this audit, plan, assumptions, database proposal, validation and handoff.
