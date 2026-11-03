@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title QuizMaster — запуск

echo ============================================
echo   QuizMaster — запуск приложения
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Не найден Node.js.
  echo Установите Node.js LTS с https://nodejs.org и запустите этот файл снова.
  echo Подробная инструкция: docs\BUILD_GUIDE.md
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Первый запуск: устанавливаю зависимости. Это займет несколько минут...
  echo.
  call "%~dp0INSTALL.bat"
  if errorlevel 1 (
    echo.
    echo [ОШИБКА] Не удалось установить зависимости. Смотрите сообщение выше.
    pause
    exit /b 1
  )
)

echo Собираю приложение...
call npm run build
if errorlevel 1 (
  echo.
  echo [ОШИБКА] Сборка не удалась. Смотрите сообщение выше.
  echo Частые причины: не установлен Node.js, повреждена папка node_modules.
  echo Решение: удалите папку node_modules и запустите INSTALL.bat заново.
  pause
  exit /b 1
)

echo.
echo Запускаю QuizMaster...
echo (это окно можно свернуть, но не закрывайте его во время игры)
echo.
"%~dp0node_modules\electron\dist\electron.exe" .
echo.
echo QuizMaster закрыт.
pause
