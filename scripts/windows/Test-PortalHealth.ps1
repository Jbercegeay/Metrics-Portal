[CmdletBinding()]
param([string]$BaseUrl = 'http://127.0.0.1:3000')
$ErrorActionPreference = 'Stop'
$checks = @('/api/v2/health', '/api/v2/health/ready', '/api/v2/health/integrations')
foreach ($path in $checks) {
    $response = Invoke-RestMethod -Uri "$BaseUrl$path" -TimeoutSec 10
    [pscustomobject]@{ Endpoint = $path; Status = $response.status; Ready = $response.ready }
}
