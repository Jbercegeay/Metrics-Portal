[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidatePattern('^https?://')][string]$BaseUrl,
    [string]$ExpectedTitle = 'Metrics Portal'
)
$ErrorActionPreference = 'Stop'
$home = Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing -TimeoutSec 10
$title = $(if ($home.Content -match '<title[^>]*>([^<]+)</title>') { $matches[1].Trim() } else { '' })
if ($title -notlike "*$ExpectedTitle*") { throw "Unexpected application at BaseUrl; received title '$title'." }
[pscustomobject]@{ Endpoint = '/'; Status = $title; Ready = $true }
$checks = @('/api/v2/health', '/api/v2/health/ready', '/api/v2/health/integrations')
foreach ($path in $checks) {
    $response = Invoke-RestMethod -Uri "$BaseUrl$path" -TimeoutSec 10
    [pscustomobject]@{ Endpoint = $path; Status = $response.status; Ready = $response.ready }
}
