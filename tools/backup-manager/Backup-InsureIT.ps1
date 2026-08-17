[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "config.local.json"),
    [string]$SecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\secrets.clixml"),
    [switch]$PreflightOnly,
    [switch]$SkipStorage
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$BackupFormatVersion = 2
$ManagedSchemaArtifactVersion = 1

function Write-BackupLog {
    param([string]$Message, [string]$Path)
    $line = "{0} {1}" -f ([DateTime]::UtcNow.ToString("o")), $Message
    Write-Host $line
    if ($Path) { Add-Content -LiteralPath $Path -Value $line -Encoding UTF8 }
}

function Write-JsonNoBom {
    param(
        [Parameter(Mandatory = $true)]$Value,
        [Parameter(Mandatory = $true)][string]$Path,
        [int]$Depth = 12
    )
    $json = $Value | ConvertTo-Json -Depth $Depth
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, $utf8NoBom)
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
    foreach ($name in @("database", "metadata", "migrations", "storage")) {
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

function Get-ManagedSchemaSnapshot {
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseUrl,
        [Parameter(Mandatory = $true)][string]$ProjectRef
    )

    $sql = @'
BEGIN READ ONLY;
SELECT jsonb_build_object(
    'policies',
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'schema', schemaname,
                    'table', tablename,
                    'name', policyname,
                    'permissive', permissive,
                    'roles', roles,
                    'cmd', cmd,
                    'qual', qual,
                    'with_check', with_check
                )
                ORDER BY policyname
            )
            FROM pg_policies
            WHERE schemaname = 'storage'
              AND tablename = 'objects'
        ),
        '[]'::jsonb
    ),
    'triggers',
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'schema', n.nspname,
                    'table', c.relname,
                    'name', t.tgname,
                    'definition', pg_get_triggerdef(t.oid, true)
                )
                ORDER BY t.tgname
            )
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE NOT t.tgisinternal
              AND n.nspname = 'auth'
              AND c.relname = 'users'
              AND t.tgname = 'on_auth_user_created'
        ),
        '[]'::jsonb
    )
);
COMMIT;
'@

    $raw = @(& psql "$DatabaseUrl" -X -q -v ON_ERROR_STOP=1 -t -A -P pager=off -c $sql)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Managed auth/storage schema extraction failed with psql exit code $exitCode."
    }

    $json = [string]::Join([Environment]::NewLine, $raw).Trim()
    if ([string]::IsNullOrWhiteSpace($json)) {
        throw "Managed auth/storage schema extraction returned no data."
    }

    $parsed = $json | ConvertFrom-Json
    $policies = @($parsed.policies)
    $triggers = @($parsed.triggers)
    if ($policies.Count -lt 1) {
        throw "Managed-schema capture found no storage.objects policies. Tooling must be reviewed before accepting this backup."
    }
    if ($triggers.Count -ne 1 -or [string]$triggers[0].name -ne "on_auth_user_created") {
        throw "Managed-schema capture did not find exactly auth.users.on_auth_user_created. Tooling must be reviewed before accepting this backup."
    }

    return [ordered]@{
        version = $ManagedSchemaArtifactVersion
        sourceProjectRef = $ProjectRef
        capturedAtUtc = [DateTime]::UtcNow.ToString("o")
        scope = [ordered]@{
            policies = "storage.objects"
            trigger = "auth.users.on_auth_user_created"
        }
        policies = $policies
        triggers = $triggers
    }
}

function Copy-GitMigrationSnapshot {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][string]$ExpectedCommit,
        [Parameter(Mandatory = $true)][string]$WorkPath
    )

    $zipPath = Join-Path $WorkPath "migration-snapshot.zip"
    $extractPath = Join-Path $WorkPath "migration-snapshot-extracted"
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    if (Test-Path -LiteralPath $extractPath) { Remove-Item -LiteralPath $extractPath -Recurse -Force }

    Invoke-Checked "git" @("-C",$RepoRoot,"archive","--format=zip","--output",$zipPath,$ExpectedCommit,"supabase/migrations") "Migration snapshot archive"
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force

    $source = Join-Path $extractPath "supabase\migrations"
    if (-not (Test-Path -LiteralPath $source -PathType Container)) {
        throw "Git migration snapshot did not contain supabase/migrations."
    }

    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Get-ChildItem -LiteralPath $source -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
    }

    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $extractPath -Recurse -Force -ErrorAction SilentlyContinue

    $files = @(Get-ChildItem -LiteralPath $Destination -File -Recurse)
    if ($files.Count -lt 1) {
        throw "Migration snapshot is empty."
    }
    return $files.Count
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Config file not found: $ConfigPath. Copy config.example.json to config.local.json first."
}
if (-not (Test-Path -LiteralPath $SecretsPath)) {
    throw "Encrypted credential file not found: $SecretsPath. Run Set-InsureITBackupSecrets.ps1 first."
}

$localDumpHelper = Join-Path $PSScriptRoot "Invoke-InsureITLocalDatabaseDump.ps1"
if (-not (Test-Path -LiteralPath $localDumpHelper -PathType Leaf)) {
    throw "Local database dump helper not found: $localDumpHelper"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$secrets = Import-Clixml -LiteralPath $SecretsPath

Require-Command "git"
Require-Command "psql"
Require-Command "pg_dump"
Require-Command "pg_dumpall"
if (-not $SkipStorage) { Require-Command "rclone" }

Test-FreeSpace -BackupRoot $config.backupRoot -MinimumFreeSpaceGB ([double]$config.minimumFreeSpaceGB)

$dbUrl = Convert-SecureStringToPlainText $secrets.DatabaseUrl
$s3Secret = Convert-SecureStringToPlainText $secrets.S3SecretAccessKey
$s3AccessKeyId = [string]$secrets.S3AccessKeyId
$projectRef = [string]$config.projectRef

if ([string]::IsNullOrWhiteSpace($dbUrl)) { throw "Stored database connection string is empty." }
if ([string]::IsNullOrWhiteSpace($projectRef) -or -not $dbUrl.Contains($projectRef)) {
    throw "STOPPED: stored database connection does not match config projectRef '$projectRef'."
}
if (-not $SkipStorage -and ([string]::IsNullOrWhiteSpace($s3AccessKeyId) -or [string]::IsNullOrWhiteSpace($s3Secret))) {
    throw "Stored S3 credentials are incomplete."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$gitCommit = ((@(& git -C $repoRoot rev-parse HEAD 2>$null) | Select-Object -First 1) -as [string]).Trim()
if ($LASTEXITCODE -ne 0 -or $gitCommit -notmatch '^[0-9a-fA-F]{40}$') {
    throw "Could not resolve the repository HEAD commit."
}

Write-Host "Preflight passed for project $projectRef." -ForegroundColor Green
Write-Host "Backup format: v$BackupFormatVersion"
Write-Host "Git snapshot:   $gitCommit"
Write-Host "DB transport:   local PostgreSQL 17 + Supabase-compatible filtering"
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
$metadataPath = Join-Path $partialPath "metadata"
$migrationsPath = Join-Path $partialPath "migrations"
$storagePath = Join-Path $partialPath "storage"
New-Item -ItemType Directory -Path $dbPath | Out-Null
New-Item -ItemType Directory -Path $metadataPath | Out-Null
New-Item -ItemType Directory -Path $migrationsPath | Out-Null
if (-not $SkipStorage) { New-Item -ItemType Directory -Path $storagePath | Out-Null }
$logPath = Join-Path $partialPath "backup.log"

$manifest = [ordered]@{
    version = $BackupFormatVersion
    format = "insureit-supabase-logical-v2"
    backupId = $backupId
    status = "in_progress"
    startedAtUtc = $startedUtc.ToString("o")
    completedAtUtc = $null
    projectRef = $projectRef
    region = [string]$config.region
    gitCommit = $gitCommit
    database = [ordered]@{
        transport = "local-postgresql-17-supabase-compatible-v1"
        roles = "database/roles.sql"
        schema = "database/schema.sql"
        data = "database/data.sql"
        migrationHistorySchema = "database/history_schema.sql"
        migrationHistoryData = "database/history_data.sql"
    }
    managedSchema = [ordered]@{
        file = "metadata/managed-schema.json"
        artifactVersion = $ManagedSchemaArtifactVersion
        storageObjectPolicyCount = 0
        authUserTriggerCount = 0
    }
    migrationSnapshot = [ordered]@{
        root = "migrations"
        source = "supabase/migrations"
        gitCommit = $gitCommit
        fileCount = 0
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
    Write-JsonNoBom -Value $manifest -Path (Join-Path $partialPath "manifest.json")
    Write-BackupLog "Backup started: $backupId (format v$BackupFormatVersion)" $logPath

    $migrationCount = Copy-GitMigrationSnapshot -RepoRoot $repoRoot -Destination $migrationsPath -ExpectedCommit $gitCommit -WorkPath $partialPath
    $manifest.migrationSnapshot.fileCount = $migrationCount
    Write-BackupLog "Git migration snapshot captured: $migrationCount files at $gitCommit." $logPath

    & $localDumpHelper -DatabaseUrl $dbUrl -OutputDirectory $dbPath
    Write-BackupLog "Database dump completed using local PostgreSQL 17 transport." $logPath

    $managed = Get-ManagedSchemaSnapshot -DatabaseUrl $dbUrl -ProjectRef $projectRef
    $managedPath = Join-Path $metadataPath "managed-schema.json"
    Write-JsonNoBom -Value $managed -Path $managedPath -Depth 20
    $manifest.managedSchema.storageObjectPolicyCount = @($managed.policies).Count
    $manifest.managedSchema.authUserTriggerCount = @($managed.triggers).Count
    Write-BackupLog ("Managed schema captured: {0} storage policies / {1} auth trigger." -f $manifest.managedSchema.storageObjectPolicyCount,$manifest.managedSchema.authUserTriggerCount) $logPath

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

                $sizeRaw = @(& rclone size "insureit:$bucket" --json --quiet)
                if ($LASTEXITCODE -ne 0) { throw "Could not measure Storage bucket '$bucket'." }
                $sizeJson = [string]::Join([Environment]::NewLine, $sizeRaw)
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

    $endingGitCommit = ((@(& git -C $repoRoot rev-parse HEAD 2>$null) | Select-Object -First 1) -as [string]).Trim()
    if ($LASTEXITCODE -ne 0 -or $endingGitCommit -ne $gitCommit) {
        throw "Repository HEAD changed while the backup was running. Backup rejected so database artifacts and migration snapshot cannot be mismatched."
    }

    $checksums = Get-ChecksumInventory -BackupPath $partialPath
    if ($checksums.Count -eq 0) { throw "No backup payload files were produced." }
    Write-JsonNoBom -Value $checksums -Path (Join-Path $partialPath "checksums.json") -Depth 4

    foreach ($entry in $checksums) {
        $fullPath = Join-Path $partialPath ($entry.Path.Replace("/", "\"))
        if (-not (Test-Path -LiteralPath $fullPath)) { throw "Checksum verification file missing: $($entry.Path)" }
        $actual = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $entry.Sha256) { throw "Checksum verification failed for $($entry.Path)." }
    }

    $manifest.status = "healthy"
    $manifest.completedAtUtc = [DateTime]::UtcNow.ToString("o")
    Write-JsonNoBom -Value $manifest -Path (Join-Path $partialPath "manifest.json")
    Write-BackupLog "Checksum verification passed for format v$BackupFormatVersion." $logPath

    Move-Item -LiteralPath $partialPath -Destination $finalPath
    Write-Host ""
    Write-Host "Backup completed successfully." -ForegroundColor Green
    Write-Host ("Format: v{0}" -f $BackupFormatVersion)
    Write-Host ("Managed schema: {0} storage policies / {1} auth trigger" -f $manifest.managedSchema.storageObjectPolicyCount,$manifest.managedSchema.authUserTriggerCount)
    Write-Host ("Migration snapshot: {0} files" -f $manifest.migrationSnapshot.fileCount)
    Write-Host $finalPath
}
catch {
    $manifest.status = "failed"
    $manifest.completedAtUtc = [DateTime]::UtcNow.ToString("o")
    try {
        Write-JsonNoBom -Value $manifest -Path (Join-Path $partialPath "manifest.json")
        Write-BackupLog ("Backup failed: " + $_.Exception.Message) $logPath
    } catch {}
    throw
}
finally {
    Clear-RcloneSourceEnvironment
    $dbUrl = $null
    $s3Secret = $null
    $secrets = $null
}
