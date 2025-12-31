---
title: find 查找
---

查找 ssserver 文件(包括文件夹)

```
find / -name ssserver
```

## -prune 排除

排除路径 `-path /mnt -prune`

示例: 查找 mysql，/mnt 目录除外

```
sudo find / -path /mnt -prune , -name mysql
```

## 参考文档

[Linux 常用命令--文件（夹）查找之 find 命令](https://www.cnblogs.com/nerohwang/p/3502273.html)

http://c.biancheng.net/view/779.html
