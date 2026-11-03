@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title QuizMaster — режим разработки

echo ============================================
echo   QuizMaster — режим разработки
echo   (изменения интерфейса применяются сразу)
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Не найден Node.js. Запустите INSTALL.bat.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Сначала устанавливаю зависимости...
  call "%~dp0INSTALL.bat"
  if errorlevel 1 exit /b 1
)

echo Запускаю в режиме разработки. Закройте окно приложения для выхода.
echo.
call npm run dev
pause
