# Unity 安装排错

按症状查。每条都给出「怎么确认」与「怎么处置」，不要凭猜测换版本。

## 目录

- [编辑器下载返回 404 / NoSuchKey](#编辑器下载返回-404--nosuchkey)
- [HTTP 451](#http-451)
- [需要扩展 LTS 权益](#需要扩展-lts-权益)
- [Hub 登录不了海外账号](#hub-登录不了海外账号)
- [unity skill install 报未知技能](#unity-skill-install-报未知技能)
- [下载卡住或速度异常](#下载卡住或速度异常)
- [unity 命令不生效](#unity-命令不生效)
- [projects create 报云组织相关错误](#projects-create-报云组织相关错误)
- [代理可用性自检](#代理可用性自检)

## 编辑器下载返回 404 / NoSuchKey

**确认**：

```powershell
curl.exe -s -o NUL -D - "https://download.unity3d.com/download_unity/<revision>/Windows64EditorInstaller/UnitySetup64-<版本>.exe" --range 0-1023
```

看响应行：`302` 且 `Location:` 指向 `download.unitychina.cn` → 已跳国内镜像；镜像再返回 `NoSuchKey` 就是 404 的来源。

**处置**：加代理重试，不要换版本（换 8 个版本结果一样）。

```powershell
& $cli install <版本> --yes --accept-eula --proxy http://127.0.0.1:7897 --set-default
```

**先验证代理真能取包**，再开 4 GB 下载：带 `-x` 取同样的 URL，期望 `206` + 正文头两字节 `MZ`。失败则代理没通或端口错，先把代理本身修好。

**revision 必须来自发布接口**，不要从发布说明网页扒 hash——网页常混入其它版本的 changeset，用它拼 URL 必然 404。

## HTTP 451

`451 Unavailable For Legal Reasons`：地区性法律限制，与本机、账号、代理都无关。

出现场景：`projects create` 的过程中配置 Remote Config 时返回 451（错误码类似 `REMOTE_CONFIG_SETUP_FAILED`）。

**处置**：当作已知缺口继续。工程照常建好、玩法不受影响。不要为此反复重试或换代理——重试不会成功。若日后确实要用 Remote Config，只能由有资质的主体在合规地区配置。

## 需要扩展 LTS 权益

报错形如 `6000.0.86f1 requires extended LTS entitlement`。Personal 免费许可拿不到这类旧版 LTS 的安装包。

**处置**：换更新的 LTS（`6000.3.x` / `6000.6.x`）。不要试图用企业/教育许可绕过，也不要降级到更旧的版本——只会撞同一堵墙。

## Hub 登录不了海外账号

**确认**：Hub 版本号 + 安装路径。国内渠道的 Hub（如 3.3.7，常带 `Tuanjie` 组件）只认国内账号；全球版为 3.22.x，装自 `public-cdn.cloud.unity3d.com`。

**处置**：按 SKILL.md 第 5 节的顺序换 Hub——**先装完编辑器并建好工程，再卸旧 Hub 装全球版**。顺序反了 CLI 会找不到可用编辑器。

卸载前备份 `%APPDATA%\UnityHub`。卸载后确认目录已清空，且没有残留的 `unityhub-<guid>` 临时下载目录（常见几十到上百 MB），一并删掉。

## unity skill install 报未知技能

CLI 1.0.0 没有固定技能集，只有 `unity-cli`、`new-unity-project` 内置。`--skill <其它名字>` 报「未知技能」是版本限制，不是网络或权限问题。

**处置**：按 SKILL.md 第 6 节从 `github.com/Unity-Technologies/skills` 下 zip 手动放置。放之前先列目录核对真实技能名（文档里的 `ui` 实际是 `create-ui`，`2d-pixel-perfect` 实际是 `configure-2d-pixel-perfect`）。

## 下载卡住或速度异常

- **Hub 在抢队列**：Hub 打开时会自己下编辑器并锁安装目录。下载期间杀掉 Hub 进程，确认它没重启下载。
- **进度长时间 0%**：先看是不是镜像 404（见第一节），再看磁盘余量（编辑器占 8 GB，安装包 4 GB）。
- 断点续传可用：重跑 `install` 通常会复用 `%APPDATA%\UnityHub\downloads` 里的已下部分。

## unity 命令不生效

PATH 由安装脚本写入，**只对新进程生效**。当前会话用全路径调用：

```powershell
& "$env:LOCALAPPDATA\Unity\bin\unity.exe" --version
```

`doctor` 报 `binary-on-path` warn 属正常。新开终端仍不生效时，检查用户 PATH 里是否有该项、是否需要重启登录会话。

## projects create 报云组织相关错误

- 只有一个组织、`activeOrganizationId` 为空时，`--cloud-org <org id>` 必须显式传，否则取不到。
- 组织 id 与云项目 id 不是同一个；`create` 的结果里会分别给出，记下来备用。
- 组织 id 可从 `& $cli cloud orgs list`（或等价命令）读取，不要手写猜测值。

## 代理可用性自检

```powershell
curl.exe -x http://127.0.0.1:7897 -s -o NUL -w "%{http_code}`n" https://public-cdn.cloud.unity3d.com/hub/prod/UnityHubSetup-x64.exe --range 0-1023
```

期望 `206`（或 `200`）。`000` / 超时说明代理未运行或端口不对；`407` 说明代理要认证。

若报「`curl.exe` 不是可识别的命令」，那是 PATH 里没有它，不是没装：

```powershell
& "$env:SystemRoot\System32\curl.exe" -x http://127.0.0.1:7897 -s -o NUL -w "%{http_code}`n" <URL> --range 0-1023
```

连 `System32\curl.exe` 也没有时，改用 `Invoke-WebRequest -Method Head -Proxy ... -SkipHttpErrorCheck` 取状态码。
