@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title QuizMaster — установка зависимостей

echo ============================================
echo   QuizMaster — проверка окружения и установка
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Node.js не найден.
  echo.
  echo 1. Откройте https://nodejs.org
  echo 2. Скачайте версию LTS (кнопка "LTS")
  echo 3. Установите её, нажимая "Далее" (ничего менять не нужно)
  echo 4. Перезапустите этот файл
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo Node.js: %NODE_VERSION%
where npm >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] npm не найден. Переустановите Node.js.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('npm -v') do set NPM_VERSION=%%v
echo npm: %NPM_VERSION%
echo.

if not exist "package.json" (
  echo [ОШИБКА] В этой папке нет проекта QuizMaster.
  echo Убедитесь, что вы запускаете файл из папки проекта.
  pause
  exit /b 1
)

echo Кэши Electron и npm храним внутри папки проекта (.cache),
echo чтобы ничего не оставалось в системных каталогах.
set ELECTRON_CACHE=%CD%\.cache\electron
set ELECTRON_BUILDER_CACHE=%CD%\.cache\electron-builder
if not exist ".cache" mkdir ".cache"

echo.
echo Устанавливаю зависимости (интернет нужен только сейчас)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo [ОШИБКА] npm install завершился с ошибкой.
  echo Что попробовать:
  echo   1. Проверьте интернет.
  echo   2. Удалите папку node_modules и запустите INSTALL.bat снова.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo Скачиваю программу запуска окон Electron...
  set ELECTRON_CACHE=%CD%\.cache\electron
  call node node_modules\electron\install.js
  if errorlevel 1 (
    echo.
    echo [ОШИБКА] Не удалось скачать Electron. Проверьте интернет и повторите.
    pause
    exit /b 1
  )
)

echo.
echo ============================================
echo   Готово! Зависимости установлены.
echo   Теперь запускайте START.bat
echo ============================================
echo.
pause
