[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [string]$ProductionSecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\secrets.clixml"),
    [string]$DRSecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\dr-secrets.clixml"),
    [string]$ConfigPath = (Join-Path $PSScriptRoot "dr.config.local.json"),
    [switch]$Execute,
    [switch]$Unattended,
    [switch]$AllowOlderBackup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProductionProjectRef = "ilzhsfqqjyppzzvfscmh"
$ApprovedDrProjectRef = "jzuqlcysyqtyydukveir"

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found."
    }
}

function Convert-SecureStringToPlainText {
    param([System.Security.SecureString]$Value)
    return [System.Net.NetworkCredential]::new("", $Value).Password
}

function Convert-ToSqlLiteral {
    param([AllowNull()][string]$Value)
    if ($null -eq $Value) { return "NULL" }
    return "'" + $Value.Replace("'", "''") + "'"
}

function Invoke-PsqlSingleValue {
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseUrl,
        [Parameter(Mandatory = $true)][string]$Sql,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $raw = @(& psql "$DatabaseUrl" -X -q -v ON_ERROR_STOP=1 -t -A -c $Sql)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Label failed (psql exit code $exitCode)."
    }

    $lines = @(
        $raw |
        ForEach-Object { ([string]$_).Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
    if ($lines.Count -lt 1) { throw "$Label returned no value." }
    return [string]$lines[0]
}

function Get-CopyTableStats {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string[]]$AllowedSchemas
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "SQL data file not found: $Path"
    }

    $stats = New-Object System.Collections.ArrayList
    $currentIdentifier = $null
    $currentSchema = $null
    $currentTable = $null
    [int64]$rowCount = 0

    foreach ($line in [IO.File]::ReadLines($Path)) {
        if ($null -eq $currentIdentifier) {
            if ($line -match '^COPY\s+((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)\.(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*))\s+\(') {
                $identifier = [string]$matches[1]
                if ($identifier -match '^"(?<schema>[^"]+)"\."(?<table>[^"]+)"$') {
                    $schema = [string]$matches['schema']
                    $table = [string]$matches['table']
                }
                elseif ($identifier -match '^(?<schema>[A-Za-z_][A-Za-z0-9_$]*)\.(?<table>[A-Za-z_][A-Za-z0-9_$]*)$') {
                    $schema = [string]$matches['schema']
                    $table = [string]$matches['table']
                }
                else {
                    throw "Could not parse COPY table identifier: $identifier"
                }

                if ($AllowedSchemas -notcontains $schema) {
                    throw "Unexpected schema '$schema' in data dump. Allowed: $($AllowedSchemas -join ', ')."
                }

                $currentIdentifier = $identifier
                $currentSchema = $schema
                $currentTable = $table
                $rowCount = 0
            }
        }
        else {
            if ($line -eq '\.') {
                [void]$stats.Add([pscustomobject]@{
                    Schema = $currentSchema
                    Table = $currentTable
                    Key = "$currentSchema.$currentTable"
                    SqlIdentifier = $currentIdentifier
                    Rows = $rowCount
                })
                $currentIdentifier = $null
                $currentSchema = $null
                $currentTable = $null
                $rowCount = 0
            }
            else {
                $rowCount++
            }
        }
    }

    if ($null -ne $currentIdentifier) {
        throw "COPY block for '$currentIdentifier' did not terminate correctly."
    }

    return $stats.ToArray()
}

function Get-TargetCounts {
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseUrl,
        [Parameter(Mandatory = $true)][object[]]$TableStats
    )

    $map = @{}
    if ($TableStats.Count -eq 0) { return $map }

    $parts = @()
    foreach ($table in $TableStats) {
        $key = ([string]$table.Key).Replace("'", "''")
        $parts += "select '$key'::text as table_key, count(*)::bigint as row_count from $($table.SqlIdentifier)"
    }
    $query = ($parts -join "`nunion all`n") + ";"

    $output = @(& psql "$DatabaseUrl" -X -q -v ON_ERROR_STOP=1 -t -A -F "|" -c $query)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) { throw "Target row-count verification query failed (psql exit code $exitCode)." }

    foreach ($line in $output) {
        $text = ([string]$line).Trim()
        if ([string]::IsNullOrWhiteSpace($text)) { continue }
        $split = $text -split '\|', 2
        if ($split.Count -ne 2) { throw "Unexpected row-count verification output." }
        $map[$split[0]] = [int64]$split[1]
    }
    return $map
}

function Assert-ExpectedCounts {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Actual,
        [Parameter(Mandatory = $true)][object[]]$Expected,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $mismatches = @()
    foreach ($table in $Expected) {
        $key = [string]$table.Key
        if (-not $Actual.ContainsKey($key)) {
            $mismatches += "$key missing"
        }
        elseif ([int64]$Actual[$key] -ne [int64]$table.Rows) {
            $mismatches += "$key expected=$($table.Rows) actual=$($Actual[$key])"
        }
    }
    if ($mismatches.Count -gt 0) {
        throw "$Label row-count verification failed: $(($mismatches | Select-Object -First 10) -join '; ')"
    }
}

function Set-ReplicaStatus {
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseUrl,
        [Parameter(Mandatory = $true)][string]$ControlSchema,
        [Parameter(Mandatory = $true)][string]$SourceRef,
        [Parameter(Mandatory = $true)][string]$TargetRef,
        [Parameter(Mandatory = $true)][string]$Status,
        [AllowNull()][string]$ErrorMessage,
        [AllowNull()][string]$BackupId,
        [AllowNull()][string]$BackupCompletedAt,
        [switch]$RecordBackup
    )

    if ($ControlSchema -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { throw "Invalid control schema name." }

    $statusSql = Convert-ToSqlLiteral $Status
    $errorSql = Convert-ToSqlLiteral $ErrorMessage
    $sourceSql = Convert-ToSqlLiteral $SourceRef
    $targetSql = Convert-ToSqlLiteral $TargetRef
    $backupSql = Convert-ToSqlLiteral $BackupId
    $completedSql = if ([string]::IsNullOrWhiteSpace($BackupCompletedAt)) { "NULL" } else { (Convert-ToSqlLiteral $BackupCompletedAt) + "::timestamptz" }

    $setBackup = if ($RecordBackup) {
        "last_backup_id = $backupSql, last_backup_completed_at = $completedSql,"
    }
    else { "" }

    $startedSql = if ($Status -eq "refreshing") { "last_refresh_started_at = now(), last_refresh_completed_at = NULL," } else { "" }
    $finishedSql = if ($Status -in @("healthy","failed")) { "last_refresh_completed_at = now()," } else { "" }

    $sql = @"
with updated as (
  update "$ControlSchema".replica_state
     set $setBackup
         $startedSql
         $finishedSql
         last_refresh_status = $statusSql,
         last_refresh_error = $errorSql,
         updated_at = now()
   where singleton = true
     and source_project_ref = $sourceSql
     and target_project_ref = $targetSql
     and mode = 'standby'
  returning 1
)
select count(*) from updated;
"@

    $result = Invoke-PsqlSingleValue -DatabaseUrl $DatabaseUrl -Sql $sql -Label "DR control-marker update"
    if ($result -ne "1") { throw "DR control marker update did not affect exactly one authorized row." }
}

function Set-RcloneTargetEnvironment {
    param(
        [Parameter(Mandatory = $true)][string]$Endpoint,
        [Parameter(Mandatory = $true)][string]$Region,
        [Parameter(Mandatory = $true)][string]$AccessKeyId,
        [Parameter(Mandatory = $true)][string]$SecretAccessKey
    )
    $env:RCLONE_CONFIG_DRREFRESH_TYPE = "s3"
    $env:RCLONE_CONFIG_DRREFRESH_PROVIDER = "Other"
    $env:RCLONE_CONFIG_DRREFRESH_ENDPOINT = $Endpoint
    $env:RCLONE_CONFIG_DRREFRESH_REGION = $Region
    $env:RCLONE_CONFIG_DRREFRESH_ACCESS_KEY_ID = $AccessKeyId
    $env:RCLONE_CONFIG_DRREFRESH_SECRET_ACCESS_KEY = $SecretAccessKey
}

function Clear-RcloneTargetEnvironment {
    "TYPE","PROVIDER","ENDPOINT","REGION","ACCESS_KEY_ID","SECRET_ACCESS_KEY" | ForEach-Object {
        Remove-Item "Env:RCLONE_CONFIG_DRREFRESH_$_" -ErrorAction SilentlyContinue
    }
}

function Get-RcloneBuckets {
    $raw = @(& rclone lsf "drrefresh:" --dirs-only --quiet)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) { throw "Could not list DR Storage buckets (rclone exit code $exitCode)." }
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
    if ($exitCode -ne 0) { throw "Could not measure '$RemotePath' (rclone exit code $exitCode)." }
    $json = [string]::Join([Environment]::NewLine, $raw)
    if ([string]::IsNullOrWhiteSpace($json)) { throw "rclone returned no size data for '$RemotePath'." }
    return ($json | ConvertFrom-Json)
}

function Convert-ToPsqlIncludePath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return ([IO.Path]::GetFullPath($Path)).Replace('\','/').Replace("'", "''")
}

if ($Unattended -and -not $Execute) {
    throw "-Unattended is valid only together with -Execute."
}

Require-Command "psql"
Require-Command "rclone"

foreach ($requiredPath in @($ProductionSecretsPath,$DRSecretsPath,$ConfigPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) { throw "Required file not found: $requiredPath" }
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$sourceRef = [string]$config.sourceProjectRef
$targetRef = [string]$config.targetProjectRef
$targetRegion = [string]$config.targetRegion
$storageEndpoint = [string]$config.targetStorageEndpoint
$controlSchema = [string]$config.controlSchema

if ($sourceRef -ne $ProductionProjectRef) { throw "STOPPED: DR config source is not INSUREIT production." }
if ($targetRef -ne $ApprovedDrProjectRef) { throw "STOPPED: DR config target is not the approved INSUREIT DR project." }
if ($targetRef -eq $ProductionProjectRef) { throw "STOPPED: production cannot be a DR refresh target." }
if ([string]::IsNullOrWhiteSpace($storageEndpoint) -or -not $storageEndpoint.Contains($targetRef)) {
    throw "STOPPED: DR Storage endpoint does not contain the approved target ref."
}
if ([string]::IsNullOrWhiteSpace($controlSchema) -or $controlSchema -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    throw "Invalid DR control schema."
}

$backup = [IO.Path]::GetFullPath($BackupPath)
& (Join-Path $PSScriptRoot "Verify-InsureITBackup.ps1") -BackupPath $backup

$manifestPath = Join-Path $backup "manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ([int]$manifest.version -ne 2 -or [string]$manifest.format -ne "insureit-supabase-logical-v2") {
    throw "DR refresh requires a verified INSUREIT backup format v2."
}
if ([string]$manifest.status -ne "healthy") { throw "Backup manifest is not healthy." }
if ([string]$manifest.projectRef -ne $sourceRef) { throw "Backup source does not match INSUREIT production." }
if ($manifest.storage.skipped) { throw "DR refresh requires a backup containing Storage bytes." }

$managedPath = Join-Path $backup (([string]$manifest.managedSchema.file).Replace('/','\'))
if (-not (Test-Path -LiteralPath $managedPath -PathType Leaf)) { throw "Verified managed-schema artifact is missing." }
$managed = Get-Content -LiteralPath $managedPath -Raw | ConvertFrom-Json
$managedPolicies = @($managed.policies)
$managedTriggers = @($managed.triggers)
if ($managedPolicies.Count -ne [int]$manifest.managedSchema.storageObjectPolicyCount) {
    throw "Managed-schema policy count does not match the manifest."
}
if ($managedTriggers.Count -ne [int]$manifest.managedSchema.authUserTriggerCount -or $managedTriggers.Count -ne 1) {
    throw "Managed-schema auth trigger count does not match the manifest."
}
if ([string]$managedTriggers[0].schema -ne "auth" -or [string]$managedTriggers[0].table -ne "users" -or [string]$managedTriggers[0].name -ne "on_auth_user_created") {
    throw "Managed-schema artifact does not contain the expected auth.users trigger."
}

$dbDir = Join-Path $backup "database"
$dataPath = Join-Path $dbDir "data.sql"
$historyDataPath = Join-Path $dbDir "history_data.sql"
$dataStats = @(Get-CopyTableStats -Path $dataPath -AllowedSchemas @("public","auth","storage"))
$historyStats = @(Get-CopyTableStats -Path $historyDataPath -AllowedSchemas @("supabase_migrations"))
if ($dataStats.Count -lt 1 -or $historyStats.Count -lt 1) { throw "Backup COPY-table inventory is incomplete." }

$prodSecrets = Import-Clixml -LiteralPath $ProductionSecretsPath
$drSecrets = Import-Clixml -LiteralPath $DRSecretsPath
if ([string]$drSecrets.TargetProjectRef -ne $targetRef) { throw "Stored DR credentials belong to another project." }
$prodUrl = Convert-SecureStringToPlainText $prodSecrets.DatabaseUrl
$drUrl = Convert-SecureStringToPlainText $drSecrets.DatabaseUrl
$s3Access = [string]$drSecrets.S3AccessKeyId
$s3Secret = Convert-SecureStringToPlainText $drSecrets.S3SecretAccessKey

if ([string]::IsNullOrWhiteSpace($prodUrl) -or -not $prodUrl.Contains($sourceRef) -or $prodUrl.Contains($targetRef)) {
    throw "STOPPED: production database credential validation failed."
}
if ([string]::IsNullOrWhiteSpace($drUrl) -or -not $drUrl.Contains($targetRef) -or $drUrl.Contains($sourceRef)) {
    throw "STOPPED: DR database credential validation failed."
}
if ([string]::IsNullOrWhiteSpace($s3Access) -or [string]::IsNullOrWhiteSpace($s3Secret)) {
    throw "Stored DR S3 credentials are incomplete."
}

$markerSql = @"
select concat_ws('|',
  source_project_ref,
  target_project_ref,
  mode,
  coalesce(last_refresh_status,''),
  coalesce(last_backup_id,''),
  coalesce(last_backup_completed_at::text,'')
)
from "$controlSchema".replica_state
where singleton=true;
"@
$marker = Invoke-PsqlSingleValue -DatabaseUrl $drUrl -Sql $markerSql -Label "DR control-marker read"
$markerParts = $marker.Split('|')
if ($markerParts.Count -ne 6) { throw "Unexpected DR control-marker format." }
if ($markerParts[0] -ne $sourceRef -or $markerParts[1] -ne $targetRef -or $markerParts[2] -ne "standby") {
    throw "STOPPED: DR control marker does not authorize this production-to-DR relationship."
}
$currentStatus = $markerParts[3]
$currentBackupId = $markerParts[4]
$currentBackupCompletedText = $markerParts[5]
if ($currentStatus -notin @("baseline_restored","healthy")) {
    throw "STOPPED: DR marker status is '$currentStatus'. A failed/incomplete refresh requires inspection before another refresh."
}
if ($Unattended -and $currentStatus -ne "healthy") {
    throw "STOPPED: unattended refresh is allowed only after one manual non-destructive refresh has reached 'healthy'."
}

$backupCompleted = [DateTimeOffset]::Parse([string]$manifest.completedAtUtc)
if (-not [string]::IsNullOrWhiteSpace($currentBackupCompletedText)) {
    $currentBackupCompleted = [DateTimeOffset]::Parse($currentBackupCompletedText)
    if (-not $AllowOlderBackup -and $backupCompleted -le $currentBackupCompleted) {
        throw "STOPPED: backup '$($manifest.backupId)' is not newer than the last known-good DR backup '$currentBackupId'."
    }
}

Write-Host "Checking live production/DR schema parity before any refresh..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "Compare-InsureITDRSchema.ps1") `
    -ProductionSecretsPath $ProductionSecretsPath `
    -DRSecretsPath $DRSecretsPath `
    -ConfigPath $ConfigPath `
    -FailOnDifference

$totalRows = [int64](($dataStats | Measure-Object -Property Rows -Sum).Sum)
$historyRows = [int64](($historyStats | Measure-Object -Property Rows -Sum).Sum)
$authEntry = $dataStats | Where-Object { $_.Key -eq "auth.users" } | Select-Object -First 1
$expectedAuthUsers = if ($null -eq $authEntry) { 0L } else { [int64]$authEntry.Rows }
$expectedBuckets = @($manifest.storage.buckets)
$expectedObjectCount = [int64]$manifest.storage.objectCount
$expectedBytes = [int64]$manifest.storage.bytes

Write-Host ""
Write-Host "INSUREIT non-destructive DR refresh plan" -ForegroundColor Cyan
Write-Host ("Backup ID:               {0}" -f [string]$manifest.backupId)
Write-Host ("Backup completed UTC:    {0}" -f [string]$manifest.completedAtUtc)
Write-Host ("Backup Git commit:       {0}" -f [string]$manifest.gitCommit)
Write-Host ("Current DR backup:       {0}" -f $currentBackupId)
Write-Host ("Current DR status:       {0}" -f $currentStatus)
Write-Host ("Database COPY tables:    {0}" -f $dataStats.Count)
Write-Host ("Database COPY rows:      {0}" -f $totalRows)
Write-Host ("Migration-history rows:  {0}" -f $historyRows)
Write-Host ("Auth users in backup:    {0}" -f $expectedAuthUsers)
Write-Host ("Managed schema:          {0} policies / {1} trigger" -f $managedPolicies.Count,$managedTriggers.Count)
Write-Host ("Storage buckets:         {0}" -f $expectedBuckets.Count)
Write-Host ("Storage objects:         {0}" -f $expectedObjectCount)
Write-Host ("Storage bytes:           {0:N2} MB" -f ($expectedBytes / 1MB))
Write-Host ""
Write-Host "Method:" -ForegroundColor Yellow
Write-Host "  1. Preserve the existing DR schema and project infrastructure."
Write-Host "  2. In one DR database transaction, disable replica-side triggers, DELETE only the tables represented in the verified dump, then COPY the exact backup data and migration history back in."
Write-Host "  3. Verify every restored COPY-table row count."
Write-Host "  4. Force-upload Storage bytes, exact-sync away stale physical objects, and download-check every object against the backup."
Write-Host "  5. Re-run exact production/DR schema comparison."
Write-Host "  6. Mark the DR backup healthy only after every check passes."
Write-Host "Production is read-only throughout this workflow." -ForegroundColor Green
Write-Host "No Supabase project reset is used." -ForegroundColor Green

if (-not $Execute) {
    Write-Host ""
    Write-Host "PLAN ONLY. No DR data, schema, or Storage bytes were changed." -ForegroundColor Green
    Write-Host "Run again with -Execute only after this plan is accepted."
    $prodUrl = $null
    $drUrl = $null
    $s3Secret = $null
    return
}

if (-not $Unattended) {
    $confirmationPhrase = "REFRESH DR FROM BACKUP $([string]$manifest.backupId)"
    Write-Host ""
    $confirmation = Read-Host "Type exactly: $confirmationPhrase"
    if ($confirmation -cne $confirmationPhrase) { throw "DR refresh cancelled. No refresh was started." }
}
else {
    Write-Host "Unattended guarded execution enabled." -ForegroundColor Yellow
}

$workDir = Join-Path $PSScriptRoot "_work"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
$refreshSqlPath = Join-Path $workDir ("dr-data-refresh-" + [string]$manifest.backupId + ".sql")
$storageEnvSet = $false
$refreshStarted = $false

try {
    Set-ReplicaStatus -DatabaseUrl $drUrl -ControlSchema $controlSchema -SourceRef $sourceRef -TargetRef $targetRef -Status "refreshing" -ErrorMessage $null -BackupId $null -BackupCompletedAt $null
    $refreshStarted = $true

    $sqlLines = New-Object System.Collections.Generic.List[string]
    $sqlLines.Add("BEGIN;")
    $sqlLines.Add("SET LOCAL session_replication_role = replica;")
    foreach ($table in $dataStats) {
        $sqlLines.Add("DELETE FROM $($table.SqlIdentifier);")
    }
    foreach ($table in $historyStats) {
        $sqlLines.Add("DELETE FROM $($table.SqlIdentifier);")
    }
    $sqlLines.Add("\i '$(Convert-ToPsqlIncludePath $dataPath)'")
    $sqlLines.Add("\i '$(Convert-ToPsqlIncludePath $historyDataPath)'")
    $sqlLines.Add("COMMIT;")

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllLines($refreshSqlPath, $sqlLines.ToArray(), $utf8NoBom)

    Write-Host ""
    Write-Host "Refreshing DR database data transactionally..." -ForegroundColor Cyan
    & psql "$drUrl" -X -v ON_ERROR_STOP=1 -f "$refreshSqlPath"
    $refreshExitCode = $LASTEXITCODE
    if ($refreshExitCode -ne 0) {
        throw "DR database refresh transaction failed with exit code $refreshExitCode."
    }

    $actualDataCounts = Get-TargetCounts -DatabaseUrl $drUrl -TableStats $dataStats
    Assert-ExpectedCounts -Actual $actualDataCounts -Expected $dataStats -Label "Database"
    $actualHistoryCounts = Get-TargetCounts -DatabaseUrl $drUrl -TableStats $historyStats
    Assert-ExpectedCounts -Actual $actualHistoryCounts -Expected $historyStats -Label "Migration history"
    Write-Host ("Database row verification passed for {0} data tables and {1} migration-history tables." -f $dataStats.Count,$historyStats.Count) -ForegroundColor Green

    $metadataSql = @"
select concat_ws('|',
  (select count(*) from storage.buckets),
  (select count(*) from storage.objects),
  (select count(*) from auth.users),
  (select count(*) from pg_policies where schemaname='storage' and tablename='objects'),
  (select count(*)
     from pg_trigger t
     join pg_class c on c.oid=t.tgrelid
     join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal
      and n.nspname='auth'
      and c.relname='users'
      and t.tgname='on_auth_user_created')
);
"@
    $metadataResult = Invoke-PsqlSingleValue -DatabaseUrl $drUrl -Sql $metadataSql -Label "DR metadata verification"
    $metadataParts = $metadataResult.Split('|')
    if ($metadataParts.Count -ne 5) { throw "Unexpected DR metadata verification result: $metadataResult" }
    if ([int64]$metadataParts[0] -ne [int64]$expectedBuckets.Count -or [int64]$metadataParts[1] -ne $expectedObjectCount) {
        throw "DR Storage metadata count mismatch after database refresh."
    }
    if ([int64]$metadataParts[2] -ne $expectedAuthUsers) { throw "DR Auth-user count mismatch after database refresh." }
    if ([int64]$metadataParts[3] -ne [int64]$managedPolicies.Count -or [int64]$metadataParts[4] -ne 1) {
        throw "DR managed auth/storage object counts changed unexpectedly during data refresh."
    }

    Set-RcloneTargetEnvironment -Endpoint $storageEndpoint -Region $targetRegion -AccessKeyId $s3Access -SecretAccessKey $s3Secret
    $storageEnvSet = $true

    $remoteBuckets = @(Get-RcloneBuckets)
    $expectedNames = @($expectedBuckets | ForEach-Object { [string]$_.name } | Sort-Object -Unique)
    $missingBuckets = @($expectedNames | Where-Object { $remoteBuckets -notcontains $_ })
    $extraBuckets = @($remoteBuckets | Where-Object { $expectedNames -notcontains $_ })
    if ($missingBuckets.Count -gt 0 -or $extraBuckets.Count -gt 0) {
        throw "DR Storage bucket reconciliation failed. Missing: $($missingBuckets -join ', '); Extra: $($extraBuckets -join ', ')."
    }

    Write-Host ""
    Write-Host "Refreshing and byte-verifying DR Storage..." -ForegroundColor Cyan
    [int64]$actualTotalCount = 0
    [int64]$actualTotalBytes = 0

    foreach ($bucket in $expectedBuckets) {
        $name = [string]$bucket.name
        $localBucket = Join-Path (Join-Path $backup "storage") $name
        $remoteBucket = "drrefresh:$name"

        & rclone copy "$localBucket" "$remoteBucket" --no-check-dest --no-update-modtime --retries 1 --fast-list --quiet
        $copyExit = $LASTEXITCODE
        if ($copyExit -ne 0) { throw "Forced DR Storage upload '$name' failed with exit code $copyExit." }

        & rclone sync "$localBucket" "$remoteBucket" --size-only --no-update-modtime --fast-list --quiet
        $syncExit = $LASTEXITCODE
        if ($syncExit -ne 0) { throw "Exact DR Storage cleanup '$name' failed with exit code $syncExit." }

        & rclone check "$localBucket" "$remoteBucket" --download --quiet
        $checkExit = $LASTEXITCODE
        if ($checkExit -ne 0) { throw "Downloaded byte verification failed for DR Storage bucket '$name' with exit code $checkExit." }

        $size = Get-RcloneSize -RemotePath $remoteBucket
        $actualCount = [int64]$size.count
        $actualBytes = [int64]$size.bytes
        $expectedCount = [int64]$bucket.objects
        $bucketExpectedBytes = [int64]$bucket.bytes
        if ($actualCount -ne $expectedCount -or $actualBytes -ne $bucketExpectedBytes) {
            throw "DR Storage verification failed for '$name': expected $expectedCount objects / $bucketExpectedBytes bytes, got $actualCount / $actualBytes."
        }

        $actualTotalCount += $actualCount
        $actualTotalBytes += $actualBytes
        Write-Host ("  {0}: {1} objects / {2:N2} MB / byte-check passed" -f $name,$actualCount,($actualBytes / 1MB))
    }

    if ($actualTotalCount -ne $expectedObjectCount -or $actualTotalBytes -ne $expectedBytes) {
        throw "Total DR Storage verification failed: expected $expectedObjectCount objects / $expectedBytes bytes, got $actualTotalCount / $actualTotalBytes."
    }

    Write-Host ""
    Write-Host "Rechecking exact production/DR schema parity..." -ForegroundColor Cyan
    & (Join-Path $PSScriptRoot "Compare-InsureITDRSchema.ps1") `
        -ProductionSecretsPath $ProductionSecretsPath `
        -DRSecretsPath $DRSecretsPath `
        -ConfigPath $ConfigPath `
        -FailOnDifference

    Set-ReplicaStatus -DatabaseUrl $drUrl -ControlSchema $controlSchema -SourceRef $sourceRef -TargetRef $targetRef -Status "healthy" -ErrorMessage $null -BackupId ([string]$manifest.backupId) -BackupCompletedAt ([string]$manifest.completedAtUtc) -RecordBackup

    Write-Host ""
    Write-Host "INSUREIT DR REFRESH COMPLETED AND VERIFIED." -ForegroundColor Green
    Write-Host ("Backup ID:       {0}" -f [string]$manifest.backupId)
    Write-Host ("Database tables: {0}" -f $dataStats.Count)
    Write-Host ("Auth users:      {0}" -f $expectedAuthUsers)
    Write-Host ("Storage objects: {0}" -f $actualTotalCount)
    Write-Host ("Storage bytes:   {0}" -f $actualTotalBytes)
    Write-Host "DR marker:       healthy"
}
catch {
    $message = $_.Exception.Message
    if ($message.Length -gt 1000) { $message = $message.Substring(0,1000) }
    if ($refreshStarted) {
        try {
            Set-ReplicaStatus -DatabaseUrl $drUrl -ControlSchema $controlSchema -SourceRef $sourceRef -TargetRef $targetRef -Status "failed" -ErrorMessage $message -BackupId $null -BackupCompletedAt $null
        }
        catch {
            Write-Warning "The refresh failed and the DR marker could not be updated to failed: $($_.Exception.Message)"
        }
    }
    throw
}
finally {
    if ($storageEnvSet) { Clear-RcloneTargetEnvironment }
    if (Test-Path -LiteralPath $refreshSqlPath -PathType Leaf) {
        Remove-Item -LiteralPath $refreshSqlPath -Force -ErrorAction SilentlyContinue
    }
    $prodUrl = $null
    $drUrl = $null
    $s3Secret = $null
    $prodSecrets = $null
    $drSecrets = $null
}
