---
title: nodejs 部署
sort: 2
---

## 一、安装 Node.js

### 1. 版本管理器（fnm / nvm）—— 首选推荐

> 版本管理器在用户空间管理多个 Node.js 版本，**不需要 `sudo` 权限**，切换、升级、卸载都干净可控，是个人开发环境的最佳选择。

**fnm vs nvm 对比：**

| 特性维度 | nvm | fnm |
| --- | --- | --- |
| 底层实现 | Bash / Zsh 脚本 | **Rust** |
| 执行速度 | 较慢（终端启动/切换有明显卡顿） | **极快**（毫秒级响应，几乎无感知） |
| 跨平台支持 | 仅 macOS / Linux（Windows 需独立的 `nvm-windows`） | **原生跨平台**（macOS、Linux、Windows 统一体验） |
| Shell 支持 | Bash、Zsh | Bash、Zsh、Fish、PowerShell、Cmd 等 |
| 自动版本切换 | 需手动配置复杂的 Shell 钩子函数 | 原生支持 `.nvmrc` / `.node-version` 自动切换 |
| 并行下载 | 单线程，速度一般 | 多线程并行下载，安装极快 |

**选型建议：**

- **选 fnm**（强烈推荐）：新环境部署、追求极速终端响应、多端/Windows 开发者、需要进入目录自动切 Node 版本。
- **选 nvm**：仅在极其老旧的 Linux 服务器，或已有 CI/CD 脚本重度依赖旧 Shell 脚本且无法更换组件时使用。

#### fnm（Fast Node Manager）—— 现代首选

```sh
# 1. 安装 fnm（任选其一）
brew install fnm                              # macOS / Linux（Homebrew）
curl -fsSL https://fnm.vercel.app/install | bash   # 官方安装脚本

# 2. 添加 Shell 初始化（bash 示例，其他 Shell 见官方文档）
#    --use-on-cd 会在进入目录时自动按 .nvmrc / .node-version 切换版本
eval "$(fnm env --use-on-cd --shell bash)"

# 3. 配置国内镜像加速下载
export FNM_NODE_DIST_MIRROR=https://npmmirror.com/mirrors/node

# 4. 安装并使用指定版本
fnm install 24.19.0
fnm use 24.19.0
fnm default 24.19.0     # 设为全局默认版本
```

#### nvm（Node Version Manager）—— 传统方案

```sh
# 1. 安装 NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# 2. 国内网络访问 GitHub 困难时，可在 ~/.bashrc 或 ~/.zshrc 结尾添加镜像配置：
export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node/

# 3. 重新加载配置并安装指定版本
source ~/.bashrc
nvm install 24.19.0
nvm use 24.19.0
```

### 2. NodeSource 仓库（适合生产环境 / 服务器）

> NodeSource 是一家独立的商业公司（**并非 Node.js 官方**，官方管理机构为 OpenJS Foundation），提供 DEB/RPM 格式的 Node.js 发行版与企业级支持（N|Solid 运行时）。其维护的 `deb.nodesource.com` 仓库在社区中非常流行且长期稳定，但本质是第三方源。

如果希望通过 APT 统一管理和升级：

```sh
# 导入 NodeSource 24.x 仓库脚本
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -

# 直接通过 apt 安装
sudo apt-get install -y nodejs
```

发行版详情与安装选择器见 NodeSource 官网：<https://nodesource.com/products/distributions>

## 二、安装包管理器（pnpm）

### 1. 工具链关系

| 工具 | 管什么 | 说明 |
|------|--------|------|
| fnm / nvm | Node.js 版本 | 先装 Node，才有 corepack |
| corepack | 包管理器版本 | Node 内置，随 Node 提供 |
| pnpm / yarn | 真正的包管理器 | 装依赖 |

### 2. 使用 Corepack 安装

Corepack 是 Node.js 从 v16.9 起内置的官方工具，用于管理 `pnpm`、`yarn`、`npm` 等包管理器的版本。

```sh
# 1. 启用 pnpm（生成 pnpm 命令的 shim 垫片）
corepack enable pnpm

# 2. 下载并激活指定版本 pnpm
corepack prepare pnpm@11.24.0 --activate

# 3. 配置国内镜像源，加速依赖下载
pnpm config set registry https://registry.npmmirror.com

# 4. 设置下载超时时间（10 分钟），避免大依赖或慢网络下超时失败
pnpm config set fetch-timeout 600000
```

### 3. 版本如何决定（`packageManager` 与 `--activate`）

Corepack 决定「用哪个版本」的优先级：

1. 项目 `package.json` 的 `"packageManager"` 字段（最高，只在该项目内生效）
2. 全局 `--activate` 设置的默认版本（全局兜底）

| 操作 | 是否下载缓存 | 是否改全局默认 |
|------|------------|--------------|
| `corepack prepare pnpm@x` | 是 | 否 |
| `corepack prepare pnpm@x --activate` | 是 | 是 |

不指定版本时的行为：

| 场景 | 行为 |
|------|------|
| `corepack prepare pnpm`（不带 `@版本`） | 读 `packageManager` 字段 → lastKnownGood → 可能报错要求指定 |
| 只 `corepack enable pnpm`，直接运行 `pnpm` | 首次运行时按 `packageManager` 字段（或 latest）自动下载并缓存 |
| 项目有 `"packageManager"` 字段 | 始终用该字段版本，优先级最高 |

> 建议：团队项目应始终在 `package.json` 写 `"packageManager"` 字段（如 `"pnpm@10.30.3"`），不依赖 `--activate` 的全局状态，版本最可控、可复现。`--activate` 只是「设全局默认」，与「是否只当前项目生效」是两个独立概念。

## 三、使用 pm2 管理 node 服务

[pm2 进程管理工具](https://github.com/Unitech/pm2) - 生产环境用

- 适用于访问量较大、需要完整监控界面的场景
- 支持异常自动重启
- 可同时管理多个进程程序
- 除了 Node.js，还[支持其他语言程序](https://pm2.io/doc/en/runtime/guide/process-management/?utm_source=github#manage-any-application-type)

```sh
# 运行 js
pm2 start app.js
# 支持命令
pm2 start http-server -- /usr/website
```
