[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [string]$ConfigPath = (Join-Path $PSScriptRoot "dr.config.local.json"),
    [string]$SecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\dr-secrets.clixml"),
    [switch]$Execute
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProductionProjectRef = "ilzhsfqqjyppzzvfscmh"
$ApprovedDrProjectRef = "jzuqlcysyqtyydukveir"

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

function Invoke-PsqlSingleValue {
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseUrl,
        [Parameter(Mandatory = $true)][string]$Sql,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $rawOutput = @(& psql "$DatabaseUrl" -X -v ON_ERROR_STOP=1 -t -A -c $Sql)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Label failed (psql exit code $exitCode)."
    }

    $lines = @(
        $rawOutput |
        ForEach-Object { ([string]$_).Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
    if ($lines.Count -lt 1) {
        throw "$Label returned no value."
    }
    return [string]$lines[0]
}

function Get-RcloneBuckets {
    $raw = @(& rclone lsf "drrestore:" --dirs-only --quiet)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Could not list DR Storage buckets (rclone exit code $exitCode)."
    }
    return @(
        $raw |
        ForEach-Object { ([string]$_).Trim().TrimEnd('/') } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Sort-Object -Unique
    )
}

function Get-RcloneSize {
    param([Parameter(Mandatory = $true)][string]$RemotePath)

    $raw = @(& rclone size "$RemotePath" --json --quiet)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Could not verify '$RemotePath' (rclone exit code $exitCode)."
    }
    $json = [string]::Join([Environment]::NewLine, $raw)
    if ([string]::IsNullOrWhiteSpace($json)) {
        throw "rclone returned no size data for '$RemotePath'."
    }
    return ($json | ConvertFrom-Json)
}

function Invoke-ForcedStorageUpload {
    param(
        [Parameter(Mandatory = $true)][string]$LocalPath,
        [Parameter(Mandatory = $true)][string]$RemotePath,
        [Parameter(Mandatory = $true)][string]$BucketName
    )

    # The database snapshot restores storage.objects metadata before the physical
    # object bytes exist. A normal sync can therefore mistake metadata-only rows
    # for real destination files and attempt SetModTime/CopyObject against a
    # non-existent object key. Force a real PUT for every local object instead.
    & rclone copy "$LocalPath" "$RemotePath" `
        --no-check-dest `
        --no-update-modtime `
        --retries 1 `
        --fast-list `
        --quiet

    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Forced Storage upload '$BucketName' failed with exit code $exitCode. STOP and inspect before retrying."
    }
}

function Invoke-DownloadedStorageCheck {
    param(
        [Parameter(Mandatory = $true)][string]$LocalPath,
        [Parameter(Mandatory = $true)][string]$RemotePath,
        [Parameter(Mandatory = $true)][string]$BucketName
    )

    # --download forces rclone to read the destination object bytes rather than
    # trusting Storage metadata or a remote checksum. This proves that the files
    # physically exist and match the verified local backup.
    & rclone check "$LocalPath" "$RemotePath" --download --quiet
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Downloaded byte verification failed for '$BucketName' with exit code $exitCode."
    }
}

Require-Command "psql"
Require-Command "rclone"

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw "DR config file not found: $ConfigPath"
}
if (-not (Test-Path -LiteralPath $SecretsPath -PathType Leaf)) {
    throw "DR credential file not found: $SecretsPath"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$sourceRef = [string]$config.sourceProjectRef
$targetRef = [string]$config.targetProjectRef
$targetRegion = [string]$config.targetRegion
$storageEndpoint = [string]$config.targetStorageEndpoint
$controlSchema = [string]$config.controlSchema

if ($sourceRef -ne $ProductionProjectRef) { throw "STOPPED: source is not INSUREIT production." }
if ($targetRef -ne $ApprovedDrProjectRef) { throw "STOPPED: target is not the approved INSUREIT DR project." }
if ($targetRef -eq $ProductionProjectRef) { throw "STOPPED: production cannot be a DR restore target." }
if ([string]::IsNullOrWhiteSpace($storageEndpoint) -or -not $storageEndpoint.Contains($targetRef)) {
    throw "STOPPED: DR Storage endpoint does not contain the approved target ref."
}
if ([string]::IsNullOrWhiteSpace($controlSchema) -or $controlSchema -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    throw "Invalid DR control schema."
}

$backup = [IO.Path]::GetFullPath($BackupPath)
& (Join-Path $PSScriptRoot "Verify-InsureITBackup.ps1") -BackupPath $backup
if ($LASTEXITCODE -ne 0) { throw "Backup verification failed." }

$manifestPath = Join-Path $backup "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "Backup manifest not found." }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if ([string]$manifest.projectRef -ne $sourceRef) { throw "Backup source project is not INSUREIT production." }
if ($manifest.storage.skipped) { throw "Backup does not contain Storage bytes." }

$expectedBuckets = @($manifest.storage.buckets)
$expectedBucketCount = $expectedBuckets.Count
$expectedObjectCount = [int64]$manifest.storage.objectCount
$expectedBytes = [int64]$manifest.storage.bytes
if ($expectedBucketCount -lt 1) { throw "Backup manifest contains no Storage buckets." }

foreach ($bucket in $expectedBuckets) {
    $name = [string]$bucket.name
    if ([string]::IsNullOrWhiteSpace($name)) { throw "Backup manifest contains an unnamed Storage bucket." }
    $localBucket = Join-Path (Join-Path $backup "storage") $name
    if (-not (Test-Path -LiteralPath $localBucket -PathType Container)) {
        throw "Local Storage folder is missing: $localBucket"
    }
}

$secrets = Import-Clixml -LiteralPath $SecretsPath
if ([string]$secrets.TargetProjectRef -ne $targetRef) { throw "Stored DR credentials belong to another project." }
$dbUrl = Convert-SecureStringToPlainText $secrets.DatabaseUrl
$s3Access = [string]$secrets.S3AccessKeyId
$s3Secret = Convert-SecureStringToPlainText $secrets.S3SecretAccessKey

if ([string]::IsNullOrWhiteSpace($dbUrl) -or -not $dbUrl.Contains($targetRef) -or $dbUrl.Contains($ProductionProjectRef)) {
    throw "STOPPED: stored DR database URL failed target validation."
}
if ([string]::IsNullOrWhiteSpace($s3Access) -or [string]::IsNullOrWhiteSpace($s3Secret)) {
    throw "Stored DR S3 credentials are incomplete."
}

$guardSql = "select source_project_ref || '|' || target_project_ref || '|' || mode from `"$controlSchema`".replica_state where singleton=true;"
$guardResult = Invoke-PsqlSingleValue -DatabaseUrl $dbUrl -Sql $guardSql -Label "DR control-marker check"
if ($guardResult -ne "$sourceRef|$targetRef|standby") {
    throw "STOPPED: DR control marker does not authorize this target. Guard result: $guardResult"
}

$metadataSql = @"
select concat_ws('|',
  (select count(*) from storage.buckets),
  (select count(*) from storage.objects)
);
"@
$metadataResult = Invoke-PsqlSingleValue -DatabaseUrl $dbUrl -Sql $metadataSql -Label "DR Storage metadata check"
$metadataParts = $metadataResult.Split('|')
if ($metadataParts.Count -ne 2) { throw "Unexpected DR Storage metadata result: $metadataResult" }
$metadataBucketCount = [int64]$metadataParts[0]
$metadataObjectCount = [int64]$metadataParts[1]
if ($metadataBucketCount -ne [int64]$expectedBucketCount -or $metadataObjectCount -ne $expectedObjectCount) {
    throw "STOPPED: DR Storage metadata does not match the backup. Expected $expectedBucketCount buckets / $expectedObjectCount objects; found $metadataBucketCount / $metadataObjectCount."
}

$storageEnvSet = $false
try {
    $env:RCLONE_CONFIG_DRRESTORE_TYPE = "s3"
    $env:RCLONE_CONFIG_DRRESTORE_PROVIDER = "Other"
    $env:RCLONE_CONFIG_DRRESTORE_ENDPOINT = $storageEndpoint
    $env:RCLONE_CONFIG_DRRESTORE_REGION = $targetRegion
    $env:RCLONE_CONFIG_DRRESTORE_ACCESS_KEY_ID = $s3Access
    $env:RCLONE_CONFIG_DRRESTORE_SECRET_ACCESS_KEY = $s3Secret
    $storageEnvSet = $true

    $targetBuckets = @(Get-RcloneBuckets)
    foreach ($bucket in $expectedBuckets) {
        $name = [string]$bucket.name
        if ($targetBuckets -notcontains $name) {
            throw "DR Storage API does not currently expose restored bucket '$name'."
        }
    }

    Write-Host ""
    Write-Host "INSUREIT DR Storage restore plan" -ForegroundColor Cyan
    Write-Host ("Backup ID:        {0}" -f [string]$manifest.backupId)
    Write-Host ("Source project:   {0}" -f $sourceRef)
    Write-Host ("DR target:        {0}" -f $targetRef)
    Write-Host ("Storage buckets:  {0}" -f $expectedBucketCount)
    Write-Host ("Storage objects:  {0}" -f $expectedObjectCount)
    Write-Host ("Storage bytes:    {0:N2} MB" -f ($expectedBytes / 1MB))
    Write-Host ""
    Write-Host "Method: force-upload every verified local object byte to the approved DR Supabase Storage project." -ForegroundColor Yellow
    Write-Host "The destination metadata is already restored, so ordinary timestamp-based sync is intentionally bypassed." -ForegroundColor Yellow
    Write-Host "After upload, every destination object is downloaded and compared against the local backup." -ForegroundColor Yellow
    Write-Host "Production Storage is never modified by this script." -ForegroundColor Green

    if (-not $Execute) {
        Write-Host ""
        Write-Host "PLAN ONLY. No DR Storage files were changed." -ForegroundColor Green
        Write-Host "Run again with -Execute only after this plan is accepted."
        return
    }

    $confirmationPhrase = "MIRROR STORAGE TO DR $targetRef"
    Write-Host ""
    $confirmation = Read-Host "Type exactly: $confirmationPhrase"
    if ($confirmation -cne $confirmationPhrase) { throw "DR Storage restore cancelled." }

    Write-Host ""
    Write-Host "Restoring physical Storage bytes to DR..." -ForegroundColor Cyan

    [int64]$actualTotalCount = 0
    [int64]$actualTotalBytes = 0

    foreach ($bucket in $expectedBuckets) {
        $name = [string]$bucket.name
        $localBucket = Join-Path (Join-Path $backup "storage") $name
        $remoteBucket = "drrestore:$name"

        Invoke-ForcedStorageUpload -LocalPath $localBucket -RemotePath $remoteBucket -BucketName $name
        Invoke-DownloadedStorageCheck -LocalPath $localBucket -RemotePath $remoteBucket -BucketName $name

        $size = Get-RcloneSize -RemotePath $remoteBucket
        $actualCount = [int64]$size.count
        $actualBytes = [int64]$size.bytes
        $expectedCount = [int64]$bucket.objects
        $bucketExpectedBytes = [int64]$bucket.bytes

        if ($actualCount -ne $expectedCount -or $actualBytes -ne $bucketExpectedBytes) {
            throw "Storage verification failed for '$name': expected $expectedCount objects / $bucketExpectedBytes bytes, got $actualCount / $actualBytes."
        }

        $actualTotalCount += $actualCount
        $actualTotalBytes += $actualBytes
        Write-Host ("  {0}: {1} objects / {2:N2} MB / byte-check passed" -f $name, $actualCount, ($actualBytes / 1MB))
    }

    if ($actualTotalCount -ne $expectedObjectCount -or $actualTotalBytes -ne $expectedBytes) {
        throw "Total Storage verification failed: expected $expectedObjectCount objects / $expectedBytes bytes, got $actualTotalCount / $actualTotalBytes."
    }

    Write-Host ""
    Write-Host "DR STORAGE RESTORE COMPLETED AND BYTE-VERIFIED." -ForegroundColor Green
    Write-Host ("Buckets: {0}" -f $expectedBucketCount)
    Write-Host ("Objects: {0}" -f $actualTotalCount)
    Write-Host ("Bytes:   {0}" -f $actualTotalBytes)
}
finally {
    if ($storageEnvSet) {
        "TYPE","PROVIDER","ENDPOINT","REGION","ACCESS_KEY_ID","SECRET_ACCESS_KEY" | ForEach-Object {
            Remove-Item "Env:RCLONE_CONFIG_DRRESTORE_$_" -ErrorAction SilentlyContinue
        }
    }
    $dbUrl = $null
    $s3Secret = $null
    $secrets = $null
}
