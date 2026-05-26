[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$TaskName = 'Metrics Portal - Delete Duplicate Master Log Rows',
    [string]$RunAt = '04:00',
    [string]$RepoRoot,
    [string]$LogDirectory
)

$ErrorActionPreference = 'Stop'

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Path $PSScriptRoot -Parent
}

if (-not $LogDirectory) {
    $LogDirectory = Join-Path $RepoRoot 'logs'
}

if (!(Test-Admin)) {
    throw 'Run this script from an elevated PowerShell window (Run as Administrator).'
}

if (!(Test-Path $RepoRoot)) {
    throw "Repo root not found: $RepoRoot"
}

$runnerScript = Join-Path $RepoRoot 'scripts\run-dedupe-master-logs.ps1'
if (!(Test-Path $runnerScript)) {
    throw "Runner script not found: $runnerScript"
}

if (!(Test-Path $LogDirectory)) {
    New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
}

$parsedTime = [DateTime]::ParseExact($RunAt, 'HH:mm', $null)
$taskUser = "$env:USERDOMAIN\$env:USERNAME"
$credential = Get-Credential -UserName $taskUser -Message 'Enter the Windows password for the account that should run the 4:00 AM dedupe task.'

$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runnerScript`" -RepoRoot `"$RepoRoot`" -LogDirectory `"$LogDirectory`""

$trigger = New-ScheduledTaskTrigger -Daily -At $parsedTime
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal -UserId $credential.UserName -LogonType Password -RunLevel Highest
$description = 'Deletes duplicate Master Log rows daily by keeping the newest portal-written row in each exact-match cluster.'

if ($PSCmdlet.ShouldProcess($TaskName, 'Register scheduled task')) {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description $description `
        -Password ($credential.GetNetworkCredential().Password) `
        -Force | Out-Null

    Write-Host "Scheduled task registered: $TaskName"
    Write-Host "Runs daily at $RunAt as $($credential.UserName)"
    Write-Host "Runner script: $runnerScript"
    Write-Host "Logs folder: $LogDirectory"
}
