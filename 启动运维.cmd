@echo off
setlocal
rem ============================================================================
rem  Pass-up ops launcher -- double-click this file.
rem
rem  No args   -> interactive menu (ops menu). The menu is READ-ONLY by default:
rem               deploy needs a dry-run plus an explicit "yes".
rem  With args -> forwarded to ops.exe unchanged (scripting / future web UI).
rem  --fg      -> keep the window (the menu already needs it); stripped before use
rem  --bg      -> strip every pause; hidden background supervision belongs to the
rem               P2 web UI mode, the interactive menu always needs a window
rem
rem  This launcher only ever runs the LOCAL binary. It never touches a server.
rem  Desktop shortcut (icon included): ops.exe shortcut
rem  Config lives outside the repo: %APPDATA%\pass-up\ops.env
rem ============================================================================
title Pass-up ops
cd /d "%~dp0"

set "OPS_EXE=%~dp0ops.exe"
set "OPS_ENV=%APPDATA%\pass-up\ops.env"
if defined PASS_UP_OPS_ENV set "OPS_ENV=%PASS_UP_OPS_ENV%"

rem ---- 0) strip the two switches that belong to this file only ---------------
rem One statement per line, never inside a ( ) block: %PASS% would expand at
rem parse time and the assignment would be invisible to the next lines.
set "PASS=%*"
if /i "%~1"=="--bg" set "BG=1"
if /i "%~1"=="--fg" set "FG=1"
if defined BG set "PASS=%PASS:--bg =%"
if defined BG if /i "%PASS%"=="--bg" set "PASS="
if defined FG set "PASS=%PASS:--fg =%"
if defined FG if /i "%PASS%"=="--fg" set "PASS="

rem ---- 1) first run: find Go, then build ops.exe ----------------------------
if exist "%OPS_EXE%" goto env_check
set "GO="
set "GO_DIR="
where go >nul 2>nul
if not errorlevel 1 set "GO=go"
if not defined GO if exist "%USERPROFILE%\go\bin\go.exe" call :pick "%USERPROFILE%\go\bin"
if not defined GO if exist "%ProgramFiles%\Go\bin\go.exe" call :pick "%ProgramFiles%\Go\bin"
if not defined GO goto no_exe
echo [ops] go build -o ops.exe .
"%GO%" build -o "%OPS_EXE%" .
if errorlevel 1 goto build_failed
goto env_check

:pick
set "GO=%~1\go.exe"
set "GO_DIR=%~1"
goto :eof

:no_exe
echo [ops] cannot start: no ops.exe and no Go toolchain found.
echo        install Go, or run once: go build -o ops.exe .
if not defined BG pause
exit /b 1

:build_failed
echo [ops] go build FAILED; no usable ops.exe.
if not defined BG pause
exit /b 1

rem ---- 2) first run: write the config template, never overwrite -------------
:env_check
if exist "%OPS_ENV%" goto run
echo [ops] first run - writing %OPS_ENV%
"%OPS_EXE%" init
if errorlevel 1 goto init_failed

rem ---- 3) run: no args -> menu, args -> forwarded ---------------------------
:run
if defined GO_DIR set "PATH=%GO_DIR%;%PATH%"
if defined PASS goto forward
"%OPS_EXE%" menu
set "RC=%errorlevel%"
goto done

:forward
"%OPS_EXE%" %PASS%
set "RC=%errorlevel%"
goto done

:init_failed
echo [ops] ops init FAILED; fix the config directory and try again.
if not defined BG pause
exit /b 1

:done
if not "%RC%"=="0" (
  echo.
  echo [ops] ops exited with code %RC%
  echo.
  if not defined BG pause
)
exit /b %RC%
