@echo off
setlocal enabledelayedexpansion

REM ===== 进入脚本所在目录（Git 仓库根目录） =====
cd /d %~dp0

REM ===== 检查是否有变更 =====
for /f "delims=" %%i in ('git status --porcelain') do (
    set HAS_CHANGES=1
    goto :changed
)

REM 无变更，直接退出
exit /b 0

:changed

REM ===== 提交并推送 =====
git add .
git commit -m "docs: auto save %date% %time%"
git push
