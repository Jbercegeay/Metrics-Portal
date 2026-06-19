[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BackupRoot,
    [int]$MaximumAgeHours = 26
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) { throw 'BackupRoot does not exist.' }
$latest = Get-ChildItem -LiteralPath $BackupRoot -Filter 'metrics-portal-*.dump' -File |
    Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
if (-not $latest) { throw 'No Metrics Portal backup was found.' }
$metadataFile = "$($latest.FullName).json"
if (-not (Test-Path -LiteralPath $metadataFile -PathType Leaf)) { throw 'Latest backup is missing verification metadata.' }
$metadata = Get-Content -LiteralPath $metadataFile -Raw | ConvertFrom-Json
$actualHash = (Get-FileHash -LiteralPath $latest.FullName -Algorithm SHA256).Hash
if ($actualHash -ne $metadata.Sha256) { throw 'Latest backup hash does not match its verification metadata.' }
$ageHours = ((Get-Date).ToUniversalTime() - $latest.LastWriteTimeUtc).TotalHours
if ($ageHours -gt $MaximumAgeHours) { throw "Latest verified backup is older than $MaximumAgeHours hours." }
[pscustomobject]@{ File = $latest.FullName; AgeHours = [math]::Round($ageHours, 2); HashVerified = $true }
