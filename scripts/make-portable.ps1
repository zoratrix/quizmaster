# Creates a portable ZIP from the unpacked build: release\QuizMaster-<version>-portable.zip
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\make-portable.ps1
# ASCII only: must work in Windows PowerShell 5.1 without BOM.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'release\win-unpacked'
if (-not (Test-Path $src)) {
  Write-Output "win-unpacked not found - build the installer first (BUILD.bat)."
  exit 1
}

$pkg = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$dst = Join-Path $root ("release\QuizMaster-{0}-portable.zip" -f $pkg.version)
if (Test-Path $dst) { Remove-Item $dst -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($src, $dst, [System.IO.Compression.CompressionLevel]::Optimal, $true)
$size = [math]::Round((Get-Item $dst).Length / 1MB, 1)
Write-Output ("Portable archive ready: {0} ({1} MB)" -f $dst, $size)
