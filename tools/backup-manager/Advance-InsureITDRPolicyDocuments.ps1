[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BackupPath,
    [string]$ProductionSecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\secrets.clixml"),
    [string]$DRSecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\dr-secrets.clixml"),
    [string]$ConfigPath,
    [switch]$Execute
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = [string]$PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptRoot) -and -not [string]::IsNullOrWhiteSpace([string]$MyInvocation.MyCommand.Path)) {
    $scriptRoot = Split-Path -Parent ([string]$MyInvocation.MyCommand.Path)
}
if ([string]::IsNullOrWhiteSpace($scriptRoot)) {
    throw "Could not resolve the backup-manager script directory."
}
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = Join-Path $scriptRoot "dr.config.local.json"
}

$ProductionProjectRef = "ilzhsfqqjyppzzvfscmh"
$ApprovedDrProjectRef = "jzuqlcysyqtyydukveir"
$MigrationName = "202608170001_policy_documents.sql"
$RemainingFunctionDiff = "DifferentDefinition`tfunction`tpublic.enforce_single_active_policy_per_vehicle()"

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

function Get-DifferenceLines {
    param([Parameter(Mandatory = $true)][string]$ReportPath)
    if (-not (Test-Path -LiteralPath $ReportPath -PathType Leaf)) {
        throw "Schema comparator did not produce its report file."
    }
    return @(
        Get-Content -LiteralPath $ReportPath |
        Where-Object { $_ -match '^(MissingInDR|ExtraInDR|DifferentDefinition)\t' }
    )
}

function Assert-ExactDifferenceSet {
    param(
        [Parameter(Mandatory = $true)][string[]]$Actual,
        [Parameter(Mandatory = $true)][string[]]$Expected,
        [Parameter(Mandatory = $true)][string]$Stage
    )

    $actualSet = New-Object System.Collections.Generic.HashSet[string] ([StringComparer]::Ordinal)
    foreach ($line in $Actual) { [void]$actualSet.Add([string]$line) }
    $expectedSet = New-Object System.Collections.Generic.HashSet[string] ([StringComparer]::Ordinal)
    foreach ($line in $Expected) { [void]$expectedSet.Add([string]$line) }

    $missing = @($Expected | Where-Object { -not $actualSet.Contains($_) })
    $unexpected = @($Actual | Where-Object { -not $expectedSet.Contains($_) })

    if ($Actual.Count -ne $Expected.Count -or $missing.Count -gt 0 -or $unexpected.Count -gt 0) {
        $message = "STOPPED: $Stage schema drift does not match the approved expected set."
        if ($missing.Count -gt 0) { $message += " Missing expected: " + ($missing -join '; ') + "." }
        if ($unexpected.Count -gt 0) { $message += " Unexpected: " + ($unexpected -join '; ') + "." }
        throw $message
    }
}

$ExpectedPreAdvanceDifferences = @(
    "MissingInDR`trelation`tpublic.policy_documents",
    "MissingInDR`tcolumn`tpublic.policy_documents.id",
    "MissingInDR`tcolumn`tpublic.policy_documents.policy_id",
    "MissingInDR`tcolumn`tpublic.policy_documents.document_type",
    "MissingInDR`tcolumn`tpublic.policy_documents.file_name",
    "MissingInDR`tcolumn`tpublic.policy_documents.storage_bucket",
    "MissingInDR`tcolumn`tpublic.policy_documents.storage_path",
    "MissingInDR`tcolumn`tpublic.policy_documents.mime_type",
    "MissingInDR`tcolumn`tpublic.policy_documents.file_size",
    "MissingInDR`tcolumn`tpublic.policy_documents.uploaded_by",
    "MissingInDR`tcolumn`tpublic.policy_documents.created_at",
    "MissingInDR`tcolumn`tpublic.policy_documents.updated_at",
    "MissingInDR`tconstraint`tpublic.policy_documents.policy_documents_pkey",
    "MissingInDR`tconstraint`tpublic.policy_documents.policy_documents_policy_id_fkey",
    "MissingInDR`tconstraint`tpublic.policy_documents.policy_documents_storage_path_unique",
    "MissingInDR`tconstraint`tpublic.policy_documents.policy_documents_uploaded_by_fkey",
    "MissingInDR`tindex`tpublic.policy_documents_pkey",
    "MissingInDR`tindex`tpublic.policy_documents_policy_id_idx",
    "MissingInDR`tindex`tpublic.policy_documents_storage_path_unique",
    "MissingInDR`tindex`tpublic.policy_documents_uploaded_by_idx",
    "MissingInDR`ttrigger`tpublic.policy_documents.policy_documents_updated_at",
    "MissingInDR`tpolicy`tpublic.policy_documents.policy documents ops manage",
    "MissingInDR`tpolicy`tpublic.policy_documents.policy documents customer read",
    "MissingInDR`tpolicy`tstorage.objects.policy document objects ops access",
    "MissingInDR`tpolicy`tstorage.objects.policy document objects customer read",
    $RemainingFunctionDiff
)

Require-Command "psql"

foreach ($requiredPath in @($ProductionSecretsPath,$DRSecretsPath,$ConfigPath)) {
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

$verifyPath = Join-Path $scriptRoot "Verify-InsureITBackup.ps1"
$comparatorPath = Join-Path $scriptRoot "Compare-InsureITDRSchema.ps1"
$currentMigrationPath = Join-Path (Resolve-Path (Join-Path $scriptRoot "..\..")).Path ("supabase\migrations\" + $MigrationName)
$backupMigrationPath = Join-Path $backup ("migrations\" + $MigrationName)
foreach ($path in @($verifyPath,$comparatorPath,$currentMigrationPath,$backupMigrationPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required file not found: $path"
    }
}

Write-Host "Re-verifying backup before DR schema planning..." -ForegroundColor Cyan
& $verifyPath -BackupPath $backup

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ([int]$manifest.version -ne 2 -or [string]$manifest.format -ne "insureit-supabase-logical-v2") {
    throw "STOPPED: DR schema advancement requires a verified INSUREIT v2 backup."
}
if ([string]$manifest.status -ne "healthy" -or [string]$manifest.projectRef -ne $ProductionProjectRef) {
    throw "STOPPED: backup is not a healthy INSUREIT production backup."
}
if ([bool]$manifest.storage.skipped) {
    throw "STOPPED: backup omitted Storage."
}
$policyBucket = @($manifest.storage.buckets | Where-Object { [string]$_.name -eq 'policy-documents' })
if ($policyBucket.Count -ne 1) {
    throw "STOPPED: verified backup does not contain the policy-documents Storage bucket."
}

$currentMigrationHash = (Get-FileHash -LiteralPath $currentMigrationPath -Algorithm SHA256).Hash.ToLowerInvariant()
$backupMigrationHash = (Get-FileHash -LiteralPath $backupMigrationPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($currentMigrationHash -ne $backupMigrationHash) {
    throw "STOPPED: current repository migration and verified-backup migration differ. Create a fresh backup before advancing DR."
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$sourceRef = [string]$config.sourceProjectRef
$targetRef = [string]$config.targetProjectRef
$controlSchema = [string]$config.controlSchema
if ($sourceRef -ne $ProductionProjectRef) { throw "STOPPED: DR config source is not INSUREIT production." }
if ($targetRef -ne $ApprovedDrProjectRef) { throw "STOPPED: DR config target is not the approved INSUREIT DR project." }
if ($targetRef -eq $ProductionProjectRef) { throw "STOPPED: production cannot be the DR schema target." }
if ([string]::IsNullOrWhiteSpace($controlSchema) -or $controlSchema -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    throw "Invalid DR control schema."
}

$prodSecrets = Import-Clixml -LiteralPath $ProductionSecretsPath
$drSecrets = Import-Clixml -LiteralPath $DRSecretsPath
if ([string]$drSecrets.TargetProjectRef -ne $targetRef) {
    throw "STOPPED: stored DR credentials belong to another project."
}
$prodUrl = Convert-SecureStringToPlainText $prodSecrets.DatabaseUrl
$drUrl = Convert-SecureStringToPlainText $drSecrets.DatabaseUrl
if ([string]::IsNullOrWhiteSpace($prodUrl) -or -not $prodUrl.Contains($ProductionProjectRef) -or $prodUrl.Contains($targetRef)) {
    throw "STOPPED: production database credential failed project-ref validation."
}
if ([string]::IsNullOrWhiteSpace($drUrl) -or -not $drUrl.Contains($targetRef) -or $drUrl.Contains($ProductionProjectRef)) {
    throw "STOPPED: DR database credential failed project-ref validation."
}

$markerSql = "select source_project_ref || '|' || target_project_ref || '|' || mode from `"$controlSchema`".replica_state where singleton=true;"
$markerRaw = @(& psql "$drUrl" -X -q -v ON_ERROR_STOP=1 -t -A -c $markerSql)
if ($LASTEXITCODE -ne 0) { throw "Could not read the DR control marker." }
$markerLines = @($markerRaw | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
if ($markerLines.Count -ne 1 -or [string]$markerLines[0] -ne "$sourceRef|$targetRef|standby") {
    throw "STOPPED: DR control marker does not authorize this standby target."
}

$workDir = Join-Path $scriptRoot "_work"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
$preReport = Join-Path $workDir "dr-policy-documents-precheck.txt"

Write-Host "Checking live production/DR schema drift..." -ForegroundColor Cyan
& $comparatorPath `
    -ProductionSecretsPath $ProductionSecretsPath `
    -DRSecretsPath $DRSecretsPath `
    -ConfigPath $ConfigPath `
    -OutputPath $preReport
$preDifferences = Get-DifferenceLines -ReportPath $preReport
Assert-ExactDifferenceSet -Actual $preDifferences -Expected $ExpectedPreAdvanceDifferences -Stage "pre-advance"

Write-Host ""
Write-Host "INSUREIT DR policy-documents schema advancement plan" -ForegroundColor Cyan
Write-Host ("Production source:        {0}" -f $sourceRef)
Write-Host ("DR target:                {0}" -f $targetRef)
Write-Host ("Verified backup:          {0}" -f [string]$manifest.backupId)
Write-Host ("Backup Git snapshot:      {0}" -f [string]$manifest.gitCommit)
Write-Host ("Migration:                 {0}" -f $MigrationName)
Write-Host ("Migration SHA256:          {0}" -f $backupMigrationHash)
Write-Host ("Expected current drift:   {0} catalog differences" -f $ExpectedPreAdvanceDifferences.Count)
Write-Host "Expected after migration:  1 function-definition difference only"
Write-Host ""
Write-Host "Method: apply only the verified backup copy of the policy-documents migration to DR in one transaction." -ForegroundColor Yellow
Write-Host "Production is queried read-only and will not be modified." -ForegroundColor Green
Write-Host "Migration history is not manually edited here; the subsequent verified DR refresh will restore it from the backup."

if (-not $Execute) {
    Write-Host ""
    Write-Host "PLAN ONLY. No DR schema was changed." -ForegroundColor Green
    Write-Host "Run again with -Execute only after this plan is accepted."
    return
}

$confirmationPhrase = "APPLY POLICY DOCUMENTS MIGRATION TO DR $targetRef"
Write-Host ""
$confirmation = Read-Host "Type exactly: $confirmationPhrase"
if ($confirmation -cne $confirmationPhrase) {
    throw "DR policy-documents schema advancement cancelled."
}

# Re-run the full live comparator after confirmation so any concurrent production
# schema change blocks the write before DR is touched.
$confirmReport = Join-Path $workDir "dr-policy-documents-confirm-precheck.txt"
Write-Host "Rechecking live schema drift immediately before DR write..." -ForegroundColor Cyan
& $comparatorPath `
    -ProductionSecretsPath $ProductionSecretsPath `
    -DRSecretsPath $DRSecretsPath `
    -ConfigPath $ConfigPath `
    -OutputPath $confirmReport
$confirmDifferences = Get-DifferenceLines -ReportPath $confirmReport
Assert-ExactDifferenceSet -Actual $confirmDifferences -Expected $ExpectedPreAdvanceDifferences -Stage "confirmation"

$sqlPath = Join-Path $workDir "advance-dr-policy-documents.sql"
$migrationSql = Get-Content -LiteralPath $backupMigrationPath -Raw
$sqlText = "BEGIN;" + [Environment]::NewLine + $migrationSql.TrimEnd() + [Environment]::NewLine + "COMMIT;" + [Environment]::NewLine
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($sqlPath, $sqlText, $utf8NoBom)

Write-Host "Applying verified policy-documents migration to DR only..." -ForegroundColor Cyan
& psql "$drUrl" -X -v ON_ERROR_STOP=1 -f "$sqlPath"
$applyExit = $LASTEXITCODE
if ($applyExit -ne 0) {
    throw "DR policy-documents schema advancement failed (psql exit code $applyExit). Transaction should have rolled back; inspect before retrying."
}

$postReport = Join-Path $workDir "dr-policy-documents-postcheck.txt"
Write-Host "Re-running full production/DR semantic schema comparison..." -ForegroundColor Cyan
& $comparatorPath `
    -ProductionSecretsPath $ProductionSecretsPath `
    -DRSecretsPath $DRSecretsPath `
    -ConfigPath $ConfigPath `
    -OutputPath $postReport
$postDifferences = Get-DifferenceLines -ReportPath $postReport
Assert-ExactDifferenceSet -Actual $postDifferences -Expected @($RemainingFunctionDiff) -Stage "post-advance"

Write-Host ""
Write-Host "DR POLICY-DOCUMENTS SCHEMA ADVANCEMENT COMPLETED." -ForegroundColor Green
Write-Host "The 25 policy-document catalog differences are resolved."
Write-Host "Exactly one expected function-definition difference remains."
Write-Host "Next step: run Repair-InsureITDRFunctionParity.ps1 in plan-only mode."

$prodUrl = $null
$drUrl = $null
$prodSecrets = $null
$drSecrets = $null
