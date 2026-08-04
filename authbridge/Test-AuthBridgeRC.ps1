param(
    [string]$RcNumber,
    [string]$Username = "test@insureit.in"
)

$ErrorActionPreference = "Stop"

function Get-FirstPayloadValue {
    param(
        [Parameter(Mandatory=$true)] $Object,
        [string[]] $CandidateKeys
    )

    if ($Object -is [string]) {
        return $Object.Trim('"')
    }

    foreach ($key in $CandidateKeys) {
        $prop = $Object.PSObject.Properties[$key]
        if ($null -ne $prop -and $null -ne $prop.Value -and "$($prop.Value)".Length -gt 0) {
            return "$($prop.Value)"
        }
    }

    throw "Could not find the expected encrypted value. Raw response: $($Object | ConvertTo-Json -Depth 20)"
}

if ([string]::IsNullOrWhiteSpace($RcNumber)) {
    $RcNumber = Read-Host "Enter a valid vehicle registration number"
}

$RcNumber = ($RcNumber -replace '\s','').ToUpperInvariant()

if ($RcNumber -notmatch '^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$') {
    Write-Warning "The registration number format looks unusual. The request will still be attempted."
}

$headers = @{
    username       = $Username
    "Content-Type" = "application/json"
}

$transactionId = "INSUREIT-RC-{0}-{1}" -f (Get-Date -Format "yyyyMMddHHmmss"), (Get-Random -Minimum 1000 -Maximum 9999)

$plainRequest = @{
    transID   = $transactionId
    docType   = 372
    docNumber = $RcNumber
}

Write-Host "`nStep 1/3: Encrypting request..." -ForegroundColor Cyan
$encryptResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "https://www.truthscreen.com/InstantSearch/encrypted_string" `
    -Headers $headers `
    -Body ($plainRequest | ConvertTo-Json -Compress) `
    -TimeoutSec 20

$encryptedRequest = Get-FirstPayloadValue `
    -Object $encryptResponse `
    -CandidateKeys @("requestData", "encryptedData", "data", "responseData", "result")

Write-Host "Step 2/3: Calling Detailed RC API..." -ForegroundColor Cyan
$apiResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "https://www.truthscreen.com/api/v2.2/utilitysearch" `
    -Headers $headers `
    -Body (@{ requestData = $encryptedRequest } | ConvertTo-Json -Compress) `
    -TimeoutSec 20

$encryptedResponse = Get-FirstPayloadValue `
    -Object $apiResponse `
    -CandidateKeys @("responseData", "encryptedData", "data", "requestData", "result")

Write-Host "Step 3/3: Decrypting response..." -ForegroundColor Cyan
$decryptResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "https://www.truthscreen.com/InstantSearch/decrypt_encrypted_string" `
    -Headers $headers `
    -Body (@{ responseData = $encryptedResponse } | ConvertTo-Json -Compress) `
    -TimeoutSec 20

$outputDirectory = Join-Path $PSScriptRoot "authbridge-test-output"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$outputFile = Join-Path $outputDirectory ("rc-response-{0}.json" -f $transactionId)

$decryptResponse | ConvertTo-Json -Depth 30 | Set-Content -Path $outputFile -Encoding UTF8

Write-Host "`nAPI test completed." -ForegroundColor Green
Write-Host "Transaction ID: $transactionId"
Write-Host "Saved response: $outputFile"
Write-Host "`nDecrypted response:`n"
$decryptResponse | ConvertTo-Json -Depth 30
