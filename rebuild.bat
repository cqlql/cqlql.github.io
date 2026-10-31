@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo   Rebuilding study deck...
echo.

node tools\build.mjs
if errorlevel 1 (
  echo.
  echo   Build failed. Is Node.js installed?
  pause
  exit /b 1
)

timeout /t 1 >nul
start "" "dist\index.html"
