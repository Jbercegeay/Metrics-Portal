$ErrorActionPreference = 'Stop'
$failures = @()
Get-ChildItem -Path (Join-Path $PSScriptRoot 'windows') -Filter '*.ps1' -File | ForEach-Object {
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count) { $failures += $errors }
}
if ($failures.Count) { $failures | ForEach-Object { Write-Error $_.Message }; exit 1 }
Write-Output 'PowerShell syntax checks passed.'
