# Target Server Bootstrap

## Verified Baseline

The target is a 64-bit Windows 11 Enterprise host with adequate free space on the system and application-data volumes. Node.js, npm, Git, and PM2 are installed. The compatibility portal is listening on port 3000 from the production `main` checkout. PostgreSQL, `psql`, `pg_dump`, and `pg_restore` are not installed. An off-server UNC backup destination has been identified but its service-account permissions and write behavior still require verification.

## PostgreSQL Installation Gate

Install the current PostgreSQL 18 Windows release from the [official PostgreSQL Windows download page](https://www.postgresql.org/download/windows/). Use the standard 64-bit installer, keep the database listener local to the host, install command-line tools, and do not install optional Stack Builder packages. Record the generated superuser password in the approved password manager—not in Git, chat, or this playbook.

After installation, add the PostgreSQL `bin` directory to the system PATH and open a new elevated PowerShell session. Verify:

```powershell
Get-Service *postgres*
psql --version
pg_dump --version
pg_restore --version
Get-NetTCPConnection -State Listen -LocalPort 5432
```

The listener must not be exposed beyond the local server. Windows Firewall should block inbound TCP 5432 except any separately approved administrative source.

## Database And Roles

From the approved release checkout, initialize separate owner, migration, application, and backup roles. The script prompts securely for all passwords and does not print or pass them as process arguments:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/Initialize-PostgresDatabase.ps1 `
  -Confirmation 'INITIALIZE METRICS PORTAL DATABASE'
```

Store three connection strings separately:

- Migration connection: used interactively only while applying migrations.
- Application connection: stored as server-local `DATABASE_URL` with read/write access but no schema-creation rights.
- Backup connection: supplied to the scheduled backup task and granted PostgreSQL's read-all-data role.

## First Migration

Keep the production portal flags disabled. In the release checkout, temporarily set the current PowerShell process's `DATABASE_URL` to the migration connection and run:

```powershell
npm ci
npm run migrate:up
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/Grant-PostgresRuntimeAccess.ps1 `
  -Confirmation 'GRANT METRICS PORTAL RUNTIME ACCESS'
```

Then remove the temporary process variable and configure the application connection in the ACL-protected server `.env`. Do not restart or enable database features until the backup and restore drill passes.

## Stop Conditions

Stop and report before proceeding if:

- The installer cannot create or start its Windows service.
- Port 5432 is reachable from an unapproved remote host.
- The database or roles already exist unexpectedly.
- The off-server backup share cannot be written by the intended scheduled-task identity.
- Any migration, backup verification, or restore drill fails.
