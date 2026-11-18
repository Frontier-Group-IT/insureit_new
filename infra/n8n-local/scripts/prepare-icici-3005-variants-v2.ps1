# Isolated, INACTIVE local n8n ICICI 3005/3005-O test candidate builder.
# PowerShell 5.1 compatible. Reads a local exported workflow, writes a NEW
# candidate JSON. Never changes Docker, credentials, database or live workflow.
param(
  [Parameter(Mandatory=$true)][string]$SourceJson,
  [Parameter(Mandatory=$true)][string]$CandidateJson
)
$ErrorActionPreference='Stop'
$parserSource=Join-Path (Split-Path -Parent $PSScriptRoot) 'parser\icici-3005-dual-v2.js'
$responseSource=Join-Path (Split-Path -Parent $PSScriptRoot) 'parser\icici-3005-review-only-response-v2.js'
if(-not (Test-Path -LiteralPath $SourceJson)){throw 'Exported source workflow JSON not found.'}
if(-not (Test-Path -LiteralPath $parserSource)){throw 'Versioned parser source not found; update repo first.'}
if(-not (Test-Path -LiteralPath $responseSource)){throw 'Versioned response source not found; update repo first.'}
if(Test-Path -LiteralPath $CandidateJson){throw 'Candidate output already exists. Choose a new output path; no overwrite allowed.'}
$wf=Get-Content -LiteralPath $SourceJson -Raw | ConvertFrom-Json
$parser=@($wf.nodes | Where-Object { $_.name -eq 'ICICI Product 3005 Parser' })
$response=@($wf.nodes | Where-Object { $_.name -eq 'Return INSUREIT Review-Only JSON' })
$hook=@($wf.nodes | Where-Object { $_.type -eq 'n8n-nodes-base.webhook' })
if($parser.Count -ne 1 -or $response.Count -ne 1 -or $hook.Count -ne 1) {
  throw 'Expected exactly one parser, response and webhook node; original export left unchanged.'
}
$oldCode=[string]$parser[0].parameters.jsCode
$oldResponse=[string]$response[0].parameters.jsCode
if(-not $oldCode.Contains('parseIcici3005Od') -or -not $oldCode.Contains('recognizedBundled')
   -or -not $oldResponse.Contains('auto_finalize_allowed:false')) {
  throw 'Source export does not match validated dual-parser workflow. Refusing an unsafe replacement.'
}
$parserCode=Get-Content -LiteralPath $parserSource -Raw
$responseCode=Get-Content -LiteralPath $responseSource -Raw
if(-not $parserCode.Contains('corporateNoCpa') -or -not $parserCode.Contains('printedNcbSection')
   -or -not $responseCode.Contains('auto_finalize_allowed:false')) {
  throw 'Candidate source contract is incomplete.'
}
$parser[0].parameters.jsCode=$parserCode
$response[0].parameters.jsCode=$responseCode
$wf.name='INSUREIT - ICICI 3005 Variants v2 - INACTIVE LOCAL TEST'
$wf.active=$false
$hook[0].parameters.path='insureit-icici-3005-variants-v2-isolated'
foreach($key in @('id','versionId','createdAt','updatedAt','shared','staticData')) {
  $wf.PSObject.Properties.Remove($key)
}
$parent=Split-Path -Parent $CandidateJson
if($parent -and -not (Test-Path -LiteralPath $parent)){New-Item -ItemType Directory -Force -Path $parent | Out-Null}
$wf | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $CandidateJson -Encoding UTF8
Write-Host 'Created isolated inactive workflow import JSON:' $CandidateJson
Write-Host 'Import as NEW workflow; do not overwrite or publish the production webhook.'
Write-Host 'Test all three variants with Execute workflow / Test URL before changing live parser.'
