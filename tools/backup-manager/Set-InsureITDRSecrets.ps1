[CmdletBinding()]
param(
    [string]$TargetProjectRef = "jzuqlcysyqtyydukveir",
    [string]$ProductionProjectRef = "ilzhsfqqjyppzzvfscmh",
    [string]$SecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\dr-secrets.clixml")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Convert-SecureStringToPlainText {
    param([System.Security.SecureString]$Value)
    return [System.Net.NetworkCredential]::new("", $Value).Password
}

if ($env:OS -ne "Windows_NT") {
    throw "This credential helper is designed for Windows because it relies on Windows DPAPI."
}

if ([string]::IsNullOrWhiteSpace($TargetProjectRef)) {
    throw "TargetProjectRef is required."
}
if ($TargetProjectRef -eq $ProductionProjectRef) {
    throw "The DR target must not be the production project."
}

$parent = Split-Path -Parent $SecretsPath
New-Item -ItemType Directory -Force -Path $parent | Out-Null

Write-Host "INSUREIT DR standby - secure credential setup" -ForegroundColor Cyan
Write-Host "These credentials are for the BACKUP Supabase project only." -ForegroundColor Yellow
Write-Host "Nothing entered here is written to Git." -ForegroundColor DarkGray
Write-Host ""
Write-Host "Paste the TESTING/DR Session pooler URI exactly as copied from Supabase, leaving [YOUR-PASSWORD] unchanged." -ForegroundColor DarkGray
Write-Host "The real password will be entered separately and URL-encoded automatically." -ForegroundColor DarkGray
Write-Host ""

$dbUrlTemplate = Read-Host "Paste DR Supabase Session pooler URI"
if ([string]::IsNullOrWhiteSpace($dbUrlTemplate)) {
    throw "DR database connection string is required."
}
if (-not $dbUrlTemplate.Contains("[YOUR-PASSWORD]")) {
    throw "The DR database URI must still contain the literal [YOUR-PASSWORD] placeholder."
}
if (-not $dbUrlTemplate.Contains($TargetProjectRef)) {
    throw "STOPPED: the database URI does not contain the approved DR project ref '$TargetProjectRef'."
}
if ($dbUrlTemplate.Contains($ProductionProjectRef)) {
    throw "STOPPED: production project detected in the DR database URI."
}
if ($dbUrlTemplate -notmatch 'pooler\.supabase\.com:5432/') {
    throw "Use the Supabase Session pooler connection string on port 5432."
}

$dbPassword = Read-Host "Enter the DR project database password exactly as-is" -AsSecureString
$dbPasswordPlain = $null
$encodedPassword = $null
$dbUrlPlain = $null
$dbUrl = $null
try {
    $dbPasswordPlain = Convert-SecureStringToPlainText $dbPassword
    if ([string]::IsNullOrWhiteSpace($dbPasswordPlain)) {
        throw "DR database password is required."
    }

    $encodedPassword = [System.Uri]::EscapeDataString($dbPasswordPlain)
    $dbUrlPlain = $dbUrlTemplate.Replace("[YOUR-PASSWORD]", $encodedPassword)
    $dbUrl = ConvertTo-SecureString -String $dbUrlPlain -AsPlainText -Force
}
finally {
    $dbPasswordPlain = $null
    $encodedPassword = $null
    $dbUrlPlain = $null
    $dbPassword = $null
}

$s3AccessKeyId = Read-Host "Paste the DR project Storage S3 Access Key ID"
$s3SecretAccessKey = Read-Host "Paste the DR project Storage S3 Secret Access Key" -AsSecureString

if ([string]::IsNullOrWhiteSpace($s3AccessKeyId)) {
    throw "DR S3 Access Key ID is required."
}

$payload = [pscustomobject]@{
    Version = 1
    CreatedAtUtc = [DateTime]::UtcNow.ToString("o")
    TargetProjectRef = $TargetProjectRef
    DatabaseUrl = $dbUrl
    S3AccessKeyId = $s3AccessKeyId.Trim()
    S3SecretAccessKey = $s3SecretAccessKey
}

$payload | Export-Clixml -LiteralPath $SecretsPath -Force

Write-Host ""
Write-Host "Encrypted DR credentials saved to:" -ForegroundColor Green
Write-Host $SecretsPath
Write-Host ""
Write-Host "The production backup credentials were not changed." -ForegroundColor Green
Write-Host "Important: the scheduled DR refresh must run under the same Windows user that created this file." -ForegroundColor Yellow
