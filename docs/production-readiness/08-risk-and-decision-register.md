# Risk And Decision Register

## Risk Register

| ID | Risk | Impact | Mitigation | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| R-001 | Application and database share one physical server | Portal and data can be lost in one hardware failure | Off-machine backups, restore drills, future secondary host evaluation | Johnny Bercegeay | Open |
| R-002 | Smartsheet accepts a row but response is lost | Duplicate remote rows after retry | Permanent submission ID, outbox, remote ID lookup, idempotent API | Technical owner | Planned |
| R-003 | Browser state mixes associates | Incorrect attribution and blocked sign-out | Server-owned versioned workspaces and session isolation | Technical owner | Planned |
| R-004 | Combined frontend causes cross-department regression | One department change breaks another | Separate department pages/modules and department test suites | Technical owner | Planned |
| R-005 | Large rewrite delays reliability improvements | Current incidents continue during development | Incremental PL-first vertical slices and compatibility flags | Johnny Bercegeay | Open |
| R-006 | Database backups exist but cannot be restored | Extended outage or permanent data loss | Scheduled restore drills and documented evidence | Johnny Bercegeay | Mitigated; first target restore passed 2026-06-19 |
| R-007 | Production schema change breaks old release | Rollback becomes unsafe | Expand-and-contract migrations and compatibility testing | Technical owner | Planned |
| R-008 | Worker silently stops | Smartsheet becomes stale | Queue-age monitoring, health checks, and alerts | Operations owner | Planned |
| R-009 | Test environment writes to production sheets | Polluted production data | Environment validation, safe defaults, separate credentials | Technical owner | Open |
| R-010 | Scope expands during foundation work | Delayed delivery and incomplete controls | Approved work packages and phase gates | Johnny Bercegeay | Open |

## Decision Log

| ID | Decision | Reason | Status | Date |
| --- | --- | --- | --- | --- |
| D-001 | Use PostgreSQL 18 as the operational system of record | Current supported release; durable transactions, constraints, recovery, and mature tooling | Approved | 2026-06-19 |
| D-002 | Keep one platform and deployment with three isolated department applications | Reduces operational overhead while limiting cross-department UI coupling | Approved | 2026-06-19 |
| D-003 | Treat Smartsheet as an asynchronous downstream destination | Smartsheet latency or outage must not decide whether work is saved | Approved | 2026-06-19 |
| D-004 | Migrate Precision Liner first | Simplified workflow and greatest current reliability pain | Approved | 2026-06-19 |
| D-005 | Use short-lived `codex/` work branches and protected `main` | Traceable, reviewable, recoverable releases | Approved for playbook | 2026-06-19 |
| D-006 | Avoid permanent department branches | Prevents long-lived divergence and repeated merge conflicts | Approved for playbook | 2026-06-19 |
| D-007 | Use `pg` and `node-pg-migrate` | Small CommonJS-compatible database layer with transactional, versioned PostgreSQL migrations | Approved | 2026-06-19 |
| D-008 | Run the synchronization worker as a separate PM2 process in production | Isolates web availability from worker failures and permits independent restart and scaling | Approved | 2026-06-19 |
| D-009 | Store server sessions in PostgreSQL using secure HTTP-only cookies | Removes authoritative authentication state from the browser and survives process restart | Approved | 2026-06-19 |
| D-010 | Require HTTPS in production and allow HTTP only for local development | Protects credentials and session cookies while keeping local setup practical | Approved | 2026-06-19 |
| D-011 | Default session inactivity to 12 hours and stale kiosk locks to 15 minutes beyond session expiry | Covers long production shifts while providing a bounded stale-lock recovery path | Approved | 2026-06-19 |
| D-012 | Alert when synchronization is pending for five minutes and immediately on terminal failure | Gives operations time to act without coupling database availability to Smartsheet health | Approved | 2026-06-19 |
| D-013 | Start with daily encrypted off-machine backups retained as 14 daily, 8 weekly, and 12 monthly copies | Establishes a practical initial recovery baseline pending company policy | Approved | 2026-06-19 |

## Decision Record Template

Use this format when a decision needs more context than the table:

```text
Decision ID and title:
Date:
Status: Proposed / Approved / Superseded
Context:
Options considered:
Decision:
Consequences:
Approver:
Related work packages:
```

## Defaults Requiring Infrastructure Confirmation, Not Architecture Rework

- PostgreSQL installation service account and eventual company IT owner.
- Physical off-machine backup destination and encryption mechanism.
- Internal DNS name and certificate issuer.
- Monitoring and alert transport destination.
- Department representatives participating in UAT.
- Production maintenance and cutover windows.
