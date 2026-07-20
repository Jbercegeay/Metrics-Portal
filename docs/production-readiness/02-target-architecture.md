# Target Architecture

## Architecture Principle

The portal database is the operational system of record. Smartsheet is a downstream integration and reporting destination. A Smartsheet outage must not determine whether an associate's work is safely recorded.

## Logical Flow

```text
Department Browser App
        |
        | HTTPS/HTTP on approved internal network
        v
Node/Express Application
        |
        | one database transaction
        v
PostgreSQL: submission + outbox + audit
        |
        | asynchronous worker
        v
Smartsheet Department Sheets
```

## Deployment Shape

The initial deployment remains one Windows server computer:

- One Node/Express application managed by PM2.
- One local PostgreSQL Windows service.
- One background synchronization worker, either in the application process initially or as a separately managed PM2 process.
- One portal domain and login experience.
- Separate department production pages or bundles.
- Off-machine database backups.

The tablets communicate only with the Node application. They never connect directly to PostgreSQL or Smartsheet.

## Application Boundaries

Recommended server organization:

```text
server.js                     application bootstrap only
routes/                       HTTP route definitions
controllers/                  request validation and response handling
services/submissions/         durable submission workflow
services/smartsheet/          synchronization and mapping
services/workspaces/          active associate workspace behavior
repositories/                 database access
db/migrations/                versioned schema changes
workers/                      outbox processing
public/shared/                shared browser assets
public/pl/                    Precision Liner application
public/ptfe/                  PTFE application
public/pi/                    Polyimide application
```

This is a target organization, not a requirement to move every file before delivering value. Modules are extracted when their phase is implemented and tested.

## Core Data Model

### users

Stores identity, department membership, role, password hash, active status, and timestamps.

### sessions

Stores authenticated session ID, user, kiosk, expiration, and revocation state.

### workspaces

Stores one associate's active department form state, version number, update timestamp, and status. Optimistic versioning prevents stale tabs from overwriting newer work.

### submissions

Stores the permanent submission ID, department, associate, entry type, normalized payload, validation version, creation time, and lifecycle status.

### submission_outbox

Stores the destination, payload snapshot, attempt count, next attempt time, lock owner, last error, and delivery state. The submission and outbox row are committed in one transaction.

### submission_deliveries

Stores each synchronization attempt, response classification, remote row ID when known, timing, and diagnostic details.

### audit_events

Stores security, workspace, submission, retry, resolution, configuration, and administrative actions.

## Database Rules

- Use PostgreSQL with versioned migrations committed to Git.
- Use database constraints for required relationships and unique submission IDs.
- Use transactions for submission plus outbox creation.
- Store timestamps in UTC and render them in the site timezone.
- Store payload snapshots as structured JSON only where flexibility is required; frequently queried status and ownership fields remain normal columns.
- Never edit a migration after it has been applied to production. Add a new migration.
- Use a restricted application database account, not the PostgreSQL administrator account.

## Idempotency Contract

1. The browser creates or receives a submission ID when the logical entry begins submission.
2. Retries reuse the same ID.
3. The API inserts the submission with a unique database constraint.
4. If the ID already exists, the API returns the existing status.
5. The outbox worker writes the same ID to Smartsheet.
6. An uncertain delivery is checked by ID before another Smartsheet insert.
7. A remote row ID is recorded after confirmed delivery.

This contract applies to jobs, events, Job x Job rows, and future submission types.

## API Direction

Recommended resource-oriented endpoints:

```text
POST   /api/v2/sessions
DELETE /api/v2/sessions/current
GET    /api/v2/departments/:dept/config
GET    /api/v2/workspaces/current
PUT    /api/v2/workspaces/current
POST   /api/v2/submissions
GET    /api/v2/submissions/:id
GET    /api/v2/submissions?status=failed&dept=PL
POST   /api/v2/submissions/:id/retry
POST   /api/v2/submissions/:id/resolve
GET    /api/v2/health
GET    /api/v2/health/ready
```

Existing endpoints may remain during migration. New behavior should be built behind versioned endpoints so department cutovers can occur independently.

## Frontend Direction

- Keep one login page and shared visual system.
- Route authenticated users to a department-specific page.
- Keep department calculations and form behavior in department-owned modules.
- Use a shared API client for authentication, timeouts, error formatting, and request IDs.
- Display database save status separately from Smartsheet synchronization status.
- Keep only non-authoritative convenience data in `localStorage`, such as theme preference.
- Do not store the only copy of open production work in the browser.

## Reliability Controls

- Database transaction around submission and outbox creation.
- Unique constraints for idempotency.
- Worker leases so only one process handles an outbox row at a time.
- Exponential retry with jitter.
- Dead-letter or `needs_review` state after repeated failures.
- Readiness checks for database connectivity and migration state.
- Graceful shutdown so in-flight work is released safely.
- Structured logs containing correlation and submission IDs.

## Architecture Decisions To Confirm

- PostgreSQL major version supported by company IT.
- Database migration tool and query library.
- In-process worker versus separate PM2 worker process.
- Session storage and cookie security settings for the internal network.
- Backup destination, encryption, retention, and restore owner.
- Whether production traffic uses HTTPS immediately or in a later infrastructure phase.

