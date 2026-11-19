@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo   Rebuilding skills guide...
echo.

node tools\build-guide.mjs --open
if errorlevel 1 (
  echo.
  echo   Build failed. Is Node.js installed?
  pause
  exit /b 1
)
