[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string]$LogDirectory,
    [int]$WindowMinutes = 10
)

$ErrorActionPreference = 'Stop'

function Get-NodeCommand {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        return $nodeCommand.Source
    }

    $commonPaths = @(
        'C:\Program Files\nodejs\node.exe',
        'C:\Program Files (x86)\nodejs\node.exe'
    )

    foreach ($candidate in $commonPaths) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    throw 'Node.js was not found. Install Node.js or add node.exe to PATH for the scheduled-task account.'
}

function Write-Log {
    param(
        [string]$Message
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$timestamp] $Message"
    Write-Host $line
    Add-Content -Path $script:LogFile -Value $line
}

if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Path $PSScriptRoot -Parent
}

if (-not $LogDirectory) {
    $LogDirectory = Join-Path $RepoRoot 'logs'
}

if (!(Test-Path $RepoRoot)) {
    throw "Repo root not found: $RepoRoot"
}

if (!(Test-Path $LogDirectory)) {
    New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
}

$dateStamp = Get-Date -Format 'yyyy-MM-dd'
$script:LogFile = Join-Path $LogDirectory "dedupe-master-logs-$dateStamp.log"
$nodePath = Get-NodeCommand
$scriptPath = Join-Path $RepoRoot 'scripts\dedupe-master-logs-dry-run.js'

if (!(Test-Path $scriptPath)) {
    throw "Cleanup script not found: $scriptPath"
}

Write-Log "Starting Master Log dedupe run."
Write-Log "RepoRoot: $RepoRoot"
Write-Log "NodePath: $nodePath"
Write-Log "WindowMinutes: $WindowMinutes"

$env:HTTP_PROXY = ''
$env:HTTPS_PROXY = ''
$env:ALL_PROXY = ''
$env:GIT_HTTP_PROXY = ''
$env:GIT_HTTPS_PROXY = ''

Push-Location $RepoRoot
try {
    $output = & $nodePath $scriptPath '--apply' "--window-minutes=$WindowMinutes" 2>&1
    $exitCode = $LASTEXITCODE

    if ($output) {
        Add-Content -Path $script:LogFile -Value ($output | Out-String)
    }

    if ($exitCode -ne 0) {
        Write-Log "Master Log dedupe failed with exit code $exitCode."
        exit $exitCode
    }

    Write-Log 'Master Log dedupe completed successfully.'
}
finally {
    Pop-Location
}
