[CmdletBinding()]
param(
    [string]$HostName = '127.0.0.1',
    [int]$Port = 5432,
    [string]$Superuser = 'postgres',
    [string]$DatabaseName = 'metrics_portal',
    [string]$ApplicationRole = 'metrics_portal_app',
    [Parameter(Mandatory = $true)][ValidateSet('GRANT METRICS PORTAL RUNTIME ACCESS')][string]$Confirmation
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { throw 'psql is not available in PATH.' }
@($DatabaseName,$ApplicationRole) | ForEach-Object { if ($_ -notmatch '^[a-z][a-z0-9_]{2,62}$') { throw "Unsafe PostgreSQL identifier: $_" } }
function Convert-Secret([Security.SecureString]$Value) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
$adminPassword = Convert-Secret (Read-Host 'PostgreSQL superuser password' -AsSecureString)
$previous = @{}
@('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE') | ForEach-Object { $previous[$_] = [Environment]::GetEnvironmentVariable($_, 'Process') }
try {
    $env:PGHOST=$HostName; $env:PGPORT=[string]$Port; $env:PGUSER=$Superuser; $env:PGPASSWORD=$adminPassword; $env:PGDATABASE=$DatabaseName
    @"
GRANT USAGE ON SCHEMA public TO $ApplicationRole;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $ApplicationRole;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO $ApplicationRole;
"@ | & psql -X --quiet --set ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'Runtime grant failed.' }
    Write-Output 'Runtime access granted to existing Metrics Portal objects.'
} finally {
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    $adminPassword = $null
}
