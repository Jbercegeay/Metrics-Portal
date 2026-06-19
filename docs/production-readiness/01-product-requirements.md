# Product Requirements Document

## Product Statement

The Metrics Portal records manufacturing job and event activity for Precision Liner, PTFE, and Polyimide. It must provide a fast, clear tablet workflow while protecting production data from loss, duplication, cross-associate mixing, and integration failures.

## Users

### Associates

- Sign in at a shared production workstation.
- Select or resume their own workspace.
- Enter and submit jobs and events.
- Receive an unambiguous saved, pending, or failed result.
- Sign out only when open work is safely submitted or intentionally discarded through an authorized process.

### Supervisors and Leads

- Manage department configuration.
- See current and recently active associates.
- Review pending, failed, and completed submissions.
- Retry or resolve failed Smartsheet synchronization without duplicating data.
- Audit who submitted, changed, retried, or discarded a record.

### Administrators and Support

- Deploy and roll back releases.
- Monitor application, database, queue, and Smartsheet health.
- Restore data from backup.
- Diagnose incidents without exposing credentials or sensitive employee data.

## Goals

1. Make the database save fast and authoritative.
2. Make every submission idempotent from browser through Smartsheet.
3. Separate Smartsheet synchronization from the associate's save action.
4. Isolate department user interfaces and department-specific business rules.
5. Move critical active-work state from the browser to the server.
6. Provide visible submission status and actionable failure details.
7. Establish repeatable testing, deployment, backup, and recovery processes.

## Non-Goals For The First Upgrade

- Replacing Smartsheet reporting or existing business reports.
- Building a general manufacturing execution system.
- Rewriting every admin workflow at the same time.
- Splitting departments into separate servers or databases without a security or scaling requirement.
- Changing department calculations or operating procedures unless explicitly approved.
- Adding new production features while the reliability foundation is being established.

## Functional Requirements

### Authentication and Sessions

- The server shall authenticate users by department and role.
- Sessions shall expire after a configurable period of inactivity.
- A kiosk identifier shall be associated with active sessions.
- A supervisor shall be able to release a stale kiosk lock with an audit entry.
- One associate's open work shall never become another associate's work after login, logout, refresh, or workstation reuse.

### Workspaces

- Each active associate shall have an independent server-side workspace.
- A workspace shall include department, associate, work date, current mode, open form data, and update timestamp.
- The portal shall restore an open workspace after refresh or temporary network loss.
- Concurrent edits from two browser tabs shall be detected and rejected or reconciled explicitly.
- Sign-out shall be blocked while required job or event data remains unsaved.

### Submission Capture

- Every logical job or event shall receive a permanent unique submission ID.
- The database shall enforce uniqueness for submission IDs.
- The portal shall acknowledge success only after the database transaction commits.
- A repeated request using the same submission ID shall return the existing result and shall not create another record.
- Validation failures shall identify the specific fields requiring correction.
- A completed record shall preserve the original payload used for synchronization and audit.

### Smartsheet Synchronization

- A committed submission shall create a durable outbox record in the same database transaction.
- A background worker shall deliver outbox records to the correct department sheet.
- Retries shall use exponential backoff and a configured maximum interval.
- The permanent submission ID shall be written to Smartsheet.
- Before retrying an uncertain delivery, the worker shall check whether that submission ID already exists.
- Synchronization status shall include `pending`, `processing`, `submitted`, `failed`, and `needs_review`.
- Repeated failures shall remain recoverable and visible; records shall not be silently discarded.

### Supervisor Status

- Supervisors shall be able to filter submissions by department, associate, date, type, and status.
- Each failed record shall show a safe, useful error message, retry count, and last attempt time.
- Authorized supervisors shall be able to retry a failed synchronization.
- Manual resolution shall require a reason and create an audit entry.

### Department Isolation

- PL, PTFE, and PI shall have separate production entry modules or pages.
- Department-specific fields, calculations, and validation shall remain within the owning module.
- Shared concerns such as authentication, API access, dialogs, and submission status shall use common components.
- A change to one department shall be testable without loading or exercising the other department interfaces.

## Non-Functional Requirements

### Reliability

- Database availability target: 99.5% during scheduled production periods for the initial on-premises deployment.
- No acknowledged submission loss is acceptable.
- Duplicate logical production submissions caused by retries are not acceptable.
- The system shall recover queued synchronization after application or server restart.

### Performance

- A normal database-backed submission should be acknowledged within two seconds on the local network.
- Page interactions should not wait for Smartsheet API completion.
- Department pages should load only the assets required for that department.

### Security

- Database and API credentials shall remain in protected environment configuration.
- The database shall accept connections only from the application host unless explicitly required.
- Passwords shall remain salted and hashed.
- Authorization shall be enforced by the server, not only by hidden buttons.
- Logs shall not contain tokens, passwords, or full sensitive payloads.

### Auditability

- Created, submitted, retried, resolved, discarded, and administrative actions shall be timestamped.
- Audit records shall identify the user, department, workstation, action, and affected record.
- Production records shall not be hard-deleted through normal application workflows.

## Success Measures

- Zero duplicate rows caused by normal retries during a 30-day observation period.
- Zero acknowledged records lost during timeout, refresh, and restart testing.
- 100% of failed Smartsheet synchronizations visible in the supervisor status view.
- Successful database restore from backup during a documented drill.
- Department user acceptance completed with no unresolved critical defects.
- Reduction in associate reports of uncertain submission status to an agreed operational target.

## Approval Questions

These items must be confirmed before implementation scope is locked:

- Who is the business owner for each department?
- Who may discard open work or resolve a failed submission?
- How long must production and audit records be retained?
- What are the approved production hours and maintenance windows?
- Where will off-machine encrypted backups be stored?
- Is the company IT team responsible for PostgreSQL patching and server recovery?
- How long may Smartsheet synchronization remain pending before an alert is required?

## Initial Approved Answers

- Interim product, technical, operations, and UAT approver: Johnny Bercegeay. Department representatives will join UAT before each cutover.
- Discard and manual-resolution actions are restricted to supervisor or administrator roles and always audited.
- Production and audit records default to indefinite retention until a company retention policy is supplied. Normal workflows never hard-delete them.
- Maintenance and department cutover windows will be scheduled outside active production and explicitly recorded for each release.
- Backups default to daily off-machine encrypted storage with 14 daily, 8 weekly, and 12 monthly recovery points. The physical destination remains an infrastructure prerequisite.
- The technical owner coordinates PostgreSQL patching and recovery until company IT formally assumes ownership.
- A pending Smartsheet item becomes alertable after five minutes. Failed or `needs_review` records alert immediately.
