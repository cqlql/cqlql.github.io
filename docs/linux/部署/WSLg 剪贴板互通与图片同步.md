---
title: WSLg 剪贴板互通与图片同步
icon: mdi:clipboard-sync
sort: 6
---

# WSLg 剪贴板互通：把 Windows 的图片搬进 Linux 剪贴板

> **文档定位：这是一篇 Linux 运维笔记，含本次完整落地记录。**
> 目标：让 WSL 里的 Linux 应用（Electron 桌面端、终端 TUI 等）能**粘贴 Windows 里复制的图片**。
> 记录 WSLg 剪贴板能力边界（**文本双向桥接，图片只到 Wayland**）、X11 与 Wayland 剪贴板**互斥**、
> 常驻同步服务落地，以及 **RDP 剪贴板通道死锁**的诊断与恢复（不必 `wsl --shutdown`）。
>
> 配套文档：
> - 《WSL 安装 Linux 子系统》（同目录）—— 子系统安装，本文假设已装好
> - 《WSLg 中文输入法配置》（同目录）—— 复用其 `wslg-wait-x.sh` 与 `.desktop` / systemd 用户服务思路
> - 《OpenCode WSL 安装与踩坑记录》（同目录）—— 本文的**首个落地对象**，那边只留引用
> - 《systemctl》《journalctl》（`进程与服务/`）—— systemd 用户服务通用写法
>
> **环境**：Windows 11 + WSL `Ubuntu-24.04`（`systemd` 已启用），WSLg，WSL 用户 `cql`（uid 1000）。

**当前状态（2026-10-30 重新验证，以本机实测为准）**：

| 能力 | 状态 |
| :--- | :--- |
| Windows → Linux **图片**剪贴板（X11） | ✅ 自动同步（`winclip-sync.service`） |
| 终端 TUI / Electron 应用粘贴图片 | ✅ 已验证（`[Image 1]`） |
| Windows → Linux **图片**剪贴板（Wayland 原生） | ✅ WSLg 本就桥接 `image/bmp`，无需配置；但 `xclip` 取 X11 属主后立即消失（§3） |
| Windows → Linux **文本**剪贴板 | ⚠️ 会方向性失效，见 §6（`wsl --system` 里重启 weston 即可） |
| Linux → Windows（文本） | ✅ WSLg 原生支持，无需额外配置 |

## 1. 结论先行（速查表）

| 症状 | 根因 | 解法 | 详见 |
| :--- | :--- | :--- | :--- |
| Windows 复制的**图片**在 WSL 里粘贴不出来 | WSLg 把图片**只桥给 Wayland**（`image/bmp`），X11 侧拿不到；而 WSLg 下 X11 与 Wayland 剪贴板**互斥** | 起一个同步服务把图片塞进 Linux X11 剪贴板 | §2、§4 |
| 图片塞进 X11 了，某些应用还是粘不上 | 原生剪贴板库**优先读 Wayland**；WSLg 下 X11 与 Wayland 剪贴板**互斥** | 让该应用强制走 X11（`unset WAYLAND_DISPLAY` 或应用自身的 backend 参数） | §3、§5 |
| Windows 复制的**文本**也粘不进 WSL | WSLg RDP 剪贴板通道**死锁**（有未完成的传输请求，[wslg#1524](https://github.com/microsoft/wslg/issues/1524)） | 在 `wsl --system` 里 `pkill -9 weston`（重置 WSLg，不动容器） | §6 |

## 2. 能力边界：文本双向桥接，图片只到 Wayland

### 2.1 先确认你在正确的发行版里

> ⚠️ **前置检查**：如果你在 Docker Desktop 的 `docker-desktop` 发行版里操作，`xclip` **一定连不上 X**
> （症状见 §9 第一条）。原因是 WSLg 的 socket **按发行版隔离**：`/mnt/wslg/.X11-unix/X0` 属于
> **最后启动的发行版**，`/tmp/.X11-unix/` 才是本发行版的（WSLg 会 bind mount 过来）。
> `docker-desktop` 没有 bind mount，`/tmp/.X11-unix` 不存在，于是 `unable to open display ":0"` ——
> 这**不代表 WSLg 坏了**。用 `cat /etc/os-release` 确认是 `Ubuntu-24.04`（要看到 `/home/<你>`），
> 不是 `docker-desktop`；换回正确发行版执行 `wsl -d Ubuntu-24.04`。

### 2.2 实测

在 Windows 里复制一张图，两个剪贴板的表现**完全不一样**（这是全文的核心事实）：

```bash
# 正常状态：/tmp/.X11-unix/X0 应存在
ls -l /tmp/.X11-unix/X0

# X11（需先装 xclip）：只有文本 targets，压根看不到 image/*
xclip -selection clipboard -o -t TARGETS     # TIMESTAMP TARGETS UTF8_STRING TEXT
# Wayland（需先装 wl-clipboard）：图在这里，但类型是 image/bmp
wl-paste --list-types                        # image/bmp

# 数据是真的，不是空壳
wl-paste --type image/bmp > /tmp/win.bmp && identify /tmp/win.bmp   # BMP3 160x100 …  64KB
```

**结论：WSLg 把图片只桥给 Wayland（`image/bmp`），X11 侧拿不到，且没有配置开关能改变这一点。**
所以要粘图片进「读 X11 的应用」，只能**自己在 Linux 侧造一个 X11 剪贴板属主**（本文方案），
或换个思路（把图存文件再用路径）。

> 📌 别走「Wayland 中转」这条路：用 `wl-paste` 读 `image/bmp`、转成 PNG 再喂给 `xclip`，
> 看着比 §4 的 PowerShell 方案省事得多，但**实测一次 `timeout` 打断 `wl-paste` 就足以触发 §6 的死锁**，
> 之后连文本一起废掉（`wl-paste` 挂起、`xclip` 读到空）。本文「从 Windows 剪贴板 API 直接读」的
> 设计完全不碰 RDP 通道，正是为了避开这个雷。

## 3. 更要命的前提：X11 与 Wayland 剪贴板**互斥**

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

> 注意一个反直觉的地方：因为 WSLg 本来就把图片桥到了 Wayland（§2.2），
> **「只读 Wayland」的应用不配置也能粘图**；但反过来，一旦 `xclip` 拿下 X11 属主，
> Wayland 那一份立刻被清空 —— 所以「两边都能粘」在 WSLg 下是不存在的，必须挑一边。

**这条是所有麻烦的源头**：一套同步不可能同时喂饱「只读 Wayland」和「只读 X11」的应用。
**必须先确认目标应用读哪个剪贴板，再决定写哪个** —— 本文的统一选择是**全部改用 X11**。

> 查某个应用读哪个：看它有没有 `WAYLAND_DISPLAY`（Electron 可用 `GDK_BACKEND=x11` 强制），
> 或直接 `strings <二进制>` 看它链接了 `xcb_*` 还是 `wl_data_*`（OpenCode CLI 的做法见
> 《OpenCode WSL 安装与踩坑记录》§4.4）。

## 4. 落地方案：图片自动同步 + 应用走 X11

整体思路：**统一用 X11**（应用侧强制 X11，再让剪贴板属主也是 X11 的 `xclip`），
用一个常驻服务把 Windows 剪贴板里的图片搬进 X11。

### 4.1 Windows 侧：监听剪贴板变化

用 `GetClipboardSequenceNumber()` 轮询（便宜），只在变化时才读图，
有图就存成 PNG 并输出一行 `IMG`，无图输出 `NONE`。也兼容「资源管理器复制图片文件」的情形。

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
> 中文注释会导致 `ParserError`。踩过，别写中文。
> ⚠️ 必须 `-STA` 启动（剪贴板 API 要求单线程单元），见 §4.2 的 `-STA`。

### 4.2 Linux 侧：把图片写进 X11 剪贴板

`/usr/local/bin/winclip-sync`：

```bash
#!/bin/bash
# winclip-sync — 把 Windows 剪贴板的图片同步到 Linux X11 剪贴板
#   * 目标应用需读 X11（Electron 用 GDK_BACKEND=x11，TUI 用 env -u WAYLAND_DISPLAY）
# Windows 剪贴板变为「非图片」时释放属主，让 WSLg 的文本通道恢复。
# 图片直接从 Windows 剪贴板 API 读，不经过 WSLg 的 RDP 剪贴板通道（该通道会死锁，见 §6）。
set -uo pipefail

PSSCRIPT='C:\Users\cql13\.wsl-clip\watch-clip-image.ps1'
OUT_WIN='C:\Users\cql13\.wsl-clip\auto.png'
OUT_LIN='/mnt/c/Users/cql13/.wsl-clip/auto.png'

export DISPLAY="${DISPLAY:-:0}"
RUNDIR="${XDG_RUNTIME_DIR:-/tmp}"

# systemd 环境 PATH 可能不含 Windows 路径，用绝对路径更稳
PWSH=/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe
[ -x "$PWSH" ] || PWSH=powershell.exe

mkdir -p "$RUNDIR"
gen=0
owner=0

"$PWSH" -STA -NoProfile -ExecutionPolicy Bypass -File "$PSSCRIPT" -Out "$OUT_WIN" 2>/dev/null |
while IFS= read -r line; do
    line="${line%$'\r'}"   # PowerShell 输出 CRLF，去掉行尾 \r
    case "$line" in
        IMG)
            # /mnt/c 是异步落盘的：等文件大小连续两次相同再读
            prev=-1
            for _ in $(seq 1 50); do
                sz=$(stat -c %s "$OUT_LIN" 2>/dev/null || echo 0)
                if [ "$sz" -gt 0 ] && [ "$sz" = "$prev" ]; then break; fi
                prev=$sz
                sleep 0.1
            done
            [ -s "$OUT_LIN" ] || continue

            # 先快照到 Linux 侧：xclip 是懒加载读文件的，跨 9p 的文件被改写会读到半截
            gen=$((gen + 1))
            snap="$RUNDIR/winclip-$gen.png"
            cp -f "$OUT_LIN" "$snap" || continue

            pkill -x xclip 2>/dev/null
            sleep 0.1
            xclip -selection clipboard -t image/png -i "$snap" 2>/dev/null &
            owner=1
            rm -f "$RUNDIR/winclip-$((gen - 1)).png"
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
>
> 两处细节是为了躲 `/mnt/c` 跨系统的坑（§9 最后一条）：**等大小稳定**（而不是等文件存在）再读，
> 以及**先 `cp` 到 `$XDG_RUNTIME_DIR` 再交给 `xclip`** —— xclip 是懒加载读取输入文件的，
> 直接喂 `/mnt/c` 上的文件，一旦被下一次同步改写就会读到半截。

### 4.3 常驻服务

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

> `wslg-wait-x.sh` 来自《WSLg 中文输入法配置》（等 XWayland socket 就绪），没有它服务会在
> `graphical-session.target` 之前抢跑，`xclip` 连不上 `:0`。

### 4.4 手工兜底：`winimg`

不想等自动同步时，可手动搬一次（同样写 X11）：

```bash
#!/bin/bash
# /usr/local/bin/winimg —— 手动把 Windows 剪贴板图片放进 Linux X11 剪贴板
set -uo pipefail
PSSCRIPT='C:\Users\cql13\.wsl-clip\get-clip-image.ps1'
OUT_WIN='C:\Users\cql13\.wsl-clip\clip.png'
OUT_LIN='/mnt/c/Users/cql13/.wsl-clip/clip.png'
export DISPLAY="${DISPLAY:-:0}"
RUNDIR="${XDG_RUNTIME_DIR:-/tmp}"
PWSH=/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe
[ -x "$PWSH" ] || PWSH=powershell.exe

rm -f "$OUT_LIN"
if ! err=$("$PWSH" -STA -NoProfile -ExecutionPolicy Bypass -File "$PSSCRIPT" -Out "$OUT_WIN" 2>&1 >/dev/null); then
    echo "❌ 读取失败：${err%$'\r'}" >&2
    exit 1
fi

prev=-1
for _ in $(seq 1 50); do
    sz=$(stat -c %s "$OUT_LIN" 2>/dev/null || echo 0)
    if [ "$sz" -gt 0 ] && [ "$sz" = "$prev" ]; then break; fi
    prev=$sz
    sleep 0.1
done
[ -s "$OUT_LIN" ] || { echo "❌ $OUT_LIN 为空，图片没写出来" >&2; exit 1; }

snap="$RUNDIR/winimg-$$.png"
cp -f "$OUT_LIN" "$snap" || { echo "❌ 复制到 $snap 失败" >&2; exit 1; }
pkill -x xclip 2>/dev/null
sleep 0.1
if xclip -selection clipboard -t image/png -i "$snap"; then
    echo "✅ 已放入 Linux X11 剪贴板（$(identify -format '%wx%h' "$snap" 2>/dev/null)），去应用里 Ctrl+V"
else
    echo "❌ xclip 写入失败（DISPLAY=$DISPLAY）" >&2
    exit 1
fi
```

配套 `get-clip-image.ps1` 逻辑与 §4.1 相同，只是**单次执行**、有图就保存并打印路径、无图 `exit 2`。

## 5. 应用侧要配合：强制走 X11

同步服务只保证「X11 里有图」，**应用读不读 X11 是应用自己的事**。两种典型改法：

| 应用类型 | 改法 |
| :--- | :--- |
| Electron（GTK 后端） | 启动项 / 启动脚本里加 `GDK_BACKEND=x11`（配合 `--disable-gpu` 见《OpenCode WSL 安装与踩坑记录》§3） |
| 终端 TUI（Bun / Node 内嵌原生剪贴板） | 启动时 `env -u WAYLAND_DISPLAY <app>`；`~/.bashrc` 里包一个同名函数最省事 |

终端 TUI 的包装函数形态：

```bash
# ---- <app> CLI 剪贴板（WSLg）----
# WSLg 下 Wayland 与 X11 剪贴板互斥；winclip-sync 把图片放进 X11。
# 该 app 原生优先读 Wayland，这里让它改用 X11。
opencode() {
    local bin='' d
    # 不依赖 type -P 解析：fnm 的 multishell shim 目录按 shell 生成，会失效
    local IFS=:
    for d in $PATH; do
        if [ -x "$d/opencode" ] && [ ! -d "$d/opencode" ]; then
            bin="$d/opencode"
            break
        fi
    done
    if [ -z "$bin" ]; then
        echo "opencode: command not found" >&2
        return 127
    fi
    env -u WAYLAND_DISPLAY "$bin" "$@"
}
```

> 用函数而不是往 `/usr/local/bin` 放 wrapper：`~/.bashrc` 里 `export PATH="$HOME/.opencode/bin:$PATH"`
> 会把真实二进制放在最前，wrapper 会被盖住。函数只影响交互式 shell，**脚本 / 非交互场景不会套用**。
>
> ⚠️ **别用 `type -P opencode` 解析真实路径**：fnm 装的话二进制经由 `fnm_multishells/<pid>_<ts>/bin`
> 暴露，这个目录按 shell 生成、会失效，函数里一旦解析为空就直接 `command not found`（127）。
> 上面改成显式扫 `$PATH` 就稳了。验证：`bash -ic 'opencode --version'`。
>
> ⚠️ 某些 TUI 提供类似 `OPENTUI_CLIPBOARD=x11` 的环境变量，**实测无效**（OpenCode 2.0.32），
> 别在这上面空转，`unset WAYLAND_DISPLAY` 才可靠。

## 6. 坑：WSLg RDP 剪贴板通道死锁（文本方向失效）

现象：**Windows 复制文本到 WSL 也读不到**，但 **Linux → Windows 正常**。
更迷惑的是：`TARGETS` 里 `UTF8_STRING` / `TEXT` **照旧列着**，可内容取出来是空的；
`wl-paste` 会一直挂着不返回（`timeout` 也只能等超时）。看 WSLg 的 weston 日志：

```bash
tail -30 /mnt/wslg/weston.log
```

关键行（先别被这行吓到，**要看它后面有没有紧跟 `non-incr transfer read complete`** ——
跟了就是良性重试，一直不完成才是死锁）：

```text
RDP clipboard_data_source_send new (...:published:fd 131) vs prev (...:cancel pending:fd 129):
outstanding RDP data request (client to server)
```

**根因**（上游 [microsoft/wslg#1524](https://github.com/microsoft/wslg/issues/1524)，2026-10-22，WSLg 1.0.71 仍未修）：
weston 的 RDP 后端把「正在请求数据的那一方」记在 `ctx->clipboard_inflight_client_data_source` 里，
状态走 `RETRY → REQUEST_DATA →（等 Windows 回应）→ TRANSFERRED / CANCELED`。
一旦 Windows 侧没回（或回得太晚），这个 inflight source 就永久停在 `REQUEST_DATA` / `CANCEL_PENDING`，
而代码里**没有清理路径**：之后所有剪贴板请求都撞在这个分支上直接失败，直到 weston 重启。

触发条件是**传输进行到一半时被打断**，典型：

- `timeout` 或 Ctrl-C 打断正在等数据的 `wl-paste` / `xclip -o`（最容易踩，实测一次就中）；
- 剪贴板属主被强杀（例如同步脚本里频繁 `pkill xclip`）；
- 高频请求方把窗口放大 —— `fcitx5` 的剪贴板插件就是这种（关掉的方法见 §6.2）。

### 6.1 恢复：重启 weston 就够了，不用 `wsl --shutdown`

WSLg 的 weston 跑在独立的「系统发行版」里，从用户发行版看不到它的进程，得从 `wsl --system` 进去杀：

```powershell
wsl --system -- sh -c "pkill -9 weston"
```

`wslgd` 会立刻拉起新的 weston（几秒内 `ps ax | grep weston` 能看到新 PID）。
**容器、VS Code Server、`opencode serve` 全都不受影响**，只有 WSLg 的 GUI 窗口（和 `fcitx5`）会掉一次、随后自动恢复：

```bash
# 验证：新进程 + 剪贴板恢复
wsl --system -- sh -c "ps ax | grep [w]eston"   # 新 PID
xclip -selection clipboard -o                    # 能读出文本即恢复
```

> `wsl --shutdown` 当然也能恢复，但它会连带停掉 Docker Desktop 里所有容器和所有 WSL 会话，
> 只在「怀疑整个 WSL 状态都不对」时才用。日常剪贴板怪掉，用上面这一条。

> 这也解释了为什么「改了 `.desktop` / 换了服务」和「剪贴板怪了」动作很像 ——
> 前者要重载用户服务（`systemctl --user daemon-reload` + restart），后者只要重启 weston，
> 两者都**不需要**重启整个 WSL。

### 6.2 预防：关掉 fcitx5 的剪贴板插件

fcitx5 的 `clipboard` 插件在剪贴板属主每次变化时都会去读一遍内容（日志里出现
`selection request, CLIPBOARD, ... property FCITX_X11_SEL_CLIPBOARD`）。
在 WSLg 下这就是额外的 RDP 请求，而且恰好落在「属主刚换人」这个最危险的时刻上。

⚠️ **别指望改主配置能关掉它**：在 `~/.config/fcitx5/config` 里写 `[Addons/clipboard] Enabled=False`
（`[Addons/Clipboard]` 也试过）**实测无效** —— 重启后日志照旧打 `Loaded addon clipboard`，
请求照旧发。可靠的做法是在**用户级数据目录覆盖插件定义**（fcitx5 优先用 `~/.local/share/fcitx5/addon/`）：

`~/.local/share/fcitx5/addon/clipboard.conf`：

```ini
[Addon]
Name=Clipboard
Type=SharedLibrary
Library=libclipboard
Category=Module
Version=5.1.7
OnDemand=False
Configurable=True
Enabled=False

[Addon/OptionalDependencies]
0=xcb
1=wayland
```

```bash
systemctl --user restart fcitx5.service
journalctl --user -u fcitx5 -n 80 --no-pager -o cat | grep -c 'Loaded addon clipboard'   # 应为 0
```

验证效果（复制一次文本后再数 weston 日志）：

```bash
grep -c FCITX_X11_SEL_CLIPBOARD /mnt/wslg/weston.log    # 关掉后不再增长
```

**代价**：失去 fcitx5 的剪贴板历史（`Ctrl+;`）；输入法本身不受影响。
`Version` 等字段跟着发行版的 `fcitx5-modules` 走（本机 5.1.7），升级后若发现插件又活了，回来核对这几行。

## 7. 验证方式

```bash
# 1) 环境自检：在正确的发行版里，且本发行版的 X socket 在
cat /etc/os-release | grep PRETTY_NAME    # 应为 Ubuntu-24.04，不是 docker-desktop
ls -l /tmp/.X11-unix/X0

# 2) 服务在跑
systemctl --user is-active fcitx5.service winclip-sync.service

# 3) Windows 复制一张图片后，X11 剪贴板里应出现 image/png
xclip -selection clipboard -o -t TARGETS
xclip -selection clipboard -t image/png -o | identify -    # 能识别出尺寸即 OK

# 4) 复制文本后应释放属主（回到 WSLg 文本桥接）—— 注意要连「内容」一起验，
#    只看到 targets 不算通（§6 死锁时 targets 也照样列得出来）
xclip -selection clipboard -o -t TARGETS                   # 有 UTF8_STRING/TEXT
xclip -selection clipboard -o                              # 内容要能读出来，不能是空
wl-paste                                                   # Wayland 侧同样应能读到

# 5) 死锁自检：没有 X11 属主时，Wayland 应能直接看到 Windows 的图（§2.2）
wl-paste --list-types                                      # image/bmp

# 6) 预防生效：fcitx5 的剪贴板插件已关（§6.2），这两条不应再增长
grep -c FCITX_X11_SEL_CLIPBOARD /mnt/wslg/weston.log
grep -c 'outstanding RDP data request' /mnt/wslg/weston.log
```

**终端 TUI 端到端验证**（不依赖肉眼，用 tmux 跑真 TUI）：

```bash
tmux new-session -d -s t -x 190 -y 50
tmux send-keys -t t "bash -ic 'cd /tmp && opencode'" Enter   # -i 让 .bashrc 的函数生效
sleep 15
tmux send-keys -t t C-v
sleep 5
tmux capture-pane -t t -p | grep -E "Image|Ask anything"     # 期望出现 [Image 1]
tmux kill-session -t t
```

## 8. 文件清单

```text
/usr/local/bin/winclip-sync                              # 图片同步主程序
/usr/local/bin/winimg                                    # 手动同步兜底
~/.config/systemd/user/winclip-sync.service              # 常驻同步服务
~/.bashrc                                                # 追加 TUI 包装函数（走 X11）
~/.local/share/fcitx5/addon/clipboard.conf               # 覆盖插件定义，关掉 fcitx5 剪贴板请求（§6.2）
~/.config/fcitx5/config                                  # fcitx5 主配置（注意：addon 开关写这里无效）
C:\Users\cql13\.wsl-clip\watch-clip-image.ps1            # Windows 侧监听剪贴板
C:\Users\cql13\.wsl-clip\get-clip-image.ps1              # Windows 侧单次取图
C:\Users\cql13\.wsl-clip\{auto,clip}.png                 # 中转 PNG
```

由 apt 安装：`xclip`、`wl-clipboard`（诊断用）、`imagemagick`（`convert` / `identify`，验证图片用）。

## 9. 排错速查表

| 症状 | 排查 |
| :--- | :--- |
| `xclip` 报 `Error: Can't open display: :0`，或 `xdpyinfo` 同样报错 | 🔴 **先看你在哪个发行版**（§2.1）：`cat /etc/os-release` → 若是 `docker-desktop`，WSLg socket 不属于它，换回 `Ubuntu-24.04`。其次看 `ls -l /tmp/.X11-unix/X0` 是否存在（正常是 bind mount 过来的 socket） |
| 图片粘不进应用 | `xclip -o -t TARGETS` 是否有 `image/png`；`systemctl --user status winclip-sync` |
| 图片在 X11 里，TUI 仍粘不上 | 是否**新开终端**（函数已加载？`type opencode` 应显示 `is a function`） |
| 图片在 X11 里，Electron 仍粘不上 | 启动项是否带了 `GDK_BACKEND=x11` |
| **文本**也粘不进 | 先看是不是 §6 的死锁：`TARGETS` 有 `TEXT` 但 `xclip -o` 读不出内容 / `wl-paste` 挂住 → `wsl --system -- sh -c "pkill -9 weston"` |
| `wl-paste` 一直不返回、返回 0 字节 | 同上，RDP 通道死锁（多半是自己用 `timeout` 打断过它）→ 重启 weston，别再中途 kill |
| 日志里 `outstanding RDP data request` 一直在涨 | 分清是良性还是死锁：后面紧跟 `non-incr transfer read complete` = 良性重试（fcitx5 换属主时必现）；卡住不再完成 = 死锁，按 §6 处理 |
| `winclip-sync` 没反应 | `journalctl --user -u winclip-sync -f`；确认 `powershell.exe` 绝对路径可执行 |
| `IMG` 收到了但 `xclip` 没生效 | 检查 `OUT_LIN` 是否可读：脚本已改成**等大小稳定**再读（最多 5s），若仍失败多半是 `powershell.exe` 没真写出文件，手动跑 `get-clip-image.ps1` 看退出码 |

## 10. 踩坑要点（通用经验，与本文主题强相关）

1. **`pkill -f <关键字>` 会误杀自己**：命令里一旦包含同一关键字，`pkill -f` 连当前 shell 一起杀
   （本次多次「Killed by SIGTERM」就是这么来的）。改用 `pkill -x <进程名>`，或写括号 `'winclip[-]sync'`
   让自身命令行不匹配（注意：括号技巧要求命令里**不要**再出现该关键字的字面量）。
2. **PowerShell → bash 的行尾是 `\r\n`**：`read` 只去 `\n`，`\r` 会让 `case` / 比较静默失败，
   记得 `line="${line%$'\r'}"`。
3. **PowerShell 5.1 按 ANSI 读 `.ps1`**：中文注释会 `ParserError`，脚本保持纯 ASCII。
4. **systemd 用户服务不继承登录 shell 环境**，也不保证含 Windows 路径：需要的变量 / 路径显式写在
   `Environment=` 或脚本里用绝对路径。
5. **WSLg 裁剪很多**：不转发输入法、**图片只桥到 Wayland（不桥到 X11）**、Weston 不支持 Wayland 输入法协议、
   X11 / Wayland 剪贴板互斥 —— 遇到「WSL 里行为不对」，先怀疑 WSLg 的能力边界，别在应用层空转。
6. 🔴 **WSLg 的 socket 是「按发行版」而不是「按整机」的**：`/mnt/wslg/.X11-unix/X0` 属于**最后启动的
   那个发行版**，自己的发行版通过 bind mount 拿到 `/tmp/.X11-unix/X0`。所以在**别的**发行版
   （典型是 Docker Desktop 的 `docker-desktop`）里跑 `xclip` / GUI 应用，会 `Can't open display: :0`，
   这不是 WSLg 坏了，也不是配置问题 —— **先 `cat /etc/os-release` 确认自己在哪个发行版**，
   再去改配置。同理，systemd 用户服务（`winclip-sync`）必须在承载 `cql` 用户环境的发行版里跑。
7. 🔴 **不要用 `wl-paste` 当中转**：它确实能读到 Windows 的图（`image/bmp`），看着像是比 §4 更省事的路子，
   但 WSLg 的 RDP 剪贴板通道**一旦被中途打断就永久死锁**（§6），而中转方案天生要频繁请求这条通道。
   能「Windows 侧读 API + `xclip` 写 X11」，就别去碰 RDP 数据通道。
8. **fcitx5 的 addon 开关写主配置无效**：`~/.config/fcitx5/config` 里的 `[Addons/clipboard] Enabled=False`
   （大小写都试过）实测不生效，得在 `~/.local/share/fcitx5/addon/` 放一份 `Enabled=False` 的插件定义覆盖它（§6.2）。
9. **先确认「装过的东西还在」**：本文方案散落在 `/usr/local/bin`、`~/.config/systemd/user`、
   `C:\Users\cql13\.wsl-clip` 三处，发行版重置或换机器后很容易只剩一半。
   排错第一步是先 `ls` 一遍清单（§8），而不是怀疑配置写错了。

## 11. 落地记录

- **2026-10-18** 复现并确认「WSLg 不桥接图片」（⚠️ 该结论后被证伪，见下方 2026-10-30 修正），
  又实测确认「X11 与 Wayland 剪贴板互斥」。
- **2026-10-18** 落地 `winclip-sync`（Windows 侧 PowerShell 监听 + Linux 侧 `xclip`），
  过程中踩到 CRLF 静默不匹配、`pkill -f` 自杀、PS 脚本中文注释解析失败三个坑，均已修正。
  首个验证对象是 OpenCode（桌面端 + CLI），两边都能粘出 `[Image 1]`。
- **2026-10-18** 发现 Windows → Linux 文本剪贴板方向性失效，定位到 `weston.log` 的
  `outstanding RDP data request`，结论为需 `wsl --shutdown`；**尚未执行重启验证**
  （后于 2026-10-30 验证：只需重启 weston，见 §6.1）。
- **2026-10-30** 从《OpenCode WSL 安装与踩坑记录》中独立成篇（原 §5–§8），
  OpenCode 文档只保留引用与 CLI 特有的「读哪个剪贴板」证据。
- **2026-10-30** 按本文排查时误从 Docker Desktop 的 `docker-desktop` 发行版进入（`/usr/local/bin` 为空、
  `/mnt/c/Users/cql13/.wsl-clip` 不存在、`xclip` 未装、`/tmp/.X11-unix` 不存在、
  `xdpyinfo :0` 报 `unable to open display`，但 `/mnt/wslg/.X11-unix/X0` 能连上）。
  结论：**不是剪贴板配置丢了，是发行版选错了**。据此补了 §2.1 前置检查、§9 首条与踩坑第 6 条。
- **2026-10-30** 回到 `Ubuntu-24.04` 后发现整套落地**确实已不存在**（`xclip`/`wl-clipboard` 未装、
  `/usr/local/bin` 无 `winclip-sync` / `winimg`、无 systemd 单元、`C:\Users\cql13\.wsl-clip` 目录缺失），
  按本文整套重建；相比原文加了两处稳健性：等 `/mnt/c` 侧 PNG 大小连续两次一致再读、
  先快照到 `$XDG_RUNTIME_DIR` 再交给 `xclip`（xclip 是懒加载读文件，跨 9p 的文件被改写会读到半截）。
- **2026-10-30** 修正三处结论：① WSLg **会把图片桥到 Wayland**（`image/bmp`，数据有效），
  只是不到 X11 —— 原文「只桥接文本、不桥接图片」不准确（§2.2、§3）；
  ② RDP 死锁**不必** `wsl --shutdown`，`wsl --system` 里 `pkill -9 weston` 即可，容器 / VS Code Server 不受影响（§6.1）；
  ③ 验证要连「内容」一起验，只列 `TARGETS` 会把死锁误判成正常（§7）。
  同日还记下两条否证：`wl-paste` 中转方案被判死刑（一次 `timeout` 打断就触发死锁，§2.2），
  以及 fcitx5 剪贴板插件只能靠用户级插件定义关掉（§6.2）；关闭后同样的复制动作
  产生的 `FCITX_X11_SEL_CLIPBOARD` 与 `outstanding RDP` 日志均为 0 新增（实测）。
- **2026-10-30** `opencode()` 包装函数的 `type -P` 解析在 fnm 下失效（multishell shim 目录按 shell 生成，
  会返回空 → 函数报 127），改为显式扫 `$PATH`，见 §5。
