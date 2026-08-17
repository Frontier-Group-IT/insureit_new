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

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required command '$Name' was not found."
    }
    return $command
}

foreach ($requiredPath in @($ConfigPath, $SecretsPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required file not found: $requiredPath"
    }
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$projectRef = [string]$config.projectRef
if ($projectRef -ne $ProductionProjectRef) {
    throw "STOPPED: config does not point to the approved INSUREIT production project."
}

$pgDump = Require-Command "pg_dump"
$versionText = (& $pgDump.Source --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $versionText -notmatch 'pg_dump \(PostgreSQL\) (?<major>\d+)') {
    throw "Could not determine local pg_dump version."
}
if ([int]$matches['major'] -ne 17) {
    throw "This diagnostic requires local PostgreSQL 17 pg_dump. Found: $versionText"
}

$secrets = Import-Clixml -LiteralPath $SecretsPath
$dbUrl = Convert-SecureStringToPlainText $secrets.DatabaseUrl
if ([string]::IsNullOrWhiteSpace($dbUrl) -or -not $dbUrl.Contains($ProductionProjectRef)) {
    throw "STOPPED: stored database connection does not match INSUREIT production."
}

$workDir = Join-Path $PSScriptRoot "_work"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
$outputPath = Join-Path $workDir "direct-pg-dump-transport-test.sql"
if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
}

Write-Host "INSUREIT production dump-transport diagnostic" -ForegroundColor Cyan
Write-Host "Project: $ProductionProjectRef"
Write-Host "Client:  $versionText"
Write-Host "Method:  local pg_dump (no Docker), public schema only, schema-only"
Write-Host "Purpose: isolate local/Docker transport behavior only; this is NOT a backup artifact."
Write-Host "Production is read-only for this test." -ForegroundColor Green
Write-Host ""

$started = Get-Date
try {
    & $pgDump.Source `
        $dbUrl `
        --schema-only `
        --schema=public `
        --no-owner `
        --no-privileges `
        --no-subscriptions `
        --file=$outputPath
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Direct local pg_dump transport test failed with exit code $exitCode."
    }

    if (-not (Test-Path -LiteralPath $outputPath -PathType Leaf)) {
        throw "Direct pg_dump returned success but produced no output file."
    }

    $file = Get-Item -LiteralPath $outputPath
    if ($file.Length -lt 1) {
        throw "Direct pg_dump produced an empty output file."
    }

    $elapsed = (Get-Date) - $started
    Write-Host ""
    Write-Host "DIRECT PG_DUMP TRANSPORT TEST PASSED." -ForegroundColor Green
    Write-Host ("Elapsed: {0:N1} seconds" -f $elapsed.TotalSeconds)
    Write-Host ("Temporary schema bytes: {0}" -f $file.Length)
    Write-Host "This proves only that the local PostgreSQL client can complete a read-only schema transfer over the stored production connection."
    Write-Host "It does not replace the Supabase-filtered v2 backup format."
}
finally {
    if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force -ErrorAction SilentlyContinue
    }
    $dbUrl = $null
    $secrets = $null
}
