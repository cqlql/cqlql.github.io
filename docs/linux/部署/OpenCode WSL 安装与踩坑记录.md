---
title: OpenCode WSL 安装与踩坑记录
icon: simple-icons:opencode
sort: 7
---

# OpenCode（桌面端 + CLI）在 WSL 的安装与踩坑记录

> **文档定位：这是一篇 Linux 环境部署笔记，含本次完整落地记录。**
> 目标：在 WSL2（WSLg）里装好 OpenCode **桌面端**，并让桌面端和 CLI 都能正常干活。
> 记录 GPU 进程崩溃导致「粘贴图片即重启」的定位链路、`.desktop` 启动项覆盖，
> 以及 CLI 读哪个剪贴板的证据（剪贴板方案本身见配套文档）。
>
> 配套文档：
> - 《WSL 安装 Linux 子系统》（同目录）—— 子系统安装，本文假设已装好
> - 《WSLg 中文输入法配置》（同目录）—— fcitx5 输入法，**本文只引用、不重复**
> - 《WSLg 剪贴板互通与图片同步》（同目录）—— **图片剪贴板同步 + CLI 走 X11 的完整方案都在那边**，本文不重复
> - 《systemctl》《journalctl》（`进程与服务/`）—— systemd 用户服务通用写法
>
> **环境**：Windows 11 + WSL `Ubuntu-24.04`（`systemd` 已启用），WSLg，WSL 用户 `cql`，
> OpenCode `2.0.32`，**无硬件 GPU（`/dev/dri` 不存在，全靠软件渲染）**。

**当前状态（2026-10-18，以本机实测为准）**：

| 部分 | 状态 |
| :--- | :--- |
| 桌面端安装（Linux `.deb` + WSLg） | ✅ 已完成 |
| 桌面端不再卡死（关闭 GPU 加速） | ✅ 已解决 |
| 桌面端中文输入法 | ✅ 见《WSLg 中文输入法配置》 |
| 桌面端 / CLI 粘贴 Windows 复制的**图片** | ✅ 见《WSLg 剪贴板互通与图片同步》 |

## 1. 结论先行（速查表）

| 症状 | 根因 | 解法 | 详见 |
| :--- | :--- | :--- | :--- |
| 桌面端粘贴图片时**卡死→自动重启** | 无 GPU，Chromium GPU 进程反复启动失败，达到阈值后 `LOG(FATAL)` 自杀 | 启动加 `--disable-gpu` | §3、§4 |
| 桌面端打不出中文 | WSLg 不转发 Windows 输入法 + Weston 不支持 Wayland 输入法协议 | fcitx5 + 强制 X11 + `.desktop` 注入 | 《WSLg 中文输入法配置》 |
| 图片粘不进桌面端 / CLI | WSLg 不桥接图片，且 **X11 与 Wayland 剪贴板互斥** | `winclip-sync` + 应用走 X11 | 《WSLg 剪贴板互通与图片同步》 |
| CLI 粘图片粘不上（即使 X11 里有图） | CLI 原生剪贴板**默认优先读 Wayland** | `env -u WAYLAND_DISPLAY` 启动 | §5 |

## 2. 安装桌面端

OpenCode 官方 Download 页给出各平台安装包，Linux 是 `.deb` / `.rpm`。直接下 `.deb`：

```bash
# /download/stable/linux-x64-deb 会 302 到 files/bin/<版本>/opencode-desktop-linux-amd64.deb
curl -fsSL -o /tmp/opencode-desktop.deb \
  "https://opencode.ai/download/stable/linux-x64-deb"

ls -lh /tmp/opencode-desktop.deb      # 约 209 MB
dpkg-deb -I /tmp/opencode-desktop.deb # 看包名/版本/依赖
```

包信息：

| 项 | 值 |
| :--- | :--- |
| 包名 | `opencode` |
| 主程序 | `/opt/OpenCode/ai.opencode.desktop`（Electron） |
| 启动项 | `/usr/share/applications/ai.opencode.desktop.desktop` |
| 依赖 | `libgtk-3-0` `libnotify4` `libnss3` `libxss1` `libxtst6` `xdg-utils` `libatspi2.0-0` `libuuid1` `libsecret-1-0` |
| Recommends | `libappindicator3-1` |

安装（**用 `--no-install-recommends`**）：

```bash
sudo apt-get install -y --no-install-recommends /tmp/opencode-desktop.deb
```

> ⚠️ 为什么带 `--no-install-recommends`：它的 Recommends 是 `libappindicator3-1`，
> 而 Ubuntu 24.04（noble）里这个包已被 `libayatana-appindicator3-1` 取代，apt 会因为找不到
> Recommends 而报错。托盘图标用不到，直接跳过。

装完可用 `ai.opencode.desktop` 启动；WSLg 会把窗口直接画到 Windows 桌面上（属于 Linux 版应用，不是原生 Windows 版）。

## 3. 坑一：粘贴图片时「卡死→重启」——真凶是 GPU 进程崩溃

### 3.1 症状

在桌面端里粘贴一张图片，程序卡死，随后自动重启。反复发生。

### 3.2 定位过程（可复用）

**第一步：确认它真的崩过、崩了几次。** Electron 的启动日志目录每次启动建一个，数量即重启次数：

```bash
ls -1 ~/.config/ai.opencode.desktop/logs    # 每个目录 = 一次启动
```

**第二步：看 Crashpad 转储里的致命错误。** 转储是 minidump，`strings` 就能读出关键的 `LOG(FATAL)`：

```bash
ls -la ~/.config/ai.opencode.desktop/Crashpad/pending/
strings ~/.config/ai.opencode.desktop/Crashpad/pending/*.dmp \
  | grep -iE "FATAL|crash|abort|GPU" | head
```

本机拿到的关键行：

```text
FATAL:content/browser/gpu/gpu_data_manager_impl_private.cc:417] GPU process isn't usable. Goodbye.
```

**第三步：内核侧佐证。** Chromium 的 `LOG(FATAL)` 会 `SIGTRAP`（signal 5），内核会记录：

```bash
sudo dmesg -T | grep -iE "opencode|fatal signal"
# [..] ai.opencode.desktop: potentially unexpected fatal signal 5.
```

**第四步：确认没有 GPU。**

```bash
ls -l /dev/dri        # 本机：不存在
```

### 3.3 根因

WSL 里没有硬件 GPU（无 `/dev/dri`），Chromium 的 **GPU 进程反复启动失败**；
失败次数超过阈值（`kGpuProcessMaxLaunchFailures`）后，Chromium 直接
`LOG(FATAL) << "GPU process isn't usable. Goodbye."` 自杀，整个应用退出。
粘贴图片是 GPU 重活（解码 + 合成），最容易踩中。

> 旁证：同一时期 `weston` 自己也在崩（`signal 6`），说明这套图形栈整体不稳。

### 3.4 解法：关闭 GPU 加速

启动时加 `--disable-gpu`（可选再配 `LIBGL_ALWAYS_SOFTWARE=1` 强制软件 GL）。加完确认 GPU 进程降级为软件：

```bash
pgrep -af 'type=gpu-process' | grep -oE '\-\-use-gl=[a-z]+' | head -1
# --use-gl=disabled
```

落地位置见 §4（因为要和输入法环境变量写在一起）。

## 4. 桌面端的启动项覆盖（同时修输入法与 GPU）

`wslg.exe` 从 Windows 开始菜单启动**不经 shell**，`/etc/profile.d`、`~/.bashrc`、
`/etc/environment` 全部无效（详见《WSLg 中文输入法配置》§7）。
因此在**用户级 `.desktop`** 里用 `env` 直接注入变量与参数。

`~/.local/share/applications/ai.opencode.desktop.desktop`：

```ini
[Desktop Entry]
Name=OpenCode
Exec=env GTK_IM_MODULE=fcitx QT_IM_MODULE=fcitx XMODIFIERS=@im=fcitx INPUT_METHOD=fcitx SDL_IM_MODULE=fcitx GDK_BACKEND=x11 QT_QPA_PLATFORM=xcb LIBGL_ALWAYS_SOFTWARE=1 /opt/OpenCode/ai.opencode.desktop --disable-gpu %U
Terminal=false
Type=Application
Icon=ai.opencode.desktop
StartupWMClass=ai.opencode.desktop
MimeType=x-scheme-handler/opencode;
Categories=Development;
Comment=Open source AI coding agent
```

> ⚠️ `Exec=` 必须写成**一行**（`.desktop` 不支持续行）。
> ⚠️ WSLg **只在发行版启动时扫描一次** `.desktop`，覆盖需 `wsl --shutdown` 后才生效。
> ⚠️ 这里的 `GDK_BACKEND=x11` 同时是**剪贴板前提** —— 桌面端读 X11，`winclip-sync` 才喂得到它
> （《WSLg 剪贴板互通与图片同步》§3）。

再配一个终端启动的包装脚本 `/usr/local/bin/opencode-desktop`：

```bash
#!/bin/bash
export GTK_IM_MODULE=fcitx QT_IM_MODULE=fcitx XMODIFIERS=@im=fcitx
export INPUT_METHOD=fcitx SDL_IM_MODULE=fcitx
export GDK_BACKEND=x11 QT_QPA_PLATFORM=xcb
export LIBGL_ALWAYS_SOFTWARE=1
exec /opt/OpenCode/ai.opencode.desktop --disable-gpu "$@"
```

## 5. CLI 读的是「宿主剪贴板」，默认走 Wayland

OpenCode CLI/TUI 的剪贴板是内嵌的原生库 `libopentui`（Bun 打包进二进制），
**同时支持 X11（xcb）与 Wayland**（`wl_data_device_manager` / `zwlr_data_control` / `ext_data_control`）。
验证方式——直接搜二进制的字符串：

```bash
BIN=$(readlink -f "$(command -v opencode)")
strings "$BIN" | grep -oE "xcb_get_property|XConvertSelection|wl_data_device_manager|zwlr_data_control_manager_v1" | sort -u
```

**实测（用 tmux 跑真实 TUI 发 `Ctrl+V`）**：

| 环境 | 图片放在 | 结果 |
| :--- | :--- | :--- |
| 默认（`WAYLAND_DISPLAY` 有值） | Wayland | ✅ 粘贴出 `[Image 1]` |
| `env -u WAYLAND_DISPLAY opencode` | X11 | ✅ 粘贴出 `[Image 1]` |

**即：CLI 有能力读 X11，只是默认优先 Wayland。** 因为 WSLg 下两个剪贴板互斥、而桌面端只能读 X11，
所以要让 CLI 也改读 X11 —— 包装函数、验证命令见《WSLg 剪贴板互通与图片同步》§5、§7。

> 试过 `OPENTUI_CLIPBOARD=x11` 这个变量，**无效**，不要走这条路；用 `unset WAYLAND_DISPLAY` 才可靠。

## 6. 文件清单

```text
/opt/OpenCode/ai.opencode.desktop                        # 桌面端主程序（apt 安装）
/usr/local/bin/opencode-desktop                          # 终端启动桌面端（输入法 + --disable-gpu）
~/.local/share/applications/ai.opencode.desktop.desktop  # 开始菜单启动项覆盖（输入法 + --disable-gpu）
~/.bashrc                                                # 追加 opencode() 包装函数（走 X11，见剪贴板文档）
```

由 apt 安装：`opencode`（桌面端）。

## 7. 排错速查表

| 症状 | 排查 |
| :--- | :--- |
| 桌面端崩溃/重启 | 看 `~/.config/ai.opencode.desktop/Crashpad/pending/*.dmp` 里的 `FATAL`；确认启动带了 `--disable-gpu` |
| 桌面端打不出中文 | 见《WSLg 中文输入法配置》；确认启动项带了 `GTK_IM_MODULE` / `GDK_BACKEND=x11` |
| 图片粘不进桌面端 / CLI | 见《WSLg 剪贴板互通与图片同步》§9 |
| 开始菜单启动的应用无输入法/参数 | `.desktop` 覆盖未生效 → `wsl --shutdown` 后重试 |

## 8. 踩坑要点（本机通用经验）

1. **`wslg.exe` 启动不经 shell**：`/etc/profile.d`、`~/.bashrc`、`/etc/environment` 全无效，
   只能靠 `.desktop` 的 `Exec=env ...` 注入（详见输入法笔记 §7）。
2. **WSLg 裁剪很多**：不转发输入法、不桥接图片剪贴板、X11 / Wayland 剪贴板互斥 ——
   遇到「WSL 里行为不对」，先怀疑 WSLg 的能力边界，别在应用层空转。
3. **Electron 应用的「莫名重启」先看 Crashpad**：`logs/` 目录数量 = 启动次数，
   minidump 里 `strings` 一下就有 `LOG(FATAL)` 原文，比翻 journal 快得多。

## 9. 落地记录

- **2026-10-18** 装桌面端：直接下官方 `.deb`，`apt-get install --no-install-recommends` 安装（规避 noble 缺失的 `libappindicator3-1`）。
- **2026-10-18** 定位「粘贴图片卡死」：从 `logs/` 目录数量确认多次重启 → Crashpad 转储读出
  `GPU process isn't usable. Goodbye.` → `dmesg` 佐证 `signal 5` → 确认无 `/dev/dri`。
  最终用 `--disable-gpu` 解决，GPU 进程降级为 `--use-gl=disabled`。
- **2026-10-18** 查 CLI 剪贴板实现：`strings` 二进制发现内嵌 `libopentui` 原生剪贴板，
  同时含 `xcb_*` 与 `wl_data_*`；用 tmux 跑真实 TUI 发 `Ctrl+V`，**两种后端都能读图**验证成立；
  `OPENTUI_CLIPBOARD=x11` 实测无效，最终用 `unset WAYLAND_DISPLAY`。
- **2026-10-30** 剪贴板部分（原 §5–§8、§9 的剪贴板验证、相关踩坑）拆到
  《WSLg 剪贴板互通与图片同步》，本文改为引用，只保留 OpenCode 特有的证据与结论。
