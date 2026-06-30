# Windows Operations Tooling

These scripts are intended to be run locally on the Windows application server from an approved release checkout. They do not install PostgreSQL, create service accounts, configure Windows Firewall, issue certificates, or create off-machine storage; those actions require server/IT access.

## Preflight

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/Test-ProductionPrerequisites.ps1 `
  -BackupRoot 'X:\MetricsPortalBackups' `
  -BaseUrl 'http://127.0.0.1:3002'
```

The preflight checks required commands, `.env`, an existing backup destination, free disk, clean Git state, current commit, application identity, and application liveness. `BaseUrl` is mandatory so a host running multiple Node portals cannot silently validate the wrong process. It does not print environment values.

When the live production checkout still predates the v2 health endpoints, the prerequisite script may report application liveness as not reachable even though the root Metrics Portal page is serving correctly. In that pre-release state, verify the listener and root-page identity with `curl http://127.0.0.1:3002/` and record the expected `/api/v2/health` 404. Full health acceptance remains a post-deployment gate after the approved release code is on the live process path.

## Verified Database Backup

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/Backup-Postgres.ps1 -BackupRoot 'X:\MetricsPortalBackups'
```

The backup command uses PostgreSQL custom format, verifies the archive with `pg_restore --list`, and writes a SHA-256 sidecar. It intentionally does not delete backups. Daily, weekly, and monthly retention must be configured on the approved off-machine destination only after its snapshot or copy behavior is known.

For a scheduled task, provide `-EnvironmentFile 'C:\path\to\.env'`; the script reads only `DATABASE_URL` and never prints it. The task identity must have read access to that file and write access to the backup destination.

Scheduling status: the script is production-ready and has been proven manually, but the Windows Task Scheduler job remains an explicit manual setup gate. Before PL database cutover, register a daily task that runs this script with the backup role connection, then verify the resulting dump with `Test-BackupFreshness.ps1`. Do not treat manual backup success as proof that recurring backups are active.

Verify backup age and integrity independently:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/Test-BackupFreshness.ps1 -BackupRoot 'X:\MetricsPortalBackups'
```

## Isolated Restore Drill

Create an empty database whose name ends in `_restore_drill`, then run. PostgreSQL requires `CREATE DATABASE` to be the only statement in its `psql -c` invocation; issue owner, connection, and schema grants in separate commands after creation.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/Restore-PostgresDrill.ps1 `
  -BackupFile 'X:\MetricsPortalBackups\metrics-portal-YYYYMMDD-HHMMSS.dump' `
  -RestoreDatabaseUrl 'postgresql://restore_user:password@127.0.0.1/metrics_portal_restore_drill' `
  -Confirmation 'RESTORE INTO ISOLATED DATABASE'
```

The drill refuses a nonempty target, refuses a target without the `_restore_drill` suffix, applies pending migrations, and verifies the required operational tables. Destroying the isolated drill database remains an explicit administrator action.

## Health Smoke Test

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/Test-PortalHealth.ps1 -BaseUrl 'https://metrics-portal.internal'
```

Run after migrations and PM2 restart. The script first proves the root page title contains `Metrics Portal`, preventing the old PL portal from satisfying a health check. A deployment is not accepted until liveness, readiness, and integration health return expected states and PM2 shows both the web and worker processes stable.

## Intentionally Manual Gates

- PostgreSQL installation and Windows service identity.
- Database roles and secret entry into the server-local `.env`.
- Internal DNS, TLS certificate, and firewall configuration.
- Creation and permissioning of the off-machine backup path.
- Windows Task Scheduler registration for backups.
- Release tag selection, production checkout, migration execution, and PM2 restart.

These remain manual so the operator must verify the target server, release, destination, and maintenance window before changing production state.
