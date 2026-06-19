[CmdletBinding()]
param(
    [string]$HostName = '127.0.0.1',
    [int]$Port = 5433,
    [string]$Superuser = 'postgres',
    [string]$DatabaseName = 'metrics_portal',
    [string]$OwnerRole = 'metrics_portal_owner',
    [string]$MigrationRole = 'metrics_portal_migrator',
    [string]$ApplicationRole = 'metrics_portal_app',
    [string]$BackupRole = 'metrics_portal_backup',
    [Parameter(Mandatory = $true)][ValidateSet('INITIALIZE METRICS PORTAL DATABASE')][string]$Confirmation
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { throw 'psql is not available in PATH.' }
@($DatabaseName,$OwnerRole,$MigrationRole,$ApplicationRole,$BackupRole) | ForEach-Object {
    if ($_ -notmatch '^[a-z][a-z0-9_]{2,62}$') { throw "Unsafe PostgreSQL identifier: $_" }
}

function Convert-Secret([Security.SecureString]$Value) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
function Sql-Literal([string]$Value) { "'$($Value.Replace("'", "''"))'" }

$adminPassword = Convert-Secret (Read-Host 'PostgreSQL superuser password' -AsSecureString)
$migrationPassword = Convert-Secret (Read-Host 'New migration-role password' -AsSecureString)
$applicationPassword = Convert-Secret (Read-Host 'New application-role password' -AsSecureString)
$backupPassword = Convert-Secret (Read-Host 'New backup-role password' -AsSecureString)
$sql = @"
DO `$block`$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$OwnerRole') THEN CREATE ROLE $OwnerRole NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$MigrationRole') THEN CREATE ROLE $MigrationRole LOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$ApplicationRole') THEN CREATE ROLE $ApplicationRole LOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$BackupRole') THEN CREATE ROLE $BackupRole LOGIN; END IF;
END
`$block`$;
ALTER ROLE $MigrationRole PASSWORD $(Sql-Literal $migrationPassword);
ALTER ROLE $ApplicationRole PASSWORD $(Sql-Literal $applicationPassword);
ALTER ROLE $BackupRole PASSWORD $(Sql-Literal $backupPassword);
GRANT $OwnerRole TO $MigrationRole;
GRANT pg_read_all_data TO $BackupRole;
SELECT format('CREATE DATABASE %I OWNER %I', '$DatabaseName', '$OwnerRole')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$DatabaseName') \gexec
\connect $DatabaseName
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE $DatabaseName TO $MigrationRole, $ApplicationRole, $BackupRole;
GRANT USAGE, CREATE ON SCHEMA public TO $MigrationRole;
GRANT USAGE ON SCHEMA public TO $ApplicationRole, $BackupRole;
ALTER DEFAULT PRIVILEGES FOR ROLE $MigrationRole IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $ApplicationRole;
ALTER DEFAULT PRIVILEGES FOR ROLE $MigrationRole IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $ApplicationRole;
ALTER DEFAULT PRIVILEGES FOR ROLE $OwnerRole IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $ApplicationRole;
ALTER DEFAULT PRIVILEGES FOR ROLE $OwnerRole IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $ApplicationRole;
"@

$previous = @{}
@('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE') | ForEach-Object { $previous[$_] = [Environment]::GetEnvironmentVariable($_, 'Process') }
try {
    $env:PGHOST = $HostName; $env:PGPORT = [string]$Port; $env:PGUSER = $Superuser
    $env:PGPASSWORD = $adminPassword; $env:PGDATABASE = 'postgres'
    $sql | & psql -X --quiet --set ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL database initialization failed.' }
    Write-Output 'Metrics Portal database and least-privilege roles initialized.'
    Write-Output 'Store the application, migration, and backup connection strings in the approved secret locations; passwords are not printed.'
} finally {
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    $adminPassword = $migrationPassword = $applicationPassword = $backupPassword = $sql = $null
}
