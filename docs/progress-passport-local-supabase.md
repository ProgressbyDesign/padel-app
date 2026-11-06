# Phase B.1 follow-up — full local Supabase validation

Investigation started 2 November and completed 3 November 2026. **The local environment blocker is resolved. No paid/hosted project is needed for this validation.** No remote migration, production data mutation, hosted configuration change, deployment, push or merge occurred. Phase C has not started.

## Docker / WSL diagnosis

- Docker Desktop **4.87.0**, Docker Engine/CLI **29.7.2**, Linux container mode, `desktop-linux` context.
- WSL **2.7.11.0**, Linux kernel **6.18.33.2-microsoft-standard-WSL2**. `WslService` and virtualisation work; a network-disabled test container executed successfully.
- Initial Desktop/WSL status was stopped while its Docker API was available. Logs identify Resource Saver idle shutdown. A Docker request woke the engine and Desktop transitioned to running normally.
- The historical `sailor-ingest.sock` startup failure from 30 October is **not reproducible now**. Its exact original cause remains unconfirmed; today's normal parent/backend-services processes are not evidence of duplicate failed engines. No socket files were deleted, no factory reset/reinstall/WSL unregister was performed, and no global Docker setting was changed.
- A replacement runtime was unnecessary. Podman/Rancher or another WSL distribution would add complexity without fixing an active engine defect.

The installed/current Supabase CLI is **3.0.0**, whereas the B.1 run used 2.122.0. This is a major CLI rewrite; the verified setup pins 3.0.0 instead of relying on whatever `npx ...@latest` resolves later. Local PostgreSQL is **17.11**, image `public.ecr.aws/supabase/postgres:17.11.0.011`; production was neither upgraded nor contacted. The major version remains 17.

## Isolation, port binding and a corrected startup issue

Created a separate, **unlinked** scratch workspace:

`C:/Users/Mateusz Paliga/.codex/.chatgpt-projects/g-p-69d94c4047d88191abf5b95ae0d82436/.supabase-b1-stack`

Project ID: `padel-b1-local`. Docker network: `padel-b1-loopback`. None of the existing application's environment files, Supabase project reference files or remote settings were used or changed. The existing unrelated `welcome-to-docker` container was left alone.

An internal-only Docker network initially suppressed host port publication, preventing the CLI from reaching its database. A normal dedicated bridge allowed connectivity. **The CLI/runtime then ignored that bridge's loopback default and briefly published test ports on `0.0.0.0` / IPv6 wildcard addresses. The test containers were stopped immediately when inspection revealed this. No app/customer data had been imported at that point.** The network option alone is therefore insufficient protection on this setup.

Explicit loopback bindings were applied, then a test-process-only Docker CLI guard was added **before subsequent container creation**. `LoopbackDocker.cs` rewrites `-p` / `--publish` mappings to `127.0.0.1`, rejects other/implicit addresses and publish-all, and transparently forwards Docker output/input. `Invoke-LocalSupabase.ps1` compiles that guard into the scratch directory, prepends it only to its own process PATH, supplies the actual installed Docker path and restores both environment values afterward. It exposes only Start/Reset/Status/Stop actions for the unlinked `padel-b1-local` project. It checks actual running port bindings and stops the test containers if a wildcard is found. No installed executable, firewall rule or system PATH was modified.

Verified both Docker's actual `NetworkSettings.Ports` **and Windows listening sockets**, not only intended configuration. Verified the guard before starting a probe container, plus negative IPv6 wildcard and publish-all tests. Final published endpoints when started are:

- API/Auth/REST/Storage: `http://127.0.0.1:55321`
- Database: `127.0.0.1:55322`, database `postgres`
- Studio: `http://127.0.0.1:55323`
- Local Mailpit: `http://127.0.0.1:55324`

Internal services have no host-published ports. The corrected bridge is not an internet-egress firewall; local Auth mail uses Mailpit, external providers are disabled and no production secrets/SMTP configuration were loaded. All generated keys/passwords/tokens stay in private scratch files or test-process memory, never in the report or repo.

## Complete application replay and the baseline defect found

The existing repository has **20 application migrations**, beginning at Sprint 6A; it lacks the original empty-database baseline. A normal fresh start without that baseline cannot create `public.profiles`. Preserving the historical production migration files is intentional.

Added a **schema-only test fixture**, `supabase/tests/fixtures/pre-sprint6a-schema.sql`, copied byte-for-byte from the inspected backup. It contains DDL, functions, grants and policies, **not customer rows**, and is outside the production migration directory. SHA-256:

`3a3f1c3ce371a5c2bd1699d1824b13bf004f6baee969808c8750d403f47549f2`

The portable preparation script uses that fixture, so a reviewed checkout no longer depends on an untracked customer-backup directory. The original backups were not edited. No new baseline migration was added to the application's production history.

The fresh Supabase stack revealed a defect the native replay had not exercised: **default managed-stack grants are additive when restoring a schema dump**. Baseline tables inherited full authenticated UPDATE privileges before the dump restored its intended column grants. Sprint 6A's existing permission assertion correctly failed. The disposable bootstrap now clears fresh-stack default client table/sequence/function grants before restoring the snapshot; the snapshot then establishes its own privileges and future defaults. The existing applied Sprint 6A migration was not altered or weakened.

The scratch-only bootstrap also attaches the existing `private.handle_new_user()` function to managed `auth.users`, because the schema-filtered public/private dump omitted the Auth-side trigger attachment. Real GoTrue signup then proves that profile creation works and user-editable metadata cannot choose the account's role. Two synthetic listings satisfy the historical migration's embedded sample-row assertions.

`prepare-supabase-local.mjs` creates that bootstrap through the CLI, gives its **scratch-only** copy an ordering prefix `20260803000000_local_application_baseline.sql`, then copies all 20 repository migrations unchanged. Consequently the local history has **21 entries**. This synthetic entry must never be copied into the production migration directory or used to repair production history.

The stack uses real Supabase-managed Auth/Storage/Realtime/Vault schemas and extensions, real API services and their actual migrations. No replacement Auth tables/functions or PostgreSQL compatibility shim is used. Core services are PostgreSQL, GoTrue, PostgREST, Storage, Realtime, Kong, Postgres Meta, Studio and Mailpit. Unused analytics, Edge Functions and pooler services are disabled.

Successful clean startup and repeated clean resets replayed the full local chain. Database system identifiers and migration versions are recorded in the evidence. The production-bound original migration files remain unchanged. The test bootstrap is a reproducible restoration fixture, not a claim that the missing pre-Sprint-6A historical migrations were reconstructed.

## Verification performed

`validate-supabase-local.mjs` refuses a linked workspace, requires the exact local API/DB ports, verifies the container project label, loopback publication, database address, system identity, migration history and disabled release gate before fixtures. Generated credentials are read internally from local CLI status without being printed.

Passed on the actual stack:

- Original Passport lifecycle SQL and all **17 separate-connection concurrency/security scenario groups**, including payments, free replacement attempts, duplicate decisions/webhooks, eligibility changes, refunds and history integrity.
- GoTrue signup for four synthetic users, confirmation emails captured in Mailpit, rejection before confirmation, confirmation through real Auth verify links and password sign-in.
- Existing installed Supabase JS `getClaims` and GoTrue `user` endpoint verification of actual signed tokens; forged JWT rejection.
- Refresh-token exchange, real recovery email, password reset, old-password rejection and new-password sign-in. No external email was sent.
- Real PostgREST JWT/RLS isolation, protected profile roles and refusal to trust user metadata for admin authority.
- Anonymous base-table denial, private coach exclusion from public profiles and explicit authorised publication through the existing update path. Public projection contact fields remain excluded.
- Actual HTTP Passport command flow: concurrent duplicate order returns one order; player/admin cannot forge provider payment; trusted service event confirms funding; another player cannot read the attempt; only the assigned eligible assessor can verify; suspension removes evidence access and preserves legitimate player history.
- Private schema RPC is not exposed through REST. Real Storage rejects other-player and public access to a synthetic private object. This is **not** a test of future Cloudflare playback or an assertion that existing production storage buckets/policies were reproduced by the schema-filtered backup.
- Seven existing SQL regressions on the same full schema: application email fallback, approval/publication separation, preserving existing coach profiles on approval, registration notification claim, favourites, private venue catalogue and coach-only booking payment attribution. Only synthetic historical booking fixture setup bypasses triggers; real transitions are tested after triggers are restored.
- All **50 Vitest files / 439 tests** pass. New scripts pass targeted ESLint. Existing application TS/TSX and dependency files are unchanged; this pass changes test/setup tooling only.

The Passport database release gate is enabled only temporarily in this isolated synthetic environment to exercise concurrent HTTP operations. It is restored to **false**, including failure cleanup. The final clean reset removes the synthetic accounts/orders and leaves it false. The test stack is then stopped, retaining a clean local migration baseline for a later guarded start. Docker Desktop itself is not globally stopped or reconfigured.

### Advisors and limitations

The known SQL advisor suite was run with CLI **2.122.0** against the explicit local loopback database, never with a linked/remote-project target. It reports the same five legacy definer-view errors, four auth-initplan warnings and 23 multiple-permissive-policy warnings recorded in B.1. There are **no Passport security ERROR/WARN findings**. Private deny-all tables and fresh/covering indexes have the documented informational findings.

The five legacy views are `coach_public_profiles`, `venue_public_profiles`, `coach_public_reviews`, `coach_relationship_identities`, `venue_relationship_identities`. They deliberately project selected fields behind publication/membership filters while base tables stay restricted. The anonymous HTTP checks and existing SQL tests reinforce this boundary; this pass does not silently convert them to invoker views or claim a clean advisor result. Explicit review/acceptance of the legacy design remains required before activation.

This closes the **local engine/full Supabase Auth/JWT/REST/RLS validation blocker** from B.1. It does not test a browser login through the Next.js callback/cookie flow, copy production project configuration or all historical Storage bucket policies, validate real payment/Stream providers, certify throughput, or approve commercial/consent/retention/safeguarding policies. Those remain separate integration/release work. Phase C upload intent ownership, signatures, private playback, media retention/deletion and account-erasure requirements in the B.1 handoff still apply.

## Reuse the free local environment

On this machine the CLI path used was:

`C:/Users/Mateusz Paliga/AppData/Local/npm-cache/_npx/b118335b4cfa220d/node_modules/@supabase/cli-windows-x64/bin/supabase.exe`

For a fresh setup, obtain CLI 3.0.0 using `npx --yes supabase@3.0.0 --version`, then pass the resolved executable path explicitly. Docker Desktop/WSL2 must be running. The Windows launcher uses the .NET Framework compiler already installed with Windows; it introduces no application dependency. The database driver `pg@8.16.3` can be installed into an external temporary tooling directory, not the app.

From the repository, with `$Cli`, `$Local` and `$PgModule` set to those explicit local paths:

```powershell
# Once, for a NEW scratch directory; never use the app's Supabase directory.
node scripts/passport/prepare-supabase-local.mjs --cli $Cli --workdir $Local

# On subsequent use, start/reset through the guard, not raw CLI start/reset.
./scripts/passport/Invoke-LocalSupabase.ps1 -Action Start -Workdir $Local -Cli $Cli
./scripts/passport/Invoke-LocalSupabase.ps1 -Action Status -Workdir $Local -Cli $Cli
./scripts/passport/Invoke-LocalSupabase.ps1 -Action Reset -Workdir $Local -Cli $Cli

# Synthetic fixtures only; resets must target this disposable environment.
node scripts/passport/validate-supabase-local.mjs --cli $Cli --workdir $Local --pg-module $PgModule --evidence "$Local/validation.json"

# Clear fixtures, then stop this project only. No --all or remote flags.
./scripts/passport/Invoke-LocalSupabase.ps1 -Action Reset -Workdir $Local -Cli $Cli
./scripts/passport/Invoke-LocalSupabase.ps1 -Action Stop -Workdir $Local -Cli $Cli
```

Preparation refuses an existing config or linked directory. Start/Reset/Stop are scoped to the dedicated project. Logs can contain generated **local** credentials; keep the scratch directory private and out of version control. Never commit `status.json`, auth email links, signing material or generated binaries. The script does not change the application's existing `.env.local`; opt-in app integration would be separate work.

The standard application's raw `supabase db reset` still needs a formally agreed original-history/baseline strategy; the separate test workspace now provides a portable, reviewed way to validate the complete available chain without rewriting production history. No paid staging project is a prerequisite for proceeding with local Phase C development after review.

## Files changed this follow-up

- `scripts/passport/prepare-supabase-local.mjs`: unlinked scratch setup and schema restoration adapter.
- `scripts/passport/Invoke-LocalSupabase.ps1`, `LoopbackDocker.cs`: process-local port guard and scoped lifecycle commands.
- `scripts/passport/validate-supabase-local.mjs`: real Auth/SMTP/JWT/REST/Storage/RLS/lifecycle checks.
- `scripts/passport/concurrency.mjs`: fixture profile insert tolerates the real Auth trigger; business assertions unchanged.
- `supabase/tests/fixtures/pre-sprint6a-schema.sql`: hash-verified schema-only test fixture, not a production migration.
- `docs/progress-passport-local-supabase.md`, `docs/progress-passport-local-supabase-evidence.json`: this report and sanitised evidence.
- `docs/progress-passport-phase-b1.md`: dated follow-up link; original historical results retained.

Recommended next action: review this local setup and the remaining legacy advisor/policy decisions, then explicitly authorise the Phase C integration slice. No Phase C work is started here.
