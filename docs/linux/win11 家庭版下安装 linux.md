

::: warning

以下两种方式都需要 [安装 Hyper-V](https://zhuanlan.zhihu.com/p/74906615)

:::

## 方式1：通过 VM 虚拟机软件安装

此方式模拟真实硬件设备，最为保险的方式


## 方式2：直接安装 linux 子系统 WSLG(WSL2) - 命令方式

```sh
#设置WSL的版本为WSL2
wsl --set-default-version 2

# 更新 wsl，确保 wsl 是最新的
wsl --update
# 安装wslg
wsl --install

# 列出可安装的linux版本
wsl --list --online

# 开始安装
wsl --install -d Ubuntu-20.04
```

### 重置 - 图形化操作

进入 win11 `设置`，依次进入 `应用 -> 应用和功能`，找到 `Ubuntu 应用`，进入`应用属性`，点击`重置按钮`进行重置

### 参考文档

[win11 家庭版 linux 子系统安装](https://www.cnblogs.com/guojikun/p/15092696.html)
