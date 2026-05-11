param(
  [switch]$Build,
  [switch]$NoBackup
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

$sourceApp = Join-Path $repoRoot "data\\serve\\app.js"
$distApp = Join-Path $repoRoot "dist\\win-unpacked\\resources\\data\\serve\\app.js"
$userApp = "C:\\Users\\Administrator\\AppData\\Roaming\\toonflow\\data\\serve\\app.js"

$sourceVendorDir = Join-Path $repoRoot "data\\vendor"
$distVendorDir = Join-Path $repoRoot "dist\\win-unpacked\\resources\\data\\vendor"
$userVendorDir = "C:\\Users\\Administrator\\AppData\\Roaming\\toonflow\\data\\vendor"

function Backup-File {
  param([string]$Path)
  if ($NoBackup) { return }
  if (Test-Path $Path) {
    Copy-Item -LiteralPath $Path -Destination ($Path + ".bak_" + $timestamp) -Force
  }
}

function Ensure-Parent {
  param([string]$Path)
  $parent = Split-Path -Parent $Path
  if (!(Test-Path $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
}

function Copy-WithBackup {
  param(
    [string]$Source,
    [string]$Target
  )
  Ensure-Parent -Path $Target
  Backup-File -Path $Target
  Copy-Item -LiteralPath $Source -Destination $Target -Force
}

if ($Build) {
  Push-Location $repoRoot
  try {
    npm run build
  } finally {
    Pop-Location
  }
}

if (!(Test-Path $sourceApp)) {
  throw "Source app build not found: $sourceApp"
}

Copy-WithBackup -Source $sourceApp -Target $distApp
Copy-WithBackup -Source $sourceApp -Target $userApp

$vendorFiles = Get-ChildItem -Path $sourceVendorDir -Filter *.ts -File
foreach ($vendorFile in $vendorFiles) {
  $distTarget = Join-Path $distVendorDir $vendorFile.Name
  $userTarget = Join-Path $userVendorDir $vendorFile.Name
  Copy-WithBackup -Source $vendorFile.FullName -Target $distTarget
  Copy-WithBackup -Source $vendorFile.FullName -Target $userTarget
}

Write-Output "Runtime sync completed."
Write-Output "App source : $sourceApp"
Write-Output "Dist target: $distApp"
Write-Output "User target: $userApp"
Write-Output ("Vendor files synced: " + $vendorFiles.Count)
