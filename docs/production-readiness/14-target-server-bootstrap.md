# Target Server Bootstrap

## Verified Baseline

The target is a 64-bit Windows 11 Enterprise host with adequate free space on the system and application-data volumes. Node.js, npm, Git, and PM2 are installed. The three-department compatibility Metrics Portal is listening on port 3002 from its production `main` checkout. PostgreSQL was initially absent; PostgreSQL 13.23 was accidentally installed during bootstrap and was removed before PostgreSQL 18 was installed. The approved off-server backup destination has verified write, hash, and restore behavior.

The host runs two distinct portals. They must never be treated as interchangeable:

| PM2 process | Port | Repository | Scope |
| --- | --- | --- | --- |
| `PL-Portal` | 3000 | `C:\ServerData\Repos\Precision-Liner-Portal` | Legacy PL-only portal; out of scope for this program |
| `metrics-portal` | 3002 | `C:\ServerData\Repos\Metrics-Portal` | Three-department Metrics Portal; production-readiness target |

All Metrics Portal health, deployment, restart, and rollback commands must name `metrics-portal` and use port 3002. Never restart, delete, or deploy into `PL-Portal` as part of this program.

## PostgreSQL Installation Gate

Install the current PostgreSQL 18 Windows release from the [official PostgreSQL Windows download page](https://www.postgresql.org/download/windows/). Confirm the downloaded filename begins with `postgresql-18`, use the standard 64-bit installer on port `5432`, keep the database listener local to the host, install command-line tools, and do not install optional Stack Builder packages. Record the generated superuser password in the approved password manager—not in Git, chat, or this playbook.

After installation, discover the actual executable and service rather than assuming the install directory or service name:

```powershell
$listener = Get-NetTCPConnection -State Listen -LocalPort 5432 | Select-Object -First 1
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
$pgBin = Split-Path -Parent $process.ExecutablePath
$service = Get-CimInstance Win32_Service | Where-Object ProcessId -eq $listener.OwningProcess
$pgBin
$service | Select-Object Name,State,StartMode,PathName
```

Add the discovered `bin` directory to the system PATH, then force local-only listening with the full executable path:

```powershell
$machinePath = [Environment]::GetEnvironmentVariable('Path','Machine')
if (($machinePath -split ';') -notcontains $pgBin) {
    [Environment]::SetEnvironmentVariable('Path', "$machinePath;$pgBin", 'Machine')
}
$env:Path += ";$pgBin"
& (Join-Path $pgBin 'psql.exe') -U postgres -d postgres -c "ALTER SYSTEM SET listen_addresses = 'localhost';"
Restart-Service -Name $service.Name
```

Create a defense-in-depth inbound block even after local-only binding:

```powershell
if (-not (Get-NetFirewallRule -DisplayName 'Metrics Portal - Block PostgreSQL inbound' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'Metrics Portal - Block PostgreSQL inbound' `
        -Direction Inbound -Action Block -Protocol TCP -LocalPort 5432
}
```

Open a new elevated PowerShell session and verify:

```powershell
Get-Service *postgres*
psql --version
pg_dump --version
pg_restore --version
Get-NetTCPConnection -State Listen -LocalPort 5432
```

The PostgreSQL 18 listener must show only `127.0.0.1` and/or `::1`, never `0.0.0.0` or `::`. Windows Firewall must also block inbound TCP 5432 unless a separately approved administrative source is introduced later.

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
- The listener still binds `0.0.0.0` or `::` after restart.
- The database or roles already exist unexpectedly.
- The off-server backup share cannot be written by the intended scheduled-task identity.
- Any migration, backup verification, or restore drill fails.
