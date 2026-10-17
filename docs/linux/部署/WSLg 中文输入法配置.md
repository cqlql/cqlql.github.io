---
title: WSLg 中文输入法配置
icon: mdi:keyboard-settings
sort: 4
---

# WSLg 中文输入法配置：fcitx5 + 拼音在 WSL 图形应用里落地

> **文档定位：这是一篇 Linux 运维笔记，含本次完整落地记录。**
> 目标：让 WSL 里的图形应用（Chrome、编辑器等）能用拼音输入中文。
> 本文记录根因分析、方案取舍、环境变量与自启动配置，
> 以及两个极易踩的坑：「Wayland 后端让 immodule 失效」和「`wslg.exe` 启动不经 shell」。
>
> 配套文档：
> - 《WSL 安装 Linux 子系统》（同目录）—— 子系统的安装，本文假设已装好
> - 《OpenCode WSL 安装与踩坑记录》（同目录）—— 复用本文的 `.desktop` 注入、systemd 用户服务与强制 X11 思路
> - 《WSL2 局域网 SSH 访问》（`网络/`）—— 网络侧配置，与本文无关
> - 《systemctl》《journalctl》（`进程与服务/`）—— systemd 用户服务的通用写法，本文不重复
>
> **环境**：Windows 11 + WSL `2.6.3.0`，发行版 `Ubuntu-24.04`（`systemd` 已启用），
> WSLg `1.0.71`，WSL 用户 `cql`。

**当前状态（2026-10-12，以本机实测为准）**：

| 部分 | 状态 |
| :--- | :--- |
| fcitx5 + 拼音安装与预配置 | ✅ 已完成 |
| XIM / GTK3 / GTK4 / Qt5 / Qt6 前端 | ✅ 全部探测通过 |
| systemd 用户服务自启（含 `linger`） | ✅ 已启用 |
| 从终端启动的图形应用 | ✅ 可用（Chrome 实测已连上输入上下文） |
| 从开始菜单启动的应用 | ⚠️ 已用 `.desktop` 覆盖解决，**需重启 WSL 生效，未复测** |
| 云拼音 / 词库同步 | ⚠️ 未配置（`cloudpinyin` 已加载，未启用联网词库） |

## 1. 背景与目标

### 1.1 要解决的问题

在 WSL 的图形应用里**敲不出中文**：按 `Ctrl+Space` 毫无反应，
想输中文只能切回 Windows 打完再复制粘贴过去。

### 1.2 目标

- WSL 图形应用内可用拼音输入，候选词窗口正常显示
- 一劳永逸：WSL 重启后自动生效，不需要每次手动起进程
- 覆盖多条启动路径（终端敲命令 / Windows 开始菜单点图标）

## 2. 结论先行

| 决策 | 结论 | 理由 |
| :--- | :--- | :--- |
| 输入法框架 | **fcitx5** | WSLg 下比 ibus 稳定；`fcitx5-chinese-addons` 自带拼音/双拼/五笔，一个包解决 |
| 拼音引擎 | `fcitx5-chinese-addons`（内置拼音） | 不引第三方闭源输入法（如搜狗），依赖干净、可 apt 升级 |
| 图形后端 | **强制 X11（XWayland）** | WSLg 的 Weston 不支持 Wayland 的 `text-input` / `input-method` 协议，走 Wayland 时 `GTK_IM_MODULE` 会被忽略，见 §6 |
| 应用接入方式 | XIM（Chrome）+ GTK/Qt immodule（原生应用） | Chrome 在 X11 下走 XIM，只需 `XMODIFIERS`；原生 GTK/Qt 应用走 immodule |
| 自启动方式 | **systemd 用户服务** | 本机 `systemd=true`，比写 `~/.profile` 更可靠（不依赖是否开过终端） |
| 开始菜单启动 | 用户级 `.desktop` 覆盖 + `env VAR=...` 注入 | `wslg.exe` 启动不经 shell，环境变量文件全部无效，见 §7 |
| 系统语言 | **不改**（保持 `C.UTF-8`） | fcitx5 与 CJK 字体都不依赖 `zh_CN` locale；改了反而会让应用界面变中文 |

## 3. 根因：为什么 WSL 里打不了中文

有两个独立的原因叠加，缺一不可：

**原因一：WSLg 不转发 Windows 的输入法。**
WSLg 只把 Linux 应用的**窗口**画到 Windows 桌面上，键盘事件以原始按键形式送进 Linux，
Windows 侧的输入法组合过程不会跟着过去。这是微软的已知限制
（[microsoft/wslg#955](https://github.com/microsoft/wslg/issues/955)、#9），
官方给的答复就是「请在 WSL 内自行安装输入法」。
所以**必须在 WSL 里跑一套 Linux 输入法**，指望系统输入法穿透是不通的。

**原因二：WSLg 的合成器不支持 Wayland 输入法协议。**
WSLg 用 Weston 作合成器，同时提供 Wayland 和 XWayland 两条通道：

```text
   图形应用
      │
      ├── Wayland 通道（WAYLAND_DISPLAY=wayland-0）
      │     └── 输入法靠 zwp_text_input_v3 / zwp_input_method_v2 协议
      │           └── ✗ WSLg 的 Weston 未实现 → 这条路走不通
      │
      └── X11 通道（XWayland，DISPLAY=:0）
            ├── XIM：应用连 X 输入法服务器（XMODIFIERS=@im=fcitx）→ ✓ 可用
            └── GTK/Qt immodule：进程内加载 libim-fcitx5.so → ✓ 可用
```

GTK3/GTK4 默认**优先走 Wayland**，而 Wayland 后端下 `GTK_IM_MODULE` 是被忽略的
（输入法要走协议，不看环境变量）。这就是为什么必须显式把应用摁回 X11。

## 4. 方案选型

| 方案 | 是否可行 | 说明 |
| :--- | :--- | :--- |
| 让 Windows 输入法穿透进 WSLg | ❌ | 无此能力，见 §3 |
| `ibus` + `ibus-libpinyin` | ⚠️ 可行但麻烦 | ibus 更依赖桌面环境（GNOME 会话、`gnome-settings-daemon`），WSLg 里没有这些，需自己拼环境变量 |
| **`fcitx5` + `fcitx5-chinese-addons`** | ✅ **采用** | 对「无桌面环境」更友好，XIM 与 immodule 两条路都支持，命令行可控 |
| 只装 `fcitx5` 不装前端模块 | ❌ | 少了 GTK/Qt immodule，原生应用（非 Chrome）打不了字 |
| 不装 `fcitx5-config-qt` | ⚠️ | 能跑，但后续加双拼/五笔/调词库没有图形入口 |

**为什么不直接用搜狗输入法**：闭源 deb 依赖 `fcitx` 4.x 时代的组件，与 `fcitx5` 兼容性差，
且无法通过 apt 升级，后期维护成本高。拼音输入的需求用 `fcitx5-chinese-addons` 完全够。

## 5. 落地步骤

### 5.1 前置：先装一个图形应用（Chrome）

没有图形应用就无从验证。Chrome 的安装方式（**不添加 apt 源，直接装 deb**）：

```bash
# 下载（国内直连 dl.google.com 较慢，约 137 MB / 4~5 分钟）
curl -L -o /tmp/google-chrome-stable_current_amd64.deb \
  https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb

# 安装（依赖走 aliyun 镜像，只额外补了 fonts-liberation 两个包）
apt-get install -y /tmp/google-chrome-stable_current_amd64.deb
```

装完 `google-chrome` / `google-chrome-stable` 都在 `/usr/bin/`。

> ⚠️ 这种装法**没有添加 Google 的 apt 源**，`apt upgrade` 不会带着 Chrome 升级，
> 需要手动重下 deb 覆盖安装。想要自动升级，补一个源即可：

```bash
wget -qO- https://dl.google.com/linux/linux_signing_key.pub \
  | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg

echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] \
https://dl.google.com/linux/chrome/deb/ stable main" \
  > /etc/apt/sources.list.d/google-chrome.list

apt-get update -qq
```

### 5.2 安装 fcitx5 全家桶

```bash
apt-get install -y \
  fcitx5 \
  fcitx5-chinese-addons \
  fcitx5-frontend-gtk3 fcitx5-frontend-gtk4 \
  fcitx5-frontend-qt5 fcitx5-frontend-qt6 \
  fcitx5-config-qt \
  fonts-noto-cjk
```

| 包 | 作用 |
| :--- | :--- |
| `fcitx5` | 输入法框架本体，自带 `libxim.so`（XIM 服务）、`libclassicui.so`（候选词窗口） |
| `fcitx5-chinese-addons` | 拼音 / 双拼 / 五笔 / 仓颉等中文引擎（提供 `libpinyin.so`） |
| `fcitx5-frontend-gtk3/gtk4` | GTK 应用用的 immodule（`im-fcitx5.so` / `libim-fcitx5.so`） |
| `fcitx5-frontend-qt5/qt6` | Qt 应用用的输入法插件 |
| `fcitx5-config-qt` | 图形配置工具（`fcitx5-configtool` 的命令名） |
| `fonts-noto-cjk` | 中文字体，缺了会显示方块 |

> 💡 全部装完约 145 MB。`fcitx5-modules`、`fcitx5-pinyin`、`fcitx5-frontend-all`
> 等会被作为依赖自动带上，不用手写。

### 5.3 环境变量

写在两个地方，**分别覆盖登录 shell 和非登录交互 shell**：

`/etc/profile.d/fcitx5-im.sh`（系统级，登录 shell 读取）：

```bash
export GTK_IM_MODULE=fcitx
export QT_IM_MODULE=fcitx
export XMODIFIERS=@im=fcitx
export INPUT_METHOD=fcitx
export SDL_IM_MODULE=fcitx

# 强制 X11 后端，原因见 §6
export GDK_BACKEND=x11
export QT_QPA_PLATFORM=xcb
```

`~/.bashrc` 末尾追加一份带守卫的同样内容（非登录 shell 也能生效）：

```bash
# ---- fcitx5 输入法（WSLg）----
if [ -n "$WSL_DISTRO_NAME" ] && [ -z "$GTK_IM_MODULE" ]; then
    export GTK_IM_MODULE=fcitx
    export QT_IM_MODULE=fcitx
    export XMODIFIERS=@im=fcitx
    export INPUT_METHOD=fcitx
    export SDL_IM_MODULE=fcitx
    export GDK_BACKEND=x11
    export QT_QPA_PLATFORM=xcb
fi
```

**为什么要写两份**：Ubuntu 的 `~/.profile` 只在登录 shell 执行，
`/etc/profile.d/*.sh` 同理；而 Windows Terminal 新开标签等场景可能是非登录交互 shell，
只读 `~/.bashrc`。两份都写才不会漏。

**`XMODIFIERS` 是关键项**：fcitx5 启动时会检查这个变量来决定是否加载 XIM 模块。
如果 fcitx5 是在没有 `XMODIFIERS` 的环境里起来的，XIM 服务就不会注册，
Chrome 这类靠 XIM 的应用就打不了字——**变量顺序（先设变量再起进程）比变量本身更容易出错**。

### 5.4 预配置拼音

默认配置里只有 `keyboard-us`，需要手动加拼音。直接写文件，省得去 GUI 里点：

`~/.config/fcitx5/profile`：

```ini
[Groups/0]
Name=Default
Default Layout=us
DefaultIM=pinyin

[Groups/0/Items/0]
Name=keyboard-us
Layout=

[Groups/0/Items/1]
Name=pinyin
Layout=

[GroupOrder]
0=Default
```

`DefaultIM=pinyin` 决定「激活输入法时用哪个」，按下 `Ctrl+Space` 切换时进的是拼音。
`Items/0` 的 `keyboard-us` 是英文状态，正常保留。

### 5.5 自启动：systemd 用户服务

本机 `/etc/wsl.conf` 里 `systemd=true`，可以直接用用户级 systemd 服务：

`~/.config/systemd/user/fcitx5.service`：

```ini
[Unit]
Description=Fcitx5 input method (WSLg)
After=graphical-session.target

[Service]
Type=simple
Environment=DISPLAY=:0
Environment=WAYLAND_DISPLAY=wayland-0
Environment=XDG_RUNTIME_DIR=/run/user/1000
Environment=XMODIFIERS=@im=fcitx
Environment=GTK_IM_MODULE=fcitx
Environment=QT_IM_MODULE=fcitx
Environment=INPUT_METHOD=fcitx
Environment=SDL_IM_MODULE=fcitx
Environment=GDK_BACKEND=x11
Environment=QT_QPA_PLATFORM=xcb
ExecStartPre=/usr/local/bin/wslg-wait-x.sh
ExecStart=/usr/bin/fcitx5 --disable=wayland
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
```

配套的等待脚本 `/usr/local/bin/wslg-wait-x.sh`：

```bash
#!/bin/sh
# 等待 WSLg 的 XWayland socket 就绪，最多 60 秒
i=0
while [ ! -S /tmp/.X11-unix/X0 ]; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
        break
    fi
    sleep 1
done
exit 0
```

启用：

```bash
chmod +x /usr/local/bin/wslg-wait-x.sh
systemctl --user daemon-reload
systemctl --user enable --now fcitx5.service

# 让用户级 systemd 在开机时就起来，而不是等第一次登录
loginctl enable-linger cql
```

**为什么用 systemd 而不是往 `~/.profile` 里塞 `fcitx5 -d`**：
`~/.profile` 的方案依赖「用户先开过终端」，如果直接从开始菜单点应用，
输入法进程可能根本没起。systemd 用户服务 + `linger` 与 shell 完全解耦。

**为什么 `--disable=wayland`**：WSLg 的 Weston 不支持 input-method 协议，
启用 Wayland 模块只会刷权限报错，关掉后统一走 X11，候选词窗口也走 XWayland 正常显示。

**为什么要 `wslg-wait-x.sh`**：`linger` 让用户级 systemd 在**开机早期**就启动，
那时 XWayland 可能还没就绪，直接拉 fcitx5 会连不上 X。等 socket 出现再启动最稳。

**为什么把环境变量又抄进 service**：systemd 用户服务**不继承登录 shell 的环境**，
不写 `Environment=` 的话 `XMODIFIERS` 就是空的，XIM 模块不会加载（同 §5.3 的坑）。

## 6. 关键坑一：Wayland 后端会让 `GTK_IM_MODULE` 失效

这是最容易误判的一条——**环境变量全都设对了，应用里还是打不了字**。

WSLg 同时提供 Wayland 和 XWayland，GTK3/GTK4 应用**默认优先选 Wayland**。
而 Wayland 后端下输入法要走 `zwp_text_input_v3` 协议，**根本不看 `GTK_IM_MODULE`**：

| 后端 | 输入法机制 | `GTK_IM_MODULE=fcitx` 是否生效 |
| :--- | :--- | :--- |
| X11（XWayland） | 加载进程内 immodule | ✅ 生效 |
| Wayland | 走 `zwp_text_input_v3` 协议 | ❌ 被忽略，WSLg 上该协议又不可用 |

所以必须把应用摁回 X11：

```bash
export GDK_BACKEND=x11        # GTK3 / GTK4
export QT_QPA_PLATFORM=xcb    # Qt5 / Qt6
```

**副作用与取舍**：强制 X11 后所有图形应用都跑在 XWayland 上，
失去 Wayland 的一些特性（如分数缩放的原生支持）。在 WSLg 场景下这是必要代价——
WSLg 的缩放本来就由 XWayland 处理，实测无明显差异。
若某个 GTK 程序确实想用原生 Wayland，把这两行注释掉即可（代价是该程序没有中文输入）。

**怎么确认当前应用走的是哪条路**：看进程环境里有没有 `GDK_BACKEND`，
或直接跑 `fcitx5-diagnose`，GTK 段落会报告实际会加载的 immodule。

## 7. 关键坑二：`wslg.exe` 从开始菜单启动不经 shell

从终端敲 `google-chrome` 一切正常，**从 Windows 开始菜单点图标却打不了字**——
因为这两条启动路径的环境完全不一样。

实测（`wsl.exe -e env` 模拟不经 shell 的启动）：

| 变量 | 终端启动 | 开始菜单启动（经 `wslg.exe`） |
| :--- | :--- | :--- |
| `DISPLAY` / `WAYLAND_DISPLAY` | ✅ | ✅（WSL 注入，与 shell 无关） |
| `WSL_DISTRO_NAME` | ✅ | ✅ |
| `GTK_IM_MODULE` / `XMODIFIERS` | ✅ | ❌ **没有** |
| `GDK_BACKEND` | ✅ | ❌ **没有** |

**根因**：开始菜单的快捷方式指向 `C:\Program Files\WSL\wslg.exe`，
它直接 exec 目标程序，**不经过 `bash`**。因此：

- `/etc/profile.d/*.sh` ❌ 不生效（只被登录 shell 读取）
- `~/.bashrc` / `~/.profile` ❌ 不生效
- `/etc/environment` ❌ 不生效（**实测验证过**：写进去后 `wsl.exe -e env` 依然看不到）

**解决**：在用户级 `.desktop` 里用 `env` 把变量直接注入给应用进程。
用户目录的 `.desktop` 优先级高于 `/usr/share/applications`，且不会被 Chrome 升级覆盖。

`~/.local/share/applications/google-chrome.desktop`：

```ini
[Desktop Entry]
Version=1.0
Type=Application
Name=Google Chrome
GenericName=Web Browser
Comment=Access the Internet
Exec=env GTK_IM_MODULE=fcitx QT_IM_MODULE=fcitx XMODIFIERS=@im=fcitx INPUT_METHOD=fcitx SDL_IM_MODULE=fcitx GDK_BACKEND=x11 QT_QPA_PLATFORM=xcb /usr/bin/google-chrome-stable %U
Icon=google-chrome
Terminal=false
Categories=Network;WebBrowser;
StartupNotify=true
StartupWMClass=Google-chrome
```

> ⚠️ `Exec=` 那行**必须写成一行**——`.desktop` 文件不支持反斜杠续行，折行会导致整个条目解析失败。

**其它应用同理**：把 `Exec=` 换成 `env <变量> /usr/bin/<程序> %U` 即可。
只对需要的应用做覆盖，不要全量改，避免污染。

⚠️ **WSLg 只在发行版启动时扫描一次 `.desktop`**，所以这个覆盖**必须重启 WSL 才生效**：

```powershell
wsl --shutdown
```

## 8. 验证方式

按顺序做，能逐条打勾：

1. **进程在跑**

```bash
systemctl --user status fcitx5.service --no-pager
pgrep fcitx5
```

   期望：`Active: active (running)`，且 `pgrep` 有输出。

2. **环境变量在登录 shell 里生效**

```bash
echo "$GTK_IM_MODULE $XMODIFIERS $GDK_BACKEND"
```

   期望：`fcitx @im=fcitx x11`。

3. **跑官方诊断工具**（最关键的一步）

```bash
fcitx5-diagnose
```

   重点看三段：

| 段落 | 期望结果 |
| :--- | :--- |
| `## Xim` | `XMODIFIERS` 设置正确，且 `XIM_SERVERS on root window` 名字一致 |
| `## Gtk` | gtk3 / gtk4 探测都返回 `GTK_IM_MODULE=fcitx` |
| `## Qt` | qt5 / qt6 探测返回 `IM_MODULE_CLASSNAME=fcitx::QFcitxPlatformInputContext` |

   再往下的 `Addon List` 里应能找到 `Pinyin`、`X Input Method Frontend`、`Classic User Interface`。

4. **拼音确实可切换**

```bash
fcitx5-remote -o   # 激活
fcitx5-remote -n   # 期望输出 pinyin
fcitx5-remote -c   # 关闭
fcitx5-remote -n   # 期望输出 keyboard-us
```

5. **图形应用真的连上了输入法**（最接近实战）

   先在终端里启动应用，再看 fcitx5 收到的输入上下文数量：

```bash
google-chrome ~/ime-test.html &
sleep 10
fcitx5-diagnose | grep InputContext
```

   期望：`Group [x11::0] has 1 InputContext(s)`，数字 > 0 说明应用已连上。

   然后在窗口里按 `Ctrl+Space` 敲 `nihao`，出现候选词即成功。

6. **重启 WSL 后复测**（验证自启动与开始菜单覆盖）

```powershell
wsl --shutdown
```

   重开后不开任何终端，直接点开始菜单里的 Chrome，应能直接输入中文。

⚠️ 排查时的两个干扰源：

- `fcitx5-remote -n` 在**没有窗口获得焦点**时返回空或 `keyboard-us`，这是正常的，
  不代表配置失败——用 `-o` 激活后再看
- 日志里 `Failed to load pinyin history: io fail` 是**首次运行**没有历史词库文件导致，
  用一段时间后自动消失，不是故障

## 9. 文件清单

新增：

```text
/etc/profile.d/fcitx5-im.sh                          # 登录 shell 的输入法环境变量
/usr/local/bin/wslg-wait-x.sh                        # 等 XWayland socket 就绪（chmod +x）
~/.bashrc                                            # 末尾追加非登录 shell 的变量守卫块
~/.config/fcitx5/profile                             # 输入法列表：keyboard-us + pinyin
~/.config/systemd/user/fcitx5.service                # 自启动服务
~/.local/share/applications/google-chrome.desktop    # 开始菜单启动时注入环境变量
~/ime-test.html                                      # 验证用测试页，可删
```

修改：

```text
/etc/environment                                     # 仅做过测试，已还原为原样
loginctl linger                                      # /var/lib/systemd/linger/cql 已创建
```

> 注意：**没有**改动 `~/.profile`。自启动完全交给 systemd 用户服务，避免两处重复拉起。

## 10. 常用操作与排错

| 需求 | 操作 |
| :--- | :--- |
| 切换中英文 | `Ctrl+Space` |
| 打开图形配置（加双拼/五笔、调词库、换主题） | `fcitx5-configtool` |
| 重启输入法 | `systemctl --user restart fcitx5.service` |
| 看输入法日志 | `journalctl --user -u fcitx5.service -f` |
| 临时前台起一个调试 | `fcitx5 --disable=wayland -r`（`-r` 替换已有实例） |
| 彻底重置输入法配置 | 停服务后删 `~/.config/fcitx5` 与 `~/.local/share/fcitx5` |

**常见症状对照**：

| 症状 | 可能原因 |
| :--- | :--- |
| 所有应用都打不了字 | fcitx5 进程没起，或 `XMODIFIERS` 未设置 |
| Chrome 打不了、其它能打 | Chrome 的 XIM 没接上：查 `XMODIFIERS` 与 `XIM_SERVERS`（§8.3） |
| 原生 GTK 应用打不了、Chrome 能打 | 应用走了 Wayland 后端，检查 `GDK_BACKEND`（§6） |
| 终端里能用、开始菜单点图标不能用 | 走了 `wslg.exe` 直启路径（§7） |
| 候选词窗口不显示 | `classicui` 没加载，或字体缺失（确认 `fonts-noto-cjk`） |
| 显示方块 | 中文字体缺失，装 `fonts-noto-cjk` |

## 11. 待确认问题 / 后续

| 优先级 | 事项 | 当前状态 | 建议 |
| :--- | :--- | :--- | :--- |
| P0 | 开始菜单覆盖需重启 WSL 才生效 | 未复测 | 执行 `wsl --shutdown` 后点开始菜单图标验证；若仍失效，退而给 `/usr/bin/google-chrome-stable` 加 wrapper 脚本 |
| P1 | 其它图形应用（编辑器等）未做 `.desktop` 覆盖 | 未处理 | 需要时按 §7 逐个加，不必全量 |
| P2 | 云拼音 / 自定义词库未配置 | 未处理 | `fcitx5-configtool` 里可开 `cloudpinyin`；词库文件在 `~/.local/share/fcitx5/pinyin/` |
| P2 | Chrome 未加 apt 源，不能自动升级 | 已知 | 按 §5.1 补源，或定期重下 deb |
| P2 | 系统 locale 仍是 `C.UTF-8` | 有意保留 | 如需中文界面可生成 `zh_CN.UTF-8` 并改 `LANG`，但会让应用菜单变中文 |

### 11.1 已定稿、不再作为待确认项

- **输入法框架选 fcitx5**：已实测通过，不再考虑 ibus。
- **强制 X11 后端**：这是 WSLg 的硬约束，不是可选项（§6）。
- **自启动走 systemd 用户服务**：已验证 `active (running)` + `linger`，不再考虑 `~/.profile` 方案。

## 12. 落地记录

- **2026-10-12** 装 Chrome：直接下官方 deb 用 `apt-get install ./xxx.deb`，
  依赖走 aliyun 镜像只补了 `fonts-liberation` 两个包；**未添加 Google apt 源**（后续升级需手动）。
- **2026-10-12** 装 fcitx5 全家桶并预置拼音。首次诊断发现 `fcitx5-remote -n` 返回空，
  一度以为拼音没注册；实际是**当时没有窗口获得焦点**，用 `-o` 激活后返回 `pinyin`，配置本身没问题。
- **2026-10-12** 确定强制 X11 方案：先查清 WSLg 的 Weston 不支持 Wayland 输入法协议
  （对照 `microsoft/wslg#955`），才把 `GDK_BACKEND=x11` 写进环境变量，而不是只设 immodule 变量。
- **2026-10-12** 踩到「开始菜单启动不经 shell」：用 `wsl.exe -e env` 实测确认
  `GTK_IM_MODULE` / `XMODIFIERS` 全部缺失；又试了写 `/etc/environment`，**同样无效**；
  最终改用用户级 `.desktop` + `Exec=env ...` 注入。
- **2026-10-12** 验证：`fcitx5-diagnose` 的 Xim / Gtk / Qt 三段全绿；
  启动 Chrome 后 `Group [x11::0] has 1 InputContext(s)`，确认应用已连上输入法。
