@echo off
setlocal
rem ============================================================================
rem  PassUp ops launcher -- double-click this file.
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
rem  Web assets are NOT in Git (only web/dist/.gitkeep), but the binary is the
rem  source of truth: if ops.exe already has a page embedded, NOTHING is built,
rem  even when web/dist was deleted by hand. On a fresh clone / NEW PC (exe has
rem  no page) this launcher builds ONCE, without any manual step:
rem    missing web/dist/index.html -> npm install + npm run build
rem    then                        -> go build -o ops.exe .
rem  Progress prints in this visible window; a failure stops here with a hint.
rem  Once built, every double-click goes straight to the hidden guardian.
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
title PassUp ops
cd /d "%~dp0"

set "OPS_EXE=%~dp0ops.exe"
set "OPS_ENV=%APPDATA%\pass-up\ops.env"
if defined PASS_UP_OPS_ENV set "OPS_ENV=%PASS_UP_OPS_ENV%"
set "NEED_GO="

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

rem ---- 3) frontend assets: THE BINARY is the source of truth ----------------
rem A CLI verb (help / servers list / ...) does not need web assets; it still
rem needs ops.exe, so it jumps straight to :ensure_exe.
rem
rem 🔴 Order matters: ask the EXE first. A hand-deleted web/dist does NOT mean
rem a rebuild is needed - the page is already embedded in the binary. Only when
rem the exe has NO page (fresh clone / copied old exe) do we touch npm/go build.
:ensure
if defined FWD goto ensure_exe
rem Keep web/dist present so a later `go build` still has an embed directory.
rem Directory + placeholder only; this is never a frontend rebuild.
if exist "%~dp0web\dist" goto check_binary
mkdir "%~dp0web\dist" 2>nul
if exist "%~dp0web\dist\.gitkeep" goto check_binary
echo # placeholder for go:embed all:web/dist > "%~dp0web\dist\.gitkeep"

:check_binary
if not exist "%OPS_EXE%" goto need_web
rem stdout dropped; stderr (the Chinese hint) stays visible in this window.
"%OPS_EXE%" __dist-check >nul
if not errorlevel 1 goto env_check
rem The exe has no page: real assets on disk are needed, then a fresh go build.
:need_web
if exist "%~dp0web\dist\index.html" goto need_go
goto build_web

:need_go
set "NEED_GO=1"
goto ensure_exe

:build_web
echo [ops] this ops.exe has no page inside - building the frontend once (may take a minute).
rem 🔴 Do NOT `call npm.cmd`: after `cd web`, cmd may resolve a project-local
rem shim whose %~dp0 points at web\node_modules\npm (broken on 2026-11-06,
rem "Cannot find module ...\npm\bin\npm-cli.js"). Call node.exe + npm-cli.js
rem by ABSOLUTE path instead - no PATH lookup, no npm-prefix probe.
set "NODE_DIR="
for /f "delims=" %%i in ('where node.exe 2^>nul') do if not defined NODE_DIR set "NODE_DIR=%%~dpi"
if not defined NODE_DIR goto no_npm
if not exist "%NODE_DIR%node_modules\npm\bin\npm-cli.js" goto no_npm
cd /d "%~dp0web"
rem Only install when the toolchain shim is absent. A pnpm-style node_modules
rem already has vite/tsc and npm install would rewrite its layout for nothing.
if exist "%~dp0web\node_modules\.bin\vite.cmd" goto npm_build
echo [ops] npm install
"%NODE_DIR%node.exe" "%NODE_DIR%node_modules\npm\bin\npm-cli.js" install
if errorlevel 1 goto web_failed

:npm_build
echo [ops] npm run build
"%NODE_DIR%node.exe" "%NODE_DIR%node_modules\npm\bin\npm-cli.js" run build
if not errorlevel 1 goto web_built
rem A half-written node_modules can still have the vite shim. Repair ONCE,
rem then retry - otherwise a broken install looks like a "npm is broken" error.
echo [ops] build failed - reinstalling dependencies once, then retrying
"%NODE_DIR%node.exe" "%NODE_DIR%node_modules\npm\bin\npm-cli.js" install
if errorlevel 1 goto web_failed
"%NODE_DIR%node.exe" "%NODE_DIR%node_modules\npm\bin\npm-cli.js" run build
if errorlevel 1 goto web_failed

:web_built
cd /d "%~dp0"
if not exist "%~dp0web\dist\index.html" goto web_failed
set "NEED_GO=1"
goto ensure_exe

:ensure_exe
if exist "%OPS_EXE%" if not defined NEED_GO goto env_check
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

:no_npm
echo [ops] Node.js / npm-cli.js not found: install Node.js, then double-click again.
echo        manual fallback: cd web ^&^& npm install ^&^& npm run build
if not defined BG pause
exit /b 1

:web_failed
cd /d "%~dp0"
echo [ops] frontend build FAILED - see the output above.
echo        manual fallback: cd web ^&^& npm install ^&^& npm run build
if not defined BG pause
exit /b 1

:no_exe
echo [ops] cannot build ops.exe: no Go toolchain found.
echo        install Go, or run once: go build -o ops.exe .
if not defined BG pause
exit /b 1

:build_failed
echo [ops] go build FAILED; no usable ops.exe.
echo        if the UI is already running, click "close UI" in the page first
echo        (Windows cannot overwrite a running exe), then double-click again.
if not defined BG pause
exit /b 1

rem ---- 4) first run: write the config template, never overwrite -------------
:env_check
if exist "%OPS_ENV%" goto dispatch
echo [ops] first run - writing %OPS_ENV%
"%OPS_EXE%" init
if errorlevel 1 goto init_failed
echo [ops] config template written; the page will guide you through the rest.

rem ---- 5) dispatch ---------------------------------------------------------
:dispatch
rem `ops deploy` shells out to `go build`, so a Go toolchain found only through
rem the fallback paths above must also be on PATH for that child process.
if defined GO_DIR set "PATH=%GO_DIR%;%PATH%"
if defined FWD goto forward
if defined MENU goto run_menu
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

rem NOTE: keep "(" and ")" out of the block below - an unescaped ")" closes
rem the IF block early and turns the pause into an unconditional one.
:done
if not "%RC%"=="0" (
  echo.
  echo [ops] ops exited with code %RC%
  if defined BG echo        details: %APPDATA%\pass-up\ops-ui.log
  echo.
  if not defined BG pause
)
exit /b %RC%
