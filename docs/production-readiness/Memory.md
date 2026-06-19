# Production-Readiness Program Memory

## Purpose

This is the durable handoff record for the production-readiness program. It records the current state of the work so a future session or agent can continue without relying on conversation history.

Read this file before beginning production-readiness work. Update it before ending any session that changes code, documentation, architecture decisions, requirements, roadmap status, migrations, deployment configuration, or operational procedures.

Do not store passwords, tokens, connection strings, employee-sensitive data, or production payloads in this file.

## Current Program State

- Status: PL migration implementation and Windows operations tooling are validated in CI; target PostgreSQL 18 is installed, secured, and initialized. Baseline backup, target migrations, restore proof, and controlled external validation remain gates.
- Current phase: Phase 7 - Deployment preparation and controlled validation.
- Production: The existing portal remains active from the server's approved `main` deployment.
- Target architecture: One platform with separate PL, PTFE, and PI applications, PostgreSQL as the operational system of record, and asynchronous Smartsheet synchronization.
- First department migration: Precision Liner.
- Last updated: 2026-06-19.

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

- Establish the verified target baseline backup, apply migrations from the pinned release candidate, prove restore and health behavior, and preserve the live compatibility portal until release gates are approved.

## Next Actions

1. Create and verify a baseline backup on the approved off-server destination.
2. Apply all migrations from the pinned release-candidate worktree and grant runtime access.
3. Execute an isolated restore drill and target health/preflight checks.
4. Complete controlled non-production Smartsheet proof and PL UAT before enabling any production feature flag.
5. Keep certificate issuer, alert transport, cutover windows, and department UAT representatives on the deployment-prerequisite checklist.

## Open Decisions

- PostgreSQL installation service account and eventual company IT owner.
- Backup encryption mechanism (the physical off-machine destination is approved).
- Internal DNS name and certificate issuer.
- Monitoring and alert transport destination.
- Production maintenance and department cutover windows.
- Named department representatives for UAT.

## Known Risks And Blockers

- The application and proposed database will initially share one physical server.
- The current production page combines all three department interfaces.
- Browser `localStorage` still owns substantial active-work state.
- Current production submissions still depend on synchronous Smartsheet responses.
- Controlled Smartsheet schema/read-write proof, UAT ownership, TLS, alerting, and cutover approval remain external release gates.

## Latest Validation

- Syntax checked across application, migration, script, and test JavaScript files.
- Local automated suite passes with 13 tests and one expected database test skip because PostgreSQL is not installed locally.
- Health endpoints pass against the assembled Express application, including compatibility-mode readiness.
- Local Markdown links pass validation and the production dependency audit reports zero vulnerabilities.
- Draft PR #3 GitHub Actions run 27827283516 passed against PostgreSQL 18, including clean migration, database transaction, application, syntax, documentation-link, and dependency-audit checks.

## Deployment State

- PostgreSQL 18.4 and the initialized empty application database are installed on the target; no portal application migration or feature flag has been deployed.
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
