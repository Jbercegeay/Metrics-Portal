# Operations And Recovery Guide

## Service Components

- Node/Express web application.
- PostgreSQL Windows service.
- Smartsheet synchronization worker.
- PM2 process management.
- Scheduled database backup job.
- Central logs and health monitoring.

## Health Checks

### Liveness

Confirms the Node process is running and able to answer HTTP requests. It must not depend on Smartsheet.

### Readiness

Confirms the application can safely accept production work. It should verify database connectivity, expected migration version, and required internal services.

### Integration Health

Reports Smartsheet worker status, oldest pending item, recent failure count, and last successful delivery. Smartsheet degradation should not automatically make the database-backed portal unavailable.

## Monitoring And Alerts

Monitor at minimum:

- Application process availability and restart count.
- Database service availability.
- Disk free space.
- Database connection failures.
- Queue depth and age of oldest pending submission.
- Failed and `needs_review` submission counts.
- Smartsheet response time, rate limits, and authentication failures.
- Backup job completion and backup age.
- Unexpected duplicate submission IDs.

Alert messages should identify the affected component, department, first failure time, current count, and the first safe action to take.

## Logging

- Use structured logs with timestamp, level, request ID, submission ID, department, and operation.
- Do not log tokens, passwords, or complete sensitive payloads.
- Separate normal application logs from error logs.
- Retain logs for an approved period and rotate them before disk growth threatens the server.
- Record deployment commit and application version at startup.

## Backup Policy

- Run an automated PostgreSQL backup at least daily.
- Store backups off the application server.
- Encrypt backups when required by company policy.
- Retain daily, weekly, and monthly copies according to the approved retention period.
- Monitor backup completion and age.
- Keep database migration files and application releases in Git; backups protect production data, not source code.

## Current Backup Implementation Status

The repository includes Windows backup tooling, and the target server has already produced verified off-machine backups during readiness work. The backup script creates a PostgreSQL custom-format dump, verifies it with `pg_restore --list`, writes a SHA-256 metadata sidecar, and removes partial artifacts if backup or verification fails.

Current state:

- Manual verified backups have been proven against the approved off-server backup share.
- Backup freshness/hash verification tooling exists.
- An isolated restore drill has been proven against a disposable PostgreSQL database.
- Automatic Windows Task Scheduler registration is still a manual operations gate; it must be completed before or as part of the PL database cutover, not assumed merely because the script exists.

Before enabling production PL database submissions, confirm:

1. The scheduled backup task exists and runs as the approved Windows identity.
2. The task identity can read the protected environment file or otherwise receive the backup-role database URL without printing secrets.
3. The task identity can write to the approved off-server backup share.
4. `Test-BackupFreshness.ps1` passes with the agreed maximum age.
5. At least one recent backup has either passed a restore drill or is covered by the documented restore-drill cadence.

## Restore Testing

A backup is not considered valid until restored successfully.

At least quarterly:

1. Select a recent backup.
2. Restore it into an isolated database.
3. Apply any required migrations.
4. Start the application against the restored database.
5. Verify users, workspaces, submissions, outbox records, and audit history.
6. Record duration, issues, and recovery point.
7. Correct deficiencies immediately.

## Incident Priorities

- **P1:** acknowledged data loss, widespread duplicate creation, security incident, or all departments unavailable.
- **P2:** one department blocked, database unavailable, queue not processing, or material data mismatch.
- **P3:** isolated failure with a safe workaround.
- **P4:** minor defect or improvement request.

## Incident Response

1. Record start time, reporter, affected department, and visible message.
2. Preserve screenshots, submission IDs, logs, and release version.
3. Determine whether database saves are succeeding before asking users to retry.
4. Stop or disable only the unsafe component when possible.
5. Do not manually resubmit uncertain records until their IDs are checked.
6. Communicate a clear operator instruction.
7. Restore service through rollback, repair, or fail-safe mode.
8. Reconcile affected submissions.
9. Document cause, corrective action, and prevention.

## Routine Maintenance

- Review failed submissions each production day.
- Confirm backup success daily.
- Review disk space and PM2 restarts weekly.
- Apply supported Node, PostgreSQL, and dependency updates through the normal branch and release workflow.
- Run restore drills quarterly.
- Review access and inactive accounts quarterly.
- Review this playbook after significant incidents or architecture changes.

## Recovery Objectives To Approve

- Recovery Point Objective: maximum acceptable data age lost after a server failure.
- Recovery Time Objective: maximum acceptable time to restore portal operation.
- Maximum acceptable Smartsheet synchronization delay.
- Escalation contacts and after-hours responsibilities.

The initial recommendation is an RPO of 24 hours for catastrophic server loss with daily backups, improved later with more frequent backups or replication. Acknowledged submissions since the last backup remain at risk if the server disk is completely lost, so the final RPO must be explicitly accepted or improved.
