# Delivery Roadmap

## Delivery Strategy

Use incremental vertical slices. Keep the current portal available while the new foundation is built and validated. Migrate Precision Liner first, then PTFE, then Polyimide. Do not perform a single big-bang rewrite.

Each phase requires:

- Approved scope and acceptance criteria.
- A dedicated Git branch or a short sequence of bounded branches.
- Tests and documentation delivered with the code.
- A demonstrated rollback path.
- Exit approval before the next production cutover.

## Phase 0: Discovery And Approval

### Work

- Confirm business owners and technical owner.
- Inventory all current forms, fields, calculations, Smartsheet columns, environment variables, and operating procedures.
- Confirm server specifications, disk capacity, Windows version, backup destination, and IT constraints.
- Record current failure examples and establish baseline incident counts.
- Approve the product requirements and architecture decisions.

### Deliverables

- Approved PRD.
- Current-state field and integration inventory.
- Named approvers and support contacts.
- Confirmed PostgreSQL and backup prerequisites.

### Exit Gate

No unresolved question may change the database technology, hosting model, department order, or submission contract.

## Phase 1: Engineering Foundation

### Work

- Install and secure PostgreSQL in development and test environments.
- Select the database library and migration tool.
- Add environment validation.
- Create initial database migrations.
- Add structured logging, correlation IDs, and health/readiness endpoints.
- Add a real automated test command and continuous integration checks.
- Document local database setup and migration commands.

### Exit Gate

- A clean environment can be created from documented steps.
- Migrations apply and roll forward consistently.
- CI validates syntax, tests, and migrations.
- Health checks distinguish application readiness from process liveness.

## Phase 2: Durable Submission Platform

### Work

- Implement submissions, outbox, delivery attempts, and audit tables.
- Implement idempotent submission API.
- Implement Smartsheet background worker.
- Add retry, uncertain-delivery lookup, and `needs_review` handling.
- Add supervisor submission-status API and initial status page.
- Add failure simulation for timeout, rate limit, connection loss, restart, and duplicate request.

### Exit Gate

- Tests prove no acknowledged submission loss.
- Replaying a request does not create another database or Smartsheet record.
- Restarting the app or worker resumes pending work.
- Supervisors can identify and retry failed synchronization.

## Phase 3: Precision Liner Migration

### Work

- Extract PL into its own department page/module.
- Remove obsolete hour-by-hour and End Shift code rather than leaving it hidden.
- Move PL active workspaces to the server.
- Submit PL jobs and events through the durable submission API.
- Preserve required Smartsheet columns and reporting behavior.
- Add PL workflow, shared-kiosk, validation, retry, and sign-out tests.
- Run local, test-sheet, and supervised floor validation.

### Exit Gate

- PL owner signs off on user acceptance testing.
- Parallel comparison confirms expected Smartsheet output.
- No critical or high-severity defects remain.
- Rollback has been rehearsed.

## Phase 4: Precision Liner Stabilization

### Work

- Observe PL production operation for an agreed period.
- Review queue latency, failures, retries, duplicate count, and support reports.
- Resolve architecture defects before copying patterns to other departments.
- Complete PL SOP and supervisor support updates.

### Exit Gate

- Observation period meets the agreed success measures.
- No unresolved systemic reliability issue remains.
- The reusable department migration pattern is documented.

## Phase 5: PTFE Migration

### Work

- Extract PTFE into its own page/module.
- Inventory and preserve PTFE calculations, standards, paretos, events, and Job x Job behavior.
- Move PTFE workspaces and submissions to the common server platform.
- Add PTFE-specific automated and user acceptance tests.
- Cut over using the approved migration procedure.

### Exit Gate

PTFE meets the same reliability, acceptance, rollback, and observation requirements as PL.

## Phase 6: Polyimide Migration

### Work

- Extract PI into its own page/module.
- Preserve PI calculations, standards, paretos, events, and Job x Job behavior.
- Move PI workspaces and submissions to the common server platform.
- Add PI-specific automated and user acceptance tests.
- Cut over using the approved migration procedure.

### Exit Gate

PI meets the same reliability, acceptance, rollback, and observation requirements as PL and PTFE.

## Phase 7: Operations Handoff And Hardening

### Work

- Complete monitoring dashboards and alert routing.
- Run database backup and bare-server recovery drills.
- Complete security and access review.
- Remove retired endpoints and obsolete combined-page code after the rollback window.
- Finalize production SOPs, incident response, deployment, and maintenance procedures.
- Establish quarterly restore tests and dependency patching cadence.

### Exit Gate

- Operations owner accepts the system.
- Restore drill evidence is recorded.
- All departments meet the production-ready definition.
- Deferred items have owners and target releases.

## Work Package Template

Use this template before starting a branch:

```text
Title:
Roadmap phase:
Problem:
In scope:
Out of scope:
Affected departments:
Database changes:
Smartsheet changes:
Security impact:
Acceptance criteria:
Automated tests:
Manual tests:
Documentation updates:
Deployment steps:
Rollback steps:
Approver:
```

