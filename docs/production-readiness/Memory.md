# Production-Readiness Program Memory

## Purpose

This is the durable handoff record for the production-readiness program. It records the current state of the work so a future session or agent can continue without relying on conversation history.

Read this file before beginning production-readiness work. Update it before ending any session that changes code, documentation, architecture decisions, requirements, roadmap status, migrations, deployment configuration, or operational procedures.

Do not store passwords, tokens, connection strings, employee-sensitive data, or production payloads in this file.

## Current Program State

- Status: PL migration implementation and Windows operations tooling are validated in CI; target PostgreSQL 18 is secured, migrated, backed up, and restore-proven. Standalone test-sheet, full-column exact-ID replay, target database/outbox delivery, isolated technical browser UAT, and rollback rehearsal are complete. PL floor-user sign-off, production destination expansion, and final deployment infrastructure remain gates.
- Current phase: Phase 7 - Deployment preparation and controlled validation.
- Production: The three-department Metrics Portal remains active from `C:\ServerData\Repos\Metrics-Portal` on PM2 process `metrics-portal`, port 3002, at the approved `main` deployment. The separate legacy `PL-Portal` on port 3000 is out of scope.
- Target architecture: One platform with separate PL, PTFE, and PI applications, PostgreSQL as the operational system of record, and asynchronous Smartsheet synchronization.
- First department migration: Precision Liner.
- Last updated: 2026-06-22.

## Completed Work

- Drafted the product requirements.
- Drafted the target architecture.
- Drafted the phased delivery roadmap.
- Defined Git branching, pull request, merge, release, hotfix, and rollback rules.
- Drafted data migration, cutover, testing, operations, recovery, risk, and decision documents.
- Established this program memory and handoff requirement.
- Inventoried the local host, application routes, browser state, configuration names, Smartsheet mappings, and operational utilities without recording secrets.
- Approved PostgreSQL, asynchronous Smartsheet delivery, PL-first migration, tooling, worker, session, HTTPS, backup, retention, and alert defaults.
- Added validated database configuration, pooled PostgreSQL transactions, the initial versioned migration, structured request logging, correlation IDs, graceful shutdown, liveness/readiness endpoints, automated tests, CI, and setup documentation.
- Proved the foundation migration and transaction behavior against clean PostgreSQL 18 in GitHub Actions.
- Implemented the Phase 2 submission, outbox, delivery-attempt, and audit schema; idempotent capture API; leased worker; Smartsheet exact-ID check; retry classification; integration health; and supervisor status/retry/resolution interface behind a disabled-by-default feature gate.
- Proved Phase 2 migrations, concurrent idempotency, worker leasing and expired-lease recovery, API authorization, and failure handling against clean PostgreSQL 18 in CI run 27828636152.
- Implemented the Phase 3 server-session and versioned-workspace foundation with hashed opaque tokens, department rollout flags, durable kiosk locks, stale-tab protection, sign-out blocking, and audited discard/release behavior.
- Implemented the isolated PL page, durable jobs/events, browser autosave and conflict handling, validation tooling, Windows backup/restore/health scripts, and guarded target-server bootstrap tooling.
- Installed and secured PostgreSQL 18.4 on the target, then initialized the `metrics_portal` database and separate owner, migration, application, and backup roles without exposing credentials.

## Active Work

- Prepare PL associate and department-lead floor UAT while preserving both live portals and all production feature flags.

## Next Actions

1. Obtain PL associate and department-lead sign-off using the proven isolated browser workflow.
2. Add the expand-only production `Submission ID` column after floor UAT approval, then rerun the read-only production audit.
3. Complete target health/preflight during the approved deployment rehearsal, after the release code exists on the live process path.
4. Keep certificate issuer, alert transport, cutover windows, and department UAT representatives on the deployment-prerequisite checklist.

## Open Decisions

- PostgreSQL installation service account and eventual company IT owner.
- Backup encryption mechanism (the physical off-machine destination is approved).
- Internal DNS name and certificate issuer.
- Monitoring and alert transport destination.
- Production maintenance and department cutover windows.
- Named department representatives for PTFE and PI UAT.

## Known Risks And Blockers

- The application and proposed database will initially share one physical server.
- The current production page combines all three department interfaces.
- Browser `localStorage` still owns substantial active-work state.
- Current production submissions still depend on synchronous Smartsheet responses.
- PL floor-UAT execution and sign-off, TLS, alerting, production destination expansion approval, and cutover approval remain external release gates.

## Latest Validation

- Syntax checked across application, migration, script, and test JavaScript files.
- Local automated suite passes with 70 runnable tests and three expected database-dependent skips outside the CI database job.
- Health endpoints pass against the assembled Express application, including compatibility-mode readiness.
- Local Markdown links pass validation and the production dependency audit reports zero vulnerabilities.
- Draft PR #3 GitHub Actions run 27827283516 passed against PostgreSQL 18, including clean migration, database transaction, application, syntax, documentation-link, and dependency-audit checks.

## Deployment State

- PostgreSQL 18.4 and the migrated application schema are installed on the target; no portal application code or feature flag has been deployed.
- Do not pull planning or incomplete implementation work onto the production server.
- Production deployments must use an approved commit or release tag and the documented release checklist.

## Session Update Template

Append a concise entry below whenever work is performed. Keep the current-state sections above accurate as well.

```text
### YYYY-MM-DD - Short title

- Branch:
- Commit or PR:
- Phase/work package:
- Work completed:
- Files or schema changed:
- Decisions made:
- Validation performed:
- Deployment status:
- Risks/blockers:
- Exact next action:
```

## Session History

### 2026-06-22 - Floor UAT requested operator dropdowns and centered alerts

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; implementation commit `a402654`; GitHub Actions run 27957662030 passed.
- Phase/work package: Phase 7 PL floor acceptance feedback.
- Work completed: Restored the four PL root-cause operator dropdowns using the existing department configuration associate roster and added a centered, keyboard-accessible blocking alert for validation and request failures.
- Files or schema changed: Isolated PL HTML, CSS, browser controller, browser fixture, focused source-contract tests, UAT scenario, changelog, and program memory. No production portal, database, Smartsheet, or live process state changed.
- Decisions made: PTFE, Etch, Teco, and Pebax operator fields are single-choice configured-associate dropdowns, matching the compatibility workflow; oven-head fields remain free text. Success remains a nonblocking toast/status banner, while warnings and failures use the centered alert.
- Validation performed: All 70 runnable tests passed with three expected database-dependent skips; syntax, inline HTML parsing, documentation-link, and diff checks passed. An isolated local browser preview confirmed all four configured operator dropdowns and the centered validation alert with keyboard focus.
- Deployment status: Awaiting isolated floor retest; not deployed to production.
- Risks/blockers: Ashley and Joey must verify the revised controls in isolated UAT before approval.
- Exact next action: Load the validated commit into the active isolated UAT worktree, refresh the browser, and have Ashley confirm PL-UAT-11 and PL-UAT-12.

### 2026-06-22 - Floor UAT confirmed low-yield root-cause rule

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; implementation commit `4c13fc9`; GitHub Actions run 27955998040 passed.
- Phase/work package: Phase 7 PL floor acceptance.
- Work completed: Verified the deployed compatibility behavior with Ashley West and Joey Cox, captured their intended rule, and updated the isolated PL page to open root-cause details and require at least one completed root-cause field at exactly 50% yield or lower.
- Files or schema changed: PL browser page/model, focused boundary and dirty-state tests, UAT scenario, changelog, and program memory. No production portal, database, Smartsheet, or live process state changed.
- Decisions made: Keep notes mandatory below 75%. At 50% yield or lower, require at least one of the seven root-cause text fields or an affirmative operator-comment indicator.
- Validation performed: All 68 runnable tests passed with three expected database-dependent skips; the 50/50 boundary blocks without root cause, accepts one populated detail, and does not trigger at 51% yield. Syntax, HTML parsing, and diff checks passed.
- Deployment status: Awaiting isolated floor retest; not deployed to production.
- Risks/blockers: Ashley and Joey must retest PL-UAT-11 and then complete job/event approval before production destination expansion.
- Exact next action: Publish the fix, load its static assets into the active isolated UAT worktree, and have Ashley verify the 50% boundary.


### 2026-06-22 - PL floor-UAT participants named

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; documentation commit pending at session entry creation.
- Phase/work package: Phase 7 department acceptance.
- Work completed: Recorded Ashley West as PL associate representative, Joey Cox as PL supervisor approver, and Johnny Bercegeay as technical observer.
- Files or schema changed: PL UAT acceptance record and program memory only. No application, server, database, Smartsheet, or process state changed.
- Decisions made: Final PL acceptance will use the isolated test account and destination through the supervised server browser; no unfinished application deployment to floor PCs is required.
- Validation performed: Participant roles are now explicit; technical rehearsal evidence remains complete.
- Deployment status: Not deployed to production.
- Risks/blockers: Ashley and Joey must personally complete and approve the normal job/event workflow before production destination expansion.
- Exact next action: Restart the isolated UAT environment at the latest approved commit and conduct the supervised floor workflow.


### 2026-06-22 - Guarded production Submission ID expansion prepared

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; commit pending at session entry creation.
- Phase/work package: Phase 7 production destination preparation.
- Work completed: Added a dry-run-by-default production destination planner and command that can add exactly one empty `Submission ID` column after floor-UAT approval.
- Files or schema changed: Migration planner, guarded command, focused tests, package command, PL migration runbook, changelog, and program memory. No Smartsheet, database, server, or live process state changed.
- Decisions made: Production expansion remains prohibited before department approval. The command blocks unrelated missing columns, duplicates, formulas, and incompatible existing ID types rather than repairing broader drift.
- Validation performed: All 65 runnable tests passed with three expected database-dependent skips; JavaScript syntax, HTML parsing, documentation links, and diff checks passed. The read-only production dry run found the existing 58-column destination ready for exactly one additive `Submission ID` column and changed zero rows.
- Deployment status: Prepared only; not run against production.
- Risks/blockers: PL associate and department-lead approval is required before apply mode. TLS/DNS, alert transport, and cutover window remain external gates.
- Exact next action: Identify the PL associate representative and department lead or supervisor who will execute and sign the floor-UAT record.
### 2026-06-22 - Isolated PL technical UAT and rollback passed

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; status fix `9928f7f`.
- Phase/work package: Phase 7 technical browser acceptance and rollback.
- Work completed: Completed the isolated PL job and event workflow, corrected and retested the synchronization label, rehearsed feature-flag rollback to the compatibility page, and removed all isolated artifacts.
- Files or schema changed: During rehearsal, two visibly synthetic test-sheet rows and isolated database records were created. Cleanup removed both test-sheet rows and dropped the isolated database. Production data and both live portal processes remained unchanged.
- Decisions made: Count the technical browser and rollback rehearsal as passed. Do not count this as final department acceptance until a PL associate representative and department lead or supervisor sign the same workflow record.
- Validation performed: Required-field errors, autosaved draft persistence across refresh, stale-tab rejection, unsent-work sign-out blocking, durable job capture, durable event capture, background Smartsheet synchronization, corrected submitted-status display, clean sign-out, rollback routing to the compatibility page, test-sheet cleanup, isolated database removal, and live-process invariants all passed.
- Deployment status: Not deployed to production; production database features remain disabled on the Metrics Portal at port 3002.
- Risks/blockers: Named floor UAT participants, production `Submission ID` expansion approval, TLS/DNS, alert routing, and cutover window remain external gates.
- Exact next action: Prepare the guarded expand-only production destination migration, but do not execute it until PL floor-user approval is recorded.


### 2026-06-22 - PL UAT found synchronization-label mismatch

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; implementation commit `9928f7f`; GitHub Actions run 27952445024 passed.
- Phase/work package: Phase 7 supervised PL acceptance and rollback.
- Work completed: Ran the initial isolated browser scenarios through durable job delivery. Corrected the browser banner to recognize the database contract's terminal `submitted` state instead of the unsupported `delivered` label.
- Files or schema changed: PL browser rendering, browser preview support, focused contract test, changelog, and program memory. The isolated UAT database and test sheet contain one synthetic job pending final cleanup; production remained untouched.
- Decisions made: Treat this as a UAT-blocking display defect until the corrected asset is loaded and the same submitted record renders as Smartsheet synced.
- Validation performed: Empty-field validation, server-owned draft refresh, stale-tab rejection, unsent-work sign-out blocking, durable database capture, form clearing, and background delivery all passed. The API reported `syncStatus: submitted`; the stale headline incorrectly remained pending.
- Deployment status: Not deployed to production. Isolated UAT remains active on loopback port 3102; both live portals remained unchanged.
- Risks/blockers: Corrected banner retest, event entry, rollback, and cleanup remain before UAT completion.
- Exact next action: Validate and publish the status fix, load the corrected static asset into the isolated worktree, and confirm the existing submitted job displays as synced.

### 2026-06-19 - Isolated PL browser UAT package prepared

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; UAT package commit in this change.
- Phase/work package: Phase 7 supervised PL acceptance and rollback.
- Work completed: Added guarded UAT-sheet inspection/cleanup, an isolated Windows UAT environment manager with Start/Rollback/Stop actions, and a ten-scenario browser acceptance and rollback record.
- Files or schema changed: Package scripts, one Smartsheet guard utility, one Windows environment manager, the production-readiness index, UAT runbook, changelog, and program memory. No server, database, Smartsheet, or live process state changed locally.
- Decisions made: Run UAT on loopback port 3102 with an isolated database, dedicated empty test sheet, separate web/worker processes, and the built-in PL training identity. Treat the live port 3002 Metrics Portal and out-of-scope port 3000 legacy portal as immutable process-ID invariants.
- Validation performed: JavaScript syntax, PowerShell parser, documentation-link, and diff checks passed; all 61 runnable unit/API tests passed with three database-dependent tests skipped as designed outside the CI database job.
- Deployment status: Tooling prepared but not run on the target; production flags remain disabled.
- Risks/blockers: Physical browser execution, participant names, and written acceptance are now required. TLS/DNS, alert routing, production destination expansion, and cutover approval remain later gates.
- Exact next action: Validate and publish the UAT package, then have the technical observer run Start, the browser scenarios, Rollback, and Stop on the target.

### 2026-06-19 - Target PL database/outbox integration passed

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; validation commit `70f0f19`.
- Phase/work package: Phase 3 full controlled integration.
- Work completed: Executed the one-shot proof on the target using the application role, migrated Metrics Portal database, and isolated PL test sheet.
- Files or schema changed: Synthetic submission, outbox, delivery, audit, and test-sheet row were created and then removed by the guarded validator. No production Smartsheet row, live portal process, or persistent test record changed.
- Decisions made: Close the controlled technical integration gate and advance to human workflow UAT; retain production flags disabled and defer the production `Submission ID` column until UAT approval.
- Validation performed: Database capture committed, exactly one outbox attempt completed, submission/outbox/delivery converged to `submitted`, the remote row ID was linked, no unexpected pending work remained, and both Smartsheet and database test artifacts were removed. PM2 `metrics-portal` remained PID 6936 on port 3002 and legacy `PL-Portal` remained PID 1928 on port 3000. Clean CI run 27841952233 passed before target execution.
- Deployment status: Technical integration validated but not deployed; live Metrics Portal remains unchanged on port 3002 with database features disabled.
- Risks/blockers: Supervised browser UAT, rollback rehearsal, production destination expansion, TLS/DNS, alert routing, and cutover approval remain pending.
- Exact next action: Prepare an isolated target UAT environment and written PL workflow/rollback acceptance record.

### 2026-06-19 - One-shot target PL outbox validation prepared

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; not committed yet.
- Phase/work package: Phase 3 full controlled integration.
- Work completed: Added a guarded one-shot validation spanning target database capture, outbox leasing, real non-production Smartsheet delivery, durable evidence, idle-queue proof, and synthetic cleanup.
- Files or schema changed: Outbox integration command, package script, PL guide, changelog, and program memory. No production external state changed.
- Decisions made: Refuse the production sheet and any nonempty queue; use the application role; process exactly one synthetic submission; require database/outbox/delivery convergence; remove both remote and database test artifacts.
- Validation performed: 50 JavaScript files passed syntax, 34 Markdown files passed links, and 61 local tests passed with 3 expected database skips. Target execution is pending clean CI.
- Deployment status: Not deployed; live Metrics Portal remains unchanged on port 3002.
- Risks/blockers: Execution requires physical target access to enter the application-role password without exposing it.
- Exact next action: Validate and publish the command, then execute it from the pinned target worktree with process-scoped credentials and the isolated sheet ID.

### 2026-06-19 - Controlled PL delivery validation tooling prepared

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; probe not committed yet.
- Phase/work package: Phase 3 controlled Smartsheet validation.
- Work completed: Added a confirmation-guarded non-production delivery probe for exact mapped values, search visibility, permanent Submission ID replay, and test-row cleanup.
- Files or schema changed: Integration-delivery command, package script, PL migration guide, changelog, and program memory. Production Smartsheet remains unchanged.
- Decisions made: The probe must refuse the configured production sheet, use visibly synthetic values, create exactly one row, prove replay returns that same row, and delete all rows it created.
- Validation performed: The probe passed JavaScript syntax, documentation links, the 61-test local suite with 3 expected database skips, and clean CI runs 27841334056, 27841465705, and 27841666256. Its first live attempt created exactly one test row and removed it, but the new value was not yet searchable after 60 seconds; no replay insert was attempted. With bounded extended polling, the next attempt became searchable after 32 searches, replay found the original without insertion, all 11 representative values matched, and cleanup passed. The final full-contract run became searchable after 36 attempts, verified all 36 mapped values, inserted no replay row, and removed its single test row.
- Deployment status: Not deployed; the combined Metrics Portal remains unchanged on port 3002.
- Risks/blockers: Smartsheet search indexing is asynchronous and can require provisioning; cleanup failure would leave only a marked row in the isolated test sheet.
- Exact next action: Run the one-shot target database/outbox proof against the same isolated destination, then prepare supervised browser UAT.

### 2026-06-19 - Empty PL integration destination tooling prepared

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; creation commit `c3c9134`.
- Phase/work package: Phase 3 controlled Smartsheet validation preparation.
- Work completed: Added a confirmation-guarded creator for a standalone empty PL integration sheet built from exact destination-contract metadata and configured defect names.
- Files or schema changed: PL integration-sheet definition, creation command, unit tests, package script, migration guide, changelog, and program memory; one standalone empty integration sheet created in the API identity's Sheets folder. No production sheet changed.
- Decisions made: Prefer a separate blank integration sheet over temporary production rows. Copy no production rows, formulas, automation, attachments, sharing, or employee data; store the returned sheet ID only in approved environment configuration.
- Validation performed: 48 JavaScript files passed syntax, 9 HTML files passed inline-script parsing, 34 Markdown files passed link checks, PowerShell parsed, and 61 local tests passed with 3 expected database skips. The live-config dry run generated a valid 36-column empty contract and created no object; clean CI run 27841158599 passed; the guarded apply then created an empty 36-column sheet, copied zero rows, and passed the destination audit.
- Deployment status: Not deployed; production Metrics Portal remains unchanged on port 3002 and the legacy PL portal remains out of scope on port 3000.
- Risks/blockers: Controlled row delivery/replay/cleanup proof and later floor UAT remain pending.
- Exact next action: Run the guarded delivery probe against the isolated integration sheet and retain only non-sensitive validation evidence.

### 2026-06-19 - Production portal identity corrected and locked down

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; correction not committed yet.
- Phase/work package: Phase 7 target deployment mapping.
- Work completed: Proved that the server hosts two independent portals, corrected the production target from port 3000 to 3002, renamed stale PL-only npm/login branding in the combined repository, and required explicit URL plus page-title verification in Windows health tooling.
- Files or schema changed: Package metadata, login title, Windows preflight/health scripts, target operations documentation, changelog, risk evidence, and program memory. No server process, database, or Smartsheet state changed.
- Decisions made: `PL-Portal` at port 3000 and `Precision-Liner-Portal` are explicitly out of scope. Only PM2 `metrics-portal`, `Metrics-Portal`, and port 3002 may be used for this program's application operations.
- Validation performed: Server listener and HTTP evidence mapped PID 1928/port 3000 to the legacy Precision Liner page and PID 6936/port 3002 to `Metrics Portal - v1.2.0`. PM2 mapped `PL-Portal` to `C:\ServerData\Repos\Precision-Liner-Portal` and `metrics-portal` to `C:\ServerData\Repos\Metrics-Portal`; the latter is GitHub `Jbercegeay/Metrics-Portal` on approved `main` commit `2e936a4`. Locally, PowerShell parsing, JavaScript syntax, inline HTML parsing, Markdown links, and 59 runnable tests passed with 3 expected database skips under the corrected `metrics-portal` package identity.
- Deployment status: Metrics Portal remains live and unchanged on port 3002; legacy PL portal remains live and unchanged on port 3000. Database foundation remains migrated but disabled.
- Risks/blockers: Earlier port-3000 liveness observations are invalid for Metrics Portal and are superseded by this mapping. Controlled Smartsheet validation and remaining release gates are still pending.
- Exact next action: Validate the identity-safety corrections locally and in CI, then continue only against the Metrics Portal target on port 3002.

### 2026-06-19 - Isolated target restore drill passed

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; restore tooling release candidate `b584521`.
- Phase/work package: Phase 7 recovery validation.
- Work completed: Restored the verified post-migration backup into a disposable isolated database, applied the recovery-time migration check, restored runtime grants, verified schema/data/privilege invariants, and removed the drill database after success.
- Files or schema changed: Temporary `metrics_portal_restore_drill` database created and removed; risk register and program memory updated. Production database and live portal were not modified by the drill.
- Decisions made: Target preflight and HTTP health acceptance remain deployment-rehearsal gates because the currently live compatibility commit predates the v2 health endpoints; recovery proof does not require changing the live process.
- Validation performed: Restore script found all seven required operational tables and no pending migrations; `pgmigrations` contained three records, foundation version was 1, application database/schema/table/sequence privileges were correct, and `DROP DATABASE ... WITH (FORCE)` completed without error. R-006 is mitigated by target evidence.
- Deployment status: Database foundation is migrated, backed up, and recoverable but unused; compatibility portal remains live and unchanged.
- Risks/blockers: Controlled Smartsheet exact-ID proof, named PL UAT participants, TLS/DNS, alert transport, and deployment window remain external gates.
- Exact next action: Prepare the guarded `Submission ID` destination schema migration and controlled validation procedure, then identify the approved non-production PL destination and UAT participants.

### 2026-06-19 - Restore drill database creation correction

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; target release candidate `b584521`.
- Phase/work package: Phase 7 isolated restore drill.
- Work completed: Corrected the operator sequence so `CREATE DATABASE` runs alone before connection and schema grants, as required by PostgreSQL.
- Files or schema changed: Restore-drill documentation and program memory only. The rejected statement created no database or schema and did not read or modify the production database.
- Decisions made: Every restore-drill database creation must use a dedicated autocommit command, followed by separately checked grants.
- Validation performed: PostgreSQL rejected the combined creation/grant batch with `CREATE DATABASE cannot run inside a transaction block`; the guarded flow stopped before setting its database-created marker or invoking the restore script.
- Deployment status: No database or portal change; verified post-migration backup remains ready.
- Risks/blockers: Isolated restore proof still pending.
- Exact next action: Rerun the drill with database creation and grants in distinct `psql` calls.

### 2026-06-19 - Verified post-migration backup created

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; backup tooling release candidate `b584521`.
- Phase/work package: Phase 7 post-migration recovery protection.
- Work completed: Created and independently verified an off-server custom-format backup after applying all target migrations.
- Files or schema changed: One post-migration dump and SHA-256 metadata sidecar on the approved backup destination; program memory only in Git. No portal process or configuration changed.
- Decisions made: Use this artifact for the isolated restore drill and retain the smaller pre-migration artifact as the original rollback baseline.
- Validation performed: The 31,237-byte archive passed `pg_restore --list`, matched its recorded SHA-256, and contained `pgmigrations` plus all seven required operational tables.
- Deployment status: Pre- and post-migration backups are verified; database remains unused by the unchanged compatibility portal.
- Risks/blockers: Isolated restore proof, target preflight/health, and external release gates remain pending.
- Exact next action: Restore the post-migration artifact into a disposable `_restore_drill` database, verify migration/data/runtime-access invariants, and remove the disposable database only after success.

### 2026-06-19 - Target migrations and runtime grants passed

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; target release candidate `b584521`.
- Phase/work package: Phase 7 target schema migration.
- Work completed: Installed locked dependencies in the isolated detached worktree, applied migrations 001 through 003 with the migration role, and granted the application role runtime access to existing objects with the guarded superuser script.
- Files or schema changed: Target `metrics_portal` schema now contains the foundation metadata, durable submissions/outbox/audit objects, and sessions/kiosk/workspace objects. The live portal checkout and process were unchanged.
- Decisions made: Treat node-pg-migrate's inability to infer timestamps from deliberately sequential numeric filenames as informational because all three files were explicitly ordered, applied atomically, and recorded in `pgmigrations`.
- Validation performed: `pgmigrations` contains exactly `001_foundation`, `002_durable_submissions`, and `003_sessions_and_workspaces`; all seven required operational tables are present; the application role has schema usage and table read/write while schema creation is denied. The production checkout remains clean on `main`, and the existing portal still listens on port 3000 under the same process.
- Deployment status: Database schema deployed but unused; all database/session/submission flags remain disabled in the unchanged compatibility portal.
- Risks/blockers: Post-migration backup, isolated restore proof, target preflight/health, and external release gates remain pending.
- Exact next action: Create and verify an off-server post-migration backup with the dedicated backup role.

### 2026-06-19 - Pinned worktree verified; portable integrity check corrected

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; target release candidate `b584521`.
- Phase/work package: Phase 7 target migration preparation.
- Work completed: Fetched the release branch and created an isolated detached target worktree at the exact approved commit. Replaced an ad hoc raw SHA-256 check for the runtime-grant script with the commit's Git blob identity plus a clean-worktree check because Windows checkout line-ending conversion legitimately changes raw file bytes.
- Files or schema changed: Program memory only; target release worktree created. Dependency installation and database operations did not run because the integrity check stopped first.
- Decisions made: Verify checked-out release files through the pinned commit, expected Git blob, and clean index rather than platform-dependent post-checkout hashes unless `.gitattributes` enforces byte-identical line endings.
- Validation performed: Target fetched commit `b5845218cbb58dd16fc5dadff8a6eadacb6f09a4`, checked it out detached, and stopped on the expected CRLF-sensitive SHA-256 mismatch before `npm ci`, migrations, or grants. The canonical grant-script blob is `c5dd14df155c578dda8a0df373f68b11f896753f`.
- Deployment status: No schema or live portal change; isolated release worktree is ready to continue.
- Risks/blockers: Migrations and runtime grants remain pending.
- Exact next action: Verify the worktree HEAD, canonical Git blob, and clean grant script, then install locked dependencies and apply the migrations.

### 2026-06-19 - Verified target baseline backup created

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; backup correction head `b584521`.
- Phase/work package: Phase 7 target baseline backup.
- Work completed: Created the first off-server custom-format backup of the initialized pre-migration database with the dedicated backup role. The script verified archive readability and emitted a SHA-256 sidecar.
- Files or schema changed: One verified dump and metadata sidecar on the approved backup destination; program memory only in Git. No database or portal state changed.
- Decisions made: Preserve this pre-migration artifact as the rollback baseline and take another verified backup after migrations.
- Validation performed: The dump completed without an interactive child-process password prompt, contained 891 bytes, passed `pg_restore --list`, and independently matched its recorded SHA-256. Clean CI run 27839735000 passed the backup-script correction and the full PostgreSQL 18 suite.
- Deployment status: Baseline backup gate passed; live compatibility portal remains unchanged.
- Risks/blockers: Target migrations, runtime grants, post-migration backup, isolated restore proof, and external release gates remain pending.
- Exact next action: Create a detached worktree at immutable commit `b584521`, install locked dependencies there, run migrations with the migration role, and grant the application role access to existing objects.

### 2026-06-19 - Backup connection identity correction

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; correction not committed yet.
- Phase/work package: Phase 7 target baseline backup.
- Work completed: Corrected the Windows backup script to parse the supplied PostgreSQL URL into process-scoped libpq variables, explicitly overriding any PostgreSQL identity inherited by the Windows service account while keeping the password out of child-process arguments. Failed or unverified attempts now remove their partial dump and sidecar artifacts.
- Files or schema changed: Windows PostgreSQL backup script, changelog, and program memory; no database or portal state changed.
- Decisions made: Operational database scripts must explicitly set and restore all five connection variables (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE`) before invoking PostgreSQL tools.
- Validation performed: The first target attempt failed safely before creating a dump because `pg_dump` inherited the `trnhrkiosk` identity. The failure exposed no credentials and made no database change. The correction passed PowerShell parsing, Markdown-link checks, 59 local tests with 3 expected database skips, and `git diff --check`.
- Deployment status: Baseline backup not yet created; live compatibility portal remains unchanged.
- Risks/blockers: The corrected pinned script must pass validation and then be rerun on the target.
- Exact next action: Validate and publish the correction, then download it by immutable commit and retry the baseline backup.

### 2026-06-19 - Target database initialization gate passed

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; head `bb29732`.
- Phase/work package: Phase 1/7 target database initialization.
- Work completed: Initialized the empty `metrics_portal` database and separate no-login owner, migration, application, and backup roles with guarded least-privilege grants. Credentials were entered only in the target's interactive session and were not captured.
- Files or schema changed: Target PostgreSQL roles and empty database only; application migrations have not run. This entry updates program memory.
- Decisions made: Require a verified off-server baseline backup before applying the first application migration.
- Validation performed: The pinned bootstrap script passed its SHA-256 check and reported successful database and role initialization; PostgreSQL notices confirmed expected role memberships.
- Deployment status: Database bootstrap complete; live compatibility portal remains unchanged on approved `main`.
- Risks/blockers: Baseline backup, target migrations, runtime grants, isolated restore proof, and external validation gates remain pending.
- Exact next action: Run the pinned backup script with the backup role against the approved UNC destination and retain its verified dump and checksum sidecar.

### 2026-06-19 - PostgreSQL 18 installation gate passed

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; follow-up not committed yet.
- Phase/work package: Phase 1 target PostgreSQL installation.
- Work completed: Removed the mistaken PostgreSQL 13.23 installation, installed PostgreSQL 18.4, enabled automatic service startup, set `listen_addresses=localhost`, and created an enabled inbound block for TCP 5432. Hardened operational scripts to discover PostgreSQL 18 tools even when PATH propagation differs between sessions.
- Files or schema changed: PostgreSQL tool-discovery logic in database initialization, grants, backup, and restore scripts; program memory. No application database has been created yet.
- Decisions made: Standardize on PostgreSQL 18.4 and port 5432; accept the installation only with both local-only binding and defense-in-depth firewall enforcement.
- Validation performed: Server evidence confirmed service `postgresql-x64-18` running automatically; `psql`, `pg_dump`, and `pg_restore` all report 18.4; listeners exist only on `127.0.0.1` and `::1`; inbound block is enabled.
- Deployment status: PostgreSQL service installed and secured; portal remains on compatibility `main` with no database features enabled.
- Risks/blockers: Least-privilege roles/database, migrations, backup, and restore verification remain pending.
- Exact next action: Validate and publish the tool-discovery update, then run the pinned database initialization script on the server.

### 2026-06-19 - Incorrect PostgreSQL 13 installation identified

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; follow-up not committed yet.
- Phase/work package: Phase 1 target PostgreSQL installation.
- Work completed: Identified that the newly installed listener and service are PostgreSQL 13.23, not the approved PostgreSQL 18 release. Confirmed from the installer screenshot that this was the new, mistaken installation rather than a pre-existing workload.
- Files or schema changed: Target bootstrap scripts, production preflight, target runbook, and program memory. No server state changed.
- Decisions made: Remove the unused PostgreSQL 13.23 installation completely, then install PostgreSQL 18 on the standard local port 5432. Do not retain an unnecessary side-by-side cluster.
- Validation performed: Server process and service evidence identified `postgresql-x64-13` under the PostgreSQL 13 installation path. No PostgreSQL 18 service was present.
- Deployment status: PostgreSQL 13.23 is installed but unused; PostgreSQL 18 is not yet installed; compatibility portal remains unchanged.
- Risks/blockers: PostgreSQL 13.23 must be removed, including its empty data directory, before PostgreSQL 18 installation.
- Exact next action: User uninstalls PostgreSQL 13.23, verifies service/port removal, then downloads an installer whose filename begins with `postgresql-18`.

### 2026-06-19 - Initial PostgreSQL listener misidentified

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; follow-up not committed yet.
- Phase/work package: Phase 1 target PostgreSQL installation.
- Work completed: Initial verification found a live PostgreSQL listener and the assumed service-name check failed. Process-based discovery was added before later evidence proved this listener belonged to a pre-existing PostgreSQL 13 installation, not PostgreSQL 18.
- Files or schema changed: Target-server runbook and program memory only.
- Decisions made: Never assume the EDB installation directory or Windows service name; discover both from the port owner. Block inbound TCP 5432 regardless of local-only PostgreSQL binding.
- Validation performed: Server evidence showed PostgreSQL listening on `0.0.0.0` and `::`; the backup UNC path was reachable. No portal or database schema change occurred.
- Deployment status: No new PostgreSQL installation was proven; the compatibility portal remains unchanged.
- Risks/blockers: The existing listener's version and ownership required identification before any action.
- Exact next action: Discover the executable and service from PID ownership without modifying the listener.

### 2026-06-19 - Target server inventoried and PostgreSQL bootstrap prepared

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; bootstrap commit `1422bc4`.
- Phase/work package: Phase 1/7 target database and operations bootstrap.
- Work completed: Recorded the target Windows 11 baseline; confirmed adequate disk, live compatibility portal, installed Node/Git/PM2, absent PostgreSQL tooling, and an identified off-server UNC backup destination. Added guarded scripts for separate owner/migration/application/backup roles and post-migration runtime grants, plus a target-specific bootstrap runbook.
- Files or schema changed: PostgreSQL initialization/grant PowerShell scripts, target-server runbook, playbook index, changelog, and program memory. No server or production schema changed.
- Decisions made: Install the current PostgreSQL 18 Windows release; bind database access locally; use separate least-privilege roles; never print or pass passwords as process arguments; keep all portal database flags disabled until migration, backup, and restore proof pass.
- Validation performed: PowerShell AST parsing passed, 34 documentation files passed local-link checks, 62 tests ran with 59 passing and 3 expected local PostgreSQL skips, and diff formatting passed.
- Deployment status: Not deployed; current production remains on `main` at its pre-readiness compatibility release.
- Risks/blockers: PostgreSQL installation requires an interactive elevated server session. Backup-share permissions for the eventual task identity are not yet proven.
- Exact next action: User installs PostgreSQL 18 from the official Windows installer and returns the non-secret verification output.

### 2026-06-19 - Target bootstrap CI passed

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; bootstrap commit `1422bc4`.
- Phase/work package: Phase 1/7 target database bootstrap validation.
- Work completed: Closed the target bootstrap clean-environment CI gate.
- Files or schema changed: Program memory only.
- Decisions made: None.
- Validation performed: GitHub Actions run 27831977151 passed PowerShell parsing, all migrations, application and PostgreSQL integration tests, syntax, HTML, documentation, and dependency audit against PostgreSQL 18.
- Deployment status: Not deployed.
- Risks/blockers: Interactive PostgreSQL installation is required on the target Windows host.
- Exact next action: Install PostgreSQL 18 with server and command-line tools, then verify its service, versions, and local listener.

### 2026-06-19 - Backup verification and restore drill safeguards added

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; follow-up commit `318679c`.
- Phase/work package: Phase 7 backup and recovery preparation.
- Work completed: Added backup freshness/hash monitoring, server-local `.env` support for scheduled backups, and a guarded isolated restore drill that refuses production-equivalent or nonempty targets, applies migrations, and verifies required tables.
- Files or schema changed: Windows backup, freshness, and restore scripts; operations guide; changelog; and program memory. No production schema changed.
- Decisions made: Scheduled-task registration remains manual until the target service identity and share permissions are known; restore targets must end in `_restore_drill`; credentials are passed through child-process environment variables rather than command arguments; drill database deletion is never automated.
- Validation performed: All PowerShell scripts passed AST parsing. Backup freshness and SHA-256 verification passed against a generated local fixture. No production database or backup was accessed.
- Deployment status: Not deployed.
- Risks/blockers: A full restore execution requires PostgreSQL client tools, an actual verified backup, and an isolated target database on the server.
- Exact next action: Obtain target-server inventory and backup destination details from the user.

### 2026-06-19 - Restore safeguards CI passed

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; follow-up commit `318679c`.
- Phase/work package: Phase 7 backup and recovery validation.
- Work completed: Closed the backup-freshness and isolated-restore safeguard clean-environment CI gate.
- Files or schema changed: Program memory only.
- Decisions made: None.
- Validation performed: GitHub Actions run 27830860822 passed PowerShell parsing, migrations, all application and PostgreSQL integration tests, syntax, HTML, documentation, and dependency audit against PostgreSQL 18.
- Deployment status: Not deployed.
- Risks/blockers: Further verification requires target-server access, PostgreSQL client tools, an approved backup destination, and an isolated restore database.
- Exact next action: User runs the read-only target-server inventory and identifies the approved off-machine backup location.

### 2026-06-19 - Windows operations tooling prepared

- Branch: `codex/windows-operations-tooling` stacked on draft PR #7.
- Commit or PR: Draft PR #8; implementation commit `e10bb4e`.
- Phase/work package: Phase 7 operations and recovery preparation.
- Work completed: Added Windows production prerequisite, verified PostgreSQL backup, and health smoke-test scripts; added PowerShell parser validation to local and CI checks; updated GitHub actions to Node 24-compatible major versions; documented intentionally manual production gates.
- Files or schema changed: PowerShell operations/check scripts, CI workflow, package commands, operations guide, playbook index, changelog, and program memory. No schema change.
- Decisions made: Backups never prune automatically until off-machine daily/weekly/monthly retention behavior is confirmed; database URLs are passed to `pg_dump` through the child environment rather than command-line arguments; production-changing install/deploy steps remain explicit manual gates.
- Validation performed: PowerShell parser check passed, 45 JavaScript files passed syntax checks, inline HTML and 33 documentation files passed, 62 tests ran with 59 passing and 3 expected local PostgreSQL skips, and the production dependency audit reported zero vulnerabilities.
- Deployment status: Not deployed; scripts were not run against a production server or database.
- Risks/blockers: Server-local prerequisite execution requires access to the target Windows server and the approved off-machine backup path. Restore-drill automation depends on PostgreSQL installation and an isolated restore target.
- Exact next action: Obtain the target-server prerequisite inventory and approved off-machine backup path through an interactive server session.

### 2026-06-19 - Windows operations CI passed

- Branch: `codex/windows-operations-tooling`.
- Commit or PR: Draft PR #8; implementation commit `e10bb4e`.
- Phase/work package: Phase 7 operations and recovery preparation.
- Work completed: Closed the Windows operations clean-environment validation gate and removed the prior GitHub Actions Node-runtime annotation by advancing the action majors.
- Files or schema changed: Program memory only.
- Decisions made: No additional local deployment automation will guess target-server identities, storage, network, certificate, or maintenance settings.
- Validation performed: GitHub Actions run 27830671911 passed PowerShell parsing on Linux PowerShell, all three PostgreSQL migrations, 62 application tests, PostgreSQL integration tests, syntax, HTML, documentation, and production dependency audit against PostgreSQL 18.
- Deployment status: Not deployed.
- Risks/blockers: Target Windows server facts and an approved off-machine backup destination are now required for meaningful progress.
- Exact next action: User opens an interactive session on the target server and runs the supplied read-only inventory commands, then returns the output without secret values.

### 2026-06-19 - PL destination contract audited read-only

- Branch: `codex/pl-validation-tooling` stacked on draft PR #6.
- Commit or PR: Draft PR #7; implementation commit `ef6c6a1`.
- Phase/work package: Phase 3 controlled validation preparation.
- Work completed: Added a reusable read-only PL destination contract module and command that combines static master-log requirements with configured defect titles, then detects missing columns, duplicate exact titles, writable formulas, and invalid Submission ID types without reading row contents.
- Files or schema changed: PL destination contract library, validation command, unit tests, package command, changelog, PL migration guide, and program memory. No database or Smartsheet schema changed.
- Decisions made: Destination schema changes remain additive and window-controlled; the audit fails closed and does not offer an implicit write mode.
- Validation performed: 62 local tests ran with 59 passing and 3 expected PostgreSQL skips. A read-only audit against the currently configured PL destination found 57 columns and exactly one missing required contract field: `Submission ID`.
- Deployment status: Not deployed; no external state changed.
- Risks/blockers: PL worker delivery cannot be enabled until an approved `Submission ID` text-compatible column is added to the intended destination and this audit returns READY.
- Exact next action: Continue safe deployment and operations preparation before requesting the controlled destination change.

### 2026-06-19 - PL destination audit CI passed

- Branch: `codex/pl-validation-tooling`.
- Commit or PR: Draft PR #7; implementation commit `ef6c6a1`.
- Phase/work package: Phase 3 controlled validation preparation.
- Work completed: Closed the destination-audit clean-environment CI gate.
- Files or schema changed: Program memory only.
- Decisions made: None.
- Validation performed: GitHub Actions run 27830472821 passed migrations, 62 application tests, PostgreSQL integration tests, syntax, HTML, documentation, and production dependency audit against PostgreSQL 18.
- Deployment status: Not deployed.
- Risks/blockers: The configured PL destination remains NOT READY until the approved `Submission ID` column is added.
- Exact next action: Prepare deployment, backup, monitoring, and rollback automation without enabling production.

### 2026-06-19 - Isolated PL page and durable workflow implemented

- Branch: `codex/pl-page-extraction` stacked on the validated server-workspaces branch.
- Commit or PR: Commit `5919c9c`; stacked draft PR #6.
- Phase/work package: Phase 3 PL page extraction and durable workflow binding.
- Work completed: Added the isolated `/pl/` module, authenticated feature/session startup, server autosave with stale-tab stop, durable job and event capture with permanent retry identity, database-versus-Smartsheet status, guarded sign-out/discard, and PL login routing. Removed hourly tracking, End Shift, browser-local workspace ownership, and local associate switching from the isolated module.
- Files or schema changed: PL HTML/CSS/model/app bundle; shared API client; safe feature-state route; login routing; model/API/browser support tests; changelog; and PL migration guide. No schema change.
- Decisions made: One authenticated associate owns one PL server workspace; one submitted PL form is one logical durable row; Smartsheet delivery status is never presented as a condition of database durability; the compatibility page remains the flag-controlled rollback path.
- Validation performed: 42 JavaScript files passed syntax checks, inline scripts parsed, 59 local tests passed with 3 expected PostgreSQL skips, 32 documentation files passed local-link checks, the production dependency audit reported zero vulnerabilities, authenticated reporting fields were proven server-canonical, and real-browser checks proved job/event autosave and capture, pending-to-synced status, form clearing, stale-tab blocking and recovery, and 768 by 1024 responsive layout without horizontal overflow.
- Deployment status: Not deployed; all rollout flags remain disabled by default.
- Risks/blockers: Controlled Smartsheet exact-ID delivery, parallel output comparison, PL floor UAT, and rollback rehearsal remain cutover gates requiring the approved environment and people.
- Exact next action: Prepare the controlled PL validation and deployment tooling without enabling production flags, then provide the exact physical cutover prerequisites when no further safe local work remains.

### 2026-06-19 - PL page PostgreSQL CI passed

- Branch: `codex/pl-page-extraction`.
- Commit or PR: Draft PR #6; head `5919c9c` before this evidence-only memory update.
- Phase/work package: Phase 3 PL clean-environment validation.
- Work completed: Closed the isolated PL page clean-database CI gate.
- Files or schema changed: Program memory only; no application or schema behavior changed.
- Decisions made: Keep all PL rollout flags disabled and continue only safe preparation until controlled Smartsheet comparison and floor acceptance are available.
- Validation performed: GitHub Actions run 27830248902 applied all three migrations and passed syntax, inline HTML, documentation, 59 application tests, PostgreSQL integration tests, and the production dependency audit against PostgreSQL 18.
- Deployment status: Not deployed.
- Risks/blockers: GitHub reports a non-failing future-runtime annotation for `actions/checkout@v4` and `actions/setup-node@v4`; current CI passed. PL external validation gates remain open.
- Exact next action: Commit the CI evidence, then prepare controlled PL validation and deployment tooling.

### 2026-06-19 - PL server sessions and workspaces implemented

- Branch: `codex/pl-server-workspaces` stacked on the validated outbox branch.
- Commit or PR: Not committed yet.
- Phase/work package: Phase 3 PL server sessions and workspaces.
- Work completed: Added users, server sessions, durable kiosk locks, and optimistic-versioned workspace schema and services. Integrated compatibility login with department-gated HTTP-only sessions, protected submission identity with the authenticated session, added session/workspace APIs, blocked unsafe sign-out, and audited discard and supervisor lock release.
- Files or schema changed: Migration `003_sessions_and_workspaces.js`; identity/workspace repositories; session/workspace services and routes; server integration; runtime flags; tests; environment example; changelog; and session/workspace guide.
- Decisions made: PL sessions are independently gated so enabling the PL pilot cannot strand PTFE or PI users; the database stores token hashes only; active requests extend inactivity expiry; one open workspace is allowed per user/department.
- Validation performed: 36 JavaScript files passed syntax checks, 47 local tests passed with 3 expected PostgreSQL skips, and GitHub Actions run 27829232827 passed migration 003 and all 50 tests against clean PostgreSQL 18.
- Deployment status: Not deployed; all new flags default false.
- Risks/blockers: HTTPS remains required for production secure cookies. Existing PL frontend extraction and workspace binding are the next work package.
- Exact next action: Extract and bind the PL page to the session/workspace and durable-submission APIs.

### 2026-06-19 - Phase 2 durable submission slice implemented

- Branch: `codex/submission-outbox` stacked on the validated foundation branch.
- Commit or PR: Not committed yet.
- Phase/work package: Phase 2 durable submissions and Smartsheet outbox.
- Work completed: Added the durable schema, atomic idempotent capture, payload conflict detection, worker leasing and restart recovery, attempt history, exact remote submission lookup, retry/backoff/terminal classification, audit events, integration health, supervisor APIs, and the submission status page. Added PM2 web/worker process definitions and kept the slice disabled by default.
- Files or schema changed: Migration `002_durable_submissions.js`; submission repository/services/routes; Smartsheet delivery adapter; worker process; supervisor page and admin links; tests; environment example; changelog; and durable-submission guide.
- Decisions made: One Job x Job row equals one logical submission; every destination requires a `Submission ID` column; durable capture requires an explicit feature flag; supervisors are restricted to their authenticated department.
- Validation performed: 28 JavaScript files passed syntax checking, inline scripts in 9 HTML pages parsed, 30 Markdown documents passed local-link checks, 32 unit/API tests passed with 2 expected PostgreSQL skips, the production dependency audit reported zero vulnerabilities, and the supervisor page passed real-browser authentication redirect, disabled-feature messaging, mocked status/action rendering, and 768x1024 responsive inspection. Clean PostgreSQL CI is still required before the slice is complete.
- Deployment status: Not deployed; feature disabled by default.
- Risks/blockers: Destination sheets do not yet have verified `Submission ID` columns. That is a cutover prerequisite, not a local implementation blocker.
- Exact next action: Complete local checks, inspect the supervisor page in a browser, commit, and validate migration/worker behavior in PostgreSQL 18 CI.

### 2026-06-19 - Phase 2 first CI correction

- Branch: `codex/submission-outbox`.
- Commit or PR: Draft PR #4; correction not committed yet.
- Phase/work package: Phase 2 PostgreSQL validation.
- Work completed: Added explicit UUID/text casts to the integration-test count assertion after PostgreSQL rejected one shared parameter inferred across UUID submission IDs and the text audit entity ID.
- Files or schema changed: Integration test and program memory only; no application or schema behavior changed.
- Decisions made: None.
- Validation performed: CI run 27828386297 applied both migrations and passed 33 tests; the sole failure was PostgreSQL error 42883 in the test assertion after the application transaction completed.
- Deployment status: Not deployed.
- Risks/blockers: Awaiting corrected CI evidence.
- Exact next action: Commit and push the focused test correction, then confirm the replacement PostgreSQL 18 run.

### 2026-06-19 - Phase 2 deterministic lease test correction

- Branch: `codex/submission-outbox`.
- Commit or PR: Draft PR #4; final correction commit `13074a7`.
- Phase/work package: Phase 2 worker restart validation.
- Work completed: Replaced a timing-sensitive 20 ms concurrent lease test with a normal 60-second concurrency assertion followed by an explicit database lease expiration and recovery claim.
- Files or schema changed: Integration test and program memory only.
- Decisions made: Restart recovery tests manipulate the lease timestamp explicitly so runner scheduling cannot turn legitimate lease expiry into a false concurrency failure.
- Validation performed: CI run 27828469533 applied both migrations and passed 33 tests; the sole failure showed two sequential claims because the intentionally tiny lease expired during runner scheduling. Follow-up run 27828573590 proved one concurrent claim and one recovered claim, then exposed a stale expected retry count of 1 even though recovery correctly increments the count to 2.
- Deployment status: Not deployed.
- Risks/blockers: Non-production Smartsheet exact-ID proof requires a destination with the approved `Submission ID` column before cutover.
- Exact next action: Implement PL server sessions/workspaces and isolated durable capture while the live-sheet gate remains disabled.

### 2026-06-19 - Phase 2 clean PostgreSQL validation passed

- Branch: `codex/submission-outbox`.
- Commit or PR: Draft PR #4; head `13074a7`.
- Phase/work package: Phase 2 validation.
- Work completed: Closed the durable submission implementation database gate.
- Files or schema changed: No additional schema or application change; this entry records validation evidence.
- Decisions made: Continue PL implementation with the feature disabled while preserving non-production Smartsheet proof as a cutover requirement.
- Validation performed: GitHub Actions run 27828636152 passed both migrations, 34 automated tests, syntax checks, inline HTML script parsing, documentation-link checks, and production dependency audit against PostgreSQL 18.
- Deployment status: Not deployed; feature disabled by default.
- Risks/blockers: Required `Submission ID` destination columns and controlled Smartsheet delivery remain external cutover prerequisites.
- Exact next action: Begin Phase 3 durable sessions, server workspaces, and isolated PL page.

### 2026-06-19 - Phase 1 engineering foundation implemented

- Branch: `codex/postgres-foundation` stacked on the approved Phase 0 commit.
- Commit or PR: Not committed yet.
- Phase/work package: Phase 1 engineering foundation.
- Work completed: Added runtime environment validation, PostgreSQL pooling and transaction support, initial migration, structured redacted logs, request IDs, graceful shutdown, liveness/readiness endpoints, automated tests, CI, and database setup documentation. Updated vulnerable production dependencies to patched versions.
- Files or schema changed: Added `app_metadata` foundation migration, database/runtime/logging/health modules, CI workflow, tests, check scripts, `.env.example`, setup guide, and changelog entry; integrated the foundation into `server.js`.
- Decisions made: Database support remains disabled by default for compatibility until an environment is installed, migrated, and verified.
- Validation performed: JavaScript syntax (19 files at the time of the check), Markdown links (29 files), 13 passing automated tests, assembled-app health smoke tests, `git diff --check`, and zero production dependency vulnerabilities. PostgreSQL integration test is correctly skipped locally because no server is installed.
- Deployment status: Not deployed.
- Risks/blockers: Clean PostgreSQL migration evidence is pending CI; physical production-server prerequisites remain deferred until deployment preparation.
- Exact next action: Commit and push the foundation, confirm PostgreSQL 18 CI, then implement the Phase 2 durable submission schema and API.

### 2026-06-19 - Phase 1 first CI correction

- Branch: `codex/postgres-foundation`.
- Commit or PR: Draft PR #3; correction commit `0f03740`.
- Phase/work package: Phase 1 CI validation.
- Work completed: Made the existing three-department startup environment contract explicit and added safe fake CI/test values after the assembled-app smoke test exposed local `.env` coupling.
- Files or schema changed: Runtime validation, environment example, CI configuration, and tests. No schema change.
- Decisions made: All configuration names required by the currently assembled three-department server are validated at startup; secret values remain environment-only.
- Validation performed: The first clean PostgreSQL 18 CI run successfully applied the migration and passed the database transaction test before failing only on a missing PTFE Job Log test variable. Replacement run 27827283516 passed all checks after the correction.
- Deployment status: Not deployed.
- Risks/blockers: None for the engineering foundation; production installation remains a later infrastructure prerequisite.
- Exact next action: Implement Phase 2 durable submission storage and idempotent API.

### 2026-06-19 - Phase 0 current-state inventory

- Branch: `codex/production-readiness-phase0`.
- Commit or PR: None yet.
- Phase/work package: Phase 0 discovery and inventory.
- Work completed: Verified the local development host and documented the current application, API, browser state, submission behavior, Smartsheet integrations, configuration names, utilities, and confirmed baseline risks.
- Files or schema changed: Added `00-current-state-inventory.md`; updated the playbook index and program memory. No schema changes.
- Decisions made: None; core architecture and ownership approvals remain pending.
- Validation performed: Repository inspection, route and environment-reference search, runtime version checks, and local PostgreSQL/PM2 prerequisite checks. Secret values were not read into documentation.
- Deployment status: Not deployed; documentation-only work on an isolated branch.
- Risks/blockers: Production infrastructure, owners, backup destination, test sheets, windows, and baseline incident counts require external confirmation.
- Exact next action: Obtain Phase 0 approvals, then implement the database and test foundation on a bounded engineering branch.

### 2026-06-19 - Phase 0 architecture approved

- Branch: `codex/production-readiness-phase0`.
- Commit or PR: None yet.
- Phase/work package: Phase 0 approval.
- Work completed: Recorded the approved core architecture, interim ownership, and sensible defaults for database tooling, worker isolation, sessions, HTTPS, backups, retention, and synchronization alerts.
- Files or schema changed: Product requirements, risk and decision register, and program memory. No schema changes.
- Decisions made: D-001 through D-004 and D-007 through D-013 approved by Johnny Bercegeay.
- Validation performed: Confirmed PostgreSQL 18 is the current supported major release and verified the selected migration tooling supports the local Node runtime and PostgreSQL target.
- Deployment status: Not deployed.
- Risks/blockers: Physical backup storage, certificate issuer, alert transport, windows, and department UAT representatives remain deployment prerequisites, not Phase 1 design blockers.
- Exact next action: Commit Phase 0 and begin the Phase 1 engineering foundation.

### 2026-06-19 - Production-readiness playbook established

- Branch: `main` working tree; documentation not yet committed.
- Commit or PR: None yet.
- Phase/work package: Phase 0 planning.
- Work completed: Created the initial playbook documents and durable memory convention.
- Files or schema changed: Documentation only; no database or production schema changes.
- Decisions made: Use short-lived `codex/` branches, keep `main` deployable, and deploy only approved commits or release tags.
- Validation performed: Markdown link and diff formatting checks.
- Deployment status: Not deployed.
- Risks/blockers: Phase 0 ownership and infrastructure decisions remain open.
- Exact next action: Review and approve the Phase 0 requirements and decision list.
