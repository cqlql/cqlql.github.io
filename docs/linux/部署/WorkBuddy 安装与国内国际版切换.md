---
title: WorkBuddy 安装与国内国际版切换
icon: mdi:robot-happy
sort: 5
---

# WorkBuddy 安装与国内国际版切换：在 WSL Ubuntu 24.04 上跑官方 Linux 原生包

> **文档定位：这是一篇 Linux 运维笔记，含本次完整落地记录。**
> 目标：在 WSL 的 Ubuntu 24.04 里装上 WorkBuddy 桌面端，并能在**国内版**与**国际版**之间切换。
> 本文记录安装渠道排查、WSLg 启动的坑、以及「国内版/国际版是同一个二进制」的验证过程。
>
> 配套文档：
> - 《WSL 安装 Linux 子系统》（同目录）—— 子系统本身，本文假设已装好
> - 《WSLg 中文输入法配置》（同目录）—— 图形应用的环境变量注入思路与本文同源（`.desktop` + `Exec=env`），本文不重复
> - 《apt 包管理》《apt 换源》（`包管理/`）—— 装 deb 的通用写法，本文不重复
>
> **环境**：Windows 11 + WSL 发行版 `Ubuntu-24.04`（x86_64，`systemd` 已启用），
> WSLg 可用（`DISPLAY=:0`），WSL 用户 `cql`，WorkBuddy `5.5.6`。

**当前状态（2026-10-12，以本机实测为准）**：

| 部分 | 状态 |
| :--- | :--- |
| 官方原生 deb 安装 | ✅ 已完成（`/opt/WorkBuddy/`） |
| WSLg 下启动到登录页 | ✅ 已验证（窗口正常渲染） |
| 国内版登录 | ✅ 可用（默认） |
| 国际版登录页拉起 | ✅ 已验证（英文界面，`codebuddy.ai/login`） |
| 国际版实际登录 | ⚠️ 未完成（需国际账号，本机无凭据） |
| `workbuddy://` 协议注册 | ✅ 已修复 |
| 国际版 Linux 安装包 | ❌ 官方 CDN 已下架（见 §7.3） |

## 1. 背景与目标

### 1.1 要解决的问题

想在 WSL 里用 WorkBuddy 桌面端。官方下载页对 Linux 只写了一句
「统信 UOS / 银河麒麟：请到系统应用商店下载」，**没有 Ubuntu 的入口**。

### 1.2 目标

- 在 Ubuntu 24.04（非信创发行版）上装上官方包，而不是第三方重打包
- WSLg 下能正常拉起窗口并登录
- 能在国内版（DeepSeek / GLM / 混元）与国际版（Claude / GPT / Gemini）之间切换
- 一劳永逸：从终端和从 Windows 开始菜单两条路径都能启动

## 2. 结论先行

| 决策 | 结论 | 理由 |
| :--- | :--- | :--- |
| 安装渠道 | **官方更新接口取原生 deb** | 依赖全是标准 GTK 库，`postinst` 里带 Ubuntu 24+ 的 AppArmor 分支，比社区包干净 |
| 是否用星火 APM 源 | ❌ 不采用（仅作备选） | 要拖进 `amber-pm-trixie` + `apm` 整套容器运行时，还引入 bwrap 的 PATH 坑，见 §5 |
| 是否用 Wine 跑 Windows 版 | ❌ 走不通 | 主进程必崩（退出码 3），见 §3 |
| 启动方式 | **wrapper 脚本 + 改写 `.desktop`** | 官方 `.desktop` 不带 WSLg 环境变量，从开始菜单启动会失败，见 §6 |
| 国内/国际版 | **同一个二进制，改配置里的 `endpoint`** | 实测验证，见 §7 |
| 切换后数据目录 | 国际版用独立 `HOME` | 避免两套账号的登录态互相覆盖 |

## 3. 为什么官方没有 Ubuntu 版

官方桌面端只发布了 **Windows / macOS / 统信 UOS / 银河麒麟**，
Linux 侧只通过各信创系统的应用商店分发，公开 apt 索引里搜不到。

三条路线的实测结论：

```text
                    在 Ubuntu 24.04 上跑 WorkBuddy
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
   星火 APM 源              直装 UOS deb             Wine 跑 Windows 版
        │                       │                       │
   腾讯官方 deb 5.5.6      需自行补齐依赖           三层问题叠加：
   + AmberPM 容器隔离      依赖不匹配就起不来       · Electron stdio 句柄 EBADF
        │                       │                   · 启动自检失败后静默退出
   ✅ 可用（见 §5）        ⚠️ 不保证                · 主进程 Chromium CHECK 失败
                                                     退出码 3
                                                     ❌ 走不通
```

**为什么不走 Wine**：WorkBuddy 对系统集成依赖很深（凭据保护、命名管道守护进程、IM Hook），
兼容层补不齐。实测的三层失败依次是：

1. Electron 主进程读 stderr 时 `Error: open EBADF`（Wine 交出的句柄无效）
2. 崩溃一次后启动自检把状态标记为异常，后续启动走「静默恢复」分支 —— 不建窗口、
   只在托盘留图标，而 GNOME 不显示 Wine 的 XEmbed 托盘图标，用户表现为「点了没反应」
3. 即使绕过前两条，主进程也会在窗口首次绘制后数秒内因 Chromium CHECK 失败自杀

## 4. 安装：官方更新接口取原生 deb（推荐）

### 4.1 接口

官方有个公开的更新接口，专门给 Linux 构建用：

```bash
curl -s 'https://copilot.tencent.com/v2/update?platform=workbuddy-linux-x64-deb'
```

返回：

```json
{
  "version": "5.5.6.38337834",
  "url": "https://download.codebuddy.cn/workbuddy/saas/linux-x64-deb/WorkBuddy-linux-x64-deb-5.5.6.38337834-5f969292.deb",
  "productVersion": "5.5.6.38337834",
  "sha256hash": "03d756b259d7086c22098fa077589a032d60948d1de7313473360eefe11e240f",
  "timestamp": 1789061034,
  "supportsFastUpdate": false
}
```

四个通道（ARM 机器把 `x64` 换成 `arm64`）：

| platform | 包类型 | 适用 |
| :--- | :--- | :--- |
| `workbuddy-linux-x64-deb` | x86_64 deb | Ubuntu / Debian 系 |
| `workbuddy-linux-x64-rpm` | x86_64 rpm | Fedora / RHEL 系 |
| `workbuddy-linux-arm64-deb` | arm64 deb | ARM 上的 Debian 系 |
| `workbuddy-linux-arm64-rpm` | arm64 rpm | ARM 上的 Fedora 系 |

> 💡 接口里出现 `rpm` 通道这件事本身就说明官方构建过 Fedora 系的包，
> 只是没挂到官网下载页上。

### 4.2 下载与安装

```bash
# 动态取地址，别硬编码（构建号每次发版都变）
url=$(curl -s 'https://copilot.tencent.com/v2/update?platform=workbuddy-linux-x64-deb' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["url"])')

curl -L --retry 3 -o /tmp/workbuddy.deb "$url"
sha256sum /tmp/workbuddy.deb          # 自己算一遍留档，见 §4.3

apt-get install -y /tmp/workbuddy.deb
```

包体约 **410 MB**（429,302,312 字节）。依赖：

```text
libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils
libatspi2.0-0 libuuid1 libsecret-1-0
```

**全是 Ubuntu 标准库，没有一个信创专有包。** 装完自动：

- 解包到 `/opt/WorkBuddy/`
- 用 `update-alternatives` 注册 `/usr/bin/workbuddy`
- 刷新 desktop / mime / 图标数据库

### 4.3 ⚠️ 接口里的 sha256 对不上实测值

`sha256hash` 字段标注 `03d756b2…`，但实测下载后算出来是：

```text
2ef1bca217d29d9c2ba988c82079aa6ea0077e9f1ff882c6ab5dd7998bddf721
```

文件大小稳定、内容稳定，只是和接口字段对不上。**别拿接口那个值当校验标准**，
下载后自己算一遍留档即可。

## 5. 备选：星火应用商店的 APM 源

官方给 UOS / 麒麟供了原生 Linux 包，星火应用商店把它以 **AmberPM（APM）格式**封装
（应用连同 Debian trixie 容器环境打成一个 deb），山东大学镜像站同步了该源。

### 5.1 安装步骤

```bash
# 1) 加源（store 提供容器运行时，apm-deb-source 提供 apm 工具，两个都要）
tee /etc/apt/sources.list.d/spark-apm.list <<'EOF'
deb [trusted=yes by-hash=force] https://mirrors.sdu.edu.cn/spark-store/store /
deb [trusted=yes] https://mirrors.sdu.edu.cn/spark-store/apm-deb-source /
EOF

# 2) 只刷这个源，避免被其它失效 PPA 拖累
apt-get update \
  -o Dir::Etc::sourcelist="sources.list.d/spark-apm.list" \
  -o Dir::Etc::sourceparts="-" -o APT::Get::List-Cleanup="0"

# 3) 装
apt-get install -y --allow-unauthenticated amber-pm-trixie apm workbuddy
```

### 5.2 选包要注意

源里同时有三个 WorkBuddy 包，**只有第一个是腾讯官方署名**：

| 包名 | 版本 | 体积 | 性质 |
| :--- | :--- | :--- | :--- |
| `workbuddy` | 5.5.6 | 410 MB | ✅ 腾讯官方署名（`workbuddy@tencent.com`） |
| `cn.workbuddy.otohime` | 5.6.2 | 148 MB | ⚠️ 社区移植 |
| `com.xydw.workbuddy` | 5.6.2 | 150 MB | ⚠️ 社区重打包 |

认准 `Depends: amber-pm-trixie` —— 这是官方 APM 包的特征。

### 5.3 这条路会踩的三个坑

**坑一：宿主 PATH 污染会让 `bwrap` 报错。**

APM 的 `ace-run` 会拼出 `bwrap --setenv PATH /amber-ce-tools/bin-override:$PATH`，
而 `bwrap --setenv` **只接受单个值**。宿主 PATH 里混着
`/mnt/c/Program Files/nodejs` 这类带空格的 Windows 路径时，参数会被空格拆开：

```text
bwrap: execvp Files/nodejs:/mnt/c/Program: No such file or directory
```

**坑二：不能以 root 运行。** Electron 直接拒绝：

```text
FATAL: Running as root without --no-sandbox is not supported.
```

必须用普通用户。

**坑三：root 跑过一次会留下权限残留。** `/tmp/apm/workbuddy` 变成 root 所有后，
普通用户再启动会：

```text
fusermount3: user has no write access to mountpoint /tmp/apm/workbuddy
fuse-overlayfs: cannot mount: Operation not permitted
bwrap: Can't mkdir /media: Permission denied
```

清掉重建即可：`rm -rf /tmp/apm && mkdir -p /tmp/apm && chmod 1777 /tmp/apm`。

> 这三个坑都是**容器方案特有的**。改用 §4 的原生 deb 后，全部消失。

## 6. WSLg 启动：为什么需要一个 wrapper

官方 `.desktop` 里的 `Exec` 只有一行：

```ini
Exec=/opt/WorkBuddy/workbuddy %U
```

它**不带 WSLg 的环境变量**，而 `wslg.exe` 从开始菜单启动时不经过 shell，
`/etc/profile.d/*.sh`、`~/.bashrc`、`/etc/environment` 全都不生效
（这一点与《WSLg 中文输入法配置》§7 是同一个根因）。

所以包一层 `/usr/local/bin/workbuddy-launch`，负责三件事：

| 职责 | 原因 |
| :--- | :--- |
| 注入 WSLg 环境变量 | `DISPLAY` / `WAYLAND_DISPLAY` / `XDG_RUNTIME_DIR` / 会话 dbus 地址 |
| 净化 PATH | 去掉带空格的 Windows 路径，避免干扰它内部调起的工具链 |
| 切换产品配置 | 国内版 / 国际版，见 §7 |

会话 dbus 那行容易被忽略：

```bash
export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
```

从 root 上下文切到普通用户时会丢这个变量，应用就会去连 `/run/user/0/bus` 并刷一堆
`Failed to connect to the bus: Permission denied`。**这些报错是无害的**，
但排错时会严重干扰判断，不如一开始就注入正确值。

## 7. 国内版 / 国际版切换（核心）

### 7.1 先明确：这是同一个二进制

| 证据 | 内容 |
| :--- | :--- |
| 包元数据 | `Homepage: https://www.codebuddy.ai`（国际站域名） |
| asar 内域名计数 | `codebuddy.ai` 出现 **1242** 次，`codebuddy.cn` 仅 40 次 |
| 内置条款 | 同时打包了 `workbuddy.cn` 与 `workbuddy.ai` 两套隐私政策 / 服务条款 |
| 全新 HOME 启动 | 界面默认**纯英文**（`Sign In` / `Work Less, Deliver More`） |

代码里的判定链路：

```text
isOverseas() → isInternationalVersion() → 比对 window.location.hostname
    域名白名单：www.workbuddy.ai / workbuddy.ai / www.codebuddy.ai /
                codebuddy.ai / workbuddy.cc / staging.* / staging-codebuddy.tencent.com
    另有一条短路：document.body 上的 data-is-chinese-version 属性优先
```

产品配置里 `product.isOversea === true` → 界面语言 `en-US`，`false` → `zh-CN`。

### 7.2 为什么「在浏览器里手动改域名」必然失败

登录是**有状态握手**，不是简单跳转。实测三个域名各自的响应：

```text
POST <域名>/v2/plugin/auth/state?platform=workbuddy
        │
        ├── copilot.tencent.com  → authUrl: https://copilot.tencent.com/login?state=...
        ├── www.codebuddy.ai     → authUrl: https://www.codebuddy.ai/login?state=...
        └── www.workbuddy.cn     → authUrl: https://www.workbuddy.cn/login?state=...
```

每个服务端都签发**指向它自己**的 `authUrl`。应用是从国内后端拿到 `state` 的，
你把这个 URL 的域名改成 `.ai`，`.ai` 后端不认识这个 `state` → 页面报 **"Log in Failed"**。

> 顺带一提：那个 `workbuddy://` 深链**不是**登录回调通道。
> 登录回调实际走本地端口 **8090**（代码里的 `CALLBACK_PORT`）。

### 7.3 正确的切换方式：改 `endpoint`

配置文件（**改这里才有效**）：

```text
/opt/WorkBuddy/resources/app.asar.unpacked/cli/product.json
```

其中的 `endpoint` 字段决定鉴权域：

| 版本 | `endpoint` | 登录页 |
| :--- | :--- | :--- |
| 国内版 | `https://copilot.tencent.com` | `workbuddy.cn/login` |
| 国际版 | `https://www.codebuddy.ai` | `codebuddy.ai/login` |

同目录还有 `product.internal.json` / `product.ioa.json` / `product.cloudhosted.json` /
`product.selfhosted.json`，**没有海外变体**。

**为什么不改 `ACC_PRODUCT_CONFIG_PATH` 环境变量**：代码里它与 `ACC_PRODUCT_CONFIG_V3`
同属 `MUTUALLY_EXCLUSIVE_ENV_GROUPS`，而应用自己会设置后者，
所以这个环境变量**实测被忽略**，改了不起作用。

### 7.4 已落地的切换方案

保留两份配置，`product.json` 是当前生效的那份：

```text
/opt/WorkBuddy/resources/app.asar.unpacked/cli/
├── product.domestic.json     # endpoint = copilot.tencent.com
├── product.overseas.json     # endpoint = www.codebuddy.ai
└── product.json              # 当前生效（由启动器切换）
```

三个文件都 `chown cql:cql`，**切换不需要 sudo**。启动器用法：

```bash
workbuddy-launch              # 国内版（默认）
workbuddy-launch --intl       # 国际版
workbuddy-launch --status     # 查看当前指向哪个
```

国际版使用**独立数据目录** `~/.workbuddy-intl`（`HOME` 被改写），
这样两套账号的登录态不会互相覆盖 —— 否则登录国际版会把国内版的会话挤掉。

### 7.5 ⚠️ 国际版 Linux 包已下架

国际站有**独立的发布通道**，返回的版本和国内不同：

| 通道 | 版本 | CDN |
| :--- | :--- | :--- |
| `copilot.tencent.com` | 5.5.6.38337834 | `download.codebuddy.cn` |
| `www.codebuddy.ai` | 5.5.2.37849279 | `codebuddy-1328495429.cos.accelerate.myqcloud.com` |

但国际版那个 deb **已经被从 CDN 删除**，下载返回：

```xml
<Error>
  <Code>NoSuchKey</Code>
  <Message>The specified key does not exist.</Message>
</Error>
```

所以国际版 Linux 只能靠 §7.4 改配置的方式复用国内包。好在实测可用。

## 8. 修复 `workbuddy://` 协议未注册

**症状**：点击登录页的「Open WorkBuddy」弹出

```text
No Apps available
No apps installed that can open "workbuddy://".
```

**根因**：`desktop-file-utils` **没装**，所以
`/usr/share/applications/mimeinfo.cache` 从来没被生成过 ——
而 GTK 的应用选择器**只读这个缓存**，不读 `.desktop` 文件本身。
`workbuddy.desktop` 里的 `MimeType=x-scheme-handler/workbuddy;` 写得再对也没用。

**修复**：

```bash
apt-get install -y desktop-file-utils
update-desktop-database /usr/share/applications

# 验证
grep workbuddy /usr/share/applications/mimeinfo.cache
# 期望：x-scheme-handler/workbuddy=workbuddy.desktop;
```

> ⚠️ 排查时注意 `~/.local/share/applications/` 下还有个
> `buddycn-url-handler.desktop`，那是 **CodeBuddy CN**（另一个独立 IDE）的，
> 处理的是 `codebuddycn://`，与 WorkBuddy 无关，别混淆。

## 9. 验证方式

按顺序做，能逐条打勾：

1. **包装好了**

```bash
dpkg -l workbuddy | tail -1          # 期望 ii  workbuddy  5.5.6  amd64
which workbuddy                      # 期望 /usr/bin/workbuddy
ls -la /opt/WorkBuddy/workbuddy      # 期望可执行文件存在
```

2. **启动器能跑**

```bash
workbuddy-launch --status
# 期望：当前 endpoint: https://copilot.tencent.com  => 国内版
```

3. **国内版登录页拉起正确**

```bash
workbuddy-launch
# 观察日志里的 openExternal 那一行
```

   期望出现 `https://www.workbuddy.cn/login?platform=workbuddy&state=...`。

4. **国际版登录页拉起正确**

```bash
workbuddy-launch --intl
```

   期望出现 `https://www.codebuddy.ai/login?platform=workbuddy&state=...`，
   且应用界面为**英文**（`Work Less, Deliver More` / `Privacy Policy` / `Terms of Service`）。

5. **窗口真的渲染出来了**

```bash
DISPLAY=:0 xdotool search --onlyvisible --name 'WorkBuddy' \
  | while read id; do echo "[$id] $(DISPLAY=:0 xdotool getwindowname $id)"; done
```

   期望至少一个标题为 `WorkBuddy` 的窗口。截图确认：

```bash
DISPLAY=:0 import -window <窗口id> /tmp/wb.png
```

6. **协议注册生效**（见 §8）

```bash
xdg-mime query default x-scheme-handler/workbuddy   # 期望 workbuddy.desktop
gio mime x-scheme-handler/workbuddy                 # 期望列出 workbuddy.desktop
```

⚠️ 排查时的干扰源（**都是无害的**，别当故障查）：

| 日志 | 说明 |
| :--- | :--- |
| `Failed to connect to socket /run/user/0/bus` | 从 root 上下文启动丢了会话 dbus；走 wrapper 就不会有 |
| `Exiting GPU process due to errors during initialization` | WSLg 走软件渲染，正常 |
| `dconf-WARNING: /root/.local/share/flatpak/...` | 无害 |
| `your 131072x1 screen size is bogus` | WSLg 屏幕尺寸探测，无害 |

## 10. 文件清单

新增：

```text
/usr/local/bin/workbuddy-launch                                  # 启动器（chmod +x）
/opt/WorkBuddy/resources/app.asar.unpacked/cli/product.domestic.json   # 国内版配置
/opt/WorkBuddy/resources/app.asar.unpacked/cli/product.overseas.json   # 国际版配置
~/.workbuddy-intl/                                               # 国际版独立数据目录
~/.workbuddy/                                                    # 国内版数据目录
```

修改：

```text
/usr/share/applications/workbuddy.desktop              # Exec 改为指向 wrapper（原文件备份为 .orig）
/opt/WorkBuddy/resources/app.asar.unpacked/cli/product.json   # 由启动器按模式覆盖
/usr/share/applications/mimeinfo.cache                 # 由 update-desktop-database 生成
```

> 注意：**没有**改动 `~/.bashrc` / `/etc/profile.d/*`。
> 环境变量全部由 wrapper 内部注入，与 shell 解耦。

## 11. 常用操作与排错

| 需求 | 操作 |
| :--- | :--- |
| 启动（国内版） | `workbuddy-launch` 或开始菜单搜 WorkBuddy |
| 启动（国际版） | `workbuddy-launch --intl` |
| 看当前是哪个版本 | `workbuddy-launch --status` |
| 查最新 Linux 版本号 | `curl -s 'https://copilot.tencent.com/v2/update?platform=workbuddy-linux-x64-deb'` |
| 升级 | 重新按 §4.2 下载新 deb 覆盖安装 |
| 完全卸载 | `apt-get remove workbuddy` |
| 看应用日志 | 启动时的 stdout，或 `~/.workbuddy/logs/` |
| 查窗口列表 | `DISPLAY=:0 xdotool search --onlyvisible --name 'WorkBuddy'` |

**常见症状对照**：

| 症状 | 可能原因 |
| :--- | :--- |
| 开始菜单点图标没反应 | `.desktop` 的 `Exec` 没指向 wrapper，缺 WSLg 环境变量（§6） |
| `FATAL: Running as root without --no-sandbox` | 以 root 启动了，必须用普通用户 |
| `bwrap: execvp Files/nodejs:...` | PATH 里混入带空格的 Windows 路径（仅 APM 容器方案，§5.3） |
| 点登录页「Open WorkBuddy」弹 No Apps available | `mimeinfo.cache` 没生成，装 `desktop-file-utils`（§8） |
| 手动把登录域名改成 `.ai` 后 Log in Failed | state 是 `.cn` 后端签发的，必须改 `endpoint`（§7.2） |
| 登录国际版后国内版要重新登录 | 两版共用了同一个 `HOME`，应使用 §7.4 的独立目录 |
| GPU 进程报错刷屏 | WSLg 软件渲染，无害 |

## 12. 待确认问题 / 后续

| 优先级 | 事项 | 当前状态 | 建议 |
| :--- | :--- | :--- | :--- |
| P0 | 国际版实际登录未跑通 | 只验证到登录页 | 需国际账号（Google / GitHub）扫码授权，本机无凭据 |
| P1 | 官方 deb 升级会覆盖 `product.json` | 已知 | 升级后需重跑一次 `workbuddy-launch`（会自动按当前模式恢复配置） |
| P1 | `product.json` 被 `chown` 给 `cql` 后，未来 deb 升级可能报权限冲突 | 未遇到 | 升级前先 `chown root:root` 还原 |
| P2 | 国际版 Linux 包官方已下架 | 已知 | 关注 `www.codebuddy.ai/v2/update` 是否重新上架 |
| P2 | 未做开机自启 | 未处理 | 如需常驻，可参考《WSLg 中文输入法配置》§5.5 的 systemd 用户服务写法 |
| P2 | 接口 `sha256hash` 字段不可信 | 已知 | 下载后自行 `sha256sum` 留档（§4.3） |

### 12.1 已定稿、不再作为待确认项

- **安装走官方原生 deb**：已验证可用，不再考虑星火 APM 容器方案。
- **Wine 方案**：实测三层失败，彻底排除（§3）。
- **国内/国际版是同一二进制**：已由包元数据 + asar 字符串 + 全新 HOME 实测三重验证（§7.1）。
- **切换靠改 `endpoint`**：已验证两种模式各自拉起正确的登录页（§7.3 / §7.4）。
- **`ACC_PRODUCT_CONFIG_PATH` 无效**：实测被忽略，不再尝试（§7.3）。

## 13. 落地记录

- **2026-10-12** 首次安装走**星火 APM 源**（山东大学镜像），装的是腾讯官方署名的
  `workbuddy_5.5.6_amd64.deb`（410 MB）。随后连踩三坑：宿主 PATH 里的
  `C:\Program Files\nodejs` 被 `bwrap --setenv` 拆坏参数；以 root 启动被 Electron 拒绝；
  root 跑过一次后 `/tmp/apm` 权限残留导致 `fuse-overlayfs` 挂不上。
  逐个定位后确认都是**容器方案特有**的问题。

- **2026-10-12** 从 deepin 论坛的线索找到**官方更新接口**
  `copilot.tencent.com/v2/update?platform=workbuddy-linux-x64-deb`，
  拿到原生 deb。`dpkg-deb -f` 看到 `Depends` 全是标准 GTK 库、
  `postinst` 里有 `Install apparmor profile. (Ubuntu 24+)` 分支，
  确认官方认真考虑过 Ubuntu —— 遂改用原生包，并卸掉 APM 运行时。

- **2026-10-12** 踩到「点击登录默认跳 `workbuddy.cn`」。先试了在浏览器里手动改域名，
  得到 `Log in Failed` + `No Apps available`。排查发现两件事：
  ① `desktop-file-utils` 没装导致 `mimeinfo.cache` 从未生成（协议注册失效）；
  ② 登录是有状态握手，域名不能手改。

- **2026-10-12** 用 `POST /v2/plugin/auth/state` 对三个域名分别实测，
  确认**每个服务端签发指向自己的 authUrl**，从原理上排除了「手改域名」这条路。

- **2026-10-12** 反查 asar 找到 `isInternationalVersion()` 与产品配置结构，
  最终定位到 `product.json` 的 `endpoint` 字段。改指 `www.codebuddy.ai` 后重启，
  应用立刻拉起 `codebuddy.ai/login`，界面转为纯英文 —— 国际版切换打通。
  期间试过 `ACC_PRODUCT_CONFIG_PATH` 环境变量，**无效**（与 `ACC_PRODUCT_CONFIG_V3` 互斥）。

- **2026-10-12** 落地 `workbuddy-launch` 启动器（`--intl` / `--cn` / `--status`），
  并改写 `/usr/share/applications/workbuddy.desktop` 的 `Exec` 指向它，
  原文件备份为 `.orig`。两种模式均已实测拉起正确的登录页。
