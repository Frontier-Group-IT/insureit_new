[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "config.local.json"),
    [string]$SecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\secrets.clixml"),
    [switch]$PreflightOnly,
    [switch]$SkipStorage
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-BackupLog {
    param([string]$Message, [string]$Path)
    $line = "{0} {1}" -f ([DateTime]::UtcNow.ToString("o")), $Message
    Write-Host $line
    if ($Path) { Add-Content -LiteralPath $Path -Value $line -Encoding UTF8 }
}

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

function Invoke-Checked {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$Label
    )
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

function Set-RcloneSourceEnvironment {
    param(
        [string]$Endpoint,
        [string]$Region,
        [string]$AccessKeyId,
        [string]$SecretAccessKey
    )
    $env:RCLONE_CONFIG_INSUREIT_TYPE = "s3"
    $env:RCLONE_CONFIG_INSUREIT_PROVIDER = "Other"
    $env:RCLONE_CONFIG_INSUREIT_ENDPOINT = $Endpoint
    $env:RCLONE_CONFIG_INSUREIT_REGION = $Region
    $env:RCLONE_CONFIG_INSUREIT_ACCESS_KEY_ID = $AccessKeyId
    $env:RCLONE_CONFIG_INSUREIT_SECRET_ACCESS_KEY = $SecretAccessKey
}

function Clear-RcloneSourceEnvironment {
    "TYPE","PROVIDER","ENDPOINT","REGION","ACCESS_KEY_ID","SECRET_ACCESS_KEY" | ForEach-Object {
        Remove-Item "Env:RCLONE_CONFIG_INSUREIT_$_" -ErrorAction SilentlyContinue
    }
}

function Test-FreeSpace {
    param([string]$BackupRoot, [double]$MinimumFreeSpaceGB)
    $root = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($BackupRoot))
    if (-not $root) { return }
    $driveName = $root.TrimEnd("\").TrimEnd(":")
    if ($driveName.Length -ne 1) { return }
    $drive = Get-PSDrive -Name $driveName -ErrorAction SilentlyContinue
    if (-not $drive) { return }
    $freeGB = [math]::Round($drive.Free / 1GB, 2)
    if ($freeGB -lt $MinimumFreeSpaceGB) {
        throw "Backup drive has only $freeGB GB free. Minimum required is $MinimumFreeSpaceGB GB."
    }
}

function Get-ChecksumInventory {
    param([string]$BackupPath)
    $roots = @()
    foreach ($name in @("database", "storage")) {
        $candidate = Join-Path $BackupPath $name
        if (Test-Path -LiteralPath $candidate) { $roots += $candidate }
    }
    $items = foreach ($root in $roots) {
        Get-ChildItem -LiteralPath $root -File -Recurse | Sort-Object FullName | ForEach-Object {
            [pscustomobject]@{
                Path = ((($_.FullName).Substring($BackupPath.TrimEnd("\").Length)) -replace '^[\\/]+','' -replace '\\','/')
                Length = $_.Length
                Sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            }
        }
    }
    return @($items)
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Config file not found: $ConfigPath. Copy config.example.json to config.local.json first."
}
if (-not (Test-Path -LiteralPath $SecretsPath)) {
    throw "Encrypted credential file not found: $SecretsPath. Run Set-InsureITBackupSecrets.ps1 first."
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$secrets = Import-Clixml -LiteralPath $SecretsPath

Require-Command "supabase"
Require-Command "docker"
Require-Command "git"
if (-not $SkipStorage) { Require-Command "rclone" }

$dockerInfo = & docker info --format "{{.ServerVersion}}" 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($dockerInfo | Out-String))) {
    throw "Docker Desktop is installed but the Docker engine is not running."
}

Test-FreeSpace -BackupRoot $config.backupRoot -MinimumFreeSpaceGB ([double]$config.minimumFreeSpaceGB)

$dbUrl = Convert-SecureStringToPlainText $secrets.DatabaseUrl
$s3Secret = Convert-SecureStringToPlainText $secrets.S3SecretAccessKey
$s3AccessKeyId = [string]$secrets.S3AccessKeyId

if ([string]::IsNullOrWhiteSpace($dbUrl)) { throw "Stored database connection string is empty." }
if (-not $SkipStorage -and ([string]::IsNullOrWhiteSpace($s3AccessKeyId) -or [string]::IsNullOrWhiteSpace($s3Secret))) {
    throw "Stored S3 credentials are incomplete."
}

Write-Host "Preflight passed for project $($config.projectRef)." -ForegroundColor Green
if ($PreflightOnly) {
    Write-Host "No backup was created."
    return
}

$backupRoot = [IO.Path]::GetFullPath([string]$config.backupRoot)
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$workRoot = Join-Path $backupRoot "_inprogress"
New-Item -ItemType Directory -Force -Path $workRoot | Out-Null

$startedUtc = [DateTime]::UtcNow
$backupId = "INSUREIT-{0}" -f $startedUtc.ToLocalTime().ToString("yyyyMMdd-HHmmss")
$partialPath = Join-Path $workRoot "$backupId.partial"
$finalPath = Join-Path $backupRoot $backupId

if (Test-Path -LiteralPath $partialPath) { throw "Partial backup already exists: $partialPath" }
if (Test-Path -LiteralPath $finalPath) { throw "Backup already exists: $finalPath" }

New-Item -ItemType Directory -Path $partialPath | Out-Null
$dbPath = Join-Path $partialPath "database"
$storagePath = Join-Path $partialPath "storage"
New-Item -ItemType Directory -Path $dbPath | Out-Null
if (-not $SkipStorage) { New-Item -ItemType Directory -Path $storagePath | Out-Null }
$logPath = Join-Path $partialPath "backup.log"

$manifest = [ordered]@{
    version = 1
    backupId = $backupId
    status = "in_progress"
    startedAtUtc = $startedUtc.ToString("o")
    completedAtUtc = $null
    projectRef = [string]$config.projectRef
    region = [string]$config.region
    gitCommit = ""
    database = [ordered]@{
        roles = "database/roles.sql"
        schema = "database/schema.sql"
        data = "database/data.sql"
        migrationHistorySchema = "database/history_schema.sql"
        migrationHistoryData = "database/history_data.sql"
    }
    storage = [ordered]@{
        skipped = [bool]$SkipStorage
        endpoint = [string]$config.storageEndpoint
        buckets = @()
        objectCount = 0
        bytes = 0
    }
}

try {
    $gitCommit = (& git -C (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path rev-parse HEAD 2>$null | Select-Object -First 1)
    if ($LASTEXITCODE -eq 0) { $manifest.gitCommit = [string]$gitCommit }

    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $partialPath "manifest.json") -Encoding UTF8
    Write-BackupLog "Backup started: $backupId" $logPath

    Invoke-Checked "supabase" @("db","dump","--db-url",$dbUrl,"-f",(Join-Path $dbPath "roles.sql"),"--role-only") "Roles dump"
    Invoke-Checked "supabase" @("db","dump","--db-url",$dbUrl,"-f",(Join-Path $dbPath "schema.sql")) "Schema dump"
    Invoke-Checked "supabase" @("db","dump","--db-url",$dbUrl,"-f",(Join-Path $dbPath "data.sql"),"--use-copy","--data-only","-x","storage.buckets_vectors","-x","storage.vector_indexes") "Data dump"
    Invoke-Checked "supabase" @("db","dump","--db-url",$dbUrl,"-f",(Join-Path $dbPath "history_schema.sql"),"--schema","supabase_migrations") "Migration history schema dump"
    Invoke-Checked "supabase" @("db","dump","--db-url",$dbUrl,"-f",(Join-Path $dbPath "history_data.sql"),"--use-copy","--data-only","--schema","supabase_migrations") "Migration history data dump"
    Write-BackupLog "Database dump completed." $logPath

    if (-not $SkipStorage) {
        Set-RcloneSourceEnvironment -Endpoint ([string]$config.storageEndpoint) -Region ([string]$config.region) -AccessKeyId $s3AccessKeyId -SecretAccessKey $s3Secret
        try {
            $rawBuckets = & rclone lsf "insureit:" --dirs-only --quiet
            if ($LASTEXITCODE -ne 0) { throw "Could not list Supabase Storage buckets." }
            $bucketNames = @($rawBuckets | ForEach-Object { $_.Trim().TrimEnd("/") } | Where-Object { $_ } | Sort-Object -Unique)

            $bucketStats = @()
            $totalObjects = 0L
            $totalBytes = 0L
            foreach ($bucket in $bucketNames) {
                $target = Join-Path $storagePath $bucket
                New-Item -ItemType Directory -Force -Path $target | Out-Null

                Invoke-Checked "rclone" @("copy","insureit:$bucket",$target,"--fast-list","--create-empty-src-dirs","--quiet") "Storage copy for bucket '$bucket'"

                $sizeJson = (& rclone size "insureit:$bucket" --json --quiet | Out-String)
                if ($LASTEXITCODE -ne 0) { throw "Could not measure Storage bucket '$bucket'." }
                $size = $sizeJson | ConvertFrom-Json
                $count = [int64]$size.count
                $bytes = [int64]$size.bytes
                $totalObjects += $count
                $totalBytes += $bytes
                $bucketStats += [pscustomobject]@{ name = $bucket; objects = $count; bytes = $bytes }
                Write-BackupLog "Storage bucket completed: $bucket ($count objects)." $logPath
            }

            $manifest.storage.buckets = @($bucketStats)
            $manifest.storage.objectCount = $totalObjects
            $manifest.storage.bytes = $totalBytes
        }
        finally {
            Clear-RcloneSourceEnvironment
        }
    }

    $checksums = Get-ChecksumInventory -BackupPath $partialPath
    if ($checksums.Count -eq 0) { throw "No backup payload files were produced." }
    $checksums | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $partialPath "checksums.json") -Encoding UTF8

    foreach ($entry in $checksums) {
        $fullPath = Join-Path $partialPath ($entry.Path.Replace("/", "\"))
        if (-not (Test-Path -LiteralPath $fullPath)) { throw "Checksum verification file missing: $($entry.Path)" }
        $actual = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $entry.Sha256) { throw "Checksum verification failed for $($entry.Path)." }
    }

    $manifest.status = "healthy"
    $manifest.completedAtUtc = [DateTime]::UtcNow.ToString("o")
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $partialPath "manifest.json") -Encoding UTF8
    Write-BackupLog "Checksum verification passed." $logPath

    Move-Item -LiteralPath $partialPath -Destination $finalPath
    Write-Host ""
    Write-Host "Backup completed successfully." -ForegroundColor Green
    Write-Host $finalPath
}
catch {
    $manifest.status = "failed"
    $manifest.completedAtUtc = [DateTime]::UtcNow.ToString("o")
    try {
        $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $partialPath "manifest.json") -Encoding UTF8
        Write-BackupLog ("Backup failed: " + $_.Exception.Message) $logPath
    } catch {}
    throw
}
finally {
    $dbUrl = $null
    $s3Secret = $null
}
