- [`@echo off` 实现输出不重复](#echo-off-实现输出不重复)
- [打开浏览器 并指定网址](#打开浏览器-并指定网址)
- [代理](#代理)
- [通过 cmd 调用 PowerShell 并执行命令](#通过-cmd-调用-powershell-并执行命令)
- [定时器](#定时器)
- [同时运行多个 cmd，并执行命令运行](#同时运行多个-cmd并执行命令运行)
- [等待任意键输入退出](#等待任意键输入退出)

## `@echo off` 实现输出不重复

## 打开浏览器 并指定网址

explorer http://google.com

## 代理

这只是临时设置，关闭 cmd 窗口则失效

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

start powershell "Start-Process node "bin/www" -Verb runas;explorer http://localhost:3003"

## 定时器

cmd 并没有提供定时器方法，但还是有办法实现

使用 ping：用一个没法 ping 通的 ip，并设置最大等待时间

```cmd
echo 60秒后执行
ping 1.1.1.1 -n 1 -w 60000 > nul
```

1.1.1.1 绝大多数情况是 ping 不同的，但也有例外。一些比较严谨的情况谨慎使用

## 同时运行多个 cmd，并执行命令运行

关于双引号可有可没有，但意义不一样：

- 双引号可让命令完全为新弹出的命令
- 不用双引号，&后面的命令为当前窗口，非新弹出的窗口

其中 /k 表示运行结束不关闭，可改成 /c 运行结束关闭  
如果不加 start 将只能执行第一个

```
start cmd /k "cd/d d:\&echo xx&&pause&&ping 172.30.218.1&&ping 172.30.218.111"
start cmd /k "cd/d d:\&echo xxx&&pause&&ping 192.168.91.1"
```

pageage.json 应用

```
{
  "name": "project",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "start cmd /k \"npm run build.ios\"&&npm run build.android",
    "build.dev": "start cmd /k \"npm run build.dev.ios\"&&npm run build.dev.android",
  }
}

```

## 等待任意键输入退出

```cmd
pause>nul
exit
```
