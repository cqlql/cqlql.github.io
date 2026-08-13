---
title: cmd
sort: 10
---

执行命令：

```
%SystemRoot%\System32\cmd.exe /k npm run dev
```

`/k` 表示即使执行完毕也不关闭 cmd（用 `/c` 则执行完关闭）。

其他参数说明请参考：[cmd](https://learn.microsoft.com/zh-cn/windows-server/administration/windows-commands/cmd)

---

## 补充：CMD 命令行杂记（旧笔记合并）

- [`@echo off` 实现输出不重复](#echo-off-实现输出不重复)
- [打开浏览器 并指定网址](#打开浏览器-并指定网址)
- [代理](#代理)
- [通过 cmd 调用 PowerShell 并执行命令](#通过-cmd-调用-powershell-并执行命令)
- [定时器](#定时器)
- [同时运行多个 cmd](#同时运行多个-cmd)
- [等待任意键输入退出](#等待任意键输入退出)

## `@echo off` 实现输出不重复

默认 bat 文件会回显每条命令本身，加上 `@echo off` 可关闭回显，只输出命令的结果：

```bat
@echo off
echo Hello
```

## 打开浏览器 并指定网址

```bat
explorer http://google.com
```

## 代理

这只是临时设置，关闭 cmd 窗口则失效。

一般只需：

```
set http_proxy=127.0.0.1:10086
```

带用户名密码的：

```
set http_proxy=http://proxy.com:port/
set http_proxy_user=username
set http_proxy_pass=password
```

## 通过 cmd 调用 PowerShell 并执行命令

```bat
start powershell "Start-Process node bin/www -Verb runas; explorer http://localhost:3003"
```

## 定时器

cmd 没有内置定时器，可用 `ping` 无法实现 ping 通的地址来等待：

```bat
echo 60秒后执行
ping 1.1.1.1 -n 1 -w 60000 > nul
```

> 1.1.1.1 多数情况 ping 不通，但存在例外，严谨场景慎用。

## 同时运行多个 cmd

关于双引号：

- 加双引号：引号内命令完全在新弹出的窗口执行。
- 不加双引号：`&` 后面的命令在当前窗口执行，而非新弹出窗口。

其中 `/k` 表示运行结束不关闭，可改成 `/c` 运行结束关闭。如果不加 `start` 只能执行第一个。

```bat
start cmd /k "cd /d D:\&echo xx&&pause&&ping 172.30.218.1&&ping 172.30.218.111"
start cmd /k "cd /d D:\&echo xxx&&pause&&ping 192.168.91.1"
```

`package.json` 中应用：

```json
{
  "name": "project",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "start cmd /k \"npm run build.ios\"&&npm run build.android",
    "build.dev": "start cmd /k \"npm run build.dev.ios\"&&npm run build.dev.android"
  }
}
```

## 等待任意键输入退出

```bat
pause > nul
exit
```
