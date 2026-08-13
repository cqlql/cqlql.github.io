---
title: powershell
sort: 20
---

## 后台运行

### 方式 1：Start-Job（关闭窗口会终止）

```sh
Start-Job -ScriptBlock { node ./app.js } -Name node-server

Get-Job
Stop-Job -Id 1
Remove-Job -Id 1
```

> 注意：关闭 PowerShell 窗口后任务会被终止。

### 方式 2：Start-Process（完全无界面，关闭窗口不终止）

```sh
Start-Process -WindowStyle Hidden -FilePath node ./app.js

# 返回进程对象并写入日志，便于关闭
Start-Process -WindowStyle Hidden -FilePath node ./app.js -PassThru -Wait -RedirectStandardOutput out.log | Out-File -FilePath ./process.log
```

## 不自动退出

用 cmd（或其他命令行程序）运行 pwsh 时，运行完不自动退出：

```sh
pwsh -NoExit
```

## 参考文档

- https://www.powershellgallery.com/
- https://learn.microsoft.com/powershell/
