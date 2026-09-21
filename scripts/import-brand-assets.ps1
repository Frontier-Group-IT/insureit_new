param(
  [Parameter(Mandatory = $true)]
  [string]$PreparedCatalogZip
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$zipPath = (Resolve-Path $PreparedCatalogZip).Path
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("insureit-logo-catalog-" + [guid]::NewGuid().ToString("N"))

try {
  New-Item -ItemType Directory -Path $temp -Force | Out-Null
  Expand-Archive -LiteralPath $zipPath -DestinationPath $temp -Force

  $expected = @(
    'apps/web-portal/public/assets/insurers',
    'apps/web-portal/public/assets/vehicle-brands',
    'apps/mobile-app/assets/catalog/insurers',
    'apps/mobile-app/assets/catalog/vehicle-brands',
    'apps/partner-app/assets/catalog/insurers',
    'apps/partner-app/assets/catalog/vehicle-brands',
    'logo-catalog.json'
  )

  foreach ($item in $expected) {
    if (-not (Test-Path (Join-Path $temp $item))) {
      throw "Prepared catalog is missing required path: $item"
    }
  }

  $preserveWebInsurers = @(
    'bajaj-allianz.png',
    'hdfc-ergo.png',
    'icici-lombard.png',
    'iffco-tokio.png',
    'new-india-assurance.png',
    'oriental-insurance.png',
    'tata-aig.png'
  )

  $copySets = @(
    @{ Source = 'apps/web-portal/public/assets/insurers'; Destination = 'apps/web-portal/public/assets/insurers'; Preserve = $preserveWebInsurers },
    @{ Source = 'apps/web-portal/public/assets/vehicle-brands'; Destination = 'apps/web-portal/public/assets/vehicle-brands'; Preserve = @() },
    @{ Source = 'apps/mobile-app/assets/catalog/insurers'; Destination = 'apps/mobile-app/assets/catalog/insurers'; Preserve = @() },
    @{ Source = 'apps/mobile-app/assets/catalog/vehicle-brands'; Destination = 'apps/mobile-app/assets/catalog/vehicle-brands'; Preserve = @() },
    @{ Source = 'apps/partner-app/assets/catalog/insurers'; Destination = 'apps/partner-app/assets/catalog/insurers'; Preserve = @() },
    @{ Source = 'apps/partner-app/assets/catalog/vehicle-brands'; Destination = 'apps/partner-app/assets/catalog/vehicle-brands'; Preserve = @() }
  )

  foreach ($set in $copySets) {
    $sourceDir = Join-Path $temp $set.Source
    $destinationDir = Join-Path $repoRoot $set.Destination
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null

    Get-ChildItem -LiteralPath $sourceDir -File | ForEach-Object {
      $target = Join-Path $destinationDir $_.Name
      if ($set.Preserve -contains $_.Name -and (Test-Path $target)) {
        Write-Host "Preserving existing curated asset: $($set.Destination)/$($_.Name)"
      } else {
        Copy-Item -LiteralPath $_.FullName -Destination $target -Force
      }
    }
  }

  Copy-Item -LiteralPath (Join-Path $temp 'logo-catalog.json') -Destination (Join-Path $repoRoot 'docs/logo-catalog.json') -Force

  $pngs = Get-ChildItem -LiteralPath (Join-Path $repoRoot 'apps/mobile-app/assets/catalog') -Recurse -File -Filter *.png
  if ($pngs.Count -lt 88) {
    throw "Expected at least 88 mobile catalog PNGs after import; found $($pngs.Count)."
  }

  Write-Host ""
  Write-Host "INSUREIT logo catalog imported successfully."
  Write-Host "Review with: git status --short"
  Write-Host "No database or deployment changes were performed."
}
finally {
  if (Test-Path $temp) {
    Remove-Item -LiteralPath $temp -Recurse -Force
  }
}
