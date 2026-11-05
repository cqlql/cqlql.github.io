> 状态：**方案（未实现）**，本文是可跨项目复用的规范（2026-11-05）

# 一键启动与桌面快捷方式

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)；配置键见 [config.md](config.md)。
>
> 🔴 **本文的定位**：以后任何项目要做「桌面双击一个图标就能用这个工具」，**只看这一篇**即可，
> 不必再去读参考项目的源码。§3 / §4 给出可直接复制的骨架，§6 是「换项目只改这些」的常量表，
> §8 是验收清单。
>
> ⚠️ **本仓目前只有文档、没有代码**。本文描述的形状已在
> `D:\_work\suikouji`（`ops/shortcut.go` + `ops/shortcut_test.go` + 仓库根 `启动运维.cmd`）
> 实现并真机验证过，规范是从那套实现反推的。要在新项目落地，照 §7 的阶段表做。

---

## 0. 一页速用

三段结构，**形状固定**：

```
桌面 .lnk  →  仓库根「启动运维.cmd」  →  ops.exe <动词>
（只存路径）   （构建/配置/单实例/前后台）   （真正干活）
```

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
- 一个能列出当前可用动词的交互入口。

**不做**：

- ❌ 不改远端任何东西，不提权、不写注册表、不设开机自启、不做安装器/卸载器；
- ❌ 不把业务参数（主机、端口、组件名、token）写进 `.lnk` 的 `Arguments`；
- ❌ 不因为「双击了一下」就执行写操作。本仓的 `backup deploy` 会写 crontab / logrotate，
  双击触发它等于把 [backup-deploy.md](backup-deploy.md) 的「安装与监控分离」红线绕过去；
- ❌ 不做 macOS / Linux 的等价物伪装：`.lnk` 与 `WScript.Shell` 是 Windows 专属，
  其它平台要明确报「请自己建一个指向启动器的启动器」。

---

## 2. 三段结构：每层只干一件事

| 层 | 文件 | 职责 | 不能做 |
| :--- | :--- | :--- | :--- |
| 快捷方式 | 桌面 `<名字>.lnk` | `TargetPath` / `WorkingDirectory` / `IconLocation` / `Description` / `WindowStyle` | 不带业务参数、不直接指 exe、不写配置 |
| 启动器 | 仓库根 `启动运维.cmd` | 定位或构建 exe、首次写配置模板、单实例、前后台、日志、参数透传 | 不实现业务逻辑、不判断该跑哪个远端动作 |
| 程序 | `ops.exe <动词>` | 真正的命令（`init` / `backup deploy` / `status` / `ui` …） | 不关心自己是被双击还是被手敲启动的 |

**为什么 `.lnk` 不直接指 exe**：启动器承担的是「这台机器现在能不能跑」的判断。
直接指 exe 会把这些全绕过去，表现是「别人电脑上好好的，我双击没反应」，
而且错误现场没有任何提示。

**为什么启动器放仓库根而不是 `ops/` 内**：`%~dp0` 天然是仓库根，
配置目录、兄弟仓库（`pass-up.backend/deploy/backup`）的相对路径都从这里算；
放深一层就得靠 `..` 拼，容易和 `findUp` 的层级判断打架。

---

## 3. 快捷方式创建（唯一实现）

### 3.1 只有一个创建函数

`createShortcutOnDesktop(name)` 是**唯一**实现，`ops shortcut` 命令与界面上的按钮
都调它。理由和 [backup-deploy.md](backup-deploy.md) 的「一份 cron 逻辑」相同：
界面自己再拼一遍路径，就会出现「命令行建出来能用、界面建出来指向别处」。

配套四个函数，签名固定：

```go
func createShortcutOnDesktop(name string) (shortcutInfo, error)   // 建，返回 lnk/启动器/图标三个路径
func removeShortcutOnDesktop(name string) (path string, removed bool, err error) // 删，本来没有不算错
func validateShortcutName(name string) error                      // 名字校验
func desktopDir() (string, error)                                // 真实桌面目录
func launcherPath() (string, error)                              // 向上找启动器
```

`shortcutInfo` 只带 `path` / `launcher` / `icon` 三个字段：命令行拿去打印，界面拿去显示，
两边看到的是同一份凭据。

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
cd /d "%~dp0"
  → 定位 ops.exe（根或 dist\）
  → 缺 exe：找 Go（PATH → %USERPROFILE%\go\bin → %ProgramFiles%\Go\bin）→ go build
  → 缺配置模板：ops init（首次才占窗口，且不覆盖已有配置）
  → 单实例判断：已在跑就只把浏览器指过去，不启第二个
  → 前台 / 后台分流 → 运行 ops.exe <动词> [透传参数]
  → 退出码处理（0 正常 / 75 重启 / 其它报错并 pause）
```

### 4.2 六个已踩过的坑

| 坑 | 对策 |
| :--- | :--- |
| 日常使用留个黑窗口 | 首次运行（没 exe / 没配置）才占窗口；日常由隐藏 cmd 守护，浏览器打开后窗口立刻消失；`--fg` 强制前台给人看 stdout |
| 后台 `pause` 变隐形僵尸 | 每个 `pause` 都包一层 `if not defined BG` |
| 子进程 stdout 丢 | 后台 stdout/stderr 接到配置目录的日志，配轮转上限 |
| `cmd /c` 剥引号 | 整行用 `/s /c ""<launcher>" --bg <args>"`，且必须走 `SysProcAttr.CmdLine`；`os/exec` 默认的 `\"` 转义 cmd 不认 |
| 隐藏窗口 ≠ 无控制台 | `CREATE_NO_WINDOW (0x08000000)` 是「有控制台、没窗口」，cmd 与其子进程仍需能写 stdout |
| Go 自己当守护会被锁死 | Windows 不允许覆盖正在运行的 exe，而守护最后一步正是**替换 exe 再拉起**；所以守护交给不持有 exe 句柄的 cmd |

重启语义：程序以 **75** 退出 → 把 `ops.exe.new` 换成正身 → 带
`--takeover --no-open` 重跑（同端口同 token，已开的浏览器标签自己重连）。
只有被守护时才提供界面上的「重启」按钮（环境变量 `*_SUPERVISED=1`），
否则点一下就什么都没有了。

### 4.3 参数透传

启动器自己的开关（`--bg` / `--fg`）必须**剥掉**，其余参数原样传给程序：
`启动运维.cmd --port 7790` 要等价于 `ops ui --port 7790`。
批处理里 `set` 要**一条一句**，不要放进 `( )` 块——块内 `%PASS%` 在解析期展开，
赋值当场看不见。

🔴 `.cmd` 用 CRLF 保存（本仓 [deploy.md](deploy.md) 的 CRLF 红线是远端 `.env`，
这里是 Windows 批处理自身）；注释一律用英文，避免中文注释在非 UTF-8 代码页下
把命令解析带偏。

### 4.4 本仓当前形态：交互菜单（P1）

本仓 `status` / `ui` 仍是 [backup-monitor.md](backup-monitor.md) 的 P2 方案，
现在没有一个可被「启动」的网页。所以本轮落地时，启动器调的是 **`ops menu`**：

- 菜单逻辑放 **Go 里**，`.cmd` 只负责「构建 + 调 `ops.exe menu`」。
  理由：菜单可单测；能力探测不用去 parse `usage` 文本；不引入第三套字符串解析。
- 菜单只列**已实现的动词**，未实现的一律不出现：
  1. 查看 / 生成配置模板 → `ops init`
  2. 备份部署预检（只读）→ `ops backup deploy --dry-run`
  3. 安装 / 升级备份能力（写）→ `ops backup deploy`，**必须二次确认**
  4. 远端自检 → `ops backup verify`
  5. 帮助 → `ops help`
  0. 退出
- 🔴 **双击绝不触发写操作**：第 3 项要先跑过预检、再显式输入确认；
  默认停在第 2 项。退出码原样透传，执行完 `pause` 回菜单。
- 带参数调用启动器时跳过菜单，直接把参数交给 `ops.exe`（脚本化用）。

**P2 之后的切换点只有一个**：`ops menu` 检测到 `ui` 能力已注册 → 菜单多一项
「打开网页面板」，并支持启动器 `--ui` 直接走「后台起网页 + 开浏览器」。
`.lnk` 与 `.cmd` 的形状**一个字都不用改**——这正是 §2 分层要买的东西。

---

## 5. 红线清单（可直接当 review checklist）

1. 🔴 `.lnk` 的 `TargetPath` 只能是启动器，不能是 `ops.exe`。
2. 🔴 快捷方式名先过 `validateShortcutName`，挡路径穿越与 Windows 非法字符。
3. 🔴 `IconLocation` 指向独立 `.ico`（带 `,0`），且与 favicon 同一份字节。
4. 🔴 桌面路径先问系统（`GetFolderPath` + UTF-8 输出编码），再回退。
5. 🔴 测试用覆盖变量，绝不写真桌面；删除幂等，非 Windows 明确失败。
6. 🔴 创建快捷方式不改远端、不提权、不写注册表、不开机自启。
7. 🔴 双击不执行写操作；部署类动作仍走显式确认 / `--dry-run` 分离。
8. 🔴 启动器不内联业务参数，不覆盖已有配置，不静默迁移目录。
9. 🔴 私钥与 sudo 密码不出现在命令行、输出、日志（本仓 AGENTS.md 硬约束 8/9）。
10. 🔴 后台分支不 `pause`；日志有轮转上限。

---

## 6. 复用清单：换项目只改这些

| # | 常量 / 位置 | 参考项目值 | 本仓值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 桌面快捷方式名 | `随口记 · 运维` | `Pass-up · 运维` | 多项目共存时**必须不同**，否则互相覆盖 |
| 2 | 启动器文件名 | `启动运维.cmd` | `启动运维.cmd` | 建议各仓根同名；`findUp` 只在自己仓库内向上找 |
| 3 | `.lnk` 描述 | 随口记 · 运维 | Pass-up · 运维 | 鼠标悬停提示 |
| 4 | exe 相对路径 | `ops\dist\ops.exe` | `ops.exe`（仓根） | 决定 `%~dp0` 怎么拼 |
| 5 | 配置目录 | `%AppData%\suikouji` | `os.UserConfigDir()` 下 `pass-up` | 见 [config.md](config.md) |
| 6 | 测试覆盖变量前缀 | `SUIKOUJI_OPS_*` | `PASS_UP_OPS_*` | 桌面 / 配置目录两个覆盖变量；**新增键要同步登记 config.md** |
| 7 | 图标 | `ui/ops.ico`（9 尺寸） | 待补 | 无界面项目也要给一份 |
| 8 | 动词表 | `deploy / status / ui / https …` | `init / backup deploy / backup verify`（+ 未来 `status` / `ui`） | 菜单与 usage 各维护一份，别第三份 |
| 9 | 界面端口 / token / 日志名 | `7788` / 随机 / `ops-ui.log` | P2 再定 | 只在有 `ui` 时存在 |
| 10 | `findUp` 层级 | 4 | 4（本仓是独立仓，2 即够，保留 4 兼容 `dist\` 布局） | 覆盖 `go run` 以外的正常布局 |

**新项目落地五步**：复制 §3 的 Go 骨架 → 按上表改常量 → 复制 §4 的 `.cmd` 骨架并改动词表
→ 补 `.ico` → 跑 §8 验收。然后在目标仓 `AGENTS.md` 的文档速查表加一行，
把本文的**相对仓名路径**指过去（跨仓引用按相对仓名，不复制全文）。

---

## 7. 文件与阶段

```
<仓库根>/
  启动运维.cmd            启动器（CRLF、英文注释）
  ops/
    shortcut.go           创建/删除/校验/桌面目录/启动器定位/PS 脚本
    shortcut_test.go      §3.6 测试矩阵
    menu.go               P1 交互菜单（P2 之后是能力探测与切换点）
    ui/ops.ico            图标（有界面才有）
    <配置目录>/ops.ico     writeIcon 落盘，快捷方式指这里
```

| 阶段 | 内容 | 验收 |
| :--- | :--- | :--- |
| S1 ✅ | 本文（通用规范 + 复用清单） | 新项目照 §6 能说清要改哪几处 |
| S2 | `ops shortcut` / `--name` / `--remove` + `shortcut_test.go` | `go vet` / `go test` 全绿；图标同源断言通过 |
| S3 | `启动运维.cmd` + `ops menu` | 缺 exe 能自己构建；缺配置不覆盖已有；双击不跑写操作 |
| S4 | 图标与桌面 `.lnk` 真机验收 | 桌面出现带图标入口，双击可用 |
| S5（P2 后） | 能力探测 → 后台网页模式 | 菜单多「打开网页面板」；`.lnk` / `.cmd` 不改 |

---

## 8. 验收清单

**自动**（`go vet ./...` + `go test ./...`）：§3.6 六项全覆盖；不写真桌面、不连真 SSH。

**真机人工**（Windows，逐条打勾）：

- [ ] `ops shortcut` 后桌面出现带正确图标的入口，名称是 §6 表里的项目名；
- [ ] 双击 → 首次运行会在窗口里构建 / 写配置模板；再双击不再重复构建；
- [ ] 删掉 exe 再双击 → 自动 `go build` 起来；Go 不在 PATH 时三处回退能命中；
- [ ] 已有实例时再双击 → 不启第二个进程（菜单场景是复用窗口 / 提示已在运行）；
- [ ] 启动器带参数（如 `--port`、`backup verify`）→ 参数完整透传；
- [ ] `ops shortcut --name "A/B"` 被拒；`--name "O'Neil"` 能建成且图标正常；
- [ ] `ops shortcut --remove` 删掉；再删一次不报错；
- [ ] 桌面被 OneDrive 重定向时，图标仍出现在「真正显示的那个桌面」；
- [ ] 全程没有改远端、没有提权、日志里没有私钥路径 / 密码；
- [ ] 🔴 双击后**没有**触发 `backup deploy`（写操作），菜单第 3 项需二次确认。

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
| 后台守护交给 cmd | Go 自己当守护 | Windows 不允许覆盖运行中的 exe，而守护最后一步正是替换 exe |
| 首次运行才占窗口 | 每次都留窗口 / 每次都隐藏 | 首次要看构建与配置提示，日常不该留黑窗口；构建失败时隐藏会变成「无声失败」 |
| **本仓 P1 用交互菜单** | 直接照搬 `ops ui` 后台网页 | `status` / `ui` 尚未实现，起点必须落在**已有动词**上；菜单放 Go 里，P2 切换只改一处 |
| 菜单逻辑放 Go | 全部写进 `.cmd` | 可单测；能力探测不靠解析 usage 文本；`.cmd` 只留构建与转调 |
| 菜单里写操作二次确认 | 双击即部署 | 本仓硬约束：`status`/`ui` 只读，安装只走显式 `ops backup deploy` |
| 启动器放仓库根 | 放 `ops/` 内 | `%~dp0` 即根，兄弟仓相对路径不用拼 `..` |
| 参数透传而非写死 | 每种用法一个 `.cmd` | 一个入口覆盖 `--port` / `--no-open` / 任意子命令，不再长出一堆批处理 |

---

## 10. 参考实现位置（只在核对细节时看）

| 想确认 | 文件 |
| :--- | :--- |
| 创建 / 删除 / 校验 / 桌面目录 / PS 脚本 | `D:\_work\suikouji\ops\shortcut.go` |
| 六项测试怎么写 | `D:\_work\suikouji\ops\shortcut_test.go` |
| 启动器完整批处理 | `D:\_work\suikouji\启动运维.cmd` |
| 隐藏后台守护与 `CREATE_NO_WINDOW` | `D:\_work\suikouji\ops\background_windows.go` |
| 图标同源（`go:embed` + `writeIcon`） | `D:\_work\suikouji\ops\ui.go` |
| 配置目录与覆盖变量 | `D:\_work\suikouji\ops\env.go` |

> 这些路径只是**核对用**。新项目落地以本文 §3–§6 为准；参考实现里的
> `SUIKOUJI_*` 命名、动词表与端口一律不要照抄。
