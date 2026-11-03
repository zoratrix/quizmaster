# Generates application icons: PNG (window icon) and ICO (Windows installer).
# Run: powershell -ExecutionPolicy Bypass -File scripts\make-icon.ps1
# ASCII only: this file must be readable by Windows PowerShell 5.1 on any machine.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force -Path (Join-Path $root 'src\renderer\public'), (Join-Path $root 'build') | Out-Null

function New-IconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap([int]$size, [int]$size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  # background: diagonal gradient violet -> cyan
  $rect = New-Object System.Drawing.Rectangle([int]0, [int]0, [int]$size, [int]$size)
  $c1 = [System.Drawing.Color]::FromArgb([int]255, [int]139, [int]123, [int]255)
  $c2 = [System.Drawing.Color]::FromArgb([int]255, [int]34, [int]168, [int]238)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, [single]55)
  $g.FillRectangle($brush, $rect)

  # soft darkening at the bottom
  $dark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb([int]45, [int]0, [int]0, [int]0))
  $g.FillRectangle($dark, [int]0, [int]($size * 0.62), [int]$size, [int]($size * 0.38))

  # white letter Q
  $fontPx = [single]($size * 0.7)
  $font = New-Object System.Drawing.Font('Segoe UI Black', $fontPx, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rectF = New-Object System.Drawing.RectangleF([single]0, [single](-$size * 0.03), [single]$size, [single]$size)
  $g.DrawString('Q', $font, $white, $rectF, $fmt)

  $g.Dispose()
  $font.Dispose()
  $white.Dispose()
  $brush.Dispose()
  $dark.Dispose()
  return $bmp
}

$png = New-IconBitmap 512
$png.Save((Join-Path $root 'src\renderer\public\icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$png.Dispose()

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$frames = @()
foreach ($s in $sizes) {
  $bmp = New-IconBitmap ([int]$s)
  $stream = New-Object System.IO.MemoryStream
  $bmp.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $frames += , $stream.ToArray()
  $bmp.Dispose()
  $stream.Dispose()
}

$ico = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($ico)
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = [int]$sizes[$i]
  $data = $frames[$i]
  $dim = if ($s -ge 256) { 0 } else { $s }
  $writer.Write([byte]$dim)
  $writer.Write([byte]$dim)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$data.Length)
  $writer.Write([UInt32]$offset)
  $offset += $data.Length
}
foreach ($data in $frames) { $writer.Write($data) }
$writer.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $root 'build\icon.ico'), $ico.ToArray())
$writer.Dispose()
$ico.Dispose()

Write-Output "OK: src\renderer\public\icon.png, build\icon.ico"
