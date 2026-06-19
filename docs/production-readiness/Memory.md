# Production-Readiness Program Memory

## Purpose

This is the durable handoff record for the production-readiness program. It records the current state of the work so a future session or agent can continue without relying on conversation history.

Read this file before beginning production-readiness work. Update it before ending any session that changes code, documentation, architecture decisions, requirements, roadmap status, migrations, deployment configuration, or operational procedures.

Do not store passwords, tokens, connection strings, employee-sensitive data, or production payloads in this file.

## Current Program State

- Status: Phase 1 complete; Phase 2 durable submission platform in progress.
- Current phase: Phase 2 - Durable Submission Platform.
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

## Active Work

- Implement the Phase 2 durable submission platform.

## Next Actions

1. Implement the durable submission, outbox, delivery-attempt, and audit schema.
2. Add the idempotent submission API and background worker.
3. Add supervisor status, retry, and resolution controls.
4. Prove restart, timeout, duplicate, uncertain-delivery, and terminal-failure behavior.
5. Keep the physical backup destination, certificate issuer, alert transport, cutover windows, and department UAT representatives on the deployment-prerequisite checklist.

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
- Commit or PR: Draft PR #4; correction not committed yet.
- Phase/work package: Phase 2 worker restart validation.
- Work completed: Replaced a timing-sensitive 20 ms concurrent lease test with a normal 60-second concurrency assertion followed by an explicit database lease expiration and recovery claim.
- Files or schema changed: Integration test and program memory only.
- Decisions made: Restart recovery tests manipulate the lease timestamp explicitly so runner scheduling cannot turn legitimate lease expiry into a false concurrency failure.
- Validation performed: CI run 27828469533 applied both migrations and passed 33 tests; the sole failure showed two sequential claims because the intentionally tiny lease expired during runner scheduling.
- Deployment status: Not deployed.
- Risks/blockers: Awaiting deterministic replacement CI evidence.
- Exact next action: Commit and push the deterministic lease test, then confirm the PostgreSQL 18 run.

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
