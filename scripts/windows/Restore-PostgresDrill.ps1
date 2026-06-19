[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BackupFile,
    [Parameter(Mandatory = $true)][string]$RestoreDatabaseUrl,
    [Parameter(Mandatory = $true)][ValidateSet('RESTORE INTO ISOLATED DATABASE')][string]$Confirmation,
    [string]$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) { throw 'BackupFile does not exist.' }
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { throw 'psql is not available in PATH.' }
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) { throw 'pg_restore is not available in PATH.' }
$uri = [uri]$RestoreDatabaseUrl
$databaseName = $uri.AbsolutePath.Trim('/')
if ($databaseName -notmatch '_restore_drill$') { throw 'Restore database name must end with _restore_drill.' }
if ($env:DATABASE_URL -and $RestoreDatabaseUrl -eq $env:DATABASE_URL) { throw 'Restore target must not equal DATABASE_URL.' }

$previousPg = @{}
@('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE') | ForEach-Object { $previousPg[$_] = [Environment]::GetEnvironmentVariable($_, 'Process') }
$previousAppDatabase = $env:DATABASE_URL
try {
    $credentials = $uri.UserInfo -split ':', 2
    $env:PGHOST = $uri.Host
    $env:PGPORT = $(if ($uri.IsDefaultPort) { '5432' } else { [string]$uri.Port })
    $env:PGUSER = [uri]::UnescapeDataString($credentials[0])
    $env:PGPASSWORD = $(if ($credentials.Count -gt 1) { [uri]::UnescapeDataString($credentials[1]) } else { '' })
    $env:PGDATABASE = $databaseName
    $existing = (& psql -X -tA -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';").Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect restore target.' }
    if ([int]$existing -gt 0) { throw 'Restore target is not empty. Refusing to overwrite it.' }
    & pg_restore --exit-on-error --no-owner --no-acl --dbname=$databaseName $BackupFile
    if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }
    $env:DATABASE_URL = $RestoreDatabaseUrl
    Push-Location $AppRoot
    try { & npm run migrate:up; if ($LASTEXITCODE -ne 0) { throw 'Migrations failed on restored database.' } }
    finally { Pop-Location }
    $required = @('users','sessions','workspaces','submissions','submission_outbox','submission_deliveries','audit_events')
    $present = (& psql -X -tA -v ON_ERROR_STOP=1 -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';")
    $missing = $required | Where-Object { $_ -notin $present }
    if ($missing) { throw "Restore verification is missing required tables: $($missing -join ', ')" }
    [pscustomobject]@{ Database = $databaseName; RequiredTables = $required.Count; VerifiedAt = (Get-Date).ToString('o') }
} finally {
    foreach ($name in $previousPg.Keys) { [Environment]::SetEnvironmentVariable($name, $previousPg[$name], 'Process') }
    $env:DATABASE_URL = $previousAppDatabase
}
