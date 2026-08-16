[CmdletBinding()]
param(
    [string]$ProductionSecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\secrets.clixml"),
    [string]$DRSecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\dr-secrets.clixml"),
    [string]$ConfigPath = (Join-Path $PSScriptRoot "dr.config.local.json"),
    [switch]$Execute
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProductionProjectRef = "ilzhsfqqjyppzzvfscmh"
$ApprovedDrProjectRef = "jzuqlcysyqtyydukveir"
$FunctionIdentity = "public.enforce_single_active_policy_per_vehicle()"
$ExpectedDiffLine = "DifferentDefinition`tfunction`t$FunctionIdentity"

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

function Get-FunctionDefinition {
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseUrl,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $sql = "select pg_get_functiondef('$FunctionIdentity'::regprocedure);"
    $raw = @(& psql "$DatabaseUrl" -X -q -v ON_ERROR_STOP=1 -t -A -P pager=off -c $sql)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Label function-definition query failed (psql exit code $exitCode)."
    }

    $definition = [string]::Join([Environment]::NewLine, $raw).Trim()
    if ([string]::IsNullOrWhiteSpace($definition)) {
        throw "$Label returned no definition for $FunctionIdentity."
    }
    return $definition
}

function Get-Sha256Text {
    param([Parameter(Mandatory = $true)][string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
        $hash = $sha.ComputeHash($bytes)
        return ([BitConverter]::ToString($hash)).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Assert-OnlyExpectedSchemaDifference {
    param(
        [Parameter(Mandatory = $true)][string]$ReportPath,
        [Parameter(Mandatory = $true)][string]$ComparatorPath
    )

    $comparatorFailed = $false
    try {
        & $ComparatorPath `
            -ProductionSecretsPath $ProductionSecretsPath `
            -DRSecretsPath $DRSecretsPath `
            -ConfigPath $ConfigPath `
            -OutputPath $ReportPath
    }
    catch {
        $comparatorFailed = $true
    }

    if (-not (Test-Path -LiteralPath $ReportPath -PathType Leaf)) {
        throw "Schema comparator did not produce its report file."
    }

    $differenceLines = @(
        Get-Content -LiteralPath $ReportPath |
        Where-Object { $_ -match '^(MissingInDR|ExtraInDR|DifferentDefinition)\t' }
    )

    if (-not $comparatorFailed -and $differenceLines.Count -eq 0) {
        throw "Schema parity is already exact; no function repair is required."
    }

    if ($differenceLines.Count -ne 1 -or [string]$differenceLines[0] -ne $ExpectedDiffLine) {
        $summary = if ($differenceLines.Count -eq 0) { "none found" } else { ($differenceLines -join '; ') }
        throw "STOPPED: expected exactly one schema difference ($ExpectedDiffLine), but found: $summary"
    }
}

Require-Command "psql"

foreach ($requiredPath in @($ProductionSecretsPath, $DRSecretsPath, $ConfigPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required file not found: $requiredPath"
    }
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$sourceRef = [string]$config.sourceProjectRef
$targetRef = [string]$config.targetProjectRef
$controlSchema = [string]$config.controlSchema

if ($sourceRef -ne $ProductionProjectRef) { throw "STOPPED: DR config source is not INSUREIT production." }
if ($targetRef -ne $ApprovedDrProjectRef) { throw "STOPPED: DR config target is not the approved INSUREIT DR project." }
if ($targetRef -eq $ProductionProjectRef) { throw "STOPPED: production cannot be a repair target." }
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
$markerExit = $LASTEXITCODE
if ($markerExit -ne 0) { throw "Could not read the DR control marker." }
$markerLines = @($markerRaw | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
if ($markerLines.Count -ne 1 -or [string]$markerLines[0] -ne "$sourceRef|$targetRef|standby") {
    throw "STOPPED: DR control marker does not authorize this standby target."
}

$workDir = Join-Path $PSScriptRoot "_work"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
$reportPath = Join-Path $workDir "dr-function-parity-precheck.txt"
$comparatorPath = Join-Path $PSScriptRoot "Compare-InsureITDRSchema.ps1"
if (-not (Test-Path -LiteralPath $comparatorPath -PathType Leaf)) {
    throw "Schema comparator not found: $comparatorPath"
}

Write-Host "Checking that this is the only live production/DR schema difference..." -ForegroundColor Cyan
Assert-OnlyExpectedSchemaDifference -ReportPath $reportPath -ComparatorPath $comparatorPath

$prodDefinition = Get-FunctionDefinition -DatabaseUrl $prodUrl -Label "Production"
$drDefinition = Get-FunctionDefinition -DatabaseUrl $drUrl -Label "DR"
$prodHash = Get-Sha256Text -Text $prodDefinition
$drHash = Get-Sha256Text -Text $drDefinition

if ($prodHash -eq $drHash) {
    throw "Function definitions now match even though the comparator reported a difference. STOP and rerun the comparator."
}

Write-Host ""
Write-Host "INSUREIT DR function parity repair plan" -ForegroundColor Cyan
Write-Host ("Production source:   {0}" -f $sourceRef)
Write-Host ("DR target:           {0}" -f $targetRef)
Write-Host ("Function:            {0}" -f $FunctionIdentity)
Write-Host ("Production SHA256:   {0}" -f $prodHash)
Write-Host ("DR SHA256:           {0}" -f $drHash)
Write-Host "Schema differences:  exactly 1 (this function only)"
Write-Host ""
Write-Host "Method: copy the exact current production function definition to DR only." -ForegroundColor Yellow
Write-Host "Production is queried read-only and is never modified by this script." -ForegroundColor Green

if (-not $Execute) {
    Write-Host ""
    Write-Host "PLAN ONLY. No DR schema was changed." -ForegroundColor Green
    Write-Host "Run again with -Execute only after this plan is accepted."
    return
}

$confirmationPhrase = "REPAIR FUNCTION ON DR $targetRef"
Write-Host ""
$confirmation = Read-Host "Type exactly: $confirmationPhrase"
if ($confirmation -cne $confirmationPhrase) {
    throw "DR function repair cancelled."
}

# Re-read both sides after operator confirmation so a concurrent production
# deployment cannot silently change what we are about to apply.
$prodDefinitionNow = Get-FunctionDefinition -DatabaseUrl $prodUrl -Label "Production recheck"
$drDefinitionNow = Get-FunctionDefinition -DatabaseUrl $drUrl -Label "DR recheck"
$prodHashNow = Get-Sha256Text -Text $prodDefinitionNow
$drHashNow = Get-Sha256Text -Text $drDefinitionNow
if ($prodHashNow -ne $prodHash) {
    throw "STOPPED: production function changed after the plan was generated. Rerun the plan."
}
if ($drHashNow -ne $drHash) {
    throw "STOPPED: DR function changed after the plan was generated. Rerun the plan."
}

$sqlPath = Join-Path $workDir "repair-dr-function-parity.sql"
$sqlText = "BEGIN;" + [Environment]::NewLine + $prodDefinitionNow + [Environment]::NewLine + "COMMIT;" + [Environment]::NewLine
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($sqlPath, $sqlText, $utf8NoBom)

Write-Host ""
Write-Host "Applying the production function definition to DR only..." -ForegroundColor Cyan
& psql "$drUrl" -X -v ON_ERROR_STOP=1 -f "$sqlPath"
$applyExit = $LASTEXITCODE
if ($applyExit -ne 0) {
    throw "DR function repair failed (psql exit code $applyExit). STOP and inspect before retrying."
}

$drDefinitionAfter = Get-FunctionDefinition -DatabaseUrl $drUrl -Label "DR post-repair"
$drHashAfter = Get-Sha256Text -Text $drDefinitionAfter
if ($drHashAfter -ne $prodHashNow) {
    throw "DR function hash still does not match production after repair."
}

Write-Host ""
Write-Host "Re-running full semantic schema comparison..." -ForegroundColor Cyan
$finalReport = Join-Path $workDir "dr-function-parity-postcheck.txt"
& $comparatorPath `
    -ProductionSecretsPath $ProductionSecretsPath `
    -DRSecretsPath $DRSecretsPath `
    -ConfigPath $ConfigPath `
    -OutputPath $finalReport

Write-Host ""
Write-Host "DR FUNCTION PARITY REPAIR COMPLETED." -ForegroundColor Green
Write-Host ("Function: {0}" -f $FunctionIdentity)
Write-Host ("SHA256:   {0}" -f $prodHashNow)
Write-Host "Full production/DR schema comparator passed."

$prodUrl = $null
$drUrl = $null
$prodSecrets = $null
$drSecrets = $null
