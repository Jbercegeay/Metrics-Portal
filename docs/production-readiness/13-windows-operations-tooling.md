# Windows Operations Tooling

These scripts are intended to be run locally on the Windows application server from an approved release checkout. They do not install PostgreSQL, create service accounts, configure Windows Firewall, issue certificates, or create off-machine storage; those actions require server/IT access.

## Preflight

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/Test-ProductionPrerequisites.ps1 -BackupRoot 'X:\MetricsPortalBackups'
```

The preflight checks required commands, `.env`, an existing backup destination, free disk, clean Git state, current commit, and application liveness. It does not print environment values.

## Verified Database Backup

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/Backup-Postgres.ps1 -BackupRoot 'X:\MetricsPortalBackups'
```

The backup command uses PostgreSQL custom format, verifies the archive with `pg_restore --list`, and writes a SHA-256 sidecar. It intentionally does not delete backups. Daily, weekly, and monthly retention must be configured on the approved off-machine destination only after its snapshot or copy behavior is known.

## Health Smoke Test

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/Test-PortalHealth.ps1 -BaseUrl 'https://metrics-portal.internal'
```

Run after migrations and PM2 restart. A deployment is not accepted until liveness, readiness, and integration health return expected states and PM2 shows both the web and worker processes stable.

## Intentionally Manual Gates

- PostgreSQL installation and Windows service identity.
- Database roles and secret entry into the server-local `.env`.
- Internal DNS, TLS certificate, and firewall configuration.
- Creation and permissioning of the off-machine backup path.
- Windows Task Scheduler registration for backups.
- Release tag selection, production checkout, migration execution, and PM2 restart.

These remain manual so the operator must verify the target server, release, destination, and maintenance window before changing production state.
