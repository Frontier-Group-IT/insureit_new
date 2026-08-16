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

    $exit = $LASTEXITCODE
    if ($exit -ne 0) { throw "$Label failed with exit code $exit." }
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

    $stats = New-Object System.Collections.Generic.List[object]
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
                    throw "Unexpected schema '$schema' found in data dump. Allowed schemas: $($AllowedSchemas -join ', ')."
                }

                $currentIdentifier = $identifier
                $currentSchema = $schema
                $currentTable = $table
                $rowCount = 0
            }
        }
        else {
            if ($line -eq '\.') {
                $stats.Add([pscustomobject]@{
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

    if ($TableStats.Count -eq 0) { return @{} }

    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($table in $TableStats) {
        $key = ([string]$table.Key).Replace("'", "''")
        $parts.Add("select '$key'::text as table_key, count(*)::bigint as row_count from $($table.SqlIdentifier)")
    }
    $query = ($parts -join "`nunion all`n") + ";"

    $output = @(& psql $DatabaseUrl -X -v ON_ERROR_STOP=1 -t -A -F "|" -c $query)
    $exit = $LASTEXITCODE
    if ($exit -ne 0) { throw "Target row-count verification query failed with exit code $exit." }

    $map = @{}
    foreach ($line in $output) {
        $text = ([string]$line).Trim()
        if ([string]::IsNullOrWhiteSpace($text)) { continue }
        $split = $text -split '\|', 2
        if ($split.Count -ne 2) { throw "Unexpected row-count verification output." }
        $map[$split[0]] = [int64]$split[1]
    }
    return $map
}

function Ensure-ControlMarker {
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
        throw "Invalid control schema name in DR config."
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
    singleton,
    source_project_ref,
    target_project_ref,
    mode,
    rpo_hours,
    last_backup_id,
    last_backup_completed_at,
    last_refresh_started_at,
    last_refresh_completed_at,
    last_refresh_status,
    last_refresh_error,
    updated_at
)
values (
    true,
    $sourceSql,
    $targetSql,
    'standby',
    $RpoHours,
    $backupSql,
    $completedSql,
    now(),
    $(if ($Status -eq 'healthy') { 'now()' } else { 'NULL' }),
    $statusSql,
    $errorSql,
    now()
)
on conflict (singleton) do update set
    source_project_ref = excluded.source_project_ref,
    target_project_ref = excluded.target_project_ref,
    mode = 'standby',
    rpo_hours = excluded.rpo_hours,
    last_backup_id = excluded.last_backup_id,
    last_backup_completed_at = excluded.last_backup_completed_at,
    last_refresh_started_at = case when excluded.last_refresh_status = 'refreshing' then now() else "$ControlSchema".replica_state.last_refresh_started_at end,
    last_refresh_completed_at = case when excluded.last_refresh_status = 'healthy' then now() else "$ControlSchema".replica_state.last_refresh_completed_at end,
    last_refresh_status = excluded.last_refresh_status,
    last_refresh_error = excluded.last_refresh_error,
    updated_at = now();
"@

    $null = & psql $DatabaseUrl -X -v ON_ERROR_STOP=1 -c $sql
    $exit = $LASTEXITCODE
    if ($exit -ne 0) { throw "Could not create/update the DR control marker (psql exit $exit)." }
}

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw "DR config file not found: $ConfigPath. Copy dr.config.example.json to dr.config.local.json first."
}
if (-not (Test-Path -LiteralPath $SecretsPath -PathType Leaf)) {
    throw "Encrypted DR credential file not found: $SecretsPath. Run Set-InsureITDRSecrets.ps1 first."
}

Require-Command "psql"
Require-Command "rclone"
Require-Command "git"
Require-Command "supabase"

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$sourceRef = [string]$config.sourceProjectRef
$targetRef = [string]$config.targetProjectRef
$targetRegion = [string]$config.targetRegion
$storageEndpoint = [string]$config.targetStorageEndpoint
$controlSchema = [string]$config.controlSchema
$rpoHours = [int]$config.expectedRpoHours

if ($sourceRef -ne $ProductionProjectRef) { throw "STOPPED: configured source is not INSUREIT production." }
if ([string]::IsNullOrWhiteSpace($targetRef) -or $targetRef -eq $ProductionProjectRef) {
    throw "STOPPED: invalid DR target project ref."
}
if ($targetRef -ne "jzuqlcysyqtyydukveir") {
    throw "STOPPED: this initializer is only approved for the dedicated INSUREIT DR project."
}

$backup = [IO.Path]::GetFullPath($BackupPath)
& (Join-Path $PSScriptRoot "Verify-InsureITBackup.ps1") -BackupPath $backup
$manifest = Get-Content -LiteralPath (Join-Path $backup "manifest.json") -Raw | ConvertFrom-Json

if ([string]$manifest.projectRef -ne $sourceRef) {
    throw "Backup source project does not match INSUREIT production."
}
if ([string]::IsNullOrWhiteSpace([string]$manifest.gitCommit)) {
    throw "Backup manifest does not contain the source Git commit. A destructive DR reset is not allowed without it."
}
if ($manifest.storage.skipped) {
    throw "Backup does not contain Storage bytes. Full DR initialization requires Storage."
}

$dataPath = Join-Path $backup "database\data.sql"
$historyDataPath = Join-Path $backup "database\history_data.sql"
$dataStats = @(Get-CopyTableStats -Path $dataPath -AllowedSchemas @("public","auth","storage"))
$historyStats = @(Get-CopyTableStats -Path $historyDataPath -AllowedSchemas @("supabase_migrations"))
if ($dataStats.Count -eq 0) { throw "No COPY tables were found in database/data.sql." }
if ($historyStats.Count -eq 0) { throw "No COPY tables were found in database/history_data.sql." }

$secrets = Import-Clixml -LiteralPath $SecretsPath
if ([string]$secrets.TargetProjectRef -ne $targetRef) {
    throw "Encrypted DR credentials belong to a different Supabase project."
}
$dbUrl = Convert-SecureStringToPlainText $secrets.DatabaseUrl
$s3Access = [string]$secrets.S3AccessKeyId
$s3Secret = Convert-SecureStringToPlainText $secrets.S3SecretAccessKey

if ([string]::IsNullOrWhiteSpace($dbUrl) -or -not $dbUrl.Contains($targetRef) -or $dbUrl.Contains($ProductionProjectRef)) {
    throw "STOPPED: stored DR database URL failed the target guard."
}
if ([string]::IsNullOrWhiteSpace($s3Access) -or [string]::IsNullOrWhiteSpace($s3Secret)) {
    throw "Stored DR S3 credentials are incomplete."
}

$guardQuery = @"
select source_project_ref || '|' || target_project_ref || '|' || mode
from "$controlSchema".replica_state
where singleton = true;
"@
$guardOutput = @(& psql $dbUrl -X -v ON_ERROR_STOP=1 -t -A -c $guardQuery)
$guardExit = $LASTEXITCODE
if ($guardExit -ne 0) { throw "Could not read the DR control marker." }
$guardLine = $guardOutput | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ } | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace([string]$guardLine)) { throw "DR control marker returned no data." }
$guardParts = ([string]$guardLine).Split('|')
if ($guardParts.Count -ne 3 -or $guardParts[0] -ne $sourceRef -or $guardParts[1] -ne $targetRef -or $guardParts[2] -ne "standby") {
    throw "STOPPED: DR control marker does not authorize this production-to-standby relationship."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$gitCommit = [string]$manifest.gitCommit
$backupId = [string]$manifest.backupId
$backupCompletedAt = [string]$manifest.completedAtUtc
$totalRows = [int64](($dataStats | Measure-Object -Property Rows -Sum).Sum)
$expectedAuthUsers = [int64](($dataStats | Where-Object { $_.Key -eq "auth.users" } | Select-Object -First 1).Rows)

Write-Host ""
Write-Host "INSUREIT DR baseline rebuild plan" -ForegroundColor Cyan
Write-Host ("Backup ID:           {0}" -f $backupId)
Write-Host ("Source project:      {0}" -f $sourceRef)
Write-Host ("DR target:           {0}" -f $targetRef)
Write-Host ("Backup Git commit:   {0}" -f $gitCommit)
Write-Host ("Database COPY tables:{0,8}" -f $dataStats.Count)
Write-Host ("Database COPY rows:  {0,8}" -f $totalRows)
Write-Host ("Auth users in backup:{0,8}" -f $expectedAuthUsers)
Write-Host ("Storage buckets:     {0,8}" -f @($manifest.storage.buckets).Count)
Write-Host ("Storage objects:     {0,8}" -f [int64]$manifest.storage.objectCount)
Write-Host ("Storage bytes:       {0,8:N2} MB" -f ([int64]$manifest.storage.bytes / 1MB))
Write-Host ""
Write-Host "The existing DR/sample database will be erased and rebuilt from the backup-time Git migrations." -ForegroundColor Yellow
Write-Host "Production is not a restore target and is never modified by this script." -ForegroundColor Green

if (-not $Execute) {
    Write-Host ""
    Write-Host "PLAN ONLY. No DR data or schema was changed." -ForegroundColor Green
    Write-Host "Run again with -Execute only when this plan is accepted."
    $dbUrl = $null
    $s3Secret = $null
    return
}

$confirmationPhrase = "REBUILD DR $targetRef"
Write-Host ""
Write-Host "DESTRUCTIVE DR RESET" -ForegroundColor Red
$confirmation = Read-Host "Type exactly: $confirmationPhrase"
if ($confirmation -cne $confirmationPhrase) {
    throw "DR rebuild cancelled. Confirmation did not match."
}

$worktreePath = Join-Path $env:TEMP ("insureit-dr-baseline-" + [Guid]::NewGuid().ToString("N"))
$worktreeAdded = $false
$storageEnvSet = $false
$resetCompleted = $false

try {
    $null = & git -C $repoRoot cat-file -e "$gitCommit^{commit}" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Invoke-Checked "git" @("-C",$repoRoot,"fetch","origin",$gitCommit) "Fetch backup Git commit"
    }

    Invoke-Checked "git" @("-C",$repoRoot,"worktree","add","--detach",$worktreePath,$gitCommit) "Create temporary backup-time Git worktree"
    $worktreeAdded = $true

    $migrationPath = Join-Path $worktreePath "supabase\migrations"
    if (-not (Test-Path -LiteralPath $migrationPath -PathType Container)) {
        throw "Backup-time Git commit does not contain supabase/migrations."
    }

    Write-Host ""
    Write-Host "Resetting disposable DR project to backup-time migrations..." -ForegroundColor Cyan
    $resetHelp = (& supabase db reset --help 2>&1 | Out-String)
    $resetArgs = New-Object System.Collections.Generic.List[string]
    $resetArgs.Add("db")
    $resetArgs.Add("reset")
    $resetArgs.Add("--db-url")
    $resetArgs.Add($dbUrl)
    if ($resetHelp -match '(?m)--no-seed\b') { $resetArgs.Add("--no-seed") }
    if ($resetHelp -match '(?m)--yes\b') { $resetArgs.Add("--yes") }

    Invoke-Checked "supabase" ($resetArgs.ToArray()) "Remote DR reset" $worktreePath
    $resetCompleted = $true

    Ensure-ControlMarker -DatabaseUrl $dbUrl -ControlSchema $controlSchema -SourceRef $sourceRef -TargetRef $targetRef -RpoHours $rpoHours -BackupId $backupId -BackupCompletedAt $backupCompletedAt -Status "refreshing" -ErrorMessage $null

    Write-Host ""
    Write-Host "Loading verified database snapshot atomically..." -ForegroundColor Cyan
    $truncateTargets = ($dataStats | ForEach-Object { $_.SqlIdentifier }) -join ",`n    "
    $truncateSql = "SET session_replication_role = replica;`nTRUNCATE TABLE`n    $truncateTargets`nCASCADE;"

    Invoke-Checked "psql" @(
        $dbUrl,
        "-X",
        "--single-transaction",
        "-v","ON_ERROR_STOP=1",
        "-c",$truncateSql,
        "-f",$dataPath,
        "-c","SET session_replication_role = origin;"
    ) "Database snapshot load"

    Write-Host "Restoring production migration history from the backup..." -ForegroundColor Cyan
    $historyTargets = ($historyStats | ForEach-Object { $_.SqlIdentifier }) -join ",`n    "
    $historyTruncateSql = "TRUNCATE TABLE`n    $historyTargets`nCASCADE;"
    Invoke-Checked "psql" @(
        $dbUrl,
        "-X",
        "--single-transaction",
        "-v","ON_ERROR_STOP=1",
        "-c",$historyTruncateSql,
        "-f",$historyDataPath
    ) "Migration history load"

    Write-Host "Verifying restored database row counts..." -ForegroundColor Cyan
    $actualCounts = Get-TargetCounts -DatabaseUrl $dbUrl -TableStats $dataStats
    $rowMismatches = New-Object System.Collections.Generic.List[string]
    foreach ($table in $dataStats) {
        $key = [string]$table.Key
        if (-not $actualCounts.ContainsKey($key)) {
            $rowMismatches.Add("$key missing from verification output")
        }
        elseif ([int64]$actualCounts[$key] -ne [int64]$table.Rows) {
            $rowMismatches.Add("$key expected $($table.Rows), got $($actualCounts[$key])")
        }
    }
    if ($rowMismatches.Count -gt 0) {
        $preview = ($rowMismatches | Select-Object -First 10) -join "; "
        throw "Database row-count verification failed: $preview"
    }
    Write-Host ("Database verification passed for {0} COPY tables." -f $dataStats.Count) -ForegroundColor Green

    $env:RCLONE_CONFIG_DRINIT_TYPE = "s3"
    $env:RCLONE_CONFIG_DRINIT_PROVIDER = "Other"
    $env:RCLONE_CONFIG_DRINIT_ENDPOINT = $storageEndpoint
    $env:RCLONE_CONFIG_DRINIT_REGION = $targetRegion
    $env:RCLONE_CONFIG_DRINIT_ACCESS_KEY_ID = $s3Access
    $env:RCLONE_CONFIG_DRINIT_SECRET_ACCESS_KEY = $s3Secret
    $storageEnvSet = $true

    Write-Host ""
    Write-Host "Mirroring Storage bytes to DR..." -ForegroundColor Cyan
    $targetBuckets = @()
    for ($attempt = 1; $attempt -le 6; $attempt++) {
        $targetBuckets = @((& rclone lsf "drinit:" --dirs-only --quiet) | ForEach-Object { $_.Trim().TrimEnd('/') } | Where-Object { $_ } | Sort-Object -Unique)
        if ($LASTEXITCODE -eq 0 -and $targetBuckets.Count -gt 0) { break }
        Start-Sleep -Seconds 2
    }
    if ($LASTEXITCODE -ne 0) { throw "Could not list DR Storage buckets after database restore." }

    $expectedBucketNames = @($manifest.storage.buckets | ForEach-Object { [string]$_.name } | Sort-Object -Unique)
    $missingBuckets = @($expectedBucketNames | Where-Object { $targetBuckets -notcontains $_ })
    if ($missingBuckets.Count -gt 0) {
        throw "Restored Storage bucket metadata is incomplete. Missing: $($missingBuckets -join ', ')"
    }

    foreach ($bucket in @($manifest.storage.buckets)) {
        $name = [string]$bucket.name
        $localBucket = Join-Path (Join-Path $backup "storage") $name
        if (-not (Test-Path -LiteralPath $localBucket -PathType Container)) {
            throw "Local Storage backup folder is missing: $name"
        }

        Invoke-Checked "rclone" @("sync",$localBucket,"drinit:$name","--fast-list","--quiet") "Storage mirror for '$name'"

        $sizeJson = (& rclone size "drinit:$name" --json --quiet | Out-String)
        if ($LASTEXITCODE -ne 0) { throw "Could not verify Storage bucket '$name'." }
        $size = $sizeJson | ConvertFrom-Json
        if ([int64]$size.count -ne [int64]$bucket.objects -or [int64]$size.bytes -ne [int64]$bucket.bytes) {
            throw "Storage verification failed for '$name': expected $($bucket.objects) objects / $($bucket.bytes) bytes, got $($size.count) objects / $($size.bytes) bytes."
        }
        Write-Host ("  {0}: {1} objects / {2:N2} MB" -f $name,[int64]$size.count,([int64]$size.bytes / 1MB))
    }

    Ensure-ControlMarker -DatabaseUrl $dbUrl -ControlSchema $controlSchema -SourceRef $sourceRef -TargetRef $targetRef -RpoHours $rpoHours -BackupId $backupId -BackupCompletedAt $backupCompletedAt -Status "healthy" -ErrorMessage $null

    Write-Host ""
    Write-Host "DR BASELINE INITIALIZATION PASSED." -ForegroundColor Green
    Write-Host ("Backup ID:     {0}" -f $backupId)
    Write-Host ("DR target:     {0}" -f $targetRef)
    Write-Host ("Auth users:    {0}" -f $expectedAuthUsers)
    Write-Host ("Storage files: {0}" -f [int64]$manifest.storage.objectCount)
    Write-Host "The DR project is still marked standby; no production failover was performed." -ForegroundColor Green
}
catch {
    $message = $_.Exception.Message
    if ($resetCompleted) {
        try {
            Ensure-ControlMarker -DatabaseUrl $dbUrl -ControlSchema $controlSchema -SourceRef $sourceRef -TargetRef $targetRef -RpoHours $rpoHours -BackupId $backupId -BackupCompletedAt $backupCompletedAt -Status "failed" -ErrorMessage $message
        }
        catch {
            Write-Warning "The DR rebuild failed and the control marker could not be updated."
        }
    }
    throw
}
finally {
    if ($storageEnvSet) {
        "TYPE","PROVIDER","ENDPOINT","REGION","ACCESS_KEY_ID","SECRET_ACCESS_KEY" | ForEach-Object {
            Remove-Item "Env:RCLONE_CONFIG_DRINIT_$_" -ErrorAction SilentlyContinue
        }
    }

    if ($worktreeAdded -and (Test-Path -LiteralPath $worktreePath)) {
        try { & git -C $repoRoot worktree remove --force $worktreePath | Out-Null } catch {}
    }

    $dbUrl = $null
    $s3Secret = $null
    $secrets = $null
}
