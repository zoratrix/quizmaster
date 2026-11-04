# Проверка установщика QuizMaster на этом компьютере (Windows PowerShell 5.1).
# Запуск: powershell -NoProfile -ExecutionPolicy Bypass -File tests\e2e\install-check.ps1
# Скрипт проводит мастер установки кнопками через UI Automation, проверяет установку,
# запускает приложение и затем удаляет его через штатный деинсталлятор.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$installer = Join-Path $root 'release\QuizMaster-1.3.2-Setup.exe'
$artifacts = Join-Path $root 'tests\e2e\artifacts'
$target = Join-Path $env:LOCALAPPDATA 'Programs\QuizMaster'
$exe = Join-Path $target 'QuizMaster.exe'
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null

if (-not (Test-Path $installer)) { throw "Не найден установщик: $installer" }

$tmp = Join-Path $root '.cache\tmp'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$env:TEMP = $tmp
$env:TMP = $tmp

function Get-Window([int]$processId) {
  $rootElement = [System.Windows.Automation.AutomationElement]::RootElement
  for ($i = 0; $i -lt 60; $i++) {
    $cond = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ProcessIdProperty, $processId)
    $win = $rootElement.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
    if ($win) { return $win }
    Start-Sleep -Milliseconds 300
  }
  throw 'Окно установщика не появилось'
}

function Find-Button($window, [string]$text) {
  $cond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Button)
  $buttons = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
  foreach ($button in $buttons) {
    $name = $button.Current.Name
    if ($name -and $name.Contains($text)) { return $button }
  }
  return $null
}

function Invoke-Button($window, [string]$text) {
  $button = Find-Button $window $text
  if (-not $button) { throw "Не найдена кнопка «$text»" }
  $pattern = $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
  $pattern.Invoke()
  Start-Sleep -Milliseconds 900
}

function Save-Shot([string]$name) {
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
  $bitmap.Save((Join-Path $artifacts $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output 'Запускаю установщик…'
$process = Start-Process -FilePath $installer -PassThru
$window = Get-Window $process.Id
Start-Sleep -Milliseconds 700
Save-Shot '30-install-mode-page.png'

Write-Output 'Шаг 1: режим установки → Далее'
Invoke-Button $window 'Далее'
Save-Shot '31-install-dir-page.png'

Write-Output 'Шаг 2: папка установки → Установить'
Invoke-Button $window 'Установить'

# Ждём окончания установки
$deadline = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 700
  if (Test-Path $exe) { break }
  $process.Refresh()
  if ($process.HasExited) { break }
}
Start-Sleep -Seconds 1
Save-Shot '32-install-finish.png'

$installed = Test-Path $exe
Write-Output "Установлено в $target : $installed"
if (-not $installed) {
  Write-Output 'ОШИБКА: файл приложения не появился'
  $process.Refresh()
  if (-not $process.HasExited) { $process.Kill() }
  exit 1
}

# Завершаем мастер, если он ещё открыт
try {
  $window = Get-Window $process.Id
  Invoke-Button $window 'Завершить'
} catch {
  Write-Output 'Мастер уже закрыт'
}

# Проверяем, что установленное приложение запускается
Write-Output 'Запускаю установленное приложение…'
$env:QM_NO_SANDBOX = '1'
$appProcess = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 8
$appProcess.Refresh()
$running = -not $appProcess.HasExited
Write-Output "Приложение запущено: $running"
if (-not $running) { exit 1 }
$appProcess.CloseMainWindow() | Out-Null
Start-Sleep -Seconds 2
if (-not $appProcess.HasExited) { $appProcess.Kill() }

# Удаляем приложение штатным деинсталлятором
$uninstaller = Join-Path $target 'Uninstall QuizMaster.exe'
if (Test-Path $uninstaller) {
  Write-Output 'Удаляю приложение через деинсталлятор…'
  $uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList '/S' -PassThru -Wait
  Start-Sleep -Seconds 3
  $stillThere = Test-Path $exe
  Write-Output "После удаления файл приложения остался: $stillThere"
} else {
  Write-Output 'Деинсталлятор не найден (проверьте вручную)'
}

Write-Output 'Проверка установки завершена.'
