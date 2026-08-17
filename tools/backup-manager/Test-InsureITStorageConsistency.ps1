[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BackupPath,
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

foreach ($requiredPath in @($ConfigPath,$SecretsPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required file not found: $requiredPath"
    }
}

$backup = [IO.Path]::GetFullPath($BackupPath)
if (-not (Test-Path -LiteralPath $backup -PathType Container)) {
    throw "Backup folder not found: $backup"
}

$manifestPath = Join-Path $backup "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Backup manifest is missing: $manifestPath"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if ([string]$config.projectRef -ne $ProductionProjectRef) {
    throw "STOPPED: config does not point to the approved INSUREIT production project."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ([string]$manifest.projectRef -ne $ProductionProjectRef) {
    throw "STOPPED: backup does not belong to INSUREIT production."
}
if ([string]$manifest.status -ne "healthy") {
    throw "STOPPED: backup manifest status is '$($manifest.status)', not healthy."
}
if ([bool]$manifest.storage.skipped) {
    throw "STOPPED: this backup did not include Storage."
}

$secrets = Import-Clixml -LiteralPath $SecretsPath
$dbUrl = Convert-SecureStringToPlainText $secrets.DatabaseUrl
$s3Secret = Convert-SecureStringToPlainText $secrets.S3SecretAccessKey
$s3AccessKeyId = [string]$secrets.S3AccessKeyId
if ([string]::IsNullOrWhiteSpace($dbUrl) -or -not $dbUrl.Contains($ProductionProjectRef)) {
    throw "STOPPED: stored database connection does not match INSUREIT production."
}
if ([string]::IsNullOrWhiteSpace($s3AccessKeyId) -or [string]::IsNullOrWhiteSpace($s3Secret)) {
    throw "Stored S3 credentials are incomplete."
}

foreach ($command in @('psql','rclone')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Required command '$command' was not found."
    }
}

Write-Host "INSUREIT Storage consistency diagnostic" -ForegroundColor Cyan
Write-Host "Production: $ProductionProjectRef"
Write-Host "Backup:     $($manifest.backupId)"
Write-Host "Purpose: compare production Storage metadata, live S3 bytes, and the verified backup."
Write-Host "This diagnostic is read-only and does not modify production, the backup, or DR." -ForegroundColor Green
Write-Host ""

$sql = @'
BEGIN READ ONLY;
SELECT b.id || E'\t' || count(o.id)::text
FROM storage.buckets b
LEFT JOIN storage.objects o ON o.bucket_id = b.id
GROUP BY b.id
ORDER BY b.id;
COMMIT;
'@

try {
    $dbRowsRaw = @(& psql "$dbUrl" -X -q -v ON_ERROR_STOP=1 -t -A -P pager=off -c $sql)
    if ($LASTEXITCODE -ne 0) {
        throw "Could not read production storage.buckets/storage.objects metadata."
    }

    $dbCounts = @{}
    foreach ($line in $dbRowsRaw) {
        $text = ([string]$line).Trim()
        if ([string]::IsNullOrWhiteSpace($text)) { continue }
        $parts = $text -split "`t", 2
        if ($parts.Count -eq 2) {
            $dbCounts[$parts[0]] = [int64]$parts[1]
        }
    }

    Set-RcloneSourceEnvironment -Endpoint ([string]$config.storageEndpoint) -Region ([string]$config.region) -AccessKeyId $s3AccessKeyId -SecretAccessKey $s3Secret

    $results = @()
    $hasMismatch = $false
    foreach ($bucket in @($manifest.storage.buckets)) {
        $name = [string]$bucket.name
        $backupObjects = [int64]$bucket.objects
        $backupBytes = [int64]$bucket.bytes
        $dbObjects = if ($dbCounts.ContainsKey($name)) { [int64]$dbCounts[$name] } else { -1L }

        $sizeRaw = @(& rclone size "insureit:$name" --json --quiet)
        if ($LASTEXITCODE -ne 0) {
            throw "Could not measure live Storage bucket '$name'."
        }
        $size = ([string]::Join([Environment]::NewLine, $sizeRaw)) | ConvertFrom-Json
        $liveObjects = [int64]$size.count
        $liveBytes = [int64]$size.bytes

        $localBucketPath = Join-Path (Join-Path $backup "storage") $name
        if (-not (Test-Path -LiteralPath $localBucketPath -PathType Container)) {
            throw "Backup Storage folder is missing: $name"
        }
        $localFiles = @(Get-ChildItem -LiteralPath $localBucketPath -File -Recurse)
        $localObjects = [int64]$localFiles.Count
        if ($localObjects -eq 0) {
            $localBytes = 0L
        }
        else {
            $localMeasure = $localFiles | Measure-Object -Property Length -Sum
            $localBytes = [int64]$localMeasure.Sum
        }

        $objectMatch = ($dbObjects -eq $liveObjects -and $liveObjects -eq $backupObjects -and $backupObjects -eq $localObjects)
        $byteMatch = ($liveBytes -eq $backupBytes -and $backupBytes -eq $localBytes)
        if (-not $objectMatch -or -not $byteMatch) { $hasMismatch = $true }

        $results += [pscustomobject]@{
            Bucket = $name
            DbObjects = $dbObjects
            LiveObjects = $liveObjects
            BackupObjects = $backupObjects
            LocalFiles = $localObjects
            LiveBytes = $liveBytes
            BackupBytes = $backupBytes
            LocalBytes = $localBytes
            Match = ($objectMatch -and $byteMatch)
        }
    }

    $results | Format-Table Bucket,DbObjects,LiveObjects,BackupObjects,LocalFiles,LiveBytes,BackupBytes,LocalBytes,Match -AutoSize
    Write-Host ""

    if ($hasMismatch) {
        throw "STORAGE CONSISTENCY CHECK FAILED: production metadata/live S3/backup counts or bytes differ. DR refresh must remain blocked."
    }

    Write-Host "STORAGE CONSISTENCY CHECK PASSED." -ForegroundColor Green
    Write-Host "Production metadata, live S3, and this backup agree for every backed-up bucket."
    Write-Host "A zero-count bucket is therefore confirmed as the current production state, not a backup copy omission."
}
finally {
    Clear-RcloneSourceEnvironment
    $dbUrl = $null
    $s3Secret = $null
    $secrets = $null
}
