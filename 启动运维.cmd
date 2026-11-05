@echo off
setlocal
rem ============================================================================
rem  Pass-up ops launcher -- double-click this file.
rem
rem  No args  -> start the WEB UI in the background: a HIDDEN cmd keeps
rem              `ops ui` alive, the browser opens with a fresh token, and this
rem              window disappears right away. Double-clicking again does NOT
rem              start a second process - it just points the browser at the
rem              instance that is already running.
rem              To stop: click "close UI" in the page.
rem  --fg     -> keep this window and run `ops ui` in the foreground (stdout).
rem  --menu   -> the interactive menu. READ-ONLY by default: installing needs a
rem              dry-run plus an explicit "yes".
rem  <verb>   -> forwarded to ops.exe unchanged (help / servers list / ...).
rem  --port N / --no-open -> forwarded to `ops ui`.
rem  --bg     -> INTERNAL: the hidden guardian. Stripped before use.
rem
rem  First run (no ops.exe, or no ops.env) keeps a visible window so the build
rem  and the config template can be seen, then runs the UI in the foreground.
rem  The page itself explains how to fill servers.json if it is still empty.
rem  From the next double-click on, it goes straight to the background.
rem
rem  Background stdout/stderr: %APPDATA%\pass-up\ops-ui.log (rotated)
rem  Config lives OUTSIDE the repo: %APPDATA%\pass-up\ops.env
rem  Desktop shortcut (icon included): ops.exe shortcut
rem
rem  This launcher only ever runs the LOCAL binary. It never touches a server.
rem ============================================================================
rem Go prints UTF-8; the default Windows console codepage (936) shows it as
rem mojibake. All comments and echoes in this file are ASCII, so switching the
rem codepage here is safe for the batch parser itself.
chcp 65001 >nul
title Pass-up ops
cd /d "%~dp0"

set "OPS_EXE=%~dp0ops.exe"
set "OPS_ENV=%APPDATA%\pass-up\ops.env"
if defined PASS_UP_OPS_ENV set "OPS_ENV=%PASS_UP_OPS_ENV%"

rem ---- 0) strip the switches that belong to this file only -------------------
rem One statement per line, never inside a ( ) block: %PASS% would expand at
rem parse time and the assignment would be invisible to the next lines.
set "PASS=%*"
if /i "%~1"=="--bg" set "BG=1"
if /i "%~1"=="--fg" set "FG=1"
if /i "%~1"=="--menu" set "MENU=1"
if defined BG set "PASS=%PASS:--bg =%"
if defined BG if /i "%PASS%"=="--bg" set "PASS="
if defined FG set "PASS=%PASS:--fg =%"
if defined FG if /i "%PASS%"=="--fg" set "PASS="
if defined MENU set "PASS=%PASS:--menu =%"
if defined MENU if /i "%PASS%"=="--menu" set "PASS="

rem ---- 1) an explicit verb wins (scripting / backwards compatibility) --------
rem `启动运维.cmd --fg help` must still mean `ops.exe help`, not `ops ui help`.
set "FWD="
if defined PASS if not "%PASS:~0,1%"=="-" set "FWD=1"

rem ---- 2) the hidden guardian: no build, no init, just `ops ui` --------------
rem It is spawned by `ops ui --background` through a HIDDEN cmd. Any `pause`
rem here would hang forever as an invisible zombie, so every pause below is
rem wrapped in `if not defined BG`.
if not defined BG goto ensure
if not exist "%OPS_EXE%" goto no_exe
goto run_ui

rem ---- 3) find Go, then build ops.exe (only when missing) --------------------
:ensure
if exist "%OPS_EXE%" goto env_check
set "FIRST=1"
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

rem ---- 4) first run: write the config template, never overwrite -------------
:env_check
if exist "%OPS_ENV%" goto dispatch
set "FIRST=1"
echo [ops] first run - writing %OPS_ENV%
"%OPS_EXE%" init
if errorlevel 1 goto init_failed
echo [ops] next: fill servers.json (docs/servers.md section 3).
echo        the page will show a step-by-step hint until it can be read.

rem ---- 5) dispatch ---------------------------------------------------------
:dispatch
rem `ops deploy` shells out to `go build`, so a Go toolchain found only through
rem the fallback paths above must also be on PATH for that child process.
if defined GO_DIR set "PATH=%GO_DIR%;%PATH%"
if defined FWD goto forward
if defined MENU goto run_menu
if defined FIRST goto run_ui
if defined FG goto run_ui
goto background

rem ---- 6) everyday use: hand it to --background ----------------------------
:background
echo [ops] starting the UI in the background (browser opens; stop it from the page)
"%OPS_EXE%" ui --background --launcher "%~f0" %PASS%
if not errorlevel 1 exit /b 0
echo.
echo [ops] background start FAILED - falling back to the foreground:
echo.
goto run_ui

:run_menu
"%OPS_EXE%" menu
set "RC=%errorlevel%"
goto done

:run_ui
"%OPS_EXE%" ui %PASS%
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
  if defined BG echo        (details: %APPDATA%\pass-up\ops-ui.log)
  echo.
  if not defined BG pause
)
exit /b %RC%
