[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BackupRoot,
    [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = 'Stop'
if (-not $DatabaseUrl) { throw 'DATABASE_URL is required but will not be printed.' }
if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) { throw 'BackupRoot must already exist.' }
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) { throw 'pg_dump is not available in PATH.' }
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) { throw 'pg_restore is not available in PATH.' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$file = Join-Path $BackupRoot "metrics-portal-$stamp.dump"
$previousDatabase = $env:PGDATABASE
try {
    $env:PGDATABASE = $DatabaseUrl
    & pg_dump --format=custom --no-owner --no-acl --file=$file
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
} finally {
    $env:PGDATABASE = $previousDatabase
}

& pg_restore --list $file | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Backup verification failed.' }
$hash = Get-FileHash -LiteralPath $file -Algorithm SHA256
[pscustomobject]@{ File = $file; Bytes = (Get-Item -LiteralPath $file).Length; Sha256 = $hash.Hash; VerifiedAt = (Get-Date).ToString('o') } |
    ConvertTo-Json | Set-Content -LiteralPath "$file.json" -Encoding UTF8

Write-Output "Verified backup created: $file"
