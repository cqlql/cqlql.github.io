# 启动器 `.cmd` 骨架与八个坑

## 1. 可复制骨架

把 `<工具名>` / `<exe>` / `<vendor>` / `<TOOL>` 换成项目常量。正文必须保持 ASCII，**CRLF 保存**。

```bat
@echo off
setlocal
title <工具名>
rem Go 输出 UTF-8；默认 GBK 控制台会乱码。本文件正文全是 ASCII，切代码页安全。
chcp 65001 >nul
cd /d "%~dp0"

set "EXE=%~dp0<exe>"
set "CFG=%APPDATA%\<vendor>\<tool>.env"
if defined <TOOL>_ENV set "CFG=%<TOOL>_ENV%"

rem ---- 0) 剥掉本文件自己的开关：一条一句，不要放进 ( ) 块 ----
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

rem ---- 1) 显式子命令优先（脚本化 / 向后兼容）----
set "FWD="
if defined PASS if not "%PASS:~0,1%"=="-" set "FWD=1"

rem ---- 2) 隐藏守护：不构建、不 init，直接跑 ui ----
if not defined BG goto ensure
if not exist "%EXE%" goto no_exe
goto run_ui

rem ---- 3) 缺 exe 才构建 ----
:ensure
if exist "%EXE%" goto env_check
set "FIRST=1"
set "GO="
set "GO_DIR="
where go >nul 2>nul
if not errorlevel 1 set "GO=go"
if not defined GO if exist "%USERPROFILE%\go\bin\go.exe" call :pick "%USERPROFILE%\go\bin"
if not defined GO if exist "%ProgramFiles%\Go\bin\go.exe" call :pick "%ProgramFiles%\Go\bin"
if not defined GO goto no_exe
echo [ops] go build -o <exe>
"%GO%" build -o "%EXE%" .
if errorlevel 1 goto build_failed
goto env_check

rem 记住工具链目录：业务命令可能 shell out 到它，只把 go.exe 路径存进 GO 不够。
:pick
set "GO=%~1\go.exe"
set "GO_DIR=%~1"
goto :eof

rem ---- 4) 首次写配置模板，绝不覆盖 ----
:env_check
if exist "%CFG%" goto dispatch
set "FIRST=1"
echo [ops] first run - writing %CFG%
"%EXE%" init
if errorlevel 1 goto init_failed

rem ---- 5) 分流 ----
:dispatch
if defined GO_DIR set "PATH=%GO_DIR%;%PATH%"
if defined FWD goto forward
if defined MENU goto run_menu
if defined FIRST goto run_ui
if defined FG goto run_ui
goto background

:background
echo [ops] starting the UI in the background (browser opens; stop it from the page)
"%EXE%" ui --background --launcher "%~f0" %PASS%
if not errorlevel 1 exit /b 0
echo [ops] background start FAILED - falling back to the foreground:
goto run_ui

:run_menu
"%EXE%" menu
set "RC=%errorlevel%"
goto done

:run_ui
"%EXE%" ui %PASS%
set "RC=%errorlevel%"
goto done

:forward
"%EXE%" %PASS%
set "RC=%errorlevel%"
goto done

:no_exe
echo [ops] cannot start: no exe and no toolchain found.
if not defined BG pause
exit /b 1

:build_failed
echo [ops] build FAILED.
if not defined BG pause
exit /b 1

:init_failed
echo [ops] init FAILED.
if not defined BG pause
exit /b 1

:done
if not "%RC%"=="0" (
  echo.
  echo [ops] exited with code %RC%
  if defined BG echo        (details: %APPDATA%\<vendor>\<tool>-ui.log)
  echo.
  if not defined BG pause
)
exit /b %RC%
```

## 2. 八个坑（都实测踩过）

| 坑 | 症状 | 对策 |
| :--- | :--- | :--- |
| 后台 `pause` 变隐形僵尸 | 进程永远不退出，任务管理器里一堆 cmd | 每个 `pause` 都包 `if not defined BG` |
| `set` 放进 `( )` 块 | 变量赋值「没生效」 | 一条一句；块内 `%VAR%` 在解析期展开 |
| `cmd /c` 剥引号 | 路径带空格就散架 | 整行走 `/s /c ""<launcher>" --bg ..."`，且必须用 `SysProcAttr.CmdLine` |
| 隐藏窗口 ≠ 无控制台 | 子进程写 stdout 失败 | `CREATE_NO_WINDOW (0x08000000)` 是「有控制台、没窗口」 |
| 中文横幅乱码 | 窗口里全是「鏈湴」 | 开头 `chcp 65001 >nul`；`.cmd` 正文保持 ASCII |
| `.cmd` 用 LF 保存 | 个别 Windows 上标签/续行解析异常 | **CRLF 保存**；注释用英文 |
| 每次双击都重新构建 | 双击后要等几秒 | 只在缺 exe 时构建 |
| 启动器内联业务参数 | 换台机器要改 `.cmd` | 参数只透传，业务参数走配置/清单 |

## 3. 首次运行的窗口行为

- 缺 exe 或缺配置 → 窗口保持可见，构建/写模板的报错人能看到；
- 日常 → 后台模式，前台几百毫秒退出；
- `--fg` → 始终前台，用于看 stdout；
- 后台拉起失败 → **回退前台**，不要静默退出。
