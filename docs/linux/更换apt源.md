---
title: 更换apt源
---

源位置：`/etc/apt/sources.list`, 更换前备份。备份命令：

```sh
cp /etc/apt/sources.list /etc/apt/sources.list.bak
```

**国内源镜像源地址**

阿里云： https://mirrors.aliyun.com 

网易源： http://mirrors.163.com

清华： https://mirrors.tuna.tsinghua.edu.cn

中科大：(这里我使用) http://mirrors.ustc.edu.cn

ping 以上服务器，选择延时最低的。(ping 的时候去掉 `http://` )

**检查源**

检查以上源地址，对比原始 `/etc/apt/sources.list` ，看有没有对应的目录。比如 `sources.list` 中的 `deb http://cn.archive.ubuntu.com/ubuntu/ focal-updates main restricted` 行，对应的清华源地址是 `https://mirrors.tuna.tsinghua.edu.cn/ubuntu/dists/focal-updates`。一般只要检查 dists 中有没对应的 focal 即可(我这里的 ubuntu 是 focal)

**换源**

```sh
## 更换为中科大镜像源 #####
# 这里我使用中科大，我这边延时较低，而且很稳定
# 替换 cn.archive.ubuntu.com
sudo sed -i 's/archive.ubuntu.com/mirrors.ustc.edu.cn/g' sources.list
# 替换 security.ubuntu.com
sudo sed -i 's/security.ubuntu.com/mirrors.ustc.edu.cn/g' sources.list

## 或者更换为清华源 #####
sudo sed -i 's/http:\/\/archive.ubuntu.com/https:\/\/mirrors.tuna.tsinghua.edu.cn/g' sources.list
sudo sed -i 's/http:\/\/security.ubuntu.com/https:\/\/mirrors.tuna.tsinghua.edu.cn/g' sources.list

## ！最后执行命令
apt update
```

## 参考文档

[Ubuntu | 对 sources.list 的总结](https://www.jianshu.com/p/5400722c369c)

[ubuntu16.04 和 18.04 更换国内源](https://blog.csdn.net/u012308586/article/details/102953882)
