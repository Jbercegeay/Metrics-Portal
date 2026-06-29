# Data Migration And Cutover Plan

## Principles

- Preserve current production operation while the new platform is validated.
- Introduce database-backed behavior department by department.
- Never require a browser and Smartsheet dual-write without reconciliation.
- Make each cutover reversible at the application-routing level.
- Back up before every production migration and verify the backup is readable.

## Environment Progression

Use distinct configuration for:

1. Local development database and test accounts.
2. Integration environment using non-production Smartsheets.
3. Production database and production Smartsheets.

Production credentials and sheet IDs must never be required for ordinary automated tests.

## Initial Database Introduction

1. Install PostgreSQL using the approved version and service account.
2. Restrict network access to the application host.
3. Create separate database roles for administration, migrations, application runtime, and backup where practical.
4. Configure the application connection through `.env`.
5. Apply versioned migrations.
6. Verify application readiness and database health checks.
7. Configure and test automated off-machine backups.

## Existing Data

The first release does not need to import all historical Smartsheet records unless reporting or reconciliation requires it. Recommended approach:

- PostgreSQL becomes authoritative for submissions created after each department's cutover timestamp.
- Smartsheet remains the historical record for earlier entries.
- Store the department cutover timestamp in a controlled configuration or migration record.
- Import only the limited recent history required for status display or duplicate reconciliation.
- Document any imported range and verify row counts and submission IDs.

## Compatibility Strategy

Use versioned APIs and feature flags so old and new department pages can coexist temporarily:

```text
PL_DATABASE_SUBMISSIONS_ENABLED=false
PTFE_DATABASE_SUBMISSIONS_ENABLED=false
PI_DATABASE_SUBMISSIONS_ENABLED=false
```

Feature flags must default to the safest known behavior and be documented per environment. Removing a flag occurs only after the rollback window closes.

## Department Cutover Procedure

1. Freeze unrelated changes for the department.
2. Confirm approved branch is merged and release tag exists.
3. Verify current database backup and available disk space.
4. Apply compatible migrations.
5. Deploy the application and worker with the department flag still disabled.
6. Run health checks and test-account smoke tests.
7. Enable the department for a controlled workstation or test account.
8. Submit known test jobs and events to the test destination.
9. Compare database records, outbox state, and Smartsheet rows.
10. Enable the department for production during the approved window.
11. Monitor errors, queue age, delivery latency, and duplicate count.
12. Obtain floor confirmation from the department lead.
13. Record the cutover timestamp and release commit.

## Precision Liner Pilot

PL is the first migration because its simplified workflow has fewer dependencies and has exposed the current reliability problems.

The PL pilot must test:

- Multiple associates sharing one workstation.
- Refresh during an open job.
- Refresh immediately after Submit.
- Double-click and repeated Retry.
- Application restart with pending synchronization.
- Smartsheet unavailable while jobs and events are recorded.
- Sign-out with saved, open, pending, and failed work.
- Exact Smartsheet field mapping and submission ID.

As of the PL floor acceptance record, the isolated browser workflow, exact-ID delivery proof, target database/outbox proof, rollback rehearsal, guarded cleanup, fresh backup, and production `Submission ID` expansion have passed. The remaining PL pilot gate is controlled release deployment with production feature flags disabled, followed by the approved PL cutover window and post-cutover observation.

## Reconciliation

During each observation window, compare:

- Count of database submissions by department/date/type.
- Count of successfully delivered outbox records.
- Count of Smartsheet rows created by the new portal.
- Missing remote row IDs.
- Duplicate submission IDs in Smartsheet.
- Records in `failed` or `needs_review` state.

Differences require documented resolution before completing the phase.

## Rollback

Application rollback may disable the new department route and return users to the prior page. It must not delete database submissions already captured.

If rollback occurs:

1. Stop new traffic to the affected workflow.
2. Record the release, time, and reason.
3. Disable the department feature flag.
4. Return the application to the previous approved release if required.
5. Keep the database and worker available unless they are the failure source.
6. Reconcile submissions captured during the attempted cutover.
7. Deliver or export any pending records safely.
8. Correct the issue on a new branch and repeat acceptance testing.

Never manually remove production rows merely to make counts match. Corrections must be auditable.
