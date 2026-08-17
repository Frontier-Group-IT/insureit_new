[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$DatabaseUrl,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$InternalSchemaPattern = 'information_schema|pg_*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault'
$DataExcludeSchemaPattern = 'information_schema|pg_*|graphql|graphql_public|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault|etl|extensions|pgbouncer|realtime|supabase_migrations|_analytics|_realtime|_supavisor'
$ReservedRolePattern = '(anon|authenticated|authenticator|cli_login_.*|dashboard_user|pgbouncer|postgres|service_role|supabase_.*|pgsodium_keyholder|pgsodium_keyiduser|pgsodium_keymaker|pgtle_admin)'
$InternalAclSchemaPattern = '(information_schema|pg_.*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_.*|_timescaledb_.*|topology|vault)'

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) { throw "Required command '$Name' was not found." }
    return $command
}

function Assert-Postgres17Client {
    param(
        [Parameter(Mandatory = $true)]$Command,
        [Parameter(Mandatory = $true)][string]$Label
    )
    $version = (& $Command.Source --version | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $version -notmatch 'PostgreSQL\) (?<major>\d+)') {
        throw "Could not determine $Label version."
    }
    if ([int]$Matches['major'] -ne 17) {
        throw "Local database dump transport requires PostgreSQL 17 clients. Found: $version"
    }
    return $version
}

function Invoke-DumpWithRetry {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$OutputPath,
        [int]$Attempts = 2
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        if (Test-Path -LiteralPath $OutputPath) {
            Remove-Item -LiteralPath $OutputPath -Force
        }

        Write-Host ("{0} (local PG17 transport, attempt {1}/{2})..." -f $Label,$attempt,$Attempts)
        & $Executable @Arguments
        $exitCode = $LASTEXITCODE
        if ($exitCode -eq 0 -and (Test-Path -LiteralPath $OutputPath -PathType Leaf) -and (Get-Item -LiteralPath $OutputPath).Length -gt 0) {
            return
        }

        if ($attempt -lt $Attempts) {
            Write-Warning "$Label failed with exit code $exitCode. Retrying once after 5 seconds."
            Start-Sleep -Seconds 5
        }
        else {
            throw "$Label failed with exit code $exitCode after $Attempts attempts."
        }
    }
}

function New-Utf8Reader {
    param([Parameter(Mandatory = $true)][string]$Path)
    return New-Object System.IO.StreamReader($Path, (New-Object System.Text.UTF8Encoding($false)), $true)
}

function New-Utf8Writer {
    param([Parameter(Mandatory = $true)][string]$Path)
    return New-Object System.IO.StreamWriter($Path, $false, (New-Object System.Text.UTF8Encoding($false)))
}

function Convert-RolesDump {
    param(
        [Parameter(Mandatory = $true)][string]$RawPath,
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )

    $reader = New-Utf8Reader -Path $RawPath
    $writer = New-Utf8Writer -Path $DestinationPath
    $previous = $null
    try {
        while (($line = $reader.ReadLine()) -ne $null) {
            if ($line -match '^\\(?:un)?restrict\s') { continue }

            if ($line -match '^-- (.* SET "(pgaudit.*|pgrst.*|session_replication_role|statement_timeout|track_io_timing)" .*)$') {
                $line = $Matches[1]
            }

            if ($line -match ('^CREATE ROLE "' + $ReservedRolePattern + '"')) { continue }
            if ($line -match ('^ALTER ROLE "' + $ReservedRolePattern + '"')) { continue }
            if ($line -match ('^GRANT ".*" TO "' + $ReservedRolePattern + '"')) { continue }

            $line = $line -replace ' (NOSUPERUSER|NOREPLICATION)', ''
            if ($line -match '^--') { continue }

            if ($null -eq $previous -or $line -cne $previous) {
                $writer.WriteLine($line)
                $previous = $line
            }
        }
        $writer.WriteLine('RESET ALL;')
    }
    finally {
        $reader.Dispose()
        $writer.Dispose()
    }
}

function Convert-SchemaDump {
    param(
        [Parameter(Mandatory = $true)][string]$RawPath,
        [Parameter(Mandatory = $true)][string]$DestinationPath,
        [switch]$FilterInternalAcl
    )

    $reader = New-Utf8Reader -Path $RawPath
    $writer = New-Utf8Writer -Path $DestinationPath
    try {
        while (($line = $reader.ReadLine()) -ne $null) {
            if ($line -match '^\\(?:un)?restrict\s') { continue }

            $line = $line -replace '^CREATE SCHEMA "', 'CREATE SCHEMA IF NOT EXISTS "'
            $line = $line -replace '^CREATE TABLE "', 'CREATE TABLE IF NOT EXISTS "'
            $line = $line -replace '^CREATE SEQUENCE "', 'CREATE SEQUENCE IF NOT EXISTS "'
            $line = $line -replace '^CREATE VIEW "', 'CREATE OR REPLACE VIEW "'
            $line = $line -replace '^CREATE FUNCTION "', 'CREATE OR REPLACE FUNCTION "'
            $line = $line -replace '^CREATE TRIGGER "', 'CREATE OR REPLACE TRIGGER "'

            if ($line -match '^CREATE PUBLICATION "supabase_realtime') { continue }
            if ($line -match '^CREATE EVENT TRIGGER ') { continue }
            if ($line -match '^\s{9}WHEN TAG IN ') { continue }
            if ($line -match '^\s{3}EXECUTE FUNCTION ') { continue }
            if ($line -match '^ALTER EVENT TRIGGER ') { continue }
            if ($line -match '^ALTER PUBLICATION "supabase_realtime_') { continue }
            if ($line -match '^ALTER FOREIGN DATA WRAPPER .+ OWNER TO ') { continue }
            if ($line -match '^ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"') { continue }
            if ($line -match '^GRANT ALL ON FOREIGN DATA WRAPPER .+ TO "postgres" WITH GRANT OPTION') { continue }

            if ($FilterInternalAcl) {
                if ($line -match ('^GRANT .+ ON .+ "' + $InternalAclSchemaPattern + '"')) { continue }
                if ($line -match ('^REVOKE .+ ON .+ "' + $InternalAclSchemaPattern + '"')) { continue }
            }

            if ($line -match '^CREATE EXTENSION IF NOT EXISTS "(pg_tle|pgsodium|pgmq)".+$') {
                $line = 'CREATE EXTENSION IF NOT EXISTS "' + $Matches[1] + '";'
            }

            if ($line -match '^COMMENT ON EXTENSION ') { continue }
            if ($line -match '^CREATE POLICY "cron_job_') { continue }
            if ($line -match '^ALTER TABLE "cron"') { continue }
            if ($line -eq 'SET transaction_timeout = 0;') { continue }
            if ($line -match '^--') { continue }

            $writer.WriteLine($line)
        }
    }
    finally {
        $reader.Dispose()
        $writer.Dispose()
    }
}

function Convert-DataDump {
    param(
        [Parameter(Mandatory = $true)][string]$RawPath,
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )

    $reader = New-Utf8Reader -Path $RawPath
    $writer = New-Utf8Writer -Path $DestinationPath
    try {
        $writer.WriteLine('SET session_replication_role = replica;')
        $writer.WriteLine('')
        while (($line = $reader.ReadLine()) -ne $null) {
            if ($line -match '^\\(?:un)?restrict\s') {
                $writer.WriteLine('-- ' + $line)
            }
            else {
                $writer.WriteLine($line)
            }
        }
        $writer.WriteLine('')
        $writer.WriteLine('RESET ALL;')
    }
    finally {
        $reader.Dispose()
        $writer.Dispose()
    }
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { throw 'DatabaseUrl is empty.' }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$pgDump = Require-Command 'pg_dump'
$pgDumpAll = Require-Command 'pg_dumpall'
$pgDumpVersion = Assert-Postgres17Client -Command $pgDump -Label 'pg_dump'
$pgDumpAllVersion = Assert-Postgres17Client -Command $pgDumpAll -Label 'pg_dumpall'
Write-Host "Database dump transport: local PostgreSQL 17 clients."
Write-Host "pg_dump:    $pgDumpVersion"
Write-Host "pg_dumpall: $pgDumpAllVersion"

$rawDirectory = Join-Path $OutputDirectory '_raw_local_pg17'
if (Test-Path -LiteralPath $rawDirectory) { Remove-Item -LiteralPath $rawDirectory -Recurse -Force }
New-Item -ItemType Directory -Path $rawDirectory | Out-Null

$rawRoles = Join-Path $rawDirectory 'roles.raw.sql'
$rawSchema = Join-Path $rawDirectory 'schema.raw.sql'
$rawData = Join-Path $rawDirectory 'data.raw.sql'
$rawHistorySchema = Join-Path $rawDirectory 'history_schema.raw.sql'
$rawHistoryData = Join-Path $rawDirectory 'history_data.raw.sql'

try {
    Invoke-DumpWithRetry -Executable $pgDumpAll.Source -Label 'Roles dump' -OutputPath $rawRoles -Arguments @(
        "--dbname=$DatabaseUrl",
        '--roles-only',
        '--role=postgres',
        '--quote-all-identifiers',
        '--no-role-passwords',
        '--no-comments',
        "--file=$rawRoles"
    )
    Convert-RolesDump -RawPath $rawRoles -DestinationPath (Join-Path $OutputDirectory 'roles.sql')

    Invoke-DumpWithRetry -Executable $pgDump.Source -Label 'Schema dump' -OutputPath $rawSchema -Arguments @(
        $DatabaseUrl,
        '--schema-only',
        '--quote-all-identifiers',
        '--role=postgres',
        "--exclude-schema=$InternalSchemaPattern",
        "--file=$rawSchema"
    )
    Convert-SchemaDump -RawPath $rawSchema -DestinationPath (Join-Path $OutputDirectory 'schema.sql') -FilterInternalAcl

    Invoke-DumpWithRetry -Executable $pgDump.Source -Label 'Data dump' -OutputPath $rawData -Arguments @(
        $DatabaseUrl,
        '--data-only',
        '--quote-all-identifiers',
        '--role=postgres',
        "--exclude-schema=$DataExcludeSchemaPattern",
        '--exclude-table=auth.schema_migrations',
        '--exclude-table=storage.migrations',
        '--exclude-table=supabase_functions.migrations',
        '--schema=*',
        '--exclude-table="storage"."buckets_vectors"',
        '--exclude-table="storage"."vector_indexes"',
        "--file=$rawData"
    )
    Convert-DataDump -RawPath $rawData -DestinationPath (Join-Path $OutputDirectory 'data.sql')

    Invoke-DumpWithRetry -Executable $pgDump.Source -Label 'Migration history schema dump' -OutputPath $rawHistorySchema -Arguments @(
        $DatabaseUrl,
        '--schema-only',
        '--quote-all-identifiers',
        '--role=postgres',
        '--schema=supabase_migrations',
        "--file=$rawHistorySchema"
    )
    Convert-SchemaDump -RawPath $rawHistorySchema -DestinationPath (Join-Path $OutputDirectory 'history_schema.sql')

    Invoke-DumpWithRetry -Executable $pgDump.Source -Label 'Migration history data dump' -OutputPath $rawHistoryData -Arguments @(
        $DatabaseUrl,
        '--data-only',
        '--quote-all-identifiers',
        '--role=postgres',
        '--exclude-table=auth.schema_migrations',
        '--exclude-table=storage.migrations',
        '--exclude-table=supabase_functions.migrations',
        '--schema=supabase_migrations',
        "--file=$rawHistoryData"
    )
    Convert-DataDump -RawPath $rawHistoryData -DestinationPath (Join-Path $OutputDirectory 'history_data.sql')

    foreach ($required in @('roles.sql','schema.sql','data.sql','history_schema.sql','history_data.sql')) {
        $path = Join-Path $OutputDirectory $required
        if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or (Get-Item -LiteralPath $path).Length -lt 1) {
            throw "Local database dump transport did not produce a valid $required."
        }
    }

    Write-Host 'Local PostgreSQL 17 database dump completed.' -ForegroundColor Green
}
finally {
    if (Test-Path -LiteralPath $rawDirectory) {
        Remove-Item -LiteralPath $rawDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
    $DatabaseUrl = $null
}
