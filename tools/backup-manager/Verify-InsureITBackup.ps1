[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [switch]$AllowPartial
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Convert-ToObjectArray {
    param($Value)
    if ($null -eq $Value) { return @() }
    $items = @($Value)
    if ($items.Count -eq 1 -and $items[0] -is [System.Array]) {
        return @($items[0])
    }
    return $items
}

function Get-RelativePayloadPath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$FullName
    )
    return ((($FullName.Substring($Root.TrimEnd("\").Length)) -replace '^[\\/]+','' -replace '\\','/'))
}

$backup = [IO.Path]::GetFullPath($BackupPath)
if (-not (Test-Path -LiteralPath $backup -PathType Container)) {
    throw "Backup folder not found: $backup"
}

$manifestPath = Join-Path $backup "manifest.json"
$checksumsPath = Join-Path $backup "checksums.json"

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "manifest.json is missing." }
if (-not (Test-Path -LiteralPath $checksumsPath -PathType Leaf)) { throw "checksums.json is missing." }

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$formatVersion = if ($null -eq $manifest.version) { 1 } else { [int]$manifest.version }
if ($formatVersion -lt 1 -or $formatVersion -gt 2) {
    throw "Unsupported backup manifest version: $formatVersion"
}
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

$parsedChecksums = Get-Content -LiteralPath $checksumsPath -Raw | ConvertFrom-Json
$checksums = @(Convert-ToObjectArray $parsedChecksums)
if ($checksums.Count -eq 0) { throw "Checksum inventory is empty." }

$checksumPathSet = New-Object System.Collections.Generic.HashSet[string] ([StringComparer]::OrdinalIgnoreCase)
$checkedBytes = 0L
foreach ($entry in $checksums) {
    $pathText = ([string]$entry.Path).Replace("\", "/").TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($pathText)) { throw "Checksum inventory contains an empty path." }
    if (-not $checksumPathSet.Add($pathText)) { throw "Duplicate checksum path: $pathText" }

    $relative = $pathText.Replace("/", "\")
    $full = Join-Path $backup $relative
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        throw "Backup file is missing: $pathText"
    }
    $item = Get-Item -LiteralPath $full
    if ([int64]$item.Length -ne [int64]$entry.Length) {
        throw "File length mismatch: $pathText"
    }
    $actual = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne ([string]$entry.Sha256).ToLowerInvariant()) {
        throw "SHA256 mismatch: $pathText"
    }
    $checkedBytes += $item.Length
}

if (-not $manifest.storage.skipped) {
    $storageRoot = Join-Path $backup "storage"
    if (-not (Test-Path -LiteralPath $storageRoot -PathType Container)) {
        throw "Storage folder is missing."
    }
    foreach ($bucket in @(Convert-ToObjectArray $manifest.storage.buckets)) {
        $bucketPath = Join-Path $storageRoot ([string]$bucket.name)
        if (-not (Test-Path -LiteralPath $bucketPath -PathType Container)) {
            throw "Storage bucket folder is missing: $($bucket.name)"
        }
    }
}

$managedPolicyCount = $null
$managedTriggerCount = $null
$migrationFileCount = $null

if ($formatVersion -ge 2) {
    if ([string]$manifest.format -ne "insureit-supabase-logical-v2") {
        throw "Format v2 manifest has an unexpected format identifier: '$($manifest.format)'."
    }
    if ([string]$manifest.gitCommit -notmatch '^[0-9a-fA-F]{40}$') {
        throw "Format v2 manifest gitCommit is missing or invalid."
    }

    $managedRelative = [string]$manifest.managedSchema.file
    if ([string]::IsNullOrWhiteSpace($managedRelative)) { throw "Format v2 manifest is missing managedSchema.file." }
    $managedPath = Join-Path $backup ($managedRelative.Replace("/", "\"))
    if (-not (Test-Path -LiteralPath $managedPath -PathType Leaf)) {
        throw "Managed-schema artifact is missing: $managedRelative"
    }

    $managed = Get-Content -LiteralPath $managedPath -Raw | ConvertFrom-Json
    if ([int]$managed.version -ne [int]$manifest.managedSchema.artifactVersion) {
        throw "Managed-schema artifact version does not match the manifest."
    }
    if ([string]$managed.sourceProjectRef -ne [string]$manifest.projectRef) {
        throw "Managed-schema artifact source project does not match the backup manifest."
    }

    $policies = @(Convert-ToObjectArray $managed.policies)
    $triggers = @(Convert-ToObjectArray $managed.triggers)
    $managedPolicyCount = $policies.Count
    $managedTriggerCount = $triggers.Count

    if ($managedPolicyCount -lt 1) {
        throw "Managed-schema artifact contains no storage.objects policies."
    }
    if ($managedTriggerCount -ne 1) {
        throw "Managed-schema artifact must contain exactly one auth.users trigger."
    }
    if ($managedPolicyCount -ne [int]$manifest.managedSchema.storageObjectPolicyCount) {
        throw "Managed-schema policy count does not match the manifest."
    }
    if ($managedTriggerCount -ne [int]$manifest.managedSchema.authUserTriggerCount) {
        throw "Managed-schema trigger count does not match the manifest."
    }

    $policyNames = New-Object System.Collections.Generic.HashSet[string]
    foreach ($policy in $policies) {
        if ([string]$policy.schema -ne "storage" -or [string]$policy.table -ne "objects") {
            throw "Managed-schema artifact contains a policy outside storage.objects."
        }
        if ([string]$policy.permissive -notin @("PERMISSIVE", "RESTRICTIVE")) {
            throw "Managed-schema policy '$($policy.name)' has an invalid permissive mode."
        }
        if ([string]$policy.cmd -notin @("ALL", "SELECT", "INSERT", "UPDATE", "DELETE")) {
            throw "Managed-schema policy '$($policy.name)' has an invalid command."
        }
        if ([string]::IsNullOrWhiteSpace([string]$policy.name)) { throw "Managed-schema policy has an empty name." }
        if (-not $policyNames.Add([string]$policy.name)) { throw "Duplicate managed-schema policy name: $($policy.name)" }
        if (@(Convert-ToObjectArray $policy.roles).Count -lt 1) { throw "Managed-schema policy '$($policy.name)' has no roles." }
    }

    $trigger = $triggers[0]
    if ([string]$trigger.schema -ne "auth" -or [string]$trigger.table -ne "users" -or [string]$trigger.name -ne "on_auth_user_created") {
        throw "Managed-schema trigger is not auth.users.on_auth_user_created."
    }
    if ([string]::IsNullOrWhiteSpace([string]$trigger.definition)) {
        throw "Managed-schema auth trigger definition is empty."
    }

    $migrationsRelative = [string]$manifest.migrationSnapshot.root
    if ([string]::IsNullOrWhiteSpace($migrationsRelative)) { throw "Format v2 manifest is missing migrationSnapshot.root." }
    if ([string]$manifest.migrationSnapshot.gitCommit -ne [string]$manifest.gitCommit) {
        throw "Migration snapshot git commit does not match manifest gitCommit."
    }
    $migrationsRoot = Join-Path $backup ($migrationsRelative.Replace("/", "\"))
    if (-not (Test-Path -LiteralPath $migrationsRoot -PathType Container)) {
        throw "Migration snapshot folder is missing: $migrationsRelative"
    }
    $migrationFiles = @(Get-ChildItem -LiteralPath $migrationsRoot -File -Recurse)
    $migrationFileCount = $migrationFiles.Count
    if ($migrationFileCount -lt 1) { throw "Migration snapshot is empty." }
    if ($migrationFileCount -ne [int]$manifest.migrationSnapshot.fileCount) {
        throw "Migration snapshot file count does not match the manifest."
    }

    # Format v2 requires the checksum inventory to cover the payload exactly,
    # so metadata or migration files cannot silently exist outside verification.
    $payloadRoots = @("database", "metadata", "migrations")
    if (-not $manifest.storage.skipped) { $payloadRoots += "storage" }
    $actualPathSet = New-Object System.Collections.Generic.HashSet[string] ([StringComparer]::OrdinalIgnoreCase)
    foreach ($rootName in $payloadRoots) {
        $rootPath = Join-Path $backup $rootName
        if (-not (Test-Path -LiteralPath $rootPath -PathType Container)) {
            throw "Format v2 payload folder is missing: $rootName"
        }
        foreach ($file in @(Get-ChildItem -LiteralPath $rootPath -File -Recurse)) {
            $relativePath = Get-RelativePayloadPath -Root $backup -FullName $file.FullName
            [void]$actualPathSet.Add($relativePath)
        }
    }

    foreach ($path in $actualPathSet) {
        if (-not $checksumPathSet.Contains($path)) {
            throw "Format v2 payload file is not covered by checksums.json: $path"
        }
    }
    foreach ($path in $checksumPathSet) {
        if (-not $actualPathSet.Contains($path)) {
            throw "checksums.json contains a path outside the format v2 payload: $path"
        }
    }
}

Write-Host "Backup verification passed." -ForegroundColor Green
Write-Host ("Backup ID: {0}" -f $manifest.backupId)
Write-Host ("Project:   {0}" -f $manifest.projectRef)
Write-Host ("Completed: {0}" -f $manifest.completedAtUtc)
Write-Host ("Format:    v{0}" -f $formatVersion)
Write-Host ("Files:     {0}" -f $checksums.Count)
Write-Host ("Verified:  {0:N2} MB" -f ($checkedBytes / 1MB))
if ($formatVersion -ge 2) {
    Write-Host ("Managed:   {0} storage policies / {1} auth trigger" -f $managedPolicyCount,$managedTriggerCount)
    Write-Host ("Migrations:{0,5} files @ {1}" -f $migrationFileCount,[string]$manifest.gitCommit)
}
if (-not $manifest.storage.skipped) {
    Write-Host ("Storage:   {0} objects / {1:N2} MB" -f [int64]$manifest.storage.objectCount, ([int64]$manifest.storage.bytes / 1MB))
}
