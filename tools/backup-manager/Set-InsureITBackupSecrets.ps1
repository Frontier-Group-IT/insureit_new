[CmdletBinding()]
param(
    [string]$SecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\secrets.clixml")
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

$parent = Split-Path -Parent $SecretsPath
New-Item -ItemType Directory -Force -Path $parent | Out-Null

Write-Host "INSUREIT Backup Manager - secure credential setup" -ForegroundColor Cyan
Write-Host "Nothing entered here is written to Git." -ForegroundColor DarkGray
Write-Host ""
Write-Host "Database password handling:" -ForegroundColor Cyan
Write-Host "Paste the Supabase Session pooler URI exactly as copied from the dashboard, leaving [YOUR-PASSWORD] unchanged." -ForegroundColor DarkGray
Write-Host "You will enter the real database password separately and it will be URL-encoded automatically." -ForegroundColor DarkGray
Write-Host ""

$dbUrlTemplate = Read-Host "Paste the Supabase Session pooler URI"
if ([string]::IsNullOrWhiteSpace($dbUrlTemplate)) {
    throw "Database connection string is required."
}
if (-not $dbUrlTemplate.Contains("[YOUR-PASSWORD]")) {
    throw "The database URI must still contain the literal [YOUR-PASSWORD] placeholder. Copy it again from Supabase without editing the password portion."
}

$dbPassword = Read-Host "Enter the Supabase database password exactly as-is" -AsSecureString
$dbPasswordPlain = $null
$encodedPassword = $null
$dbUrlPlain = $null
$dbUrl = $null
try {
    $dbPasswordPlain = Convert-SecureStringToPlainText $dbPassword
    if ([string]::IsNullOrWhiteSpace($dbPasswordPlain)) {
        throw "Database password is required."
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

$s3AccessKeyId = Read-Host "Paste the Supabase Storage S3 Access Key ID"
$s3SecretAccessKey = Read-Host "Paste the Supabase Storage S3 Secret Access Key" -AsSecureString

if ([string]::IsNullOrWhiteSpace($s3AccessKeyId)) {
    throw "S3 Access Key ID is required."
}

$payload = [pscustomobject]@{
    Version = 1
    CreatedAtUtc = [DateTime]::UtcNow.ToString("o")
    DatabaseUrl = $dbUrl
    S3AccessKeyId = $s3AccessKeyId.Trim()
    S3SecretAccessKey = $s3SecretAccessKey
}

$payload | Export-Clixml -LiteralPath $SecretsPath -Force

Write-Host ""
Write-Host "Encrypted credentials saved to:" -ForegroundColor Green
Write-Host $SecretsPath
Write-Host ""
Write-Host "The database password was URL-encoded automatically; no manual encoding was required." -ForegroundColor Green
Write-Host "Important: the scheduled task must run under the same Windows user that created this file." -ForegroundColor Yellow
