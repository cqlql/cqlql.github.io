## 先安装 wsl

1. 打开 [程序和功能] -> [启用和关闭 windows 功能]
   1. 勾选 [Hyper-V]。注意，`Windows 11 Home` 需使用命令方式安装，下面警告有详细方法。
   2. 勾选 [适用于 Linux 的 Windows 子系统]
   3. 现在就可以使用 `wsl -h` 命令了

   <!-- 2. 使用 `wsl --update` 命令更新 wsl，确保 wsl 是最新的 -->
2. 访问 `Microsoft Store` 来安装 `ubuntu`，这里我安装的是 `Ubuntu 22.04`
3. 安装成功后需打开 `Ubuntu 22.04` 应用，等待初始化成功。
4. 运行 `wsl -l -v` 检查 wsl 版本。如果版本是 1 需要使用 `wsl --set-version Ubuntu-22.04 2` 命令升级成 wsl2。如果无法升级成 wsl2 , 需 [安装 Linux 内核包](https://docs.microsoft.com/zh-cn/windows/wsl/install-manual#step-4---download-the-linux-kernel-update-package)


::: warning 如果是 Windows 11 Home ，需使用命令方式安装 HyperV

新建文本格式文件 HyperV.bat ，内容如下，然后以管理员运行即可

```cmd
pushd "%~dp0"
dir /b %SystemRoot%\servicing\Packages\*Hyper-V*.mum >hyper-v.txt
for /f %%i in ('findstr /i . hyper-v.txt 2^>nul') do dism /online /norestart /add-package:"%SystemRoot%\servicing\Packages\%%i"
del hyper-v.txt
Dism /online /enable-feature /featurename:Microsoft-Hyper-V -All /LimitAccess /ALL
pause
```

:::


## 安装 docker

去 [Docker 官网](https://www.docker.com/) 下载 docker 安装程序安装。安装过程推荐勾选[使用 wsl2]

## 常见问题

## 参考文档

[适用于 Linux 的 Windows 子系统文档](https://docs.microsoft.com/zh-cn/windows/wsl)

[如何在 Windows 11 Home 中启用 Hyper-V](https://zhuanlan.zhihu.com/p/558063980)
