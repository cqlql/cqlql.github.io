@echo off
REM ===== 进入脚本所在目录（也就是 Git 仓库根目录） =====
cd /d %~dp0

REM ===== 检查是否有变更 =====
git status --porcelain > _git_status.txt
for %%A in (_git_status.txt) do if %%~zA==0 exit /b 0
del _git_status.txt

REM ===== 提交并推送 =====
git add .
git commit -m "Docs auto-save %date% %time%"
git push
