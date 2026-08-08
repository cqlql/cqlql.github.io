

---
title: ps7 (PowerShell 7)
sort: 30
---

## 常用命令

### tree 命令

输出目录结构

```
tree /f
```

## 后台运行

### 方式 1：关掉 pwsh 会终止

有管理

但是关掉 PowerShell 窗口还是会终止运行

```shell
Start-Job -ScriptBlock { node ./app.js } -Name node-server

Get-Job

Stop-Job -id 1

Remove-Job -id 1
```

### 方式 2：成功

完全没有界面的运行

```shell
Start-Process -WindowStyle Hidden -FilePath node ./app.js

# 返回进程Id，方便关闭
# 进程对象详细输出到 process.log 文件下
cd /d D:\_work\lmm-admin-ui\projects\apidocs\sever&&start pwsh -c "Start-Process -WindowStyle Hidden -FilePath node ./app.js -PassThru -Wait -RedirectStandardOutput out.log|out-file -filepath ./process.log"
```

## 不自动退出

用 cmd(或者其他命令行程序)运行 pwsh 时，运行完不自动退出

```shell
pwsh -noexit
```

## 快捷方式命令

快捷方式 --> 属性 --> 目标：

```
"C:\Program Files\PowerShell\7\pwsh.exe" -Command cd D:\_work\mgmt-frontend-inner&&npm run dev
```