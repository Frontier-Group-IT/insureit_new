# No credentials or customer data required. Run on the Windows Docker host.
param([switch]$Public)
$ErrorActionPreference = 'Stop'
$base = if ($Public) { 'https://studio.nishant.uk' } else { 'http://127.0.0.1:8790' }
function Check([string]$method, [string]$path, [string[]]$expected) {
  $args = @('-sS','--max-time','15','-o','NUL','-w','%{http_code}','-X',$method,'-H','Host: studio.nishant.uk')
  if ($method -eq 'POST') { $args += @('-H','Content-Type: application/json','--data','{}') }
  $status = & curl.exe @args "$base$path"
  if ($LASTEXITCODE -ne 0) { throw "Connection failed for $method $path" }
  Write-Host "$method $path => $status"
  if ($status -notin $expected) { throw "Unexpected status $status on $method $path (expected $($expected -join ', '))" }
}
Check 'GET' '/login' @('404')
Check 'GET' '/api' @('404')
Check 'GET' '/api/partner/ai-policy-studio/actions' @('405')
# While the backend is disabled: 503. After enablement: 401 for anonymous POST.
Check 'POST' '/api/partner/ai-policy-studio/actions' @('503','401')
Write-Host 'PASS: proxy exposes only the protected Studio POST endpoint.'
