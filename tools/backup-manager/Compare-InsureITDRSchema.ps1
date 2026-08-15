[CmdletBinding()]
param(
    [string]$ProductionSecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\secrets.clixml"),
    [string]$DRSecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\dr-secrets.clixml"),
    [string]$ConfigPath = (Join-Path $PSScriptRoot "dr.config.local.json"),
    [string]$OutputPath = (Join-Path $PSScriptRoot "_work\dr-schema-catalog-diff.txt")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProductionProjectRef = "ilzhsfqqjyppzzvfscmh"

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

if (-not (Test-Path -LiteralPath $ProductionSecretsPath)) {
    throw "Production backup credential file not found: $ProductionSecretsPath"
}
if (-not (Test-Path -LiteralPath $DRSecretsPath)) {
    throw "DR credential file not found: $DRSecretsPath"
}
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "DR config file not found: $ConfigPath"
}

Require-Command "psql"

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$targetRef = [string]$config.targetProjectRef
if ([string]::IsNullOrWhiteSpace($targetRef)) { throw "DR config is missing targetProjectRef." }
if ($targetRef -eq $ProductionProjectRef) { throw "STOPPED: DR target cannot be production." }

$prodSecrets = Import-Clixml -LiteralPath $ProductionSecretsPath
$drSecrets = Import-Clixml -LiteralPath $DRSecretsPath
$prodUrl = Convert-SecureStringToPlainText $prodSecrets.DatabaseUrl
$drUrl = Convert-SecureStringToPlainText $drSecrets.DatabaseUrl

if (-not $prodUrl.Contains($ProductionProjectRef)) { throw "STOPPED: production credential URL does not contain the production project ref." }
if ($prodUrl.Contains($targetRef)) { throw "STOPPED: DR project ref detected in production credential URL." }
if (-not $drUrl.Contains($targetRef)) { throw "STOPPED: DR credential URL does not contain the approved DR target ref." }
if ($drUrl.Contains($ProductionProjectRef)) { throw "STOPPED: production project ref detected in DR credential URL." }

$sql = @'
with catalog as (
    select 'relation'::text as category,
           format('%I.%I', n.nspname, c.relname) as object_key,
           md5(concat_ws('|', c.relkind::text, c.relrowsecurity::text, c.relforcerowsecurity::text)) as fingerprint
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public','auth','storage')
      and c.relkind in ('r','p','v','m','S')

    union all

    select 'column',
           format('%I.%I.%I', n.nspname, c.relname, a.attname),
           md5(concat_ws('|',
               format_type(a.atttypid, a.atttypmod),
               a.attnotnull::text,
               coalesce(pg_get_expr(d.adbin, d.adrelid), ''),
               a.attidentity::text,
               a.attgenerated::text,
               coalesce(coll.collname, '')
           ))
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    left join pg_collation coll on coll.oid = a.attcollation and a.attcollation <> 0
    where n.nspname in ('public','auth','storage')
      and c.relkind in ('r','p','v','m')
      and a.attnum > 0
      and not a.attisdropped

    union all

    select 'constraint',
           format('%I.%I.%I', n.nspname, c.relname, con.conname),
           md5(pg_get_constraintdef(con.oid, true))
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public','auth','storage')

    union all

    select 'index',
           format('%I.%I', n.nspname, idx.relname),
           md5(pg_get_indexdef(idx.oid))
    from pg_index i
    join pg_class idx on idx.oid = i.indexrelid
    join pg_class tbl on tbl.oid = i.indrelid
    join pg_namespace n on n.oid = tbl.relnamespace
    where n.nspname in ('public','auth','storage')

    union all

    select 'function',
           format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
           md5(pg_get_functiondef(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','auth','storage')

    union all

    select 'trigger',
           format('%I.%I.%I', n.nspname, c.relname, t.tgname),
           md5(pg_get_triggerdef(t.oid, true))
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname in ('public','auth','storage')

    union all

    select 'policy',
           format('%I.%I.%I', schemaname, tablename, policyname),
           md5(concat_ws('|', permissive, cmd, roles::text, coalesce(qual,''), coalesce(with_check,'')))
    from pg_policies
    where schemaname in ('public','auth','storage')

    union all

    select 'extension',
           quote_ident(e.extname),
           md5(concat_ws('|', e.extversion, n.nspname))
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace

    union all

    select 'enum',
           format('%I.%I.%s', n.nspname, t.typname, e.enumsortorder),
           md5(e.enumlabel)
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname in ('public','auth','storage')
)
select category || E'\t' || object_key || E'\t' || fingerprint
from catalog
order by category, object_key;
'@

function Get-CatalogRows {
    param([string]$DatabaseUrl, [string]$Label)
    $rows = @(& psql $DatabaseUrl -X -v ON_ERROR_STOP=1 -t -A -c $sql)
    $exit = $LASTEXITCODE
    if ($exit -ne 0) { throw "$Label catalog query failed with exit code $exit." }
    return @($rows | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
}

function Convert-RowsToMap {
    param([string[]]$Rows)
    $map = @{}
    foreach ($row in $Rows) {
        $parts = $row -split "`t", 3
        if ($parts.Count -ne 3) { throw "Unexpected catalog row format." }
        $key = "$($parts[0])`t$($parts[1])"
        $map[$key] = $parts[2]
    }
    return $map
}

try {
    Write-Host "Reading production schema catalog (read-only)..." -ForegroundColor Cyan
    $sourceRows = Get-CatalogRows -DatabaseUrl $prodUrl -Label "Production"
    Write-Host "Reading DR schema catalog (read-only)..." -ForegroundColor Cyan
    $targetRows = Get-CatalogRows -DatabaseUrl $drUrl -Label "DR"

    $source = Convert-RowsToMap $sourceRows
    $target = Convert-RowsToMap $targetRows
    $allKeys = @($source.Keys + $target.Keys | Sort-Object -Unique)
    $differences = @()

    foreach ($key in $allKeys) {
        $parts = $key -split "`t", 2
        $category = $parts[0]
        $objectKey = $parts[1]
        if (-not $target.ContainsKey($key)) {
            $differences += [pscustomobject]@{ Category=$category; Object=$objectKey; Status="MissingInDR" }
        }
        elseif (-not $source.ContainsKey($key)) {
            $differences += [pscustomobject]@{ Category=$category; Object=$objectKey; Status="ExtraInDR" }
        }
        elseif ($source[$key] -ne $target[$key]) {
            $differences += [pscustomobject]@{ Category=$category; Object=$objectKey; Status="DifferentDefinition" }
        }
    }

    $outputDir = Split-Path -Parent ([IO.Path]::GetFullPath($OutputPath))
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

    $lines = @()
    $lines += "INSUREIT production vs DR schema catalog comparison"
    $lines += "Generated UTC: $([DateTime]::UtcNow.ToString('o'))"
    $lines += "Production ref: $ProductionProjectRef"
    $lines += "DR ref: $targetRef"
    $lines += "Production catalog objects: $($source.Count)"
    $lines += "DR catalog objects: $($target.Count)"
    $lines += "Differences: $($differences.Count)"
    $lines += ""
    foreach ($d in $differences) {
        $lines += "$($d.Status)`t$($d.Category)`t$($d.Object)"
    }
    $lines | Set-Content -LiteralPath $OutputPath -Encoding UTF8

    Write-Host ""
    Write-Host ("Production catalog objects: {0}" -f $source.Count)
    Write-Host ("DR catalog objects:         {0}" -f $target.Count)
    Write-Host ("Differences:                {0}" -f $differences.Count)
    Write-Host ("Catalog exact match:        {0}" -f ($differences.Count -eq 0))

    if ($differences.Count -gt 0) {
        Write-Host ""
        Write-Host "Difference summary:" -ForegroundColor Yellow
        $differences | Group-Object Status,Category | Sort-Object Name | ForEach-Object {
            Write-Host ("  {0}: {1}" -f $_.Name, $_.Count)
        }
        Write-Host ""
        Write-Host "First differences:" -ForegroundColor Yellow
        $differences | Select-Object -First 40 | ForEach-Object {
            Write-Host ("  {0} | {1} | {2}" -f $_.Status, $_.Category, $_.Object)
        }
        if ($differences.Count -gt 40) {
            Write-Host ("  ... {0} more written to the report file." -f ($differences.Count - 40))
        }
    }

    Write-Host ""
    Write-Host ("Report: {0}" -f ([IO.Path]::GetFullPath($OutputPath)))
    Write-Host "No database data or schema was changed." -ForegroundColor Green
}
finally {
    $prodUrl = $null
    $drUrl = $null
    $prodSecrets = $null
    $drSecrets = $null
}
