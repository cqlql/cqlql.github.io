---
title: SSH 密钥管理
sort: 1
---

# SSH 密钥管理

## 密钥类型选择

日常优先选用 **Ed25519**，绝大多数场景比 RSA 更好。

| 密钥类型 | 公钥前缀 | 推荐程度 |
|---|---|---|
| Ed25519 | `ssh-ed25519` | 首选 |
| RSA | `ssh-rsa` | 兼容老旧设备 |
| ECDSA | `ecdsa-sha2-nistp256` | 较少使用 |

### Ed25519 vs RSA

| | Ed25519 | RSA |
|---|---|---|
| **密钥长度** | 很短，复制粘贴省心 | 超长字符串 |
| **签名速度** | 极快，服务端校验开销小 | 较慢 |
| **安全性** | 抗暴力破解强，无传统填充漏洞 | 依赖大数运算，历史漏洞较多 |
| **兼容性** | 现代系统全面支持 | 天花板级兼容，老旧设备通用 |
| **OpenSSH 态度** | 默认推荐算法 | 逐步边缘化 |

**选择建议**：

- 普通 Linux、K3s、云服务器、日常开发 → `ed25519`
- 老旧设备、老式交换机、NAS、古董系统 → `rsa`
- 可以同时准备两套密钥，ed25519 主力日常，rsa 兼容老旧机器

## 生成密钥对

### Ed25519（推荐）

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

### RSA（兼容老旧设备）

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

参数说明：
- `-t`：密钥类型
- `-b`：密钥长度（RSA 建议 4096 位）
- `-C`：注释，通常用邮箱标识

按提示选择保存路径（默认 `~/.ssh/id_ed25519` 或 `~/.ssh/id_rsa`）和设置密码短语（可选）。

## 将公钥添加到服务端

### 方法一：ssh-copy-id（推荐）

```bash
ssh-copy-id user@server_ip
```

会自动将默认公钥（`~/.ssh/id_ed25519.pub`）追加到服务端的 `~/.ssh/authorized_keys`。

指定端口和密钥：

```bash
ssh-copy-id -p 2222 -i ~/.ssh/id_ed25519.pub user@server_ip
```

### 方法二：手动复制

```bash
cat ~/.ssh/id_ed25519.pub | ssh user@server_ip "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### 方法三：直接 scp

```bash
scp ~/.ssh/id_ed25519.pub user@server_ip:~/
ssh user@server_ip "cat ~/id_ed25519.pub >> ~/.ssh/authorized_keys && rm ~/id_ed25519.pub"
```

## 服务端权限检查

确保权限正确，否则 SSH 会拒绝公钥认证：

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

## 验证

```bash
ssh user@server_ip
```

如果能免密登录，说明配置成功。

## 常见问题

- **仍然要求输入密码**：检查服务端 `/etc/ssh/sshd_config` 是否启用 `PubkeyAuthentication yes`，修改后需 `systemctl restart sshd`
- **Permission denied (publickey)**：检查 `~/.ssh` 和 `authorized_keys` 权限
- **Windows 下使用**：PowerShell 自带 `ssh-keygen` 和 `ssh-copy-id`（较新版本），或用 Git Bash
