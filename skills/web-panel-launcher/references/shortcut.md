# 桌面快捷方式

## 1. 唯一实现 + 注入

🔴 创建逻辑只能有**一份**：`CreateShortcutOnDesktop(name) (ShortcutInfo, error)`。命令行（`shortcut` 动词）与页面按钮（`POST /api/shortcut`）都调它。

界面侧通过 `main` 注入，不要反向 import `launcher`（见 SKILL.md §3）。

## 2. 用 PowerShell 建 `.lnk`

`.lnk` 是没有公开文档的复合结构，手写等于把「微软哪天改一格」变成自己的 bug；为一次调用引 COM 库又会给单二进制工具加依赖。用 `WScript.Shell` 最划算：

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
$sc.Description = '<项目名>：双击打开本地运维界面'
$sc.WindowStyle = 7
$sc.Save()
```

调用：`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command <script>`。

| 细节 | 要求 | 省了会怎样 |
| :--- | :--- | :--- |
| `IconLocation` 的 `,0` | 必须带 | 部分 Windows 解析失败，图标空白 |
| `WindowStyle = 7` | 最小化启动 | 双击闪一大块黑窗口 |
| `Arguments = ''` | 显式置空 | 覆盖旧 `.lnk` 时残留上一次参数 |
| `Test-Path -LiteralPath` | 先建父目录 | 桌面被重定向/不存在时直接失败 |
| 单引号转义 `'` → `''` | 必须 | 用户名 `O'Neil` 会把脚本拼断 |
| `ErrorActionPreference = 'Stop'` | 必须 | COM 失败被吞掉，函数却返回成功 |

## 3. 图标：一份字节，两个去处

```text
go:embed <icon>.ico  →  var iconBytes []byte
                        ├─ 网页 /favicon.ico（直接读内存）
                        └─ <配置目录>/<tool>.ico（落盘，.lnk 指这里）
```

🔴 `IconLocation` **不能指 exe**：Go 编出来的 exe 没嵌 Windows 图标资源，指过去只有空白图标。
🔴 落盘后要补一次 `os.Stat` 确认写成功，否则 `.lnk` 会悄悄变成空白图标。

## 4. 桌面目录：问系统，不要拼

顺序：测试覆盖变量 → `[Environment]::GetFolderPath('Desktop')`（会把 OneDrive 重定向算进去）
→ `%USERPROFILE%\Desktop` → `%OneDrive%\Desktop`。

🔴 调 `GetFolderPath` 前设 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`：中文用户名下桌面路径是中文，默认 GBK 读回来是乱码。

## 5. 名字校验与幂等删除

```go
strings.ContainsAny(name, `\/:*?"<>|`) // Windows 非法字符
name == "." || name == ".."            // 相对路径
strings.TrimSpace(name) == ""          // 空名
```

`--remove` 对「本来就没有」返回「没删，但不是错误」：重复点两次不该弹红叉。
非 Windows 创建/删除都返回一句人话，不假装写了个文件。

## 6. 接口形状

`POST /api/shortcut`，要 token + Origin，但**不受「配置是否齐全」限制**（只碰本机桌面），也不进业务锁。成功回 `{path, launcher, icon}`，失败回 500 + 原始中文原因。
