---
title: pg_dump 安装指南
icon: mdi:package-variant-closed
sort: 3
---

# pg_dump 安装指南

`pg_dump` 是 PostgreSQL 自带的逻辑备份工具，但它**不随数据库服务端默认安装到宿主机**——尤其在 Docker 部署下，宿主机往往没有 `pg_dump` 命令。本文梳理各环境下的安装方式。

> 核心结论：`pg_dump` / `pg_restore` / `psql` 等客户端工具统一由 **`postgresql-client`** 包提供，安装它即可，无需安装完整服务端。

---

## 0. 关键认知：客户端 vs 服务端

| 包 | 内容 | 是否包含 `pg_dump` |
| --- | --- | --- |
| `postgresql-client`（或 `postgresqlXX-client`） | 仅客户端：`psql` / `pg_dump` / `pg_restore` / `pg_dumpall` / `createdb` 等 | ✅ |
| `postgresql`（完整服务端） | 服务端 + 客户端 | ✅（附带客户端工具） |

**只在宿主机做备份/恢复** → 装 `postgresql-client` 即可，轻量、无守护进程。

---

## 1. Linux（Debian / Ubuntu）

### 1.1 默认仓库安装

Debian/Ubuntu 默认仓库自带 `postgresql-client`，但版本通常较旧。**注意**：客户端版本应 **≥ 服务端版本**（低版本客户端连高版本服务端会报 `unsupported version`，如 PG 17 服务端需 `postgresql-client-17`）。

```bash
# 安装默认版本（可能偏旧）
sudo apt update
sudo apt install -y postgresql-client

# 验证
pg_dump --version
```

### 1.2 安装指定版本（PGD 官方仓库，推荐 ⭐）

需要与服务端版本精确匹配时，用 PostgreSQL 官方 APT 仓库（PGDG）。官方安装教程见 [PostgreSQL 官方 - Debian/Ubuntu](https://www.postgresql.org/download/linux/debian/)。

```bash
# 1. 添加 PGDG 官方仓库（以 PG 17 为例）
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# 2. 更新并安装指定版本客户端
sudo apt update
sudo apt install -y postgresql-client-17

# 3. 验证
pg_dump --version
# pg_dump (PostgreSQL) 17.x
```

> 版本对照：PG 16 → `postgresql-client-16`，PG 17 → `postgresql-client-17`，依此类推。

---

## 2. Linux（RHEL / CentOS / Rocky / Alma）

官方安装教程见 [PostgreSQL 官方 - RHEL/CentOS](https://www.postgresql.org/download/linux/redhat/)。

```bash
# 1. 安装 PostgreSQL 官方 YUM 仓库（以 PG 17 为例）
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# 2. 默认仓库自带的 postgresql 模块需先禁用，避免版本冲突
sudo dnf -qy module disable postgresql

# 3. 安装客户端
sudo dnf install -y postgresql17

# 4. 验证
pg_dump --version
```

> RHEL 8 / CentOS 8 用 `dnf`；老版本 CentOS 7 用 `yum`，命令一致。EL-8 对应仓库 URL 为 `EL-8-x86_64`。

---

## 3. Linux（Arch / Manjaro）

```bash
sudo pacman -S postgresql-client

# 或安装完整服务端（含客户端）
sudo pacman -S postgresql
```

---

## 4. Linux（Alpine）

Alpine 的客户端包名为 `postgresql-client`：

```sh
apk add --no-cache postgresql-client
```

---

## 5. macOS（Homebrew）

```bash
# 安装最新版客户端
brew install libpq

# libpq 安装到 keg-only 路径，需手动加入 PATH
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 验证
pg_dump --version
```

> 需要旧版本（如 PG 16）时：`brew install postgresql@16`，其 bin 目录下含 `pg_dump`。

---

## 6. Docker 环境（无需宿主机安装 ⭐）

Docker 部署下**根本无需在宿主机安装 `pg_dump`**，直接利用运行中的 PG 容器内已内置的工具：

```bash
# 备份
docker exec postgres-prod pg_dump -U postgres -d mydb -F c -Z 9 -b > backup.dump

# 恢复
docker exec -i postgres-prod pg_restore -U postgres -d mydb < backup.dump
```

> 完整实操见：[pg_dump 单机 Docker 实操指南](./pg_dump单机docker实操指南.md)。

---

## 7. Windows

Windows 下通常通过 [EDB PostgreSQL 安装器](https://www.enterprisedb.com/downloads/postgresql-postgresql) 安装，勾选 **Command Line Tools**（命令行工具）组件即可获得 `pg_dump.exe`。

安装后：

```powershell
# 加入 PATH（默认安装目录）
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"

# 验证
pg_dump --version
```

---

## 8. 安装后验证清单

```bash
# 1. 版本信息
pg_dump --version

# 2. 连接测试（成功会提示输入密码或直接列出表）
pg_dump -U postgres -h 127.0.0.1 -d postgres --schema-only | head -n 20

# 3. 其余客户端工具是否就位
which psql pg_dump pg_restore pg_dumpall createdb
```

---

## 9. 常见问题

1. **`unsupported version (server vs client)` / `pg_dump: error: server version`**
   客户端版本低于服务端版本。解决办法：升级客户端到 ≥ 服务端版本（见 §1.2 安装指定版本）。反向（客户端版本更高）通常可以正常工作。

2. **Docker 宿主机执行 `pg_dump` 报 `command not found`**
   宿主机未装客户端。两种选择：① 用 `docker exec` 走容器内工具（§6）；② 在宿主机安装 `postgresql-client`（§1）。

3. **连接时卡住或超时**
   检查 `pg_hba.conf` 是否允许该来源 IP，以及 `-h` 指定的是否为容器映射端口（如 `127.0.0.1:5433`）。

4. **需要密码但脚本要免密**
   使用环境变量 `PGPASSWORD` 或 `.pgpass` 文件，见 [pg_dump 单机 Docker 实操指南](./pg_dump单机docker实操指南.md#常见避坑)。
