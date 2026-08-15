[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [string]$ConfigPath = (Join-Path $PSScriptRoot "dr.config.local.json"),
    [string]$SecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\dr-secrets.clixml")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProductionProjectRef = "ilzhsfqqjyppzzvfscmh"

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found."
    }
}

function Convert-SecureStringToPlainText {
    param([System.Security.SecureString]$Value)
    return [System.Net.NetworkCredential]::new("", $Value).Password
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "DR config file not found: $ConfigPath. Copy dr.config.example.json to dr.config.local.json first."
}
if (-not (Test-Path -LiteralPath $SecretsPath)) {
    throw "Encrypted DR credential file not found: $SecretsPath. Run Set-InsureITDRSecrets.ps1 first."
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$targetRef = [string]$config.targetProjectRef
$sourceRef = [string]$config.sourceProjectRef
$targetRegion = [string]$config.targetRegion
$storageEndpoint = [string]$config.targetStorageEndpoint
$controlSchema = [string]$config.controlSchema

if ([string]::IsNullOrWhiteSpace($targetRef) -or [string]::IsNullOrWhiteSpace($sourceRef)) {
    throw "DR config is missing sourceProjectRef or targetProjectRef."
}
if ($targetRef -eq $ProductionProjectRef) {
    throw "STOPPED: DR target cannot be the production project."
}
if ($sourceRef -ne $ProductionProjectRef) {
    throw "STOPPED: source project does not match the INSUREIT production project."
}
if ([string]::IsNullOrWhiteSpace($controlSchema)) {
    throw "DR config is missing controlSchema."
}

$backup = [IO.Path]::GetFullPath($BackupPath)
& (Join-Path $PSScriptRoot "Verify-InsureITBackup.ps1") -BackupPath $backup
$manifest = Get-Content -LiteralPath (Join-Path $backup "manifest.json") -Raw | ConvertFrom-Json
if ([string]$manifest.projectRef -ne $sourceRef) {
    throw "Backup source project does not match the configured production source."
}

Require-Command "psql"
Require-Command "rclone"

$secrets = Import-Clixml -LiteralPath $SecretsPath
if ([string]$secrets.TargetProjectRef -ne $targetRef) {
    throw "Encrypted DR credentials belong to a different target project."
}

$dbUrl = Convert-SecureStringToPlainText $secrets.DatabaseUrl
$s3Access = [string]$secrets.S3AccessKeyId
$s3Secret = Convert-SecureStringToPlainText $secrets.S3SecretAccessKey

if ([string]::IsNullOrWhiteSpace($dbUrl)) { throw "Stored DR database URL is empty." }
if (-not $dbUrl.Contains($targetRef)) { throw "STOPPED: stored DR database URL does not contain the approved target ref." }
if ($dbUrl.Contains($ProductionProjectRef)) { throw "STOPPED: production project detected in stored DR database URL." }
if ([string]::IsNullOrWhiteSpace($s3Access) -or [string]::IsNullOrWhiteSpace($s3Secret)) {
    throw "Stored DR S3 credentials are incomplete."
}

Write-Host ""
Write-Host "DR database guard check" -ForegroundColor Cyan
$query = @"
select source_project_ref || '|' || target_project_ref || '|' || mode || '|' || coalesce(last_refresh_status,'')
from $controlSchema.replica_state
where singleton = true;
"@
$guardOutput = @(& psql $dbUrl -X -v ON_ERROR_STOP=1 -t -A -c $query)
$psqlExitCode = $LASTEXITCODE
if ($psqlExitCode -ne 0) { throw "Could not read the DR control marker." }
$guardLine = $guardOutput | ForEach-Object { [string]$_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace([string]$guardLine)) { throw "DR control marker query returned no data." }
$guard = ([string]$guardLine).Trim()
$parts = $guard.Split('|')
if ($parts.Count -lt 3 -or $parts[0] -ne $sourceRef -or $parts[1] -ne $targetRef -or $parts[2] -ne "standby") {
    throw "STOPPED: DR control marker does not match the approved production->standby relationship."
}
Write-Host "DR control marker is valid and target is in standby mode." -ForegroundColor Green

$env:RCLONE_CONFIG_DRTEST_TYPE = "s3"
$env:RCLONE_CONFIG_DRTEST_PROVIDER = "Other"
$env:RCLONE_CONFIG_DRTEST_ENDPOINT = $storageEndpoint
$env:RCLONE_CONFIG_DRTEST_REGION = $targetRegion
$env:RCLONE_CONFIG_DRTEST_ACCESS_KEY_ID = $s3Access
$env:RCLONE_CONFIG_DRTEST_SECRET_ACCESS_KEY = $s3Secret
try {
    $targetBuckets = @((& rclone lsf "drtest:" --dirs-only --quiet) | ForEach-Object { $_.Trim().TrimEnd('/') } | Where-Object { $_ } | Sort-Object -Unique)
    if ($LASTEXITCODE -ne 0) { throw "Could not list DR Storage buckets." }

    Write-Host ""
    Write-Host "DR Storage access passed." -ForegroundColor Green
    Write-Host ("Target buckets currently visible: {0}" -f $targetBuckets.Count)

    $missing = @()
    foreach ($bucket in @($manifest.storage.buckets)) {
        $name = [string]$bucket.name
        if ($targetBuckets -notcontains $name) { $missing += $name }
    }
    if ($missing.Count -gt 0) {
        Write-Host ("Buckets that will need to exist before file mirroring: {0}" -f ($missing -join ', ')) -ForegroundColor Yellow
    }
    else {
        Write-Host "All backup Storage bucket names already exist on the DR target." -ForegroundColor Green
    }
}
finally {
    "TYPE","PROVIDER","ENDPOINT","REGION","ACCESS_KEY_ID","SECRET_ACCESS_KEY" | ForEach-Object {
        Remove-Item "Env:RCLONE_CONFIG_DRTEST_$_" -ErrorAction SilentlyContinue
    }
    $dbUrl = $null
    $s3Secret = $null
}

Write-Host ""
Write-Host "DR preflight passed. No DR data was changed." -ForegroundColor Green
Write-Host ("Backup ID: {0}" -f $manifest.backupId)
Write-Host ("Source:    {0}" -f $sourceRef)
Write-Host ("Target:    {0}" -f $targetRef)
