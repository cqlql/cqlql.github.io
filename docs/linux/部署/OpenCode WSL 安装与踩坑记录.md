---
title: OpenCode WSL 安装与踩坑记录
icon: simple-icons:opencode
sort: 6
---

# OpenCode（桌面端 + CLI）在 WSL 的安装与踩坑记录

> **文档定位：这是一篇 Linux 环境部署笔记，含本次完整落地记录。**
> 目标：在 WSL2（WSLg）里装好 OpenCode **桌面端**，并让**桌面端和 CLI 都能粘贴 Windows 里复制的图片**。
> 记录 GPU 进程崩溃、WSLg 剪贴板双向互斥、CLI 宿主剪贴板后端、WSLg RDP 剪贴板卡死等坑。
>
> 配套文档：
> - 《WSL 安装 Linux 子系统》（同目录）—— 子系统安装，本文假设已装好
> - 《WSLg 中文输入法配置》（同目录）—— fcitx5 输入法，**本文只引用、不重复**
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
| Windows → Linux **图片**剪贴板（X11） | ✅ 自动同步（`winclip-sync.service`） |
| CLI 粘贴图片（走 X11） | ✅ 已验证（`[Image 1]`） |
| Windows → Linux **文本**剪贴板 | ⚠️ 方向性故障，见 §8（需 `wsl --shutdown`） |

## 1. 结论先行（速查表）

| 症状 | 根因 | 解法 | 详见 |
| :--- | :--- | :--- | :--- |
| 桌面端粘贴图片时**卡死→自动重启** | 无 GPU，Chromium GPU 进程反复启动失败，达到阈值后 `LOG(FATAL)` 自杀 | 启动加 `--disable-gpu` | §3 |
| 桌面端打不出中文 | WSLg 不转发 Windows 输入法 + Weston 不支持 Wayland 输入法协议 | fcitx5 + 强制 X11 + `.desktop` 注入 | 《WSLg 中文输入法配置》 |
| Windows 复制的**图片**在 WSL 里粘贴不出来 | **WSLg 根本不桥接图片**（只桥接文本） | 起一个同步服务把图片塞进 Linux 剪贴板 | §5、§7 |
| 图片塞进 X11 了，CLI 还是粘不上 | CLI 原生剪贴板**优先读 Wayland**；WSLg 下 X11 与 Wayland 剪贴板**互斥** | 让 CLI 走 X11（`unset WAYLAND_DISPLAY`） | §6 |
| Windows 复制的**文本**也粘不进 WSL | WSLg RDP 剪贴板通道**卡死**（有未完成的传输请求） | `wsl --shutdown` 重置 WSLg | §8 |

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

再配一个终端启动的包装脚本 `/usr/local/bin/opencode-desktop`：

```bash
#!/bin/bash
export GTK_IM_MODULE=fcitx QT_IM_MODULE=fcitx XMODIFIERS=@im=fcitx
export INPUT_METHOD=fcitx SDL_IM_MODULE=fcitx
export GDK_BACKEND=x11 QT_QPA_PLATFORM=xcb
export LIBGL_ALWAYS_SOFTWARE=1
exec /opt/OpenCode/ai.opencode.desktop --disable-gpu "$@"
```

## 5. 坑二：WSLg 根本不转发「图片」剪贴板

### 5.1 实测

在 Windows 里复制一张图，WSL 侧两个剪贴板都读不到 `image/png`：

```bash
# X11（需先装 xclip）
xclip -selection clipboard -o -t TARGETS     # TIMESTAMP TARGETS UTF8_STRING TEXT
# Wayland（需先装 wl-clipboard）
wl-paste --list-types                        # text/plain;charset=utf-8 STRING
```

**结论：WSLg 只桥接文本，图片不支持，且没有开关能打开。**

### 5.2 更要命的发现：X11 与 Wayland 剪贴板**互斥**

WSLg 的 Weston 在 X11（XWayland）与 Wayland 之间**不是同步两份**，而是「谁最后写谁生效，另一个立刻被清空」：

```bash
# 只设 Wayland
wl-copy --type image/png < img ; wl-paste --list-types    # image/png
xclip -selection clipboard -o -t TARGETS                  # TIMESTAMP TARGETS UTF8_STRING TEXT
sleep 1
# 再设 X11
xclip -selection clipboard -t image/png -i img
wl-paste --list-types                                     # ← 变空！
```

反过来也一样（先 X11 再 Wayland → X11 被清成文本）。

**这条是所有麻烦的源头**：一套同步不可能同时喂饱只读 Wayland 的 CLI 和只读 X11 的桌面端。
必须先确认目标应用读哪个剪贴板，再决定写哪个。

## 6. 坑三：CLI 读的是「宿主剪贴板」，默认走 Wayland

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

**即：CLI 有能力读 X11，只是默认优先 Wayland。** 因此让它改读 X11 即可与桌面端共用同一个剪贴板。

> 试过 `OPENTUI_CLIPBOARD=x11` 这个变量，**无效**，不要走这条路；用 `unset WAYLAND_DISPLAY` 才可靠。

## 7. 落地方案：图片自动同步 + CLI 走 X11

整体思路：**统一用 X11**（桌面端本来就强制 X11，再让 CLI 也读 X11），
用一个常驻服务把 Windows 剪贴板里的图片搬进 X11。

### 7.1 Windows 侧：监听剪贴板变化

用 `GetClipboardSequenceNumber()` 轮询（便宜），只在变化时才读图，
有图就存成 PNG 并输出一行 `IMG`，无图输出 `NONE`。

`C:\Users\cql13\.wsl-clip\watch-clip-image.ps1`：

```powershell
param(
    [string]$Out = "$env:TEMP\wsl-clip.png",
    [int]$IntervalMs = 700
)
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -Namespace Win32 -Name Clip -MemberDefinition '[DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber();'

$lastSeq = [uint32]::MaxValue
$lastHash = ''
while ($true) {
    $seq = [Win32.Clip]::GetClipboardSequenceNumber()
    if ($seq -ne $lastSeq) {
        $lastSeq = $seq
        $img = $null
        try { $img = [System.Windows.Forms.Clipboard]::GetImage() } catch { $img = $null }
        if ($null -eq $img) {
            $files = $null
            try { $files = [System.Windows.Forms.Clipboard]::GetFileDropList() } catch { $files = $null }
            if ($files) {
                foreach ($f in $files) {
                    $ext = [System.IO.Path]::GetExtension($f).ToLower()
                    if (@('.png','.jpg','.jpeg','.gif','.bmp','.webp','.tif','.tiff') -contains $ext) {
                        try { $img = [System.Drawing.Image]::FromFile($f); break } catch { $img = $null }
                    }
                }
            }
        }
        if ($null -ne $img) {
            $ms = New-Object System.IO.MemoryStream
            $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
            $bytes = $ms.ToArray()
            $img.Dispose()
            $sha = [System.Security.Cryptography.SHA1]::Create()
            $hash = [BitConverter]::ToString($sha.ComputeHash($bytes))
            if ($hash -ne $lastHash) {
                $lastHash = $hash
                [System.IO.File]::WriteAllBytes($Out, $bytes)
                [Console]::Out.WriteLine('IMG')
                [Console]::Out.Flush()
            }
        } else {
            $lastHash = ''
            [Console]::Out.WriteLine('NONE')
            [Console]::Out.Flush()
        }
    }
    Start-Sleep -Milliseconds $IntervalMs
}
```

> ⚠️ **`.ps1` 只用 ASCII 注释**：Windows PowerShell 5.1 默认按系统 ANSI（中文机器上是 GBK）读脚本，
> 中文注释会导致 `ParserError`。这是踩过的坑，别写中文。

### 7.2 Linux 侧：把图片写进 X11 剪贴板

`/usr/local/bin/winclip-sync`：

```bash
#!/bin/bash
# winclip-sync — 把 Windows 剪贴板的图片同步到 Linux X11 剪贴板
#   * 桌面端（Electron，强制 X11）直接可用
#   * opencode CLI 通过 ~/.bashrc 的包装函数改走 X11（见 §7.4）
# Windows 剪贴板变为「非图片」时释放属主，让 WSLg 的文本通道恢复。
set -uo pipefail

PS1='C:\Users\cql13\.wsl-clip\watch-clip-image.ps1'
OUT_WIN='C:\Users\cql13\.wsl-clip\auto.png'
OUT_LIN='/mnt/c/Users/cql13/.wsl-clip/auto.png'

export DISPLAY="${DISPLAY:-:0}"

# systemd 环境 PATH 可能不含 Windows 路径，用绝对路径更稳
PWSH=/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe
[ -x "$PWSH" ] || PWSH=powershell.exe

owner=0
"$PWSH" -STA -NoProfile -ExecutionPolicy Bypass -File "$PS1" -Out "$OUT_WIN" 2>/dev/null |
while IFS= read -r line; do
    line="${line%$'\r'}"   # PowerShell 输出 CRLF，去掉行尾 \r
    case "$line" in
        IMG)
            for _ in $(seq 1 30); do
                [ -s "$OUT_LIN" ] && break
                sleep 0.1
            done
            [ -s "$OUT_LIN" ] || continue
            pkill -x xclip 2>/dev/null
            xclip -selection clipboard -t image/png -i "$OUT_LIN" 2>/dev/null &
            owner=1
            ;;
        NONE)
            if [ "$owner" = 1 ]; then
                pkill -x xclip 2>/dev/null
                owner=0
            fi
            ;;
    esac
done
```

> ⚠️ `line="${line%$'\r'}"` 这句不能省：PowerShell 输出是 `\r\n`，
> bash 的 `read` 只去 `\n`，留下的 `\r` 会让 `case "$line" in IMG)` **静默不匹配**（踩过）。

### 7.3 常驻服务

`~/.config/systemd/user/winclip-sync.service`：

```ini
[Unit]
Description=Windows clipboard image to X11 clipboard sync (WSLg)
After=graphical-session.target

[Service]
Type=simple
Environment=DISPLAY=:0
Environment=WAYLAND_DISPLAY=wayland-0
Environment=XDG_RUNTIME_DIR=/run/user/1000
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStartPre=/usr/local/bin/wslg-wait-x.sh
ExecStart=/usr/local/bin/winclip-sync
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

```bash
chmod +x /usr/local/bin/winclip-sync
systemctl --user daemon-reload
systemctl --user enable --now winclip-sync.service
```

> `wslg-wait-x.sh` 来自《WSLg 中文输入法配置》（等 XWayland socket 就绪）。

### 7.4 让 CLI 改走 X11

在 `~/.bashrc` 末尾追加一个包装函数（**开新终端才生效**）：

```bash
# ---- opencode CLI 剪贴板（WSLg）----
# WSLg 下 Wayland 与 X11 剪贴板互斥；winclip-sync 把图片放进 X11。
# opencode 原生优先读 Wayland，这里让它改用 X11，这样 CLI 也能粘贴图片。
opencode() {
    local bin="$HOME/.opencode/bin/opencode"
    [ -x "$bin" ] || bin="$(type -P opencode)"
    env -u WAYLAND_DISPLAY "$bin" "$@"
}
```

> 用函数而不是改 PATH：`~/.bashrc` 里 `export PATH="$HOME/.opencode/bin:$PATH"` 把真实二进制放在最前，
> 放 `/usr/local/bin` 的 wrapper 会被它盖住。函数只影响交互式 shell，**脚本/非交互场景不会套用**。

### 7.5 手工兜底：`winimg`

不想等自动同步时，可手动搬一次（同样写 X11）：

```bash
#!/bin/bash
# /usr/local/bin/winimg —— 手动把 Windows 剪贴板图片放进 Linux X11 剪贴板
PS1='C:\Users\cql13\.wsl-clip\get-clip-image.ps1'
OUT_WIN='C:\Users\cql13\.wsl-clip\clip.png'
OUT_LIN='/mnt/c/Users/cql13/.wsl-clip/clip.png'
export DISPLAY="${DISPLAY:-:0}"
err=$(/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe -STA -NoProfile \
  -ExecutionPolicy Bypass -File "$PS1" -Out "$OUT_WIN" 2>&1 >/dev/null) || {
    echo "❌ 读取失败: $err" >&2; exit 1; }
for _ in $(seq 1 30); do [ -s "$OUT_LIN" ] && break; sleep 0.1; done
xclip -selection clipboard -t image/png -i "$OUT_LIN" && echo "✅ 已放入 Linux 剪贴板，去应用里 Ctrl+V"
```

配套 `get-clip-image.ps1` 逻辑与 §7.1 相同，只是单次执行、有图就保存并打印路径、无图 `exit 2`。

## 8. 坑四：WSLg RDP 剪贴板通道卡死（文本方向失效）

排查时发现 **Windows 复制文本到 WSL 也读不到**（X11/Wayland 都空），但 **Linux → Windows 正常**。
看 WSLg 的 weston 日志：

```bash
tail -30 /mnt/wslg/weston.log
```

关键行：

```text
RDP clipboard_data_source_send new (...:published:fd 131) vs prev (...:cancel pending:fd 129):
outstanding RDP data request (client to server)
```

**根因**：RDP 剪贴板有一个**未完成的传输请求**卡住（`cancel pending`），
后续 Windows → Linux 的剪贴板传输全部被挡住。这是 WSLg / `msrdc` 的已知毛病，
常见诱因是**传输进行到一半时剪贴板属主被强杀**（比如频繁 `pkill xclip`）。

**解法**：重启 WSLg，即

```powershell
wsl --shutdown
```

> 这也顺带让 §4 的 `.desktop` 覆盖、以及所有 systemd 用户服务（`fcitx5` / `winclip-sync`）重新生效。

## 9. 验证方式

```bash
# 1) 服务在跑
systemctl --user is-active fcitx5.service winclip-sync.service

# 2) Windows 复制一张图片后，X11 剪贴板里应出现 image/png
xclip -selection clipboard -o -t TARGETS
xclip -selection clipboard -t image/png -o | identify -    # 能识别出尺寸即 OK

# 3) 复制文本后应释放属主（回到 WSLg 文本桥接）
xclip -selection clipboard -o -t TARGETS                   # 有 UTF8_STRING/TEXT
```

**CLI 端到端验证**（不依赖肉眼，用 tmux 跑真 TUI）：

```bash
tmux new-session -d -s t -x 190 -y 50
tmux send-keys -t t "bash -ic 'cd /tmp && opencode'" Enter   # -i 让 .bashrc 的函数生效
sleep 15
tmux send-keys -t t C-v
sleep 5
tmux capture-pane -t t -p | grep -E "Image|Ask anything"     # 期望出现 [Image 1]
tmux kill-session -t t
```

## 10. 文件清单

新增：

```text
/usr/local/bin/opencode-desktop                          # 终端启动桌面端（输入法 + --disable-gpu）
/usr/local/bin/winclip-sync                              # 图片同步主程序
/usr/local/bin/winimg                                    # 手动同步兜底
~/.config/systemd/user/winclip-sync.service              # 常驻同步服务
~/.local/share/applications/ai.opencode.desktop.desktop  # 开始菜单启动项覆盖（输入法 + --disable-gpu）
~/.bashrc                                                # 追加 opencode() 包装函数（走 X11）
C:\Users\cql13\.wsl-clip\watch-clip-image.ps1            # Windows 侧监听剪贴板
C:\Users\cql13\.wsl-clip\get-clip-image.ps1              # Windows 侧单次取图
C:\Users\cql13\.wsl-clip\{auto,clip}.png                 # 中转 PNG
```

由 apt 安装：`opencode`（桌面端）、`xclip`、`wl-clipboard`、`xdotool`（调试用）。

## 11. 排错速查表

| 症状 | 排查 |
| :--- | :--- |
| 桌面端崩溃/重启 | 看 `~/.config/ai.opencode.desktop/Crashpad/pending/*.dmp` 里的 `FATAL`；确认启动带了 `--disable-gpu` |
| 桌面端打不出中文 | 见《WSLg 中文输入法配置》；确认启动项带了 `GTK_IM_MODULE` / `GDK_BACKEND=x11` |
| 图片粘不进桌面端 | `xclip -o -t TARGETS` 是否有 `image/png`；`systemctl --user status winclip-sync` |
| 图片粘不进 CLI | 是否用**新开终端**（函数是否已加载：`type opencode` 应显示 `is a function`） |
| CLI 文本也粘不进 | 可能就是 §8 的 RDP 通道卡死 → `wsl --shutdown` |
| `winclip-sync` 没反应 | 看 `journalctl --user -u winclip-sync -f`；确认 `powershell.exe` 绝对路径可执行 |
| 开始菜单启动的应用无输入法/参数 | `.desktop` 覆盖未生效 → `wsl --shutdown` 后重试 |

## 12. 踩坑要点（通用经验，与 OpenCode 无关）

1. **`pkill -f <关键字>` 会误杀自己**：命令里一旦包含同一关键字，`pkill -f` 连当前 shell 一起杀
   （本次多次「Killed by SIGTERM」就是这么来的）。改用 `pkill -x <进程名>`，或写括号 `'winclip[-]sync'` 让自身命令行不匹配
   （注意：括号技巧要求命令里**不要**再出现该关键字的字面量）。
2. **PowerShell → bash 的行尾是 `\r\n`**：`read` 只去 `\n`，`\r` 会让 `case`/比较静默失败，记得 `line="${line%$'\r'}"`。
3. **PowerShell 5.1 按 ANSI 读 `.ps1`**：中文注释会 `ParserError`，脚本保持纯 ASCII。
4. **systemd 用户服务不继承登录 shell 环境**，也不保证含 Windows 路径：需要的变量/路径显式写在 `Environment=` 或脚本里用绝对路径。
5. **`wslg.exe` 启动不经 shell**：`/etc/profile.d`、`~/.bashrc`、`/etc/environment` 全无效，只能靠 `.desktop` 的 `Exec=env ...` 注入（详见输入法笔记 §7）。
6. **WSLg 裁剪很多**：不转发输入法、不桥接图片剪贴板、Weston 不支持 Wayland 输入法协议、X11/Wayland 剪贴板互斥——遇到「WSL 里行为不对」，先怀疑 WSLg 的能力边界，别在应用层空转。

## 13. 落地记录

- **2026-10-18** 装桌面端：直接下官方 `.deb`，`apt-get install --no-install-recommends` 安装（规避 noble 缺失的 `libappindicator3-1`）。
- **2026-10-18** 定位「粘贴图片卡死」：从 `logs/` 目录数量确认多次重启 → Crashpad 转储读出
  `GPU process isn't usable. Goodbye.` → `dmesg` 佐证 `signal 5` → 确认无 `/dev/dri`。
  最终用 `--disable-gpu` 解决，GPU 进程降级为 `--use-gl=disabled`。
- **2026-10-18** 复现并确认「WSLg 不桥接图片」，又实测确认「X11 与 Wayland 剪贴板互斥」。
- **2026-10-18** 查 CLI 剪贴板实现：`strings` 二进制发现内嵌 `libopentui` 原生剪贴板，
  同时含 `xcb_*` 与 `wl_data_*`；用 tmux 跑真实 TUI 发 `Ctrl+V`，**两种后端都能读图**验证成立；
  `OPENTUI_CLIPBOARD=x11` 实测无效，最终用 `unset WAYLAND_DISPLAY`。
- **2026-10-18** 落地 `winclip-sync`（Windows 侧 PowerShell 监听 + Linux 侧 `xclip`），
  过程中踩到 CRLF 静默不匹配、`pkill -f` 自杀、PS 脚本中文注释解析失败三个坑，均已修正。
- **2026-10-18** 发现 Windows → Linux 文本剪贴板方向性失效，定位到 `weston.log` 的
  `outstanding RDP data request`，结论为需 `wsl --shutdown`；**尚未执行重启验证**。
