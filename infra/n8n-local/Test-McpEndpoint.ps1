# Read-only diagnostics for the isolated local INSUREIT n8n MCP hostname.
# Run in Windows PowerShell 5.1. Never paste tokens, compose env or private PDFs.
param([string]$PublicOrigin = 'https://mcp.nishant.uk')
$ErrorActionPreference = 'Continue'
try {
  $uri = [Uri]$PublicOrigin
  if ($uri.Scheme -ne 'https' -or $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment) {
    throw 'Supply an HTTPS origin without a path, query or fragment.'
  }
} catch {
  Write-Error 'Invalid MCP HTTPS origin.'
  exit 1
}
$PublicOrigin = $PublicOrigin.TrimEnd('/')
Write-Host '=== DNS (public MCP hostname) ==='
try {
  Resolve-DnsName -Name ([Uri]$PublicOrigin).Host -Type A -ErrorAction Stop |
    Where-Object Type -eq 'A' | Select-Object -First 5 Name,Type,IPAddress | Format-Table
} catch { Write-Host ('DNS failure: ' + $_.Exception.Message) }
Write-Host '=== Cloudflare Tunnel Windows service ==='
try { Get-Service cloudflared -ErrorAction Stop | Select-Object Name,Status | Format-Table }
catch { Write-Host 'Service not available under name cloudflared' }

function Probe([string]$Path) {
  $url = $PublicOrigin + $Path
  Write-Host ('=== ' + $Path + ' ===')
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 12 -Headers @{Accept='application/json'} -ErrorAction Stop
    Write-Host ('HTTP: ' + [int]$r.StatusCode)
    if ($r.Content -and $r.Content.TrimStart().StartsWith('{')) {
      $json = $r.Content | ConvertFrom-Json
      if ($null -ne $json.resource) { Write-Host ('resource: ' + $json.resource) }
      if ($null -ne $json.authorization_servers) {
        foreach ($server in $json.authorization_servers) { Write-Host ('authorization_server: ' + $server) }
      }
      foreach ($name in @('issuer','authorization_endpoint','token_endpoint','registration_endpoint')) {
        if ($json.PSObject.Properties[$name]) { Write-Host ($name + ': ' + $json.$name) }
      }
    }
  } catch {
    $response = $_.Exception.Response
    if ($null -ne $response) {
      Write-Host ('HTTP: ' + [int]$response.StatusCode)
      if ($response.Headers['WWW-Authenticate']) {
        Write-Host ('WWW-Authenticate: ' + $response.Headers['WWW-Authenticate'])
      }
    } else { Write-Host ('Connection failed: ' + $_.Exception.Message) }
  }
}
Probe '/.well-known/oauth-protected-resource'
Probe '/.well-known/oauth-protected-resource/mcp-server/http'
Probe '/.well-known/oauth-authorization-server'
Probe '/mcp-server/http'
Write-Host '=== Expected ==='
Write-Host ('MCP resource: ' + $PublicOrigin + '/mcp-server/http')
Write-Host 'OAuth metadata must advertise public HTTPS, never localhost:5678.'
Write-Host 'The unauthenticated MCP request should not return authenticated tools.'
