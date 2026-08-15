[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [switch]$AllowPartial
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$backup = [IO.Path]::GetFullPath($BackupPath)
if (-not (Test-Path -LiteralPath $backup -PathType Container)) {
    throw "Backup folder not found: $backup"
}

$manifestPath = Join-Path $backup "manifest.json"
$checksumsPath = Join-Path $backup "checksums.json"

if (-not (Test-Path -LiteralPath $manifestPath)) { throw "manifest.json is missing." }
if (-not (Test-Path -LiteralPath $checksumsPath)) { throw "checksums.json is missing." }

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if (-not $AllowPartial -and $manifest.status -ne "healthy") {
    throw "Backup manifest status is '$($manifest.status)', not 'healthy'."
}

$requiredDatabaseFiles = @(
    "database\roles.sql",
    "database\schema.sql",
    "database\data.sql",
    "database\history_schema.sql",
    "database\history_data.sql"
)
foreach ($relative in $requiredDatabaseFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $backup $relative) -PathType Leaf)) {
        throw "Required database backup file is missing: $relative"
    }
}

$checksums = @(Get-Content -LiteralPath $checksumsPath -Raw | ConvertFrom-Json)
if ($checksums.Count -eq 0) { throw "Checksum inventory is empty." }

$checkedBytes = 0L
foreach ($entry in $checksums) {
    $relative = ([string]$entry.Path).Replace("/", "\")
    $full = Join-Path $backup $relative
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        throw "Backup file is missing: $($entry.Path)"
    }
    $item = Get-Item -LiteralPath $full
    if ([int64]$item.Length -ne [int64]$entry.Length) {
        throw "File length mismatch: $($entry.Path)"
    }
    $actual = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne ([string]$entry.Sha256).ToLowerInvariant()) {
        throw "SHA256 mismatch: $($entry.Path)"
    }
    $checkedBytes += $item.Length
}

if (-not $manifest.storage.skipped) {
    $storageRoot = Join-Path $backup "storage"
    if (-not (Test-Path -LiteralPath $storageRoot -PathType Container)) {
        throw "Storage folder is missing."
    }
    foreach ($bucket in @($manifest.storage.buckets)) {
        $bucketPath = Join-Path $storageRoot ([string]$bucket.name)
        if (-not (Test-Path -LiteralPath $bucketPath -PathType Container)) {
            throw "Storage bucket folder is missing: $($bucket.name)"
        }
    }
}

Write-Host "Backup verification passed." -ForegroundColor Green
Write-Host ("Backup ID: {0}" -f $manifest.backupId)
Write-Host ("Project:   {0}" -f $manifest.projectRef)
Write-Host ("Completed: {0}" -f $manifest.completedAtUtc)
Write-Host ("Files:     {0}" -f $checksums.Count)
Write-Host ("Verified:  {0:N2} MB" -f ($checkedBytes / 1MB))
if (-not $manifest.storage.skipped) {
    Write-Host ("Storage:   {0} objects / {1:N2} MB" -f [int64]$manifest.storage.objectCount, ([int64]$manifest.storage.bytes / 1MB))
}
