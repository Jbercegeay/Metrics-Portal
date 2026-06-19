# Production-Readiness Program Memory

## Purpose

This is the durable handoff record for the production-readiness program. It records the current state of the work so a future session or agent can continue without relying on conversation history.

Read this file before beginning production-readiness work. Update it before ending any session that changes code, documentation, architecture decisions, requirements, roadmap status, migrations, deployment configuration, or operational procedures.

Do not store passwords, tokens, connection strings, employee-sensitive data, or production payloads in this file.

## Current Program State

- Status: Phase 2 implementation validated in clean PostgreSQL; non-production Smartsheet proof remains a cutover gate. Phase 3 PL migration code is beginning.
- Current phase: Phase 3 - Precision Liner Migration.
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

## Active Work

- Implement PL server sessions/workspaces, isolated frontend, and durable capture while preserving the existing production route behind feature flags.

## Next Actions

1. Add durable server sessions and versioned associate workspaces.
2. Extract PL into an isolated department page and shared browser API client.
3. Route PL jobs and events through durable capture with compatibility flags.
4. Add PL refresh, multi-click, stale-tab, shared-kiosk, validation, and sign-out tests.
5. Keep non-production Smartsheet proof, physical backup destination, certificate issuer, alert transport, cutover windows, and department UAT representatives on the deployment-prerequisite checklist.

## Open Decisions

- PostgreSQL installation service account and eventual company IT owner.
- Physical off-machine backup destination and encryption mechanism.
- Internal DNS name and certificate issuer.
- Monitoring and alert transport destination.
- Production maintenance and department cutover windows.
- Named department representatives for UAT.

## Known Risks And Blockers

- The application and proposed database will initially share one physical server.
- The current production page combines all three department interfaces.
- Browser `localStorage` still owns substantial active-work state.
- Current production submissions still depend on synchronous Smartsheet responses.
- No active implementation blocker has been recorded because Phase 0 is still in planning.

## Latest Validation

- Syntax checked across application, migration, script, and test JavaScript files.
- Local automated suite passes with 13 tests and one expected database test skip because PostgreSQL is not installed locally.
- Health endpoints pass against the assembled Express application, including compatibility-mode readiness.
- Local Markdown links pass validation and the production dependency audit reports zero vulnerabilities.
- Draft PR #3 GitHub Actions run 27827283516 passed against PostgreSQL 18, including clean migration, database transaction, application, syntax, documentation-link, and dependency-audit checks.

## Deployment State

- No production-readiness implementation has been deployed.
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
