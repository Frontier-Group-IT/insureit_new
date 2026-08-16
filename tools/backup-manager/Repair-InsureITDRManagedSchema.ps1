[CmdletBinding()]
param(
    [string]$DRSecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\dr-secrets.clixml"),
    [string]$ConfigPath = (Join-Path $PSScriptRoot "dr.config.local.json"),
    [string]$DefinitionsPath = (Join-Path $PSScriptRoot "_work\production-managed-schema.json"),
    [switch]$Execute
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProductionProjectRef = "ilzhsfqqjyppzzvfscmh"
$ExpectedTargetProjectRef = "jzuqlcysyqtyydukveir"

function Convert-SecureStringToPlainText {
    param([System.Security.SecureString]$Value)
    return [System.Net.NetworkCredential]::new("", $Value).Password
}

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found."
    }
}

function Quote-Identifier {
    param([Parameter(Mandatory = $true)][string]$Value)
    return '"' + ($Value -replace '"', '""') + '"'
}

function Quote-PolicyRole {
    param([Parameter(Mandatory = $true)][string]$Value)
    if ($Value -eq "public") { return "PUBLIC" }
    return Quote-Identifier $Value
}

function Assert-ExpressionSafe {
    param(
        [AllowNull()][string]$Expression,
        [string]$Label
    )
    if ($null -eq $Expression) { return }
    if ($Expression.Contains(";")) {
        throw "$Label contains a semicolon and was rejected. Re-extract the definitions from production."
    }
}

function Invoke-PsqlSingleValue {
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseUrl,
        [Parameter(Mandatory = $true)][string]$Sql,
        [Parameter(Mandatory = $true)][string]$Label
    )

    # Do not pipe native psql directly into Select-Object -First. On Windows
    # PowerShell 5.1 that can close the native pipe early and make psql return
    # a false non-zero/broken-pipe exit code even when the query succeeded.
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

Require-Command "psql"

if (-not (Test-Path -LiteralPath $DRSecretsPath)) {
    throw "DR credential file not found: $DRSecretsPath"
}
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "DR config file not found: $ConfigPath"
}
if (-not (Test-Path -LiteralPath $DefinitionsPath)) {
    throw "Managed-schema definition file not found: $DefinitionsPath"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$targetRef = [string]$config.targetProjectRef
if ([string]::IsNullOrWhiteSpace($targetRef)) { throw "DR config is missing targetProjectRef." }
if ($targetRef -ne $ExpectedTargetProjectRef) {
    throw "STOPPED: approved DR target is $ExpectedTargetProjectRef, but config points to $targetRef."
}
if ($targetRef -eq $ProductionProjectRef) {
    throw "STOPPED: DR target cannot be production."
}

$drSecrets = Import-Clixml -LiteralPath $DRSecretsPath
if ([string]$drSecrets.TargetProjectRef -ne $targetRef) {
    throw "STOPPED: DR credential file target does not match the approved DR project."
}
$dbUrl = Convert-SecureStringToPlainText $drSecrets.DatabaseUrl
if (-not $dbUrl.Contains($targetRef)) {
    throw "STOPPED: DR database URL does not contain the approved DR project ref."
}
if ($dbUrl.Contains($ProductionProjectRef)) {
    throw "STOPPED: production project ref detected in DR database URL."
}

$definitions = Get-Content -LiteralPath $DefinitionsPath -Raw | ConvertFrom-Json
$policies = @($definitions.policies)
$triggers = @($definitions.triggers)

if ($policies.Count -ne 22) {
    throw "Expected exactly 22 production storage.objects policies, found $($policies.Count)."
}
if ($triggers.Count -ne 1) {
    throw "Expected exactly 1 production auth.users trigger, found $($triggers.Count)."
}

$allowedCommands = @("ALL", "SELECT", "INSERT", "UPDATE", "DELETE")
$expectedPolicyNames = New-Object System.Collections.Generic.HashSet[string]

foreach ($policy in $policies) {
    if ([string]$policy.schema -ne "storage" -or [string]$policy.table -ne "objects") {
        throw "Unexpected policy target '$($policy.schema).$($policy.table)'. Only storage.objects is allowed."
    }
    if ([string]$policy.permissive -ne "PERMISSIVE") {
        throw "Unexpected policy mode '$($policy.permissive)' for '$($policy.name)'."
    }
    $cmd = ([string]$policy.cmd).ToUpperInvariant()
    if ($allowedCommands -notcontains $cmd) {
        throw "Unexpected policy command '$cmd' for '$($policy.name)'."
    }
    if ([string]::IsNullOrWhiteSpace([string]$policy.name)) {
        throw "A policy has an empty name."
    }
    if (-not $expectedPolicyNames.Add([string]$policy.name)) {
        throw "Duplicate policy name '$($policy.name)' in the definitions file."
    }
    $roles = @($policy.roles)
    if ($roles.Count -lt 1) {
        throw "Policy '$($policy.name)' has no roles."
    }
    foreach ($role in $roles) {
        if ([string]$role -notin @("anon", "authenticated", "public")) {
            throw "Unexpected role '$role' in policy '$($policy.name)'."
        }
    }
    Assert-ExpressionSafe -Expression $policy.qual -Label "USING expression for '$($policy.name)'"
    Assert-ExpressionSafe -Expression $policy.with_check -Label "WITH CHECK expression for '$($policy.name)'"
}

$trigger = $triggers[0]
if ([string]$trigger.schema -ne "auth" -or [string]$trigger.table -ne "users" -or [string]$trigger.name -ne "on_auth_user_created") {
    throw "Unexpected trigger definition. Expected auth.users.on_auth_user_created."
}
$triggerDefinition = [string]$trigger.definition
if ($triggerDefinition -ne "CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()") {
    throw "The auth.users trigger definition does not match the expected production trigger."
}

$guardSql = @"
select concat_ws('|',
  to_regclass('storage.objects') is not null,
  to_regclass('auth.users') is not null,
  to_regprocedure('public.handle_new_user()') is not null,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'insureit_dr_control'
      and table_name = 'replica_state'
  )
);
"@

$guardResult = Invoke-PsqlSingleValue -DatabaseUrl $dbUrl -Sql $guardSql -Label "DR guard query"
if ($guardResult -ne "t|t|t|t") {
    throw "STOPPED: DR prerequisite objects are not in the expected restored state. Guard result: $guardResult"
}

Write-Host ""
Write-Host "INSUREIT DR managed-schema repair plan" -ForegroundColor Cyan
Write-Host "DR target:             $targetRef"
Write-Host "Definitions file:      $DefinitionsPath"
Write-Host "Storage RLS policies:  $($policies.Count)"
Write-Host "Auth triggers:          $($triggers.Count)"
Write-Host ""
Write-Host "This repair only recreates the production-managed custom objects missing from the logical snapshot:"
Write-Host "  - 22 policies on storage.objects"
Write-Host "  - auth.users.on_auth_user_created"
Write-Host "Production is never modified by this script."

if (-not $Execute) {
    Write-Host ""
    Write-Host "PLAN ONLY. No DR schema was changed." -ForegroundColor Yellow
    Write-Host "Run again with -Execute only after this plan is accepted."
    $dbUrl = $null
    $drSecrets = $null
    return
}

$confirmation = Read-Host "Type exactly 'REPAIR MANAGED SCHEMA ON DR $targetRef' to continue"
if ($confirmation -ne "REPAIR MANAGED SCHEMA ON DR $targetRef") {
    throw "Confirmation did not match. No DR schema was changed."
}

$statements = New-Object System.Collections.Generic.List[string]
$statements.Add("BEGIN;")

foreach ($policy in $policies) {
    $policyName = Quote-Identifier ([string]$policy.name)
    $cmd = ([string]$policy.cmd).ToUpperInvariant()
    $roleSqlParts = New-Object System.Collections.Generic.List[string]
    foreach ($role in @($policy.roles)) {
        $roleSqlParts.Add((Quote-PolicyRole ([string]$role)))
    }
    $roleSql = [string]::Join(", ", $roleSqlParts.ToArray())

    $statements.Add("DROP POLICY IF EXISTS $policyName ON storage.objects;")

    $create = "CREATE POLICY $policyName ON storage.objects AS PERMISSIVE FOR $cmd TO $roleSql"
    if ($null -ne $policy.qual -and -not [string]::IsNullOrWhiteSpace([string]$policy.qual)) {
        $create += " USING ($([string]$policy.qual))"
    }
    if ($null -ne $policy.with_check -and -not [string]::IsNullOrWhiteSpace([string]$policy.with_check)) {
        $create += " WITH CHECK ($([string]$policy.with_check))"
    }
    $create += ";"
    $statements.Add($create)
}

$statements.Add("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;")
$statements.Add($triggerDefinition + ";")
$statements.Add("COMMIT;")

$workDir = Join-Path $PSScriptRoot "_work"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
$sqlPath = Join-Path $workDir "repair-dr-managed-schema.sql"

# Windows PowerShell 5.1's UTF8 encoding writes a BOM, which has broken Supabase SQL execution before.
# Write the temporary SQL explicitly as UTF-8 without BOM.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($sqlPath, $statements.ToArray(), $utf8NoBom)

Write-Host ""
Write-Host "Applying DR-only managed-schema repair..." -ForegroundColor Cyan
& psql "$dbUrl" -X -v ON_ERROR_STOP=1 -f "$sqlPath"
if ($LASTEXITCODE -ne 0) {
    throw "Managed-schema repair failed. The transaction was not completed. STOP and inspect the error before retrying."
}

$verifySql = @"
select concat_ws('|',
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'),
  (select count(*)
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'auth'
      and c.relname = 'users'
      and t.tgname = 'on_auth_user_created')
);
"@

$verifyResult = Invoke-PsqlSingleValue -DatabaseUrl $dbUrl -Sql $verifySql -Label "Post-repair verification query"
if ($verifyResult -ne "22|1") {
    throw "Post-repair verification failed. Expected 22 policies and 1 trigger, got $verifyResult."
}

Write-Host ""
Write-Host "DR MANAGED-SCHEMA REPAIR COMPLETED." -ForegroundColor Green
Write-Host "storage.objects policies: 22"
Write-Host "auth.users trigger:         1"
Write-Host "Run Compare-InsureITDRSchema.ps1 next to verify exact semantic parity."

$dbUrl = $null
$drSecrets = $null
