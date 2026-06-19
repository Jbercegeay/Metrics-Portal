[CmdletBinding()]
param(
    [string]$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [Parameter(Mandatory = $true)][string]$BackupRoot,
    [Parameter(Mandatory = $true)][ValidatePattern('^https?://')][string]$BaseUrl,
    [string]$ExpectedTitle = 'Metrics Portal',
    [int]$PostgresPort = 5432,
    [int]$MinimumFreeGb = 20
)

$ErrorActionPreference = 'Stop'
$results = [System.Collections.Generic.List[object]]::new()
function Add-Check([string]$Name, [bool]$Ok, [string]$Detail) {
    $results.Add([pscustomobject]@{ Check = $Name; Ready = $Ok; Detail = $Detail })
}
function Find-Command([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    Add-Check $Name ([bool]$command) $(if ($command) { $command.Source } else { 'Not found in PATH' })
}

Find-Command node
Find-Command npm
Find-Command git
Find-Command pm2
Find-Command psql
Find-Command pg_dump
Find-Command pg_restore

$envFile = Join-Path $AppRoot '.env'
Add-Check '.env' (Test-Path -LiteralPath $envFile -PathType Leaf) 'Required local configuration file'
Add-Check 'Backup root' (Test-Path -LiteralPath $BackupRoot -PathType Container) $BackupRoot

$appDrive = Get-PSDrive -Name ([System.IO.Path]::GetPathRoot($AppRoot).TrimEnd('\').TrimEnd(':'))
$freeGb = [math]::Round($appDrive.Free / 1GB, 1)
Add-Check 'Free disk' ($freeGb -ge $MinimumFreeGb) "$freeGb GB free; minimum $MinimumFreeGb GB"

$listeners = Get-NetTCPConnection -State Listen -LocalPort $PostgresPort -ErrorAction SilentlyContinue
$unsafeListeners = @($listeners | Where-Object LocalAddress -in @('0.0.0.0','::'))
Add-Check 'PostgreSQL listener' ([bool]$listeners -and $unsafeListeners.Count -eq 0) $(if (-not $listeners) { "No listener on $PostgresPort" } elseif ($unsafeListeners.Count) { "Port $PostgresPort is exposed on all interfaces" } else { "Port $PostgresPort is local-only" })

Push-Location $AppRoot
try {
    $status = git status --porcelain
    Add-Check 'Git worktree' (-not $status) $(if ($status) { 'Uncommitted files present' } else { 'Clean' })
    $head = git rev-parse HEAD
    Add-Check 'Git commit' ([bool]$head) $head
} finally { Pop-Location }

try {
    $home = Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing -TimeoutSec 5
    $title = $(if ($home.Content -match '<title[^>]*>([^<]+)</title>') { $matches[1].Trim() } else { '' })
    Add-Check 'Application identity' ($title -like "*$ExpectedTitle*") $(if ($title) { $title } else { 'No HTML title found' })
} catch { Add-Check 'Application identity' $false 'Root page not reachable' }

try {
    $live = Invoke-RestMethod -Uri "$BaseUrl/api/v2/health" -TimeoutSec 5
    Add-Check 'Application liveness' ($live.status -eq 'ok') "$BaseUrl/api/v2/health"
} catch { Add-Check 'Application liveness' $false 'Not reachable (acceptable before first deployment)' }

$results | Format-Table -AutoSize
if ($results.Where({ -not $_.Ready }).Count -gt 0) { exit 1 }
