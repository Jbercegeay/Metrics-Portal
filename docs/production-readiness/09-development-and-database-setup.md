# Development And Database Setup

## Supported Baseline

- Node.js 24 LTS-compatible runtime.
- PostgreSQL 18.
- `pg` for pooled database access.
- `node-pg-migrate` for versioned migrations.

Do not use production credentials or production Smartsheets for ordinary development and automated tests.

## Local PostgreSQL Preparation

Create separate administrative, migration, runtime, and backup roles where practical. The exact password values belong in the target machine's protected secret configuration and must not be committed.

Example role and database names:

```text
metrics_portal_admin
metrics_portal_migrator
metrics_portal_app
metrics_portal_backup
metrics_portal
```

Grant the runtime role only the table and sequence permissions needed by the application. The runtime role must not own the database or migrations.

## Environment

Copy `.env.example` to a local `.env` only when creating a new environment. Preserve existing Smartsheet values when upgrading an established environment.

The database foundation uses:

```text
DATABASE_ENABLED=true
DATABASE_REQUIRED=true
DATABASE_URL=postgresql://<runtime-user>:<password>@127.0.0.1:5432/metrics_portal
DATABASE_POOL_MAX=10
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_STATEMENT_TIMEOUT_MS=15000
DATABASE_SSL=false
```

Use a migration-role connection string when applying migrations. Do not place connection strings in Git, logs, screenshots, or program memory.

During compatibility deployment, `DATABASE_ENABLED=false` preserves the existing Smartsheet-backed portal. Set `DATABASE_REQUIRED=true` only after PostgreSQL is installed, migrated, and verified. Production database-backed submissions will require both flags to be true.

## Commands

```powershell
npm ci
npm run migrate:up
npm test
npm run test:database
node server.js
```

Create a new migration with:

```powershell
npm run migrate:create -- descriptive-name
```

Never edit an applied migration. Add a new migration and use a forward repair when production data may already depend on the previous schema.

## Health Verification

- `GET /api/v2/health` is process liveness and never depends on Smartsheet.
- `GET /api/v2/health/ready` checks database connectivity and the foundation migration.
- When the database is intentionally disabled for compatibility, readiness reports the database as `disabled`.
- When the database is enabled but unavailable or not migrated, readiness returns HTTP 503.

Example local checks:

```powershell
Invoke-RestMethod http://localhost:3000/api/v2/health
Invoke-RestMethod http://localhost:3000/api/v2/health/ready
```

## CI

The GitHub Actions workflow starts PostgreSQL 18, applies all migrations to a clean database, runs unit/API/database tests, and audits production dependencies. A migration or database integration failure blocks the workflow.

## Production Prerequisites

Before enabling PostgreSQL on the production server:

1. Confirm the Windows service account and supported PostgreSQL installer.
2. Create restricted migration, runtime, and backup roles.
3. Restrict database listening and firewall access to the application host.
4. Select and secure the off-machine backup destination.
5. Apply migrations with the migration role.
6. Verify readiness with the runtime role.
7. Produce and restore the first backup in an isolated database.
8. Record the release commit and validation result.
