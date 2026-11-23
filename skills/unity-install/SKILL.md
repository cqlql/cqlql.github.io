---
name: unity-install
description: 在 Windows 上装通 Unity 工具链：安装 Unity CLI、选定 LTS 编辑器版本、绕开国内镜像导致的编辑器下载 404（走本地代理）、激活 Personal 许可证、换掉只认国内账号的 Unity Hub、补齐官方技能包，并在装完后衔接到建工程（new-unity-project）。当用户要求安装/重装 Unity、编辑器下载失败或 404、许可证未激活、Hub 登不上海外账号、unity CLI 报未知技能、unity doctor 有问题、或装完 Unity 后要接着创建工程时使用。
---

# Unity 安装（Windows）

目标：从零到「CLI 可用 + 编辑器可启动 + 许可证已激活 + 技能包装齐 + 工程已建」。全程只需用户做两件事：**在浏览器里登录**、**同意条款**。

## 0. 先探现状，别重复安装

```powershell
$cli = "$env:LOCALAPPDATA\Unity\bin\unity.exe"
Test-Path $cli                                  # CLI 是否已装
& $cli --version                                # 版本号
& $cli editors --installed                      # 已装编辑器清单
Test-Path "C:\Program Files\Unity Hub\Unity Hub.exe"
```

四项都在就直接跳到「验收」；部分存在则只补缺的那一段。

## 1. 安装 Unity CLI

先下载后审阅，不要直接管道执行——安装脚本会改 PATH、装二进制、还会自己跑 `unity skill install --all`。

```powershell
curl.exe -fsSL https://unity.com/install.ps1 -o "$env:TEMP\unity-install.ps1"
Get-Item "$env:TEMP\unity-install.ps1" | Select-Object Length
Get-Content "$env:TEMP\unity-install.ps1" -TotalCount 40   # 确认来源与动作
pwsh -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\unity-install.ps1"
```

（没有 `pwsh` 的老机器用 `powershell -NoProfile -ExecutionPolicy Bypass -File`，二者参数一致。）

脚本做四件事：取版本清单 → 下载 `unity.exe` → SHA-256 校验 → 装到 `%LOCALAPPDATA%\Unity\bin` 并写用户 PATH。

**PATH 只对新终端生效。** 当前会话一律用全路径 `& "$env:LOCALAPPDATA\Unity\bin\unity.exe"`，别指望 `unity` 命令能直接调起来。

自检：`& $cli doctor`。`binary-on-path` 报 warn 是正常的（原因同上）；长路径、凭据库应为 pass。

## 2. 登录与许可证（需要用户明确点头）

CLI 会拉起浏览器完成 OAuth，**登录必须由用户本人操作**，不要代填账号密码。

Personal 免费版在激活时同时代表接受编辑器服务条款与 Personal EULA，因此**先把这层含义讲清楚，拿到「继续」再执行**：

```powershell
& $cli license activate --personal --accept-eula
& $cli license status                            # 期望 Assigned / active=true
```

编辑器首次启动前还要按版本接受条款：

```powershell
& $cli terms accept <版本号> --architecture x86_64 --yes
```

## 3. 选版本：永远不要 `latest`

CLI 的 `latest` 指向 alpha（例如 `7000.0.0a20`），新手项目不要碰。从发布接口取 LTS：

```powershell
curl.exe -s "https://services.api.unity.com/unity/editor/release/v1/releases?stream=LTS&limit=8"
```

`stream` 只接受单值，传逗号列表会报错。挑最新的 `6000.3.x` / `6000.6.x` 这类 LTS。

**权益坑**：`6000.0.86f1` 一类旧 LTS 会报「需要扩展 LTS 权益」，Personal 账号下不来。遇到就换更新的 LTS，别去折腾权益。

## 4. 装编辑器：本机必须走代理

**这是本 skill 最核心的坑。** 在某些国内网络环境下 `download.unity3d.com` 会 302 跳到 `download.unitychina.cn`，而该镜像对多数 LTS 版本返回 `NoSuchKey`（表现为 CLI 报 404），换多少个版本都一样。**不是版本问题，是链路问题。**

先做一次低成本探测，确认真能取到包再开下载：

```powershell
# 期望：HTTP 206，前两字节为 MZ
curl.exe -x http://127.0.0.1:7897 -s -o "$env:TEMP\probe.bin" -D - `
  "https://download.unity3d.com/download_unity/<revision>/Windows64EditorInstaller/UnitySetup64-<版本>.exe" `
  --range 0-4095
Format-Hex "$env:TEMP\probe.bin" -Count 2
```

`revision` 从发布接口读，**不要从网页 changeset 猜**（网页上的 hash 常属于另一个版本，用错了必然 404）。

探测通过后再装（会下 4 GB 左右、装出 8 GB 左右，磁盘先留足 12 GB）：

```powershell
& $cli install <版本号> --yes --accept-eula --proxy http://127.0.0.1:7897 --set-default
& $cli editors --installed
```

下载期间**关掉 Unity Hub**：它有自己的下载队列，会和 CLI 抢带宽、锁安装目录。

代理地址以用户实际在用的为准（Clash 类常见 `127.0.0.1:7897`），所有联网的 CLI 命令都要带 `--proxy`。

## 5. Unity Hub 的国内版 / 全球版

国内分发渠道的 Hub（如 3.3.7）**只接受国内账号登录**。用户若用全球账号，它会卡在登录，且会在里面重复下载编辑器，白占空间。

判断：`Get-Item "C:\Program Files\Unity Hub\Unity Hub.exe" | Select-Object VersionInfo`，或看安装目录在 `D:\Program Files\Unity Hub` 且带 `Tuanjie` 相关组件。

**换 Hub 的顺序不能反**：CLI 装编辑器**不需要** Hub 登录态，所以先把编辑器装完、工程建好，最后再换 Hub。反过来做会让 CLI 找不到可用编辑器。

```powershell
# 1) 备份配置
Copy-Item "$env:APPDATA\UnityHub" "$env:TEMP\UnityHub-appdata-backup" -Recurse

# 2) 卸载旧 Hub（静默）
& "<旧Hub目录>\Uninstall Unity Hub.exe" /S

# 3) 装全球版
curl.exe -L -o "$env:TEMP\UnityHubSetup-x64.exe" `
  --proxy http://127.0.0.1:7897 `
  "https://public-cdn.cloud.unity3d.com/hub/prod/UnityHubSetup-x64.exe"
& "$env:TEMP\UnityHubSetup-x64.exe" /S
```

装完核对版本（全球版约 3.22.x）。`%APPDATA%\UnityHub` 里的 `cli-install.json`、`cli-skill-installs.json`、`hubConfig.json` 不要丢，CLI 靠它们记状态。

## 6. 补齐官方技能包

CLI 1.0.0 自带只有 `unity-cli` 与 `new-unity-project`，且**没有固定技能集**：`unity skill install <client> --skill <名字>` 对多数名字会报「未知技能」。这不是网络问题，是版本限制。

兜底路线（按客户端技能目录手动放）：

```powershell
curl.exe -L -o "$env:TEMP\unity-skills.zip" --proxy http://127.0.0.1:7897 `
  "https://github.com/Unity-Technologies/skills/archive/refs/heads/main.zip"
Expand-Archive "$env:TEMP\unity-skills.zip" "$env:TEMP\unity-skills" -Force
```

然后再拷进客户端技能目录（opencode 为 `%USERPROFILE%\.config\opencode\skills`）。Windows 上 **`tar` 常常不在 PATH**，用 `Expand-Archive`，别写 `tar -xf`。

仓库里技能名与文档常对不上，拷之前先 `Get-ChildItem` 列实际目录名。

## 7. 装完就建工程（交给 new-unity-project）

本 skill 的边界到此为止：只负责「工具链能跑」，工程内容交给 `new-unity-project`。装完不要停在「装好了」，直接确认下一步由谁接。

**先确认技能在位**：`%USERPROFILE%\.config\opencode\skills\new-unity-project\SKILL.md`（CLI 自带，通常随安装脚本落盘）。缺失按第 6 节兜底补齐。

**只要一个空工程**：

```powershell
& $cli projects create <工程名> --output-dir <目录> `
  --editor-version <版本> --template 3d `
  --cloud-org <组织 id> --proxy http://127.0.0.1:7897
```

- `--cloud-org` 必须显式传：账号下只有一个组织时 `activeOrganizationId` 为空，不传会取不到。
- 结果里同时给出**组织 id 与云项目 id**，两个都记下备用。
- 过程中 Remote Config 可能返回 HTTP 451（地区法律限制）。不影响后续，向用户说明为已知缺口，**不要重试**。

**要完整流程**（概念澄清 → 建工程 → 按需装包 → 视觉基线 → 可玩循环 → 保存与首次提交）：加载 `new-unity-project` 技能，按它的模式选择与步骤清单执行。

**衔接检查项**：

- 建完立即比对 `ProjectSettings\ProjectVersion.txt` 与已装编辑器版本，不一致说明挑错了版本。
- 首次提交前工程根目录必须已有排除 `Library/`、`Temp/`、`obj/` 的 `.gitignore`，否则几 GB 缓存会进仓库。
- 交接说明写 `AGENTS.md`（跨客户端通用），不要只写 `CLAUDE.md`；写前先问用户。

## 8. 验收清单

- [ ] `& $cli --version` 有输出，`doctor` 无真错误
- [ ] `editors --installed` 列出 LTS 版本，`Editor\Unity.exe` 实际存在
- [ ] `license status` 为 Assigned、`active=true`
- [ ] Hub 版本是全球版，能登录海外账号
- [ ] 能 `projects create` 出一个工程并打开

逐项机器核对用 `scripts/verify-unity-install.ps1`（只读，不改任何东西）。

## 9. 排错

常见报错、原因与处置见 `references/troubleshooting.md`：404/NoSuchKey、HTTP 451、扩展 LTS 权益、Hub 登录、技能安装失败、下载卡住、PATH 失效。

## 边界

- 不在未获同意时执行 `license activate`、卸载 Hub、写入客户端技能目录——这三件都改用户机器状态。
- 不代用户输入账号、密码、验证码。
- 安装脚本永远先落盘审阅再执行，不用 `curl | sh` 或 `irm | iex` 直通。
