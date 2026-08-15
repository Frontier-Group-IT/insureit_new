[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "config.local.json"),
    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Config file not found: $ConfigPath"
}
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$root = [IO.Path]::GetFullPath([string]$config.backupRoot)
if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    throw "Backup root not found: $root"
}

$now = [DateTime]::UtcNow
$allCutoff = $now.AddDays(-[double]$config.retention.allBackupsDays)
$dailyCutoff = $now.AddDays(-[double]$config.retention.dailyDays)
$weeklyCutoff = $now.AddDays(-7 * [double]$config.retention.weeklyWeeks)
$monthlyCutoff = $now.AddMonths(-[int]$config.retention.monthlyMonths)

$backups = @()
Get-ChildItem -LiteralPath $root -Directory | Where-Object { $_.Name -like "INSUREIT-*" } | ForEach-Object {
    $manifestPath = Join-Path $_.FullName "manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath)) { return }
    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        if ($manifest.status -ne "healthy") { return }
        $time = [DateTime]::Parse([string]$manifest.completedAtUtc).ToUniversalTime()
        $backups += [pscustomobject]@{
            Path = $_.FullName
            Name = $_.Name
            TimeUtc = $time
        }
    } catch {}
}

$backups = @($backups | Sort-Object TimeUtc -Descending)
$keep = New-Object 'System.Collections.Generic.HashSet[string]'

foreach ($b in $backups | Where-Object { $_.TimeUtc -ge $allCutoff }) {
    [void]$keep.Add($b.Path)
}

$dailyCandidates = $backups | Where-Object { $_.TimeUtc -lt $allCutoff -and $_.TimeUtc -ge $dailyCutoff }
$dailyCandidates | Group-Object { $_.TimeUtc.ToLocalTime().ToString("yyyy-MM-dd") } | ForEach-Object {
    $chosen = $_.Group | Sort-Object TimeUtc -Descending | Select-Object -First 1
    [void]$keep.Add($chosen.Path)
}

$weeklyCandidates = $backups | Where-Object { $_.TimeUtc -lt $dailyCutoff -and $_.TimeUtc -ge $weeklyCutoff }
$weeklyCandidates | Group-Object {
    $culture = [System.Globalization.CultureInfo]::InvariantCulture
    $cal = $culture.Calendar
    $week = $cal.GetWeekOfYear($_.TimeUtc, [System.Globalization.CalendarWeekRule]::FirstFourDayWeek, [DayOfWeek]::Monday)
    "{0}-W{1:00}" -f $_.TimeUtc.Year, $week
} | ForEach-Object {
    $chosen = $_.Group | Sort-Object TimeUtc -Descending | Select-Object -First 1
    [void]$keep.Add($chosen.Path)
}

$monthlyCandidates = $backups | Where-Object { $_.TimeUtc -lt $weeklyCutoff -and $_.TimeUtc -ge $monthlyCutoff }
$monthlyCandidates | Group-Object { $_.TimeUtc.ToString("yyyy-MM") } | ForEach-Object {
    $chosen = $_.Group | Sort-Object TimeUtc -Descending | Select-Object -First 1
    [void]$keep.Add($chosen.Path)
}

$delete = @($backups | Where-Object { -not $keep.Contains($_.Path) })

Write-Host ("Healthy backups found: {0}" -f $backups.Count)
Write-Host ("Backups retained:      {0}" -f $keep.Count)
Write-Host ("Backups eligible:      {0}" -f $delete.Count)

if ($delete.Count -eq 0) { return }

Write-Host ""
foreach ($item in $delete) {
    Write-Host ("{0}  {1}" -f $item.TimeUtc.ToLocalTime().ToString("yyyy-MM-dd HH:mm"), $item.Path)
}

if (-not $Apply) {
    Write-Host ""
    Write-Host "Dry run only. Nothing was deleted. Use -Apply after reviewing this list." -ForegroundColor Yellow
    return
}

Write-Host ""
foreach ($item in $delete) {
    Remove-Item -LiteralPath $item.Path -Recurse -Force
    Write-Host ("Deleted: {0}" -f $item.Path)
}
