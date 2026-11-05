> 状态：**已实现（S2/S3/S5 + 图标同源；S4 真实桌面人工验收待做）**（2026-11-05）
> **S5 已落地**：双击 `启动运维.cmd` 直接开网页面板——隐藏 cmd 守护 + 自动开浏览器 +
> 单实例 + 日志轮转；页面上有「关闭界面」。**退出码 75 自重建 / `ops.exe.new` 换身未做**，
> 源码改动仍需手动 `go build`，见 §4.4。

# 一键启动与桌面快捷方式

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)；配置键见 [config.md](config.md)。
>
> 通用母本：`cqlql-notes/docs/工程/桌面启动器与本地网页面板.md`（跨项目施工图）。
> 本文是它的**本仓实例**：通用判据以母本为准，这里只留本仓常量、状态与验收记录。
>
> 🔴 **本文的定位**：以后任何项目要做「桌面双击一个图标就能用这个工具」，**只看这一篇**即可，
> 不必再去读参考项目的源码。§3 / §4 给出可直接复制的骨架，§6 是「换项目只改这些」的常量表，
> §8 是验收清单。
>
> ✅ **本仓已按本文落地 S2/S3/S5**：`ops shortcut`、`ops menu`、仓根 `启动运维.cmd`、
> `internal/ui/ops.ico`（`go:embed` 一份两用）、后台网页模式与单测；`.lnk` 与图标
> 已用覆盖变量真机验证（不写真桌面，见 §8），后台链路已用临时配置目录端到端验证。
> 规范反推自 `D:\_work\suikouji` 的参考实现，§10 只在核对细节时看。

---

## 0. 一页速用

三段结构，**形状固定**：

```
桌面 .lnk  →  仓库根「启动运维.cmd」  →  ops.exe <动词>
（只存路径）   （构建/配置/单实例/前后台）   （真正干活）
```

**无参双击的动词是 `ui --background`**：前台这一层立刻退出，隐藏 cmd 接管
`ops ui`，浏览器自动打开带 token 的地址；第二次双击只把浏览器指回同一个实例。

三句红线：

1. 🔴 `.lnk` **必须指向启动器**，不能直接指 `ops.exe`——指 exe 会绕过构建、配置模板、
   单实例判断，首次换机器必然「双击没反应」。
2. 🔴 `IconLocation` **必须指向一份独立的 `.ico`**，不能指 exe——Go 编出来的 exe 没嵌
   Windows 图标资源，指过去只会得到一个空白图标。
3. 🔴 快捷方式名会拼进文件路径，**必须校验**；`--name ..\..\evil` 能把文件写到桌面外面。

换项目只改 §6 那张表里的常量；其余结构、脚本、测试矩阵原样复制。

---

## 1. 要解决什么

本地单二进制运维工具平时靠手敲 `ops xxx`。想要的是：桌面上一个带图标的入口，
双击就能用，不用记命令、不用先开终端、不用管「exe 有没有构建过 / 配置有没有生成」。

**做**（全部只发生在本机）：

- 桌面 `.lnk` 的创建 / 删除 / 改名；
- 启动器的构建兜底、配置模板生成、单实例判断、前台/后台切换、参数透传；
- 双击直达网页面板；`--menu` 仍保留那个「只列已实现动词」的交互入口。

**不做**：

- ❌ 不改远端任何东西，不提权、不写注册表、不设开机自启、不做安装器/卸载器；
- ❌ 不把业务参数（主机、端口、组件名、token）写进 `.lnk` 的 `Arguments`；
- ❌ 不因为「双击了一下」就执行写操作。双击开的是**只读**的服务器清单页；唯一的写
  （一键免密 sudo）要人在页面上点、还要输密码。本仓的 `backup deploy` 会写 crontab /
  logrotate，双击触发它等于把 [backup-deploy.md](backup-deploy.md) 的「安装与监控分离」红线绕过去；
- ❌ 不做 macOS / Linux 的等价物伪装：`.lnk` 与 `WScript.Shell` 是 Windows 专属，
  其它平台要明确报「请自己建一个指向启动器的启动器」。

---

## 2. 三段结构：每层只干一件事

| 层 | 文件 | 职责 | 不能做 |
| :--- | :--- | :--- | :--- |
| 快捷方式 | 桌面 `<名字>.lnk` | `TargetPath` / `WorkingDirectory` / `IconLocation` / `Description` / `WindowStyle` | 不带业务参数、不直接指 exe、不写配置 |
| 启动器 | 仓库根 `启动运维.cmd` | 定位或构建 exe、首次写配置模板、单实例、前后台、日志、参数透传 | 不实现业务逻辑、不判断该跑哪个远端动作 |
| 程序 | `ops.exe <动词>` | 真正的命令（`init` / `ui` / `backup deploy` / `menu` …） | 不关心自己是被双击还是被手敲启动的 |

**为什么 `.lnk` 不直接指 exe**：启动器承担的是「这台机器现在能不能跑」的判断。
直接指 exe 会把这些全绕过去，表现是「别人电脑上好好的，我双击没反应」，
而且错误现场没有任何提示。

**为什么启动器放仓库根而不是 `ops/` 内**：`%~dp0` 天然是仓库根，
配置目录、兄弟仓库（`pass-up.backend/deploy/backup`）的相对路径都从这里算；
放深一层就得靠 `..` 拼，容易和 `findUp` 的层级判断打架。

---

## 3. 快捷方式创建（唯一实现）

### 3.1 只有一个创建函数

`CreateShortcutOnDesktop(name)` 是**唯一**实现，`ops shortcut` 命令与界面右上角的
「创建桌面快捷方式」按钮都调它。理由和 [backup-deploy.md](backup-deploy.md) 的
「一份 cron 逻辑」相同：界面自己再拼一遍路径，就会出现「命令行建出来能用、界面建出来指向别处」。

🔴 **界面侧靠注入拿到它**：`ui.CmdUI(args, static, createShortcut)` 的第三个参数由
`main.go` 传 `launcher.CreateShortcutOnDesktop`。不能改成 `ui` 直接 import `launcher`
——`launcher` 已经 import `ui`（图标字节），反过来就成环。这与菜单的
`launcher.CmdMenu(args, exec, probe)` 是同一套注入风格。

配套函数，签名固定：

```go
func CreateShortcutOnDesktop(name string) (shared.ShortcutInfo, error) // 建，返回 lnk/启动器/图标
func removeShortcutOnDesktop(name string) (path string, removed bool, err error) // 删，本来没有不算错
func validateShortcutName(name string) error                      // 名字校验
func desktopDir() (string, error)                                // 真实桌面目录
func launcherPath() (string, error)                              // 向上找启动器
```

`shared.ShortcutInfo` 只带 `path` / `launcher` / `icon` 三个字段：命令行打印、页面显示、
HTTP 响应用的是同一份模型（放 `shared` 是因为 `ui` 与 `launcher` 都要用，而两边不能互相
import）。

### 3.2 用 PowerShell 的 WScript.Shell 建 .lnk

`.lnk` 是没公开文档的复合结构（Shell Link Binary），手写等于把「微软哪天改一格」
变成自己的 bug；为一次调用引 COM 库又会给单二进制工具加依赖。
`powershell -Command` 调 `WScript.Shell.CreateShortcut` 最划算。

**脚本必须是纯函数** `shortcutScript(lnk, target, workdir, icon) string`，
测试直接断言生成的文本，不用真的去点桌面。可直接复制：

```powershell
$ErrorActionPreference = 'Stop'
$lnk = '<lnk>'
$parent = Split-Path -Parent $lnk
if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnk)
$sc.TargetPath = '<launcher>'
$sc.Arguments = ''
$sc.WorkingDirectory = '<launcher 所在目录>'
$sc.IconLocation = '<ico 路径>,0'
$sc.Description = '<项目名> · 运维：双击打开本地运维界面'
$sc.WindowStyle = 7
$sc.Save()
```

调用方式固定：

```go
exec.Command("powershell", "-NoProfile", "-NonInteractive",
             "-ExecutionPolicy", "Bypass", "-Command", script)
```

几个不能省的细节：

| 项 | 要求 | 省了会怎样 |
| :--- | :--- | :--- |
| `IconLocation` 的 `,0` | 图标索引后缀必须带 | 部分 Windows 版本解析失败，图标空白 |
| `WindowStyle = 7` | 最小化启动 | 双击闪一大块黑窗口 |
| `Arguments = ''` | 显式置空 | 覆盖旧 `.lnk` 时残留上一次的参数 |
| `Test-Path -LiteralPath` | 先建父目录 | 桌面目录被重定向 / 不存在时直接失败 |
| `psQuote` | 单引号字面量里 `'` → `''` | 用户名 `O'Neil` 会把脚本拼断，报的语法错看不出跟名字有关 |
| `ErrorActionPreference` | `Stop` | COM 失败被吞掉，函数却返回成功 |

`psQuote` 的实现只有一行，但必须有：

```go
func psQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}
```

> 本仓的 `$sc.Description` 是「<项目名>：双击打开本地运维界面」（S5 起与参考项目一致）；
> 换项目按 §6 第 3 行改项目名，别照抄别人的名字。

### 3.3 桌面目录：问系统，不要拼

Windows 桌面常被 OneDrive 重定向，硬编码 `%USERPROFILE%\Desktop` 会把图标
建到一个根本不显示的目录里。顺序固定：

1. `SUIKOUJI_OPS_DESKTOP` 之类的**测试覆盖变量**（存在就 `MkdirAll` 后直接返回）；
2. PowerShell `[Environment]::GetFolderPath('Desktop')`——会把重定向算进去；
3. 回退 `%USERPROFILE%\Desktop`，再看 `%OneDrive%\Desktop`；
4. 都找不到 → 报错并提示可用覆盖变量指定。

🔴 `GetFolderPath` 之前必须设 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`：
中文用户名下桌面路径是中文，控制台默认 GBK 读回来是乱码，最后建到一条不存在的路径上。
🔴 **测试绝不写真桌面**，一律用覆盖变量指到 `t.TempDir()`。

### 3.4 图标：一份字节，两个去处

```
go:embed ui/ops.ico  →  var uiIcon []byte
                        ├─ 网页 /favicon.ico（直接读内存）
                        └─ 配置目录 ops.ico（writeIcon 落盘，.lnk 指这里）
```

`writeIcon(dir)` 只在缺失或内容不同时写；失败一律忽略——图标不该让界面起不来。
但 `ensureIcon()` 在写完后要**补一次 `os.Stat`**：真没写出来就报错，
别假装成功（否则 `.lnk` 悄悄变成空白图标）。

没有界面的项目也要给一份 `.ico`；没有就先别设 `IconLocation`，
但不要把 `IconLocation` 指到 exe 上凑数。

### 3.5 名字校验与删除

```go
// name 直接拼进 lnk 路径，必须挡住路径穿越
strings.ContainsAny(name, `\/:*?"<>|`)  // Windows 非法字符
name == "." || name == ".."             // 相对路径
strings.TrimSpace(name) == ""           // 空名
```

`--remove` 对「本来就没有」返回 `(path, false, nil)`，不算错误：重复点两次
不该弹一个红叉。非 Windows 平台创建和删除都返回一句人话
（`errShortcutWindowsOnly`），不假装写了个文件。

### 3.6 测试矩阵（不碰真桌面）

| 用例 | 断言 |
| :--- | :--- |
| 名字合法 / 非法 | 中文 + 空格 + 中点允许；`\` `/` `:` `*` `?` `"` `<` `>` `|` `.` `..` 空串拒绝 |
| `findUp` | 从 cwd 和 `os.Executable()` 两个起点向上 4 层都能找到启动器；层级不够时找不到 |
| 脚本转义 | 路径含 `O'Neil` 与空格时，`''` 转义与 `IconLocation ...,0` 都在文本里 |
| 桌面覆盖变量 | 返回指定目录且该目录被建出来 |
| 图标同源 | 落盘的 `ops.ico` 与 `uiIcon` 逐字节相等 |
| 删除幂等 | 不存在时 `removed=false, err=nil` |

**不写需要真桌面 / 真 COM 的单测**；`.lnk` 是否真的能双击，留给 §8 的人工验收。

---

## 4. 启动器契约（`.cmd`）

### 4.1 固定顺序

```
cd /d "%~dp0" + chcp 65001
  → 剥启动器自己的开关（--bg / --fg / --menu），其余留作透传
  → --bg（隐藏守护专用）：直接 ops ui，不构建不 init，所有 pause 都跳过
  → 定位 ops.exe；缺 exe：找 Go（PATH → %USERPROFILE%\go\bin → %ProgramFiles%\Go\bin）→ go build
  → 缺配置模板：ops init（首次才占窗口，且不覆盖已有配置）
  → 分流：显式子命令 → 原样转发；--menu → 菜单；首次 / --fg → 前台 ops ui
  → 日常：ops ui --background --launcher "%~f0" [透传参数]
          Go 侧用命名互斥体判单实例：已有实例只把浏览器指过去
          否则 spawn 一条隐藏 cmd（--bg），前台 exit 0，黑窗口立刻消失
  → 退出码：0 正常；非 0 报错（后台不 pause）；后台启动失败则回退前台
```

> **本仓现状（S5）**：`chcp 65001` → 定位 / 构建 exe → 首次写配置模板 → 上面那条分流
> → 退出码。单实例、隐藏守护、日志轮转、自动开浏览器全在 Go 侧（见 §4.4）。
> `ops.exe` 已存在时直接复用：Windows 不允许覆盖正在运行的 exe，自动重建需要
> `.new` 换身 + 退出码 75，**本仓未实现**；源码改动请手动 `go build -o ops.exe .`
> （改了 `web/` 先 `npm run build`）。

### 4.2 七个已踩过的坑

| 坑 | 对策 |
| :--- | :--- |
| 日常使用留个黑窗口 | 首次运行（没 exe / 没配置）才占窗口；日常由隐藏 cmd 守护，浏览器打开后窗口立刻消失；`--fg` 强制前台给人看 stdout |
| 后台 `pause` 变隐形僵尸 | 每个 `pause` 都包一层 `if not defined BG` |
| 子进程 stdout 丢 | 后台 stdout/stderr 接到配置目录的日志，配轮转上限 |
| `cmd /c` 剥引号 | 整行用 `/s /c ""<launcher>" --bg <args>"`，且必须走 `SysProcAttr.CmdLine`；`os/exec` 默认的 `\"` 转义 cmd 不认 |
| 隐藏窗口 ≠ 无控制台 | `CREATE_NO_WINDOW (0x08000000)` 是「有控制台、没窗口」，cmd 与其子进程仍需能写 stdout |
| 守护交给 cmd，不交给 Go | Windows 上双击 .cmd 必开控制台，用隐藏 cmd 重新执行启动器是最小改动；cmd 不持有 `ops.exe` 句柄，将来要做换身也不会把自己锁死 |
| Go 的中文横幅在 GBK 控制台乱码 | 启动器开头 `chcp 65001 >nul`；`.cmd` 正文全是 ASCII，切代码页不影响批处理解析 |

> **退出码 75 / `.new` 换身 / `--takeover`（参考项目有，本仓未做）**：那套是「界面上点
> 重启 → 本进程重建自己 → 退出 75 → 启动器换 exe 再用同端口同 token 拉起」。本仓 S5
> 只做「开网页 + 关界面」：关闭按钮让进程以 **0** 退出，守护随之结束。理由见 §9。

### 4.3 参数透传

启动器自己的开关（`--bg` / `--fg` / `--menu`）必须**剥掉**，其余参数原样传给程序。
分流规则（顺序不能换）：

| 调用 | 走到哪 |
| :--- | :--- |
| 无参 | `ops ui --background --launcher "%~f0"`（隐藏守护 + 开浏览器） |
| `--port 7790` / `--no-open` 等以 `-` 开头 | 同上，参数透传给后台的 `ops ui` |
| `--fg`（可叠加上面的参数） | 前台 `ops ui`，保留窗口看 stdout |
| `--menu` | `ops menu`（交互菜单，见 §4.4 末） |
| `help` / `servers list` / `backup verify --server x` | 原样转发 `ops.exe`，**前台** |
| `--bg` | 内部专用：隐藏守护里的 `启动运维.cmd --bg` 直接跑 `ops ui` |

🔴 显式子命令优先于 `--fg`：`启动运维.cmd --fg help` 必须等于 `ops.exe help`，
不能变成 `ops ui help`。判据是「透传串的第一个字符是不是 `-`」。
批处理里 `set` 要**一条一句**，不要放进 `( )` 块——块内 `%PASS%` 在解析期展开，
赋值当场看不见。

🔴 `.cmd` 用 CRLF 保存（本仓 [deploy.md](deploy.md) 的 CRLF 红线是远端 `.env`，
这里是 Windows 批处理自身）；注释一律用英文，避免中文注释在非 UTF-8 代码页下
把命令解析带偏。开头 `chcp 65001 >nul` 让 Go 的 UTF-8 中文横幅正常显示。

### 4.4 本仓当前形态：双击开网页面板（S5 已实现）

链路（`.lnk` 与 `.cmd` 的形状从 S3 起没变，只是无参分支换了动词）：

```
桌面双击
  → 启动运维.cmd（可见，几百毫秒）
  → ops ui --background --launcher <启动器绝对路径> [透传参数]
       ├─ 命名互斥体 Local\pass-up-ops-ui 已被占 → 读 ui.json，只 openBrowser
       └─ 没被占 → 立即释放 → spawn 隐藏 cmd（CREATE_NO_WINDOW）
                     → 启动运维.cmd --bg → ops ui [透传参数]
                     → 写 ui.json（0600，port + token）→ 自动开浏览器
  → 前台 exit 0，黑窗口消失
```

- 🔴 **单实例靠命名互斥体**（`internal/shared/singleton_windows.go`），不靠 `tasklist`：
  后者会把 `servers check` 这类短命进程也算成「界面在跑」。互斥体由内核持有，
  进程被强杀也自动释放，不存在残留锁文件。`ops menu` 用的是**另一个名字**，两者互不干扰。
- `ui.json` 只存 `port` + `token`（0600）。第二次双击、或手工再敲一次 `ops ui`，
  都只把浏览器指过去，不启第二个进程。进程退出后它留着，下次启动会被覆写。
- 🔴 **端口从 7788 起，被占自动递增**（最多 20 个）：同机的 `suikouji ops` 也默认 7788，
  绑死端口会让隐藏窗口里 bind 失败、浏览器永远不开——那就是「双击没反应」的真身。
  显式 `--port` 仍严格绑定，被占直接报错；**实际端口**写进 `ui.json`。
- 🔴 **守护起不来要回退前台**：`--background` 父进程 spawn 后等新的 `ui.json`
  （上限 6 秒），超时返回非 0，启动器改在前台跑 `ops ui`，错误直接显示在可见窗口里。
- 后台 stdout/stderr 进配置目录 `ops-ui.log`，`openRotatedLog` 超过 512 KB 整个重写。
  后台分支没有窗口，所有 `pause` 都包了 `if not defined BG`，否则会变成隐形僵尸。
- 页面右上角「关闭界面」→ `POST /api/shutdown`（token + Origin 校验）→ 进程以 **0** 退出，
  隐藏 cmd 随之结束。这是隐藏模式下唯一的体面停止方式。
- 🔴 **配置不全也照样起界面**：`ops init` 生成的 `servers.json` 是空模板，而
  `shared.LoadServers` 对空清单会报错。若 `ops ui` 因此直接退出，隐藏窗口里就是一次
  无声失败。现在 `uiState.setupErr` 记住这个错误，页面回一页「怎么补配置」的说明；
  每次请求都重读配置，补完**刷新即可**，不用重启界面。API 侧同样回 503 + 中文原因。
- 🔴 **双击绝不触发写操作**：落地页是只读的服务器清单，唯一的写（一键免密 sudo）
  要人点按钮并输密码。`backup deploy` 这类安装动作仍需 `--menu` 里「预检通过 + 输入 yes」，
  或命令行显式调用。

`ops menu` 作为**显式入口**保留（启动器加 `--menu`）：菜单逻辑在 Go 里，只列已实现动词，
能力探测走 `commandHandler()`，第 3 项安装仍要二次确认。S3 的「菜单是双击默认」已结束，
但菜单本身没有删——只读预检、远端自检这些入口还得有地方点。

**未做**（与参考项目的差别，别照抄）：退出码 75 自重建、`ops.exe.new` 换身、
`--takeover` 同端口同 token 重连、界面上的「重启」按钮。理由见 §9。

---

## 5. 红线清单（可直接当 review checklist）

1. 🔴 `.lnk` 的 `TargetPath` 只能是启动器，不能是 `ops.exe`。
2. 🔴 快捷方式名先过 `validateShortcutName`，挡路径穿越与 Windows 非法字符。
3. 🔴 `IconLocation` 指向独立 `.ico`（带 `,0`），且与 favicon 同一份字节。
4. 🔴 桌面路径先问系统（`GetFolderPath` + UTF-8 输出编码），再回退。
5. 🔴 测试用覆盖变量，绝不写真桌面；删除幂等，非 Windows 明确失败。
6. 🔴 创建快捷方式不改远端、不提权、不写注册表、不开机自启。
7. 🔴 双击不执行写操作：落地页只读，唯一的写（一键免密 sudo）要显式点击 + 输密码；
   安装类动作仍走 `--menu` 的「预检通过 + 输入 yes」或命令行显式调用。
8. 🔴 启动器不内联业务参数，不覆盖已有配置，不静默迁移目录。
9. 🔴 私钥与 sudo 密码不出现在命令行、输出、日志（本仓 AGENTS.md 硬约束 8/9）。
10. 🔴 后台分支不 `pause`；日志有轮转上限；隐藏窗口里的失败只能靠日志排查。
11. 🔴 单实例只认命名互斥体（不靠 `tasklist`）；`ui.json` 权限 0600，只存 port + token。
12. 🔴 配置 / 清单读不出来也**必须把界面起起来**，给一页能照做的说明；
    在隐藏窗口里静默退出等于「双击没反应」。

---

## 6. 复用清单：换项目只改这些

| # | 常量 / 位置 | 参考项目值 | 本仓值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 桌面快捷方式名 | `随口记 · 运维` | `Pass-up · 运维` | 多项目共存时**必须不同**，否则互相覆盖 |
| 2 | 启动器文件名 | `启动运维.cmd` | `启动运维.cmd` | 建议各仓根同名；`findUp` 只在自己仓库内向上找 |
| 3 | `.lnk` 描述 | 随口记 · 运维：双击打开… | Pass-up · 运维：双击打开本地运维界面 | 鼠标悬停提示 |
| 4 | exe 相对路径 | `ops\dist\ops.exe` | `ops.exe`（仓根） | 决定 `%~dp0` 怎么拼 |
| 5 | 配置目录 | `%AppData%\suikouji` | `os.UserConfigDir()` 下 `pass-up` | 见 [config.md](config.md) |
| 6 | 测试覆盖变量前缀 | `SUIKOUJI_OPS_*` | `PASS_UP_OPS_*` | 桌面 / 配置目录两个覆盖变量（键名见 §1 的 [config.md](config.md)）；**新增键要同步登记** |
| 7 | 图标 | `ui/ops.ico`（9 尺寸） | `internal/ui/ops.ico`（`go:embed`） | favicon 与配置目录 `ops.ico` 同源；无界面项目也要给一份 |
| 8 | 动词表 | `deploy / status / ui / https …` | `init / servers / ui / backup / shortcut / menu` | 动词注册表 + usage 两份，菜单不维护第三份 |
| 9 | 界面端口 / token / 运行态文件 | `7788` / 随机（`#t=`）/ `ui.json` / `ops-ui.log` | `7788` 起、被占自动递增 / 随机（`?token=`）/ `ui.json`（0600）/ `ops-ui.log`（512 KB 轮转） | 同机 suikouji 也占 7788；显式 `--port` 才严格绑定。token 形式按 [ui.md](ui.md) §4 |
| 10 | `findUp` 层级 | 4 | 4（cwd 与 exe 目录两个起点） | 覆盖 `go run` 以外的正常布局 |
| 11 | 单实例互斥体名 | `ui.lock`（文件锁） | `Local\pass-up-ops-ui`（命名互斥体） | 菜单另用 `Local\pass-up-ops-menu`；内核持有，进程被杀自动释放 |

**新项目落地五步**：复制 §3 的 Go 骨架 → 按上表改常量 → 复制 §4 的 `.cmd` 骨架并改动词表
→ 补 `.ico` → 跑 §8 验收。然后在目标仓 `AGENTS.md` 的文档速查表加一行，
把本文的**相对仓名路径**指过去（跨仓引用按相对仓名，不复制全文）。

---

## 7. 文件与阶段

```
<仓库根>/
  启动运维.cmd                                启动器（CRLF、英文注释、chcp 65001）
  ops.exe                                 本机二进制（构建产物，不入 Git）
  internal/shared/singleton_windows.go     跨进程命名互斥体（menu / ui 共用一份）
  internal/shared/singleton_other.go       非 Windows 空实现 + 单测
  internal/shared/shortcut.go              快捷方式的展示模型（CLI 打印 / 页面显示 / HTTP 响应）
  internal/launcher/shortcut.go           创建/删除/校验/桌面目录/启动器定位/PS 脚本
  internal/launcher/shortcut_test.go      §3.6 测试矩阵
  internal/launcher/menu.go               交互菜单（--menu 入口）
  internal/launcher/menu_windows.go       菜单单实例薄包装（调 shared）
  internal/launcher/menu_test.go          菜单默认只读与二次确认
  internal/ui/ui.go                       静态产物托管、token、/api/shutdown、配置降级页
  internal/ui/background.go               --background 调度、ui.json、日志轮转、openBrowser
  internal/ui/background_windows.go       隐藏 cmd 守护（CREATE_NO_WINDOW + CmdLine）
  internal/ui/background_other.go         非 Windows 明确报错
  internal/ui/background_test.go          后台链路单测（不弹浏览器、不 spawn 真进程）
  internal/ui/ui_test.go                  图标同源、token 边界、shutdown、配置降级
  internal/ui/ops.ico                     9 尺寸图标（唯一字节来源）
  web/                                    前端工程；产物嵌入二进制，见 ui.md
  <配置目录>/ops.ico                          writeIcon 落盘，快捷方式指这里
  <配置目录>/ui.json                          port + token（0600，单实例复用）
  <配置目录>/ops-ui.log                       后台 stdout/stderr（512 KB 轮转）
```

| 阶段 | 内容 | 验收 |
| :--- | :--- | :--- |
| S1 ✅ | 本文（通用规范 + 复用清单） | 新项目照 §6 能说清要改哪几处 |
| S2 ✅ | `ops shortcut` / `--name` / `--remove` + 界面「创建桌面快捷方式」（`POST /api/shortcut`） | `go vet` / `go test` 全绿；图标同源断言通过；按钮建出的 `.lnk` 指向启动器 |
| S3 ✅ | `启动运维.cmd` + `ops menu` | 缺 exe 能自己构建；缺配置不覆盖已有；双击不跑写操作 |
| S4 ◐ | 图标与桌面 `.lnk` 真机验收 | 覆盖变量下 `.lnk` 属性与图标已验；真实桌面双击待人工 |
| S5 ✅ | 后台网页模式（隐藏守护 / 单实例 / 自动开浏览器 / 日志轮转 / 关闭界面） | 临时配置目录端到端：`ui.json` 生成、`/api/servers` 200、二次启动只指过去、`shutdown` 后端口释放 |
| — | 退出码 75 自重建 / `.new` 换身 / `--takeover` | **未做**；源码改动手动 `go build`，改了 `web/` 先 `npm run build` |

---

## 8. 验收清单

**自动**（Go：`go vet ./...` / `go test ./...` / `go build ./...`；前端：`npm test` /
`npm run typecheck` / `npm run build`）：§3.6 六项 + 后台链路（`ui.json`、日志轮转、
`quoteArg`、单实例冲突、`shutdown`、配置降级页）+ 21 个前端用例；
不写真桌面、不连真 SSH、不真的 spawn 隐藏进程。2026-11-05 已全绿。

**覆盖变量下的真机核对**（已做，未写真桌面）：

- `ops shortcut` 建出的 `.lnk` 读回 `TargetPath=启动运维.cmd`、
  `IconLocation=...\ops.ico,0`、`Arguments=''`、`WindowStyle=7`，图标文件存在；
  `O'Neil` 名字通过；`--remove` 连点两次幂等；`启动运维.cmd --fg help` 参数透传且退出码 0。
- 后台链路（`PASS_UP_OPS_CONFIG_DIR` / `PASS_UP_OPS_ENV` 指向临时目录，端口 7791/7792）：
  走真实的 `启动运维.cmd` 日常分支 → `ui.json` 生成、`/api/servers` 200、
  第二次启动返回 0 且只打印「已有界面在跑」、`POST /api/shutdown` 200 后监听端口释放，
  `ops-ui.log` 里有完整启动横幅与关闭记录。

**真机人工**（Windows，逐条打勾，仍待用户在真实桌面执行）：

- [ ] `ops shortcut` 后桌面出现带正确图标的入口，名称是 §6 表里的项目名；
- [ ] 双击 → 浏览器自动打开带 token 的网页面板，桌面**不留**黑窗口；
- [ ] 首次运行（缺 exe / 缺配置）→ 可见窗口里构建 / 写模板，页面显示「配置还没准备好」说明；
- [ ] 删掉 exe 再双击 → 自动 `go build` 起来；Go 不在 PATH 时三处回退能命中；
- [ ] 已有实例时再双击 → 不启第二个进程，只把浏览器指回同一个实例；
- [ ] 点页面「关闭界面」→ 本页显示「已关闭」，进程退出；再双击能重新打开；
- [ ] 启动器带参数（`--port 7790` / `backup verify`）→ 参数完整透传；`--menu` 进菜单；
- [ ] `ops shortcut --name "A/B"` 被拒；`--name "O'Neil"` 能建成且图标正常；
- [ ] `ops shortcut --remove` 删掉；再删一次不报错；
- [ ] 桌面被 OneDrive 重定向时，图标仍出现在「真正显示的那个桌面」；
- [ ] 全程没有改远端、没有提权，日志里没有私钥路径 / 密码；
- [ ] 🔴 双击后**没有**触发 `backup deploy`（写操作）；页面上的一键免密 sudo 要显式点击 + 密码。

---

## 9. 决策与备选

| 决策 | 备选 | 为什么选这个 |
| :--- | :--- | :--- |
| `.lnk` 指向启动器 | 直接指 `ops.exe` | 指 exe 绕过构建 / 配置 / 单实例判断，换机器就「双击没反应」 |
| PowerShell `WScript.Shell` | 手写 `.lnk` 二进制 / 引 COM 库 | 复合结构无公开文档；引库破坏单二进制零依赖；全项目只有这一处要 COM |
| 图标用独立 `.ico` | `IconLocation` 指 exe | Go exe 没嵌图标资源，指过去只有空白默认图标 |
| 图标 `go:embed` 一份两用 | 仓库里再放一份 ico | 否则「配置目录那个 ico 是哪来的」永远没人答得上 |
| 创建逻辑只有一个函数 | CLI 与界面各写一份 | 两份路径必然漂移成「命令行能用、界面指向别处」 |
| 桌面路径问系统 | 拼 `%USERPROFILE%\Desktop` | OneDrive 重定向很常见，硬编码会把图标建到不显示的目录 |
| 脚本生成做成纯函数 | 测试真调 COM | 转义与 WindowStyle 能断言，测试不依赖真桌面 |
| 测试用覆盖变量 | 写临时目录再清理真桌面 | 验收脚本不该碰用户桌面 |
| `--remove` 不存在不算错 | 返回错误 | 重复点两次弹红叉是噪音，不是信息 |
| 非 Windows 明确失败 | 静默跳过 / 写个假文件 | 假装成功比失败更糟 |
| 后台守护交给 cmd | Go 自己当守护 / 一直前台 | Windows 上双击 .cmd 必开控制台；隐藏 cmd 重新执行启动器是最小改动，且不持有 `ops.exe` 句柄 |
| 首次运行才占窗口 | 每次都留窗口 / 每次都隐藏 | 首次要看构建与配置提示，日常不该留黑窗口；构建失败时隐藏会变成「无声失败」 |
| **S5 起双击直达网页面板** | 保留 S3 的交互菜单做默认 | 菜单要读 stdin、必须留窗口，双击体验差；`ui` 已实现且落地页只读，切换不破坏「双击不写」红线 |
| `ops menu` 作为 `--menu` 保留 | 菜单整个删掉 | 只读预检 / 远端自检 / 安装二次确认这些入口还得有地方点 |
| 菜单逻辑放 Go | 全部写进 `.cmd` | 可单测；能力探测不靠解析 usage 文本；`.cmd` 只留构建与转调 |
| 菜单里写操作二次确认 | 双击即部署 | 本仓硬约束：`ui` 只读，安装只走显式 `ops backup deploy` |
| 启动器放仓库根 | 放 `ops/` 内 | `%~dp0` 即根，兄弟仓相对路径不用拼 `..` |
| 参数透传而非写死 | 每种用法一个 `.cmd` | 一个入口覆盖 `--port` / `--no-open` / 任意子命令，不再长出一堆批处理 |
| `--menu` 仍保留前台窗口 | 让菜单也走隐藏守护 | 菜单要读 stdin，隐藏窗口等于「双击没反应」；日常双击已不走菜单 |
| 单实例用命名互斥体 | `tasklist` / pid 文件 / 端口探测 | 内核持有、进程被杀自动释放；`tasklist` 会把短命子进程算成「界面在跑」 |
| 配置不全仍起界面 + 降级页 | 直接退出 / 白屏 | `ops init` 生成的是空 `servers.json`，隐藏窗口里退出就是「双击没反应」；降级页每次请求重读，补完刷新即可 |
| 「关闭界面」按钮（退出 0） | 只给 `--fg` / 让用户去任务管理器杀 | 后台窗口隐藏，页面上必须有一个体面的停止方式 |
| 不做 75 自重建 / `.new` 换身 | 照搬参考项目 | 本仓前端是 Vite 工程，重建要跑 npm，链路长且出错时无人看见；源码改动手动 `go build`，边界写进文档 |
| 静态产物不过 token | 每个请求都校验 token | `<script src>` 带不上自定义头、也拿不到 `?token=`；真正的边界是 API（见 [ui.md](ui.md) §4） |
| `chcp 65001` 放在启动器开头 | 让 Go 只输出 ASCII / 改终端字体 | 一行解决中文横幅乱码；`.cmd` 正文全 ASCII，切代码页不影响批处理解析 |

---

## 10. 参考实现位置（只在核对细节时看）

| 想确认 | 文件 |
| :--- | :--- |
| 创建 / 删除 / 校验 / 桌面目录 / PS 脚本 | `D:\_work\suikouji\ops\shortcut.go` |
| 六项测试怎么写 | `D:\_work\suikouji\ops\shortcut_test.go` |
| 启动器完整批处理 | `D:\_work\suikouji\启动运维.cmd` |
| 隐藏后台守护与 `CREATE_NO_WINDOW` | `D:\_work\suikouji\ops\background_windows.go` |
| `--background` 调度、`ui.json`、单实例与自动开浏览器 | `D:\_work\suikouji\ops\background.go` + `ui.go` 的 `runUI` |
| 退出码 75 / `.new` 换身（**本仓未做**） | `D:\_work\suikouji\ops\ui.go` 的 `handleRestart` |
| 图标同源（`go:embed` + `writeIcon`） | `D:\_work\suikouji\ops\ui.go` |
| 配置目录与覆盖变量 | `D:\_work\suikouji\ops\env.go` |

> 这些路径只是**核对用**。新项目落地以本文 §3–§6 为准；参考实现里的
> `SUIKOUJI_*` 命名、动词表与端口一律不要照抄。
