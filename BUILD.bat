@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title QuizMaster — сборка установщика

echo ============================================
echo   QuizMaster — сборка установщика Windows
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Не найден Node.js. Сначала запустите INSTALL.bat.
  pause
  exit /b 1
)

if not exist "node_modules\electron-builder" (
  echo [ОШИБКА] Не установлены зависимости. Сначала запустите INSTALL.bat.
  pause
  exit /b 1
)

rem Кэши и временные файлы сборки держим внутри папки проекта:
rem так сборка не зависит от системных каталогов и прав пользователя.
set ELECTRON_CACHE=%CD%\.cache\electron
set ELECTRON_BUILDER_CACHE=%CD%\.cache\electron-builder
set TEMP=%CD%\.cache\tmp
set TMP=%CD%\.cache\tmp
if not exist ".cache\tmp" mkdir ".cache\tmp"
set CSC_IDENTITY_AUTO_DISCOVERY=false
set PATH=%CD%\node_modules\7zip-bin\win\x64;%PATH%

echo Собираю приложение...
call npm run build
if errorlevel 1 (
  echo.
  echo [ОШИБКА] Сборка не удалась. Смотрите сообщение выше.
  pause
  exit /b 1
)

echo.
echo Собираю установщик. При первом запуске скачиваются инструменты сборки
echo (нужен интернет, это может занять 5-10 минут)...
echo.
call npm run dist
if errorlevel 1 (
  echo.
  echo Первая попытка не удалась. Подготавливаю инструменты сборки и пробую ещё раз...
  call node scripts\prepare-build-tools.mjs
  call npm run dist
  if errorlevel 1 (
    echo.
    echo [ОШИБКА] Не удалось собрать установщик.
    echo Что можно сделать:
    echo   1. Проверьте интернет и свободное место на диске (нужно около 1,5 ГБ).
    echo   2. Удалите папку .cache и повторите BUILD.bat.
    echo   3. Если ошибка повторяется - смотрите docs\troubleshooting.md
    pause
    exit /b 1
  )
)

echo.
echo Создаю переносимую версию (ZIP без установки)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\make-portable.ps1"

echo.
echo ============================================
echo   Готово!
echo   Установщик:        release\QuizMaster-1.3.1-Setup.exe
echo   Портативная версия: release\QuizMaster-1.3.1-portable.zip
echo ============================================
echo.
if exist "release" start "" "%~dp0release"
pause
