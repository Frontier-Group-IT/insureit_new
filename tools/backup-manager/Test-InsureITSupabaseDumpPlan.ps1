[CmdletBinding()]
param(
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

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) { throw "Required command '$Name' was not found." }
    return $command
}

function Redact-DumpPlanText {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$DatabaseUrl
    )

    $safe = $Text
    if (-not [string]::IsNullOrWhiteSpace($DatabaseUrl)) {
        $safe = $safe.Replace($DatabaseUrl, "<REDACTED_DB_URL>")
    }

    # Catch connection strings even if the CLI rewrites/normalizes the URL.
    $safe = [regex]::Replace(
        $safe,
        '(?i)postgres(?:ql)?://[^\s''"`]+',
        '<REDACTED_DB_URL>'
    )

    # Catch common password environment/argument forms without exposing values.
    $safe = [regex]::Replace($safe, '(?im)(PGPASSWORD\s*=\s*)[^\s]+', '$1<REDACTED>')
    $safe = [regex]::Replace($safe, '(?im)(--password(?:=|\s+))[^\s]+', '$1<REDACTED>')

    return $safe
}

function Invoke-SanitizedDryRun {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$DatabaseUrl,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $fullArgs = @('db','dump','--db-url',$DatabaseUrl) + $Arguments + @('--dry-run')
    $raw = @(& supabase @fullArgs 2>&1)
    $exitCode = $LASTEXITCODE
    $text = [string]::Join([Environment]::NewLine, @($raw | ForEach-Object { [string]$_ }))
    $safe = Redact-DumpPlanText -Text $text -DatabaseUrl $DatabaseUrl

    if ($exitCode -ne 0) {
        throw "$Label dry-run failed with exit code $exitCode.`n$safe"
    }

    return [pscustomobject]@{
        Label = $Label
        Text = $safe.Trim()
    }
}

foreach ($requiredPath in @($ConfigPath,$SecretsPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required file not found: $requiredPath"
    }
}

Require-Command 'supabase' | Out-Null

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if ([string]$config.projectRef -ne $ProductionProjectRef) {
    throw "STOPPED: config does not point to the approved INSUREIT production project."
}

$secrets = Import-Clixml -LiteralPath $SecretsPath
$dbUrl = Convert-SecureStringToPlainText $secrets.DatabaseUrl
if ([string]::IsNullOrWhiteSpace($dbUrl) -or -not $dbUrl.Contains($ProductionProjectRef)) {
    throw "STOPPED: stored database connection does not match INSUREIT production."
}

$workDir = Join-Path $PSScriptRoot '_work'
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
$outputPath = Join-Path $workDir 'supabase-db-dump-dry-run-sanitized.txt'

Write-Host "INSUREIT Supabase dump-plan diagnostic" -ForegroundColor Cyan
Write-Host "Project: $ProductionProjectRef"
Write-Host "Mode:    Supabase CLI --dry-run only"
Write-Host "Purpose: capture the exact Supabase-filtered pg_dump plans without running a dump."
Write-Host "Production is read-only; no backup or DR change occurs." -ForegroundColor Green
Write-Host "Secrets are redacted before anything is written or printed."
Write-Host ""

try {
    $planSpecs = @(
        [pscustomobject]@{ Label = 'roles'; Arguments = @('--role-only') }
        [pscustomobject]@{ Label = 'schema'; Arguments = @() }
        [pscustomobject]@{ Label = 'data'; Arguments = @('--use-copy','--data-only','-x','storage.buckets_vectors','-x','storage.vector_indexes') }
        [pscustomobject]@{ Label = 'history_schema'; Arguments = @('--schema','supabase_migrations') }
        [pscustomobject]@{ Label = 'history_data'; Arguments = @('--use-copy','--data-only','--schema','supabase_migrations') }
    )

    $plans = @()
    foreach ($spec in $planSpecs) {
        $plans += Invoke-SanitizedDryRun -Label ([string]$spec.Label) -DatabaseUrl $dbUrl -Arguments @($spec.Arguments)
    }

    $sections = New-Object System.Collections.Generic.List[string]
    foreach ($plan in $plans) {
        $sections.Add("===== $($plan.Label) =====")
        $sections.Add($plan.Text)
        $sections.Add("")
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($outputPath, ([string]::Join([Environment]::NewLine, $sections)), $utf8NoBom)

    Write-Host "SUPABASE DUMP-PLAN DIAGNOSTIC PASSED." -ForegroundColor Green
    Write-Host "Sanitized plan: $outputPath"
    Write-Host ""
    foreach ($plan in $plans) {
        Write-Host "--- $($plan.Label) ---" -ForegroundColor Cyan
        Write-Host $plan.Text
        Write-Host ""
    }
}
finally {
    $dbUrl = $null
    $secrets = $null
}
