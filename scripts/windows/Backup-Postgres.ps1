[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BackupRoot,
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$EnvironmentFile
)

$ErrorActionPreference = 'Stop'
function Find-PgTool([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidate = Join-Path $env:ProgramFiles "PostgreSQL\18\bin\$Name.exe"
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    throw "$Name is not available in PATH or the PostgreSQL 18 default directory."
}
if (-not $DatabaseUrl -and $EnvironmentFile) {
    if (-not (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf)) { throw 'EnvironmentFile does not exist.' }
    $line = Get-Content -LiteralPath $EnvironmentFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -Last 1
    if ($line) { $DatabaseUrl = ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'") }
}
if (-not $DatabaseUrl) { throw 'DATABASE_URL is required but will not be printed.' }
if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) { throw 'BackupRoot must already exist.' }
$pgDumpExe = Find-PgTool 'pg_dump'
$pgRestoreExe = Find-PgTool 'pg_restore'
$uri = [uri]$DatabaseUrl
$databaseName = [uri]::UnescapeDataString($uri.AbsolutePath.Trim('/'))
$credentials = $uri.UserInfo -split ':', 2
if ($uri.Scheme -notin @('postgres', 'postgresql') -or -not $uri.Host -or -not $databaseName -or -not $credentials[0]) {
    throw 'DATABASE_URL must be a PostgreSQL URL with a host, user, and database name.'
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$file = Join-Path $BackupRoot "metrics-portal-$stamp.dump"
$previousPg = @{}
@('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE') | ForEach-Object {
    $previousPg[$_] = [Environment]::GetEnvironmentVariable($_, 'Process')
}
try {
    $env:PGHOST = $uri.Host
    $env:PGPORT = $(if ($uri.IsDefaultPort) { '5432' } else { [string]$uri.Port })
    $env:PGUSER = [uri]::UnescapeDataString($credentials[0])
    $env:PGPASSWORD = $(if ($credentials.Count -gt 1) { [uri]::UnescapeDataString($credentials[1]) } else { '' })
    $env:PGDATABASE = $databaseName
    & $pgDumpExe --format=custom --no-owner --no-acl --file=$file
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
} finally {
    foreach ($name in $previousPg.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previousPg[$name], 'Process')
    }
}

& $pgRestoreExe --list $file | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Backup verification failed.' }
$hash = Get-FileHash -LiteralPath $file -Algorithm SHA256
[pscustomobject]@{ File = $file; Bytes = (Get-Item -LiteralPath $file).Length; Sha256 = $hash.Hash; VerifiedAt = (Get-Date).ToString('o') } |
    ConvertTo-Json | Set-Content -LiteralPath "$file.json" -Encoding UTF8

Write-Output "Verified backup created: $file"
