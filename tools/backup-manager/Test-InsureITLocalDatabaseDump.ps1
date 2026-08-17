[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "config.local.json"),
    [string]$SecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\secrets.clixml")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProductionProjectRef = "ilzhsfqqjyppzzvfscmh"

function Convert-SecureStringToPlainText {
    param([System.Security.SecureString]$Value)
    return [System.Net.NetworkCredential]::new("", $Value).Password
}

foreach ($requiredPath in @($ConfigPath,$SecretsPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required file not found: $requiredPath"
    }
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if ([string]$config.projectRef -ne $ProductionProjectRef) {
    throw "STOPPED: config does not point to the approved INSUREIT production project."
}

$helperPath = Join-Path $PSScriptRoot "Invoke-InsureITLocalDatabaseDump.ps1"
if (-not (Test-Path -LiteralPath $helperPath -PathType Leaf)) {
    throw "Local dump helper is missing: $helperPath"
}

$secrets = Import-Clixml -LiteralPath $SecretsPath
$dbUrl = Convert-SecureStringToPlainText $secrets.DatabaseUrl
if ([string]::IsNullOrWhiteSpace($dbUrl) -or -not $dbUrl.Contains($ProductionProjectRef)) {
    throw "STOPPED: stored database connection does not match INSUREIT production."
}

$workDir = Join-Path $PSScriptRoot "_work\local-database-dump-test"
if (Test-Path -LiteralPath $workDir) {
    Remove-Item -LiteralPath $workDir -Recurse -Force
}
New-Item -ItemType Directory -Path $workDir | Out-Null

Write-Host "INSUREIT local database dump validation" -ForegroundColor Cyan
Write-Host "Project: $ProductionProjectRef"
Write-Host "Method:  local PostgreSQL 17 clients + Supabase-compatible filtering"
Write-Host "Scope:   roles, schema, data, migration-history schema/data"
Write-Host "Production is queried read-only. No backup or DR change occurs." -ForegroundColor Green
Write-Host "Temporary SQL files are deleted after validation."
Write-Host ""

try {
    & $helperPath -DatabaseUrl $dbUrl -OutputDirectory $workDir

    $required = @('roles.sql','schema.sql','data.sql','history_schema.sql','history_data.sql')
    $rows = foreach ($name in $required) {
        $path = Join-Path $workDir $name
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Validation output is missing: $name"
        }
        $item = Get-Item -LiteralPath $path
        if ($item.Length -lt 1) { throw "Validation output is empty: $name" }
        [pscustomobject]@{ File = $name; Bytes = [int64]$item.Length }
    }

    Write-Host ""
    Write-Host "LOCAL DATABASE DUMP VALIDATION PASSED." -ForegroundColor Green
    foreach ($row in $rows) {
        Write-Host ("{0,-24} {1,12:N0} bytes" -f $row.File,$row.Bytes)
    }
    Write-Host "This validates the replacement database transport only; it is not a complete v2 backup."
}
finally {
    $dbUrl = $null
    $secrets = $null
    if (Test-Path -LiteralPath $workDir) {
        Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
