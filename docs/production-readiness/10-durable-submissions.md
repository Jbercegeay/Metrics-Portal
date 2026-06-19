# Durable Submission Platform

## Capture Contract

`POST /api/v2/submissions` accepts one logical job, event, or Job x Job row. The browser creates a UUID when submission begins and reuses that UUID for every retry.

Required fields:

```json
{
  "id": "permanent-uuid",
  "department": "PL",
  "associateName": "Associate Name",
  "entryType": "job",
  "workDate": "2026-06-19",
  "kioskId": "controlled-kiosk-id",
  "payload": {
    "Entry Type": "Job"
  }
}
```

Each Job x Job row is a separate logical submission. Batch arrays are rejected because one permanent submission ID must identify one remote row.

The database transaction inserts:

1. The immutable normalized submission and payload hash.
2. One unique outbox record containing the delivery snapshot.
3. The submission-created audit event.

A replay with the same ID and payload returns the existing record. Reusing an ID with a different payload returns HTTP 409.

## Feature Gate

The API and worker remain unavailable unless both settings are true:

```text
DATABASE_ENABLED=true
DURABLE_SUBMISSIONS_ENABLED=true
```

This gate must remain false in production until the target database is migrated, the required Smartsheet columns exist, and a controlled account passes capture and delivery validation.

## Outbox Worker

The worker runs separately from the web process:

```powershell
npm run start:worker
```

Production PM2 process definitions are in `ecosystem.config.js`.

Worker behavior:

- Claims one eligible row using `FOR UPDATE SKIP LOCKED`.
- Uses a renewable-by-reclaim lease so a stopped worker cannot strand a row.
- Records every attempt in `submission_deliveries`.
- Searches the destination for the exact permanent submission ID before every insert.
- Treats timeout, connection, server, and rate-limit failures as retryable.
- Uses exponential backoff with jitter up to the configured maximum.
- Moves permanent failures and exhausted retries to `needs_review`.
- Never deletes failed or uncertain submissions.

## Smartsheet Prerequisite

Every destination sheet must contain a writable text/number column titled exactly:

```text
Submission ID
```

Do not enable the worker until that column has been added to the PL, PTFE, and PI master logs and the PTFE and PI Job x Job logs. The worker refuses delivery and moves the record to `needs_review` when the column is missing.

The worker uses Smartsheet's sheet-search operation for the exact submission ID and verifies the matching row's cell before deciding that a prior uncertain request was accepted.

## Supervisor Status

`public/submissions.html` provides department-scoped filtering and status details. Existing supervisor sessions authorize:

- `GET /api/v2/submissions`
- `POST /api/v2/submissions/:id/retry`
- `POST /api/v2/submissions/:id/resolve`

Retry and manual resolution require a reason and create an audit event. A supervisor cannot manage another department's records.

The public submission-detail endpoint returns status metadata but not the stored payload snapshot.

## Health

`GET /api/v2/health/integrations` reports pending count, `needs_review` count, oldest pending age, and last successful delivery. Health becomes degraded when a record needs review or the oldest pending item reaches five minutes.

## Failure Evidence

Automated coverage includes:

- Concurrent replay creating one submission, outbox row, and audit event.
- Different payload reuse returning a conflict.
- Worker lease expiry and restart recovery.
- Timeout after remote acceptance followed by exact-ID discovery instead of another insert.
- Rate-limit, authentication, mapping, retry exhaustion, and connection classification.
- Supervisor authorization and department isolation.
- Database transaction rollback and migration readiness.
