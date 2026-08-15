[CmdletBinding()]
param(
    [string]$SecretsPath = (Join-Path $env:ProgramData "InsureIT Backup\secrets.clixml")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
    throw "This credential helper is designed for Windows because it relies on Windows DPAPI."
}

$parent = Split-Path -Parent $SecretsPath
New-Item -ItemType Directory -Force -Path $parent | Out-Null

Write-Host "INSUREIT Backup Manager - secure credential setup" -ForegroundColor Cyan
Write-Host "Nothing entered here is written to Git." -ForegroundColor DarkGray
Write-Host ""

$dbUrl = Read-Host "Paste the Supabase database connection string" -AsSecureString
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
Write-Host "Important: the scheduled task must run under the same Windows user that created this file." -ForegroundColor Yellow
