# INSUREIT isolated non-Tata webhook proxy update. Windows PowerShell 5.1 compatible.
# Run from C:\Users\HP\insureit_new\infra\n8n-local (or anywhere inside repo).
# Does NOT checkout, reset, stash or modify branches; safe alongside parallel Tata work.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$gitRoot = (& git rev-parse --show-toplevel)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($gitRoot)) { throw 'Run inside the INSUREIT git checkout.' }
$gitRoot = $gitRoot.Trim()
$configPath = Join-Path $gitRoot 'infra\n8n-local\webhook-proxy.conf'
$composeDir = Join-Path $gitRoot 'infra\n8n-local'
if (-not (Test-Path $configPath)) { throw 'Expected local webhook-proxy.conf is missing.' }
Push-Location $gitRoot
try {
  & git fetch origin main
  if ($LASTEXITCODE -ne 0) { throw 'Cannot fetch origin/main. Nothing changed.' }
  $remoteConfig = & git show 'origin/main:infra/n8n-local/webhook-proxy.conf'
  if ($LASTEXITCODE -ne 0) { throw 'Cannot read reviewed proxy config from origin/main. Nothing changed.' }
  $newText = [string]::Join([Environment]::NewLine, $remoteConfig) + [Environment]::NewLine
  $oldPath = 'location = /webhook/insureit-policy-intake-icici-v1'
  $newPath = 'location = /webhook/insureit-nontata-motor-pdf-candidate-v1'
  if (-not $newText.Contains($oldPath) -or -not $newText.Contains($newPath)) {
    throw 'Origin main does not include both exact isolated and existing webhook allowlists. Nothing changed.'
  }
  if ($newText -notmatch 'location\s+/\s*\{\s*return\s+404;') {
    throw 'Unexpected default deny behavior; refusing to update.'
  }
  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupPath = "$configPath.backup-$timestamp"
  Copy-Item -LiteralPath $configPath -Destination $backupPath -ErrorAction Stop
  $enc = New-Object System.Text.UTF8Encoding($false)
  try {
    [System.IO.File]::WriteAllText($configPath, $newText, $enc)
    Push-Location $composeDir
    try {
      & docker compose -f compose.yaml -f compose.proxy.yaml exec -T webhook-proxy nginx -t
      if ($LASTEXITCODE -ne 0) { throw 'Nginx rejected the new config.' }
      & docker compose -f compose.yaml -f compose.proxy.yaml exec -T webhook-proxy nginx -s reload
      if ($LASTEXITCODE -ne 0) { throw 'Nginx reload failed.' }
    } finally { Pop-Location }
    Write-Host 'OK: isolated non-Tata webhook enabled on existing local proxy; Tata/ICICI path unchanged.'
    Write-Host "Backup: $backupPath"
  } catch {
    Copy-Item -LiteralPath $backupPath -Destination $configPath -Force
    Write-Warning 'Previous Nginx config restored. Existing website/webhook configuration remains preserved.'
    throw
  }
} finally { Pop-Location }
