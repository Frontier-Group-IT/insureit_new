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

function Invoke-Checked {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$Label,
        [string]$WorkingDirectory = ""
    )

    if ([string]::IsNullOrWhiteSpace($WorkingDirectory)) {
        & $Command @Arguments
    }
    else {
        Push-Location $WorkingDirectory
        try { & $Command @Arguments }
        finally { Pop-Location }
    }

    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Label failed with exit code $exitCode."
    }
}

function Convert-ToSqlLiteral {
    param([AllowNull()][string]$Value)
    if ($null -eq $Value) { return "NULL" }
    return "'" + $Value.Replace("'", "''") + "'"
}

function Get-CopyTableStats {
    param(
        [string]$Path,
        [string[]]$AllowedSchemas
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
        [string]$DatabaseUrl,
        [object[]]$TableStats
    )

    $map = @{}
    if ($TableStats.Count -eq 0) { return $map }

    $parts = @()
    foreach ($table in $TableStats) {
        $key = ([string]$table.Key).Replace("'", "''")
        $parts += "select '$key'::text as table_key, count(*)::bigint as row_count from $($table.SqlIdentifier)"
    }
    $query = ($parts -join "`nunion all`n") + ";"

    $output = @(& psql $DatabaseUrl -X -v ON_ERROR_STOP=1 -t -A -F "|" -c $query)
    if ($LASTEXITCODE -ne 0) {
        throw "Target row-count verification query failed."
    }

    foreach ($line in $output) {
        $text = ([string]$line).Trim()
        if ([string]::IsNullOrWhiteSpace($text)) { continue }
        $split = $text -split '\|', 2
        if ($split.Count -ne 2) { throw "Unexpected row-count verification output." }
        $map[$split[0]] = [int64]$split[1]
    }
    return $map
}

function Set-ControlMarker {
    param(
        [string]$DatabaseUrl,
        [string]$ControlSchema,
        [string]$SourceRef,
        [string]$TargetRef,
        [int]$RpoHours,
        [string]$BackupId,
        [string]$BackupCompletedAt,
        [string]$Status,
        [AllowNull()][string]$ErrorMessage
    )

    if ($ControlSchema -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
        throw "Invalid control schema name."
    }

    $sourceSql = Convert-ToSqlLiteral $SourceRef
    $targetSql = Convert-ToSqlLiteral $TargetRef
    $backupSql = Convert-ToSqlLiteral $BackupId
    $statusSql = Convert-ToSqlLiteral $Status
    $errorSql = Convert-ToSqlLiteral $ErrorMessage
    $completedSql = if ([string]::IsNullOrWhiteSpace($BackupCompletedAt)) { "NULL" } else { (Convert-ToSqlLiteral $BackupCompletedAt) + "::timestamptz" }

    $sql = @"
create schema if not exists "$ControlSchema";
create table if not exists "$ControlSchema".replica_state (
    singleton boolean primary key default true check (singleton),
    source_project_ref text not null,
    target_project_ref text not null,
    mode text not null default 'standby' check (mode in ('standby','active')),
    rpo_hours integer not null default 6 check (rpo_hours > 0),
    last_backup_id text,
    last_backup_completed_at timestamptz,
    last_refresh_started_at timestamptz,
    last_refresh_completed_at timestamptz,
    last_refresh_status text,
    last_refresh_error text,
    updated_at timestamptz not null default now()
);
revoke all on schema "$ControlSchema" from public, anon, authenticated;
revoke all on table "$ControlSchema".replica_state from public, anon, authenticated;
insert into "$ControlSchema".replica_state (
    singleton, source_project_ref, target_project_ref, mode, rpo_hours,
    last_backup_id, last_backup_completed_at, last_refresh_started_at,
    last_refresh_completed_at, last_refresh_status, last_refresh_error, updated_at
) values (
    true, $sourceSql, $targetSql, 'standby', $RpoHours,
    $backupSql, $completedSql, now(),
    $(if ($Status -eq 'baseline_restored') { 'now()' } else { 'NULL' }),
    $statusSql, $errorSql, now()
)
on conflict (singleton) do update set
    source_project_ref = excluded.source_project_ref,
    target_project_ref = excluded.target_project_ref,
    mode = 'standby',
    rpo_hours = excluded.rpo_hours,
    last_backup_id = excluded.last_backup_id,
    last_backup_completed_at = excluded.last_backup_completed_at,
    last_refresh_started_at = case when excluded.last_refresh_status = 'refreshing' then now() else "$ControlSchema".replica_state.last_refresh_started_at end,
    last_refresh_completed_at = case when excluded.last_refresh_status = 'baseline_restored' then now() else "$ControlSchema".replica_state.last_refresh_completed_at end,
    last_refresh_status = excluded.last_refresh_status,
    last_refresh_error = excluded.last_refresh_error,
    updated_at = now();
"@

    $null = & psql $DatabaseUrl -X -v ON_ERROR_STOP=1 -c $sql
    if ($LASTEXITCODE -ne 0) { throw "Could not update the DR control marker." }
}

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw "DR config file not found: $ConfigPath"
}
if (-not (Test-Path -LiteralPath $SecretsPath -PathType Leaf)) {
    throw "DR credential file not found: $SecretsPath"
}

Require-Command "psql"
Require-Command "rclone"
Require-Command "supabase"

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$sourceRef = [string]$config.sourceProjectRef
$targetRef = [string]$config.targetProjectRef
$targetRegion = [string]$config.targetRegion
$storageEndpoint = [string]$config.targetStorageEndpoint
$controlSchema = [string]$config.controlSchema
$rpoHours = [int]$config.expectedRpoHours

if ($sourceRef -ne $ProductionProjectRef) { throw "STOPPED: source is not INSUREIT production." }
if ($targetRef -ne $ApprovedDrProjectRef) { throw "STOPPED: target is not the approved INSUREIT DR project." }
if ($targetRef -eq $ProductionProjectRef) { throw "STOPPED: production cannot be a DR restore target." }

$backup = [IO.Path]::GetFullPath($BackupPath)
& (Join-Path $PSScriptRoot "Verify-InsureITBackup.ps1") -BackupPath $backup
$manifest = Get-Content -LiteralPath (Join-Path $backup "manifest.json") -Raw | ConvertFrom-Json

if ([string]$manifest.projectRef -ne $sourceRef) { throw "Backup source project is not INSUREIT production." }
if ($manifest.storage.skipped) { throw "Backup does not contain Storage bytes." }

$dbDir = Join-Path $backup "database"
$rolesPath = Join-Path $dbDir "roles.sql"
$schemaPath = Join-Path $dbDir "schema.sql"
$dataPath = Join-Path $dbDir "data.sql"
$historyDataPath = Join-Path $dbDir "history_data.sql"
foreach ($required in @($rolesPath,$schemaPath,$dataPath,$historyDataPath)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required backup file missing: $required" }
}

$dataStats = @(Get-CopyTableStats -Path $dataPath -AllowedSchemas @("public","auth","storage"))
$historyStats = @(Get-CopyTableStats -Path $historyDataPath -AllowedSchemas @("supabase_migrations"))
if ($dataStats.Count -eq 0) { throw "No COPY tables found in data.sql." }
if ($historyStats.Count -eq 0) { throw "No migration-history COPY tables found." }

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
$guardOutput = @(& psql $dbUrl -X -v ON_ERROR_STOP=1 -t -A -c $guardSql)
if ($LASTEXITCODE -ne 0) { throw "Could not read the DR control marker." }
$guardLine = $guardOutput | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ } | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace([string]$guardLine)) { throw "DR control marker returned no row." }
$guardParts = ([string]$guardLine).Split('|')
if ($guardParts.Count -ne 3 -or $guardParts[0] -ne $sourceRef -or $guardParts[1] -ne $targetRef -or $guardParts[2] -ne "standby") {
    throw "STOPPED: DR control marker does not authorize this target."
}

$totalRows = [int64](($dataStats | Measure-Object -Property Rows -Sum).Sum)
$authEntry = $dataStats | Where-Object { $_.Key -eq "auth.users" } | Select-Object -First 1
$expectedAuthUsers = if ($null -eq $authEntry) { 0L } else { [int64]$authEntry.Rows }
$backupId = [string]$manifest.backupId
$backupCompletedAt = [string]$manifest.completedAtUtc

Write-Host ""
Write-Host "INSUREIT DR snapshot rebuild plan" -ForegroundColor Cyan
Write-Host ("Backup ID:             {0}" -f $backupId)
Write-Host ("Source project:        {0}" -f $sourceRef)
Write-Host ("DR target:             {0}" -f $targetRef)
Write-Host ("Backup Git commit:     {0}" -f [string]$manifest.gitCommit)
Write-Host ("Database COPY tables:  {0}" -f $dataStats.Count)
Write-Host ("Database COPY rows:    {0}" -f $totalRows)
Write-Host ("Auth users in backup:  {0}" -f $expectedAuthUsers)
Write-Host ("Storage buckets:       {0}" -f @($manifest.storage.buckets).Count)
Write-Host ("Storage objects:       {0}" -f [int64]$manifest.storage.objectCount)
Write-Host ("Storage bytes:         {0:N2} MB" -f ([int64]$manifest.storage.bytes / 1MB))
Write-Host ""
Write-Host "Method: clean the disposable DR user-created state, then restore roles.sql + schema.sql + data.sql from the verified snapshot." -ForegroundColor Yellow
Write-Host "The historical migration chain is NOT replayed by this script." -ForegroundColor Yellow
Write-Host "Production is never modified by this script." -ForegroundColor Green

if (-not $Execute) {
    Write-Host ""
    Write-Host "PLAN ONLY. No DR data or schema was changed." -ForegroundColor Green
    $dbUrl = $null
    $s3Secret = $null
    return
}

$confirmationPhrase = "RESTORE SNAPSHOT TO DR $targetRef"
Write-Host ""
Write-Host "DESTRUCTIVE DR SNAPSHOT REBUILD" -ForegroundColor Red
$confirmation = Read-Host "Type exactly: $confirmationPhrase"
if ($confirmation -cne $confirmationPhrase) { throw "DR snapshot rebuild cancelled." }

$tempRoot = Join-Path $env:TEMP ("insureit-dr-snapshot-" + [Guid]::NewGuid().ToString("N"))
$storageEnvSet = $false
$resetStarted = $false

try {
    $supabaseDir = Join-Path $tempRoot "supabase"
    $migrationDir = Join-Path $supabaseDir "migrations"
    New-Item -ItemType Directory -Force -Path $migrationDir | Out-Null

    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
    $configSource = Join-Path $repoRoot "supabase\config.toml"
    if (Test-Path -LiteralPath $configSource -PathType Leaf) {
        Copy-Item -LiteralPath $configSource -Destination (Join-Path $supabaseDir "config.toml") -Force
    }
    else {
        & supabase init --workdir $tempRoot | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Could not initialize temporary Supabase reset workspace." }
        New-Item -ItemType Directory -Force -Path $migrationDir | Out-Null
    }

    "select 1;" | Set-Content -LiteralPath (Join-Path $migrationDir "20000101000000_dr_clean_baseline.sql") -Encoding UTF8

    Write-Host ""
    Write-Host "Cleaning disposable DR project without replaying INSUREIT historical migrations..." -ForegroundColor Cyan
    $resetStarted = $true
    $helpText = (& supabase db reset --help 2>&1 | Out-String)
    $resetArgs = @("db","reset","--db-url",$dbUrl)
    if ($helpText -match '(?m)--no-seed\b') { $resetArgs += "--no-seed" }
    if ($helpText -match '(?m)--yes\b') { $resetArgs += "--yes" }
    Invoke-Checked "supabase" $resetArgs "Clean remote DR reset" $tempRoot

    Set-ControlMarker -DatabaseUrl $dbUrl -ControlSchema $controlSchema -SourceRef $sourceRef -TargetRef $targetRef -RpoHours $rpoHours -BackupId $backupId -BackupCompletedAt $backupCompletedAt -Status "refreshing" -ErrorMessage $null

    Write-Host ""
    Write-Host "Restoring verified database snapshot using Supabase backup files..." -ForegroundColor Cyan
    Invoke-Checked "psql" @(
        $dbUrl,
        "-X",
        "--single-transaction",
        "-v","ON_ERROR_STOP=1",
        "-f",$rolesPath,
        "-f",$schemaPath,
        "-c","SET session_replication_role = replica;",
        "-f",$dataPath
    ) "Snapshot database restore"

    Write-Host "Restoring production migration-history rows..." -ForegroundColor Cyan
    $historyTargets = ($historyStats | ForEach-Object { $_.SqlIdentifier }) -join ",`n    "
    $historyTruncateSql = "TRUNCATE TABLE`n    $historyTargets`nCASCADE;"
    Invoke-Checked "psql" @(
        $dbUrl,
        "-X",
        "--single-transaction",
        "-v","ON_ERROR_STOP=1",
        "-c",$historyTruncateSql,
        "-f",$historyDataPath
    ) "Migration-history restore"

    Write-Host "Verifying database row counts..." -ForegroundColor Cyan
    $actualCounts = Get-TargetCounts -DatabaseUrl $dbUrl -TableStats $dataStats
    $mismatches = @()
    foreach ($table in $dataStats) {
        $key = [string]$table.Key
        if (-not $actualCounts.ContainsKey($key)) {
            $mismatches += "$key missing"
        }
        elseif ([int64]$actualCounts[$key] -ne [int64]$table.Rows) {
            $mismatches += "$key expected $($table.Rows), got $($actualCounts[$key])"
        }
    }
    if ($mismatches.Count -gt 0) {
        throw "Database row-count verification failed: $(($mismatches | Select-Object -First 10) -join '; ')"
    }
    Write-Host ("Database verification passed for {0} COPY tables." -f $dataStats.Count) -ForegroundColor Green

    $env:RCLONE_CONFIG_DRRESTORE_TYPE = "s3"
    $env:RCLONE_CONFIG_DRRESTORE_PROVIDER = "Other"
    $env:RCLONE_CONFIG_DRRESTORE_ENDPOINT = $storageEndpoint
    $env:RCLONE_CONFIG_DRRESTORE_REGION = $targetRegion
    $env:RCLONE_CONFIG_DRRESTORE_ACCESS_KEY_ID = $s3Access
    $env:RCLONE_CONFIG_DRRESTORE_SECRET_ACCESS_KEY = $s3Secret
    $storageEnvSet = $true

    Write-Host ""
    Write-Host "Mirroring Storage bytes..." -ForegroundColor Cyan
    $targetBuckets = @()
    for ($attempt = 1; $attempt -le 10; $attempt++) {
        $targetBuckets = @((& rclone lsf "drrestore:" --dirs-only --quiet) | ForEach-Object { $_.Trim().TrimEnd('/') } | Where-Object { $_ } | Sort-Object -Unique)
        if ($LASTEXITCODE -eq 0 -and $targetBuckets.Count -gt 0) { break }
        Start-Sleep -Seconds 2
    }
    if ($LASTEXITCODE -ne 0) { throw "Could not list DR Storage buckets." }

    foreach ($bucket in @($manifest.storage.buckets)) {
        $name = [string]$bucket.name
        if ($targetBuckets -notcontains $name) { throw "Restored bucket metadata is missing '$name'." }
        $localBucket = Join-Path (Join-Path $backup "storage") $name
        if (-not (Test-Path -LiteralPath $localBucket -PathType Container)) { throw "Local Storage folder missing: $name" }

        Invoke-Checked "rclone" @("sync",$localBucket,"drrestore:$name","--fast-list","--quiet") "Storage mirror '$name'"
        $sizeJson = (& rclone size "drrestore:$name" --json --quiet | Out-String)
        if ($LASTEXITCODE -ne 0) { throw "Could not verify Storage bucket '$name'." }
        $size = $sizeJson | ConvertFrom-Json
        if ([int64]$size.count -ne [int64]$bucket.objects -or [int64]$size.bytes -ne [int64]$bucket.bytes) {
            throw "Storage verification failed for '$name': expected $($bucket.objects) objects / $($bucket.bytes) bytes, got $($size.count) / $($size.bytes)."
        }
        Write-Host ("  {0}: {1} objects / {2:N2} MB" -f $name,[int64]$size.count,([int64]$size.bytes / 1MB))
    }

    Set-ControlMarker -DatabaseUrl $dbUrl -ControlSchema $controlSchema -SourceRef $sourceRef -TargetRef $targetRef -RpoHours $rpoHours -BackupId $backupId -BackupCompletedAt $backupCompletedAt -Status "baseline_restored" -ErrorMessage $null

    Write-Host ""
    Write-Host "DR SNAPSHOT BASELINE RESTORE PASSED." -ForegroundColor Green
    Write-Host ("Backup ID:     {0}" -f $backupId)
    Write-Host ("Auth users:    {0}" -f $expectedAuthUsers)
    Write-Host ("Storage files: {0}" -f [int64]$manifest.storage.objectCount)
    Write-Host "The DR remains standby. Managed auth/storage schema parity and application failover testing are still required before declaring it failover-ready." -ForegroundColor Yellow
}
catch {
    $message = $_.Exception.Message
    if ($resetStarted) {
        try {
            Set-ControlMarker -DatabaseUrl $dbUrl -ControlSchema $controlSchema -SourceRef $sourceRef -TargetRef $targetRef -RpoHours $rpoHours -BackupId $backupId -BackupCompletedAt $backupCompletedAt -Status "failed" -ErrorMessage $message
        }
        catch {
            Write-Warning "DR rebuild failed and the control marker could not be updated."
        }
    }
    throw
}
finally {
    if ($storageEnvSet) {
        "TYPE","PROVIDER","ENDPOINT","REGION","ACCESS_KEY_ID","SECRET_ACCESS_KEY" | ForEach-Object {
            Remove-Item "Env:RCLONE_CONFIG_DRRESTORE_$_" -ErrorAction SilentlyContinue
        }
    }
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    $dbUrl = $null
    $s3Secret = $null
    $secrets = $null
}
