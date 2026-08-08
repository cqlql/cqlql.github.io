---
title: ps7 (PowerShell 7)
sort: 30
---

> PowerShell 7 与 Windows 内置的 PowerShell 5（即 `powershell.md`）通用命令一致，本文仅记录 PS7 特有用法。通用后台运行、不自动退出等见 `powershell.md`。

## 常用命令

### tree 命令

输出目录结构

```
tree /f
```

## 快捷方式命令

快捷方式 --> 属性 --> 目标：

```
"C:\Program Files\PowerShell\7\pwsh.exe" -Command cd D:\_work\mgmt-frontend-inner&&npm run dev
```