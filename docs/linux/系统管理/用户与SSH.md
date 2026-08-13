---
title: 用户与 SSH
sort: 1
---

## root 用户切换

设置密码：

```sh
sudo passwd root
```

切换：

```bash
su root
```

## xshell 无法用 root 登录

1. 修改 `/etc/ssh/sshd_config`，把 `PermitRootLogin Prohibit-password` 注释掉；
2. 新增一行：`PermitRootLogin yes`；
3. 重启 ssh 服务：`/etc/init.d/ssh restart`（或 `systemctl restart ssh`）。
