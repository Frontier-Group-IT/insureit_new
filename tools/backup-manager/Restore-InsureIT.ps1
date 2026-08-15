[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [Parameter(Mandatory = $true)]
    [string]$TargetProjectRef,
    [Parameter(Mandatory = $true)]
    [string]$TargetRegion,
    [string]$TargetStorageEndpoint = "",
    [switch]$ExecuteDatabase,
    [switch]$ExecuteStorage,
    [switch]$AllowProductionRestore
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

function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments, [string]$Label)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE." }
}

function Read-SecretPlainText {
    param([string]$Prompt)
    $secure = Read-Host $Prompt -AsSecureString
    return [System.Net.NetworkCredential]::new("", $secure).Password
}

$backup = [IO.Path]::GetFullPath($BackupPath)
& (Join-Path $PSScriptRoot "Verify-InsureITBackup.ps1") -BackupPath $backup

$manifest = Get-Content -LiteralPath (Join-Path $backup "manifest.json") -Raw | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($TargetStorageEndpoint)) {
    $TargetStorageEndpoint = "https://$TargetProjectRef.storage.supabase.co/storage/v1/s3"
}

Write-Host ""
Write-Host "Restore plan" -ForegroundColor Cyan
Write-Host ("Source backup:  {0}" -f $manifest.backupId)
Write-Host ("Source project: {0}" -f $manifest.projectRef)
Write-Host ("Target project: {0}" -f $TargetProjectRef)
Write-Host ("Database:       {0}" -f ($(if ($ExecuteDatabase) { "EXECUTE" } else { "PLAN ONLY" })))
Write-Host ("Storage:        {0}" -f ($(if ($ExecuteStorage) { "EXECUTE" } else { "PLAN ONLY" })))

if (-not $ExecuteDatabase -and -not $ExecuteStorage) {
    Write-Host ""
    Write-Host "Plan only. No target system was changed." -ForegroundColor Green
    return
}

if ($TargetProjectRef -eq $ProductionProjectRef) {
    if (-not $AllowProductionRestore) {
        throw "Production restore is blocked. Restore into an isolated project first."
    }
    Write-Host ""
    Write-Host "DANGER: target is the INSUREIT production Supabase project." -ForegroundColor Red
    $confirmation = Read-Host "Type exactly RESTORE PRODUCTION to continue"
    if ($confirmation -cne "RESTORE PRODUCTION") {
        throw "Production restore cancelled."
    }
}

if ($ExecuteDatabase) {
    Require-Command "psql"
    $dbUrl = $env:INSUREIT_RESTORE_DB_URL
    if ([string]::IsNullOrWhiteSpace($dbUrl)) {
        $dbUrl = Read-SecretPlainText "Target Supabase database connection string"
    }
    if ([string]::IsNullOrWhiteSpace($dbUrl)) { throw "Target database connection string is required." }

    $db = Join-Path $backup "database"
    Invoke-Checked "psql" @(
        "--single-transaction",
        "--variable","ON_ERROR_STOP=1",
        "--file",(Join-Path $db "roles.sql"),
        "--file",(Join-Path $db "schema.sql"),
        "--command","SET session_replication_role = replica",
        "--file",(Join-Path $db "data.sql"),
        "--dbname",$dbUrl
    ) "Database restore"

    Invoke-Checked "psql" @(
        "--single-transaction",
        "--variable","ON_ERROR_STOP=1",
        "--file",(Join-Path $db "history_schema.sql"),
        "--file",(Join-Path $db "history_data.sql"),
        "--dbname",$dbUrl
    ) "Migration history restore"

    $dbUrl = $null
    Write-Host "Database restore completed." -ForegroundColor Green
}

if ($ExecuteStorage) {
    if ($manifest.storage.skipped) { throw "This backup does not contain Storage files." }
    Require-Command "rclone"

    $access = $env:INSUREIT_RESTORE_S3_ACCESS_KEY_ID
    $secret = $env:INSUREIT_RESTORE_S3_SECRET_ACCESS_KEY
    if ([string]::IsNullOrWhiteSpace($access)) { $access = Read-Host "Target Storage S3 Access Key ID" }
    if ([string]::IsNullOrWhiteSpace($secret)) { $secret = Read-SecretPlainText "Target Storage S3 Secret Access Key" }
    if ([string]::IsNullOrWhiteSpace($access) -or [string]::IsNullOrWhiteSpace($secret)) {
        throw "Target Storage S3 credentials are required."
    }

    $env:RCLONE_CONFIG_RESTORE_TYPE = "s3"
    $env:RCLONE_CONFIG_RESTORE_PROVIDER = "Other"
    $env:RCLONE_CONFIG_RESTORE_ENDPOINT = $TargetStorageEndpoint
    $env:RCLONE_CONFIG_RESTORE_REGION = $TargetRegion
    $env:RCLONE_CONFIG_RESTORE_ACCESS_KEY_ID = $access
    $env:RCLONE_CONFIG_RESTORE_SECRET_ACCESS_KEY = $secret

    try {
        $targetBuckets = @((& rclone lsf "restore:" --dirs-only --quiet) | ForEach-Object { $_.Trim().TrimEnd("/") } | Where-Object { $_ })
        if ($LASTEXITCODE -ne 0) { throw "Could not list target Storage buckets." }

        foreach ($bucket in @($manifest.storage.buckets)) {
            $name = [string]$bucket.name
            if ($targetBuckets -notcontains $name) {
                throw "Target Storage bucket '$name' does not exist. Restore the database/bucket definitions first."
            }
            $localBucket = Join-Path (Join-Path $backup "storage") $name
            Invoke-Checked "rclone" @("copy",$localBucket,"restore:$name","--fast-list","--quiet") "Storage restore for bucket '$name'"

            $sizeJson = (& rclone size "restore:$name" --json --quiet | Out-String)
            if ($LASTEXITCODE -ne 0) { throw "Could not verify target Storage bucket '$name'." }
            $targetSize = $sizeJson | ConvertFrom-Json
            if ([int64]$targetSize.count -lt [int64]$bucket.objects) {
                throw "Target Storage bucket '$name' has fewer objects than the backup after restore."
            }
        }

        Write-Host "Storage restore completed and object counts were checked." -ForegroundColor Green
    }
    finally {
        "TYPE","PROVIDER","ENDPOINT","REGION","ACCESS_KEY_ID","SECRET_ACCESS_KEY" | ForEach-Object {
            Remove-Item "Env:RCLONE_CONFIG_RESTORE_$_" -ErrorAction SilentlyContinue
        }
        $secret = $null
    }
}

Write-Host ""
Write-Host "Restore commands completed. Perform application-level reconciliation before using the target." -ForegroundColor Yellow
