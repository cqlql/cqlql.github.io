---
title: apt 包管理
---

```sh
# 更新软件源头
apt update

# 显示可升级的软件包
apt list --upgradeable

# 显示已安装的软件包
apt list --installed

# 升级所有已安装软件
apt upgrade

# 安装指定软件 ( -f 修复依赖关系)
apt install -f mysql-server

# 删除已安装软件包
apt remove mysql-server

# 自动清理不再使用的依赖和库文件
apt autoremove

# 显示已安装软件包信息（版本号，安装大小，依赖关系，bug报告等等）
apt show mysql-server
```
