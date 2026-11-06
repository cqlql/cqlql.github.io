---
title: Docker 安装能力：官方步骤、实现施工图与真机实测
icon: mdi:docker
sort: 8
---

# Docker 安装能力：官方步骤、实现施工图与真机实测

> 状态：**现行**（2026-11-06，Ubuntu 24.04.2 `noble` x86_64 真机实测）
>
> **官方文档（先看这个）**：
> <https://docs.docker.com/engine/install/ubuntu/>
> 卸载：<https://docs.docker.com/engine/install/ubuntu/#uninstall-docker-engine>
> Debian：<https://docs.docker.com/engine/install/debian/>
>
> **一句话**：用**官方 apt 仓库（deb822 写法）**装 5 个包，别用 `curl | sh` 便捷脚本；
> 内网先解决「下载」再谈安装，否则 `apt-get install` 会卡几十分钟。
> 2026-11 实测版本：Docker **29.9.3**、compose **v5.7.0**。
>
> **本文有两种用法**：
> ① 手工在机器上装 Docker → 看 §1–§6；
> ② 在运维工具里**新增一个「安装 Docker」能力**（CLI + 界面 + 体检 + 预检 + 幂等 + 测试）
> → 看 §7 施工图，照 §7.9 的顺序做，按 §7.1 的 DoD 验收。
> 实现细节以 `pass-up.ops/docs/components.md` 为准；本文与它冲突时以项目仓为准。

---

## 1. 装之前先花 30 秒确认环境（只读）

```bash
. /etc/os-release
echo "OS=$ID $VERSION_ID codename=${UBUNTU_CODENAME:-$VERSION_CODENAME} arch=$(dpkg --print-architecture)"
command -v docker >/dev/null && docker --version || echo "docker: 未安装"
systemctl is-active docker 2>/dev/null || true
sudo -n true 2>/dev/null && echo "sudo: 免密可用" || echo "sudo: 需要密码"
df -h / | tail -1
```

判据：

| 检查 | 通过条件 | 不通过怎么办 |
| :--- | :--- | :--- |
| `ID` | 必须是 `ubuntu` | Debian 用官方 Debian 步骤，源路径不同 |
| `codename` | 小写字母（`noble` / `jammy`） | 取不到就显式用 `$VERSION_CODENAME`，别手写错 |
| 架构 | `amd64` / `arm64` | 官方源都支持；32 位不支持 |
| 磁盘 | 根分区至少剩 **2–3 GB** | Docker 包 + 镜像层很占空间 |
| 已有 docker | 官方版（`docker-ce`）可跳过 apt，只补服务与组 | 旧版 `docker.io` 需先卸 |

---

## 2. 官方安装步骤（可直接复制）

> 对应官方文档 *Install using the apt repository*。2025 年起官方已改成
> **deb822 `.sources` 写法**；网上大量教程还在用 `apt-key add` + `docker.list`，已过时。

```bash
# 0) 卸载官方列出的冲突包（保留 /var/lib/docker）
for p in docker.io docker-compose docker-compose-v2 docker-doc \
         docker-buildx podman-docker containerd runc; do
  if [ "$(dpkg-query -W -f='${db:Status-Status}' "$p" 2>/dev/null || true)" = "installed" ]; then
    sudo apt-get remove -y "$p"
  fi
done

# 1) 基础依赖
sudo apt-get update
sudo apt-get install -y ca-certificates curl

# 2) 官方 GPG key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 3) deb822 仓库源（注意不是 docker.list）
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

# 4) 安装 5 个包
sudo apt-get update
sudo apt-get install -y \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5) 启用服务 + 把当前用户加入 docker 组
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

# 6) 验证（不要用 hello-world，见下）
docker --version
docker compose version
sudo docker info --format '{{.ServerVersion}}'
```

**三个容易做错的点**：

1. `Suites` 必须是 Ubuntu 的 codename（`noble`），不是 `24.04`，也不是 Debian 的 `bookworm`。
2. `usermod` 后**当前会话仍然 permission denied**：组变更只对新登录生效。
   重开终端 / `newgrp docker` / 重新 ssh 都行。
3. 验证**不要**用 `docker run hello-world`：它会从 Docker Hub 拉镜像，内网经常拉不到，
   会把「装好了」误判成「装坏了」。用 `docker info` 就够。

---

## 3. 内网 / 国内网络：先解决下载，再谈安装

### 3.1 判断是「慢」还是「死」

```bash
sudo ls -lh /var/cache/apt/archives/partial/          # 正在下载的 deb
sudo cat /proc/$(pgrep -f 'apt-get install' | head -1)/wchan 2>/dev/null
sudo ss -tnp | grep -E 'apt|https' | head
```

- `partial/` 里的 deb 在**变大** → 只是慢，可以等，或换代理/镜像源；
- 大小长时间不变、`wchan=do_select`、没有 TCP 连接 → 基本是卡死，终止重来；
- 终止时**别只杀本机 ssh**：远端 apt 可能还在跑，先只读确认
  `ps -eo pid,etime,cmd | grep -E 'apt-get|passup-.*install'`，再决定。

### 3.2 方案 A：临时走代理（推荐，不留系统配置）

```bash
PROXY=http://192.168.1.221:7897   # 换成你的代理
sudo apt-get -o "Acquire::http::Proxy=$PROXY" -o "Acquire::https::Proxy=$PROXY" update
sudo apt-get -o "Acquire::http::Proxy=$PROXY" -o "Acquire::https::Proxy=$PROXY" \
  install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo https_proxy="$PROXY" curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
```

> 实测：直连 `download.docker.com` 会 `Connection reset by peer`；走代理后
> `HTTP 200 in 0.37s`，整套安装 **32 秒**完成。
>
> ⚠️ 不建议把代理写进 `/etc/apt/apt.conf.d/`：那会让这台机器的所有 apt 都走代理，
> 属于「临时需求留下系统级副作用」。

### 3.3 方案 B：换国内镜像源

把 `docker.sources` 的 `URIs` 换掉，`Signed-By` 仍指向官方 key：

```ini
URIs: https://mirrors.aliyun.com/docker-ce/linux/ubuntu
# 或 https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/ubuntu
```

改完先验证目录存在，再 `apt-get update`：

```bash
curl -I https://mirrors.aliyun.com/docker-ce/linux/ubuntu/dists/noble/Release
```

### 3.4 方案 C：离线 deb 包

在**同版本同架构**、能上网的机器上：

```bash
apt-get download docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

连同依赖一起拷到目标机，`sudo dpkg -i ./*.deb`（缺依赖再 `sudo apt-get -f install`）。

---

## 4. 装完必须逐条过的验证清单

| 命令 | 期望 | 不满足说明 |
| :--- | :--- | :--- |
| `docker --version` | `Docker version 29.x` | 包没装上 / PATH 问题 |
| `docker compose version` | `Docker Compose version v2.x`（或 v5.x） | 缺 `docker-compose-plugin` |
| `systemctl is-active docker` | `active` | 服务没起，看 `journalctl -u docker` |
| `docker info --format '{{.ServerVersion}}'` | 非空（如 `29.9.3`） | daemon 不通 / 权限问题 |
| `getent group docker` | 组存在且包含你的用户 | `usermod` 没执行或没重新登录 |
| `docker ps` | 空表但**不报权限错误** | 用户不在 docker 组 |
| `docker run --rm hello-world` | 内网**不要做** | 拉不到 Docker Hub，误判 |

---

## 5. 常见故障

| 现象 | 原因 | 处理 |
| :--- | :--- | :--- |
| `Could not get lock /var/lib/dpkg/lock-frontend` | 另一个 apt / dpkg 在跑 | `sudo fuser /var/lib/dpkg/lock-frontend` 看 PID，等它结束或结束它；**别直接删锁文件** |
| `GPG error ... NO_PUBKEY` / `Signed-By` 校验失败 | key 没下全 / 权限不对 | 重下 `docker.asc`，`chmod a+r`，确认 `Signed-By` 路径一致 |
| `404 Not Found .../dists/noble/stable` | `Suites` 写错（写成 `24.04` 或 Debian codename） | 用 `$VERSION_CODENAME` 重新生成 `docker.sources` |
| `permission denied ... /var/run/docker.sock` | 用户不在 docker 组 / 未重新登录 | `sudo usermod -aG docker $USER`，重开终端 |
| `docker: 'compose' is not a docker command` | 只装了引擎 | 补装 `docker-compose-plugin` |
| `apt-get install` 卡 20+ 分钟 | 直连源被 reset / 极慢 | 见 §3：代理 / 镜像源 / 离线包 |
| `containerd.io` 冲突 / 依赖断裂 | 旧 `containerd` / `runc` 残留 | 先按官方冲突列表卸载，再装 |
| `Cannot connect to the Docker daemon` | `docker.service` 没起 | `sudo systemctl start docker`，看 `journalctl -u docker -n 50` |
| 根分区被写满 | 镜像/容器/卷占空间 | `docker system df`，确认后 `docker system prune` |

---

## 6. 卸载 / 回滚

```bash
sudo systemctl disable --now docker
sudo apt-get purge -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
# ⚠️ 下面两条会删掉所有镜像 / 容器 / 卷，生产先确认再执行
sudo rm -rf /var/lib/docker /var/lib/containerd
sudo rm -f /etc/apt/sources.list.d/docker.sources /etc/apt/keyrings/docker.asc
```

只想「重装引擎、保留镜像」：不要删 `/var/lib/docker`，`purge` 后重新装即可。

---

## 7. 在运维工具里新增这个能力（施工图）

> 本节是**给实现者/AI 看的**：不是「怎么装 Docker」，而是「怎么在
> `pass-up.ops` 里加一个能装 Docker 的组件」，做到和现在线上那套一样：
> 只读体检 → 预检门 → 幂等安装 → 复核 → 界面六道门。

### 7.1 先定验收标准（DoD）

做不到下面每一条，就不算「实现完成」：

| # | 能力 | 判据 |
| :--- | :--- | :--- |
| 1 | 只读体检 | `component list --server <name> --json` 返回 `collected=true`，Docker 三态正确（missing / ok / degraded / unknown），数组是 `[]` 不是 `null` |
| 2 | 预检门 | 非 Ubuntu / 无 apt / 无 curl / 空间 < 1G → 拦住；仓库不可达只警告；`--dry-run` 返回 0 且远端零改动 |
| 3 | 安装 | 服务 `active`、`docker compose version` 可用、清单用户进 `docker` 组、`docker info` 通过 |
| 4 | 幂等 | 第二次安装跳过 apt、不重建容器、不重复下载 |
| 5 | 清理 | 远端 `/tmp/passup-component-docker-install.sh` 不存在 |
| 6 | 失败安全 | ssh 不通 → `collected=false`，不安装；脚本失败如实返回非 0，不假装成功 |
| 7 | 界面 | 输 `yes` 才能提交；服务端自己再跑 dry-run；并发 409；日志按行脱敏 |
| 8 | 测试 | 单测 + 脚本源码断言 + 前端纯函数测试全绿；`go vet` / `go build` 通过 |

### 7.2 架构与数据流

```text
[只读体检]
  远端 check.sh（每组件一份，只读）
    → KEY=VALUE + CHECK_OK
    → Go: CollectWithLocal（合并 raw）
    → 按组件派生 state / version / checks / preflight
    → GET /api/components/status?name= → 页面组件目录 + 详情

[安装]
  CLI / 界面
    → 参数校验（name 白名单、组件白名单、confirm、代理格式）
    → 服务端 --dry-run 预检（0 才继续）
    → 上传 install.sh（root=false，stdin 送脚本，固定 /tmp 路径）
    → 执行（root=true，stdin 留给 sudo 密码，脚本从文件读）
    → 清理临时脚本（root=false，成败都删）
    → 再跑一次只读体检做复核
```

### 7.3 文件清单（新增 / 修改）

| 文件 | 动作 | 写什么 |
| :--- | :--- | :--- |
| `internal/component/registry.go` | 改 | 加 `{ID:"docker", Name:"Docker 引擎", Kind:"基础设施", Phase:PhaseReady}` |
| `deploy/component/docker/check.sh` | 新增 | 只读采集（§7.4 的 key 一个不能少） |
| `deploy/component/docker/install.sh` | 新增 | 官方步骤 + 幂等 + 清理（§7.6 骨架） |
| `componentdist.go` | 已有 | `//go:embed all:deploy/component`，不用改；新增目录自动被嵌入 |
| `internal/component/status.go` | 改 | `CollectWithLocal` 按注册表跑脚本；`deriveDockerState` / `dockerCheckItems` / `Evaluate` |
| `internal/component/install.go` | 改 | `Install` 分派 + `installDocker`：dry-run 门、上传、执行、清理、复核 |
| `internal/component/cmd.go` | 改 | `parseArgs` 加 `install docker` / `--dry-run` / `--password-stdin`；`usage` 同步 |
| `internal/component/proxy.go` | 已有 | 可选代理的格式白名单（`ValidProxy`） |
| `internal/ui/component.go` | 改 | `handleComponentStatus/Run/Task`；六道门；runner 参数 |
| `internal/ui/ui.go` | 改 | 注册 `/api/components/status|run|task` 路由 |
| `backuprun.go` | 已有 | `args[0]=="component"` 时不补 `backup` 前缀（复用同一个子进程执行器） |
| `internal/restart/staleness.go` | 改 | `deploy/component/**` 算作 Go 构建输入（改脚本要重编） |
| `web/src/features/components/` | 新增 | `types.ts` / `api.ts` / `service.ts` / `utils/format.ts` / `pages/ComponentsPage.tsx` / `index.ts` |
| `web/src/App.tsx` | 改 | 第 3 个导航项「环境组件」+ pane |
| `internal/component/component_test.go` 等 | 新增 | 见 §7.10 |
| `docs/components.md` / `AGENTS.md` | 改 | 组件章节 + 红线 25 |

### 7.4 契约一：check.sh 输出与状态派生

脚本一行一个 `KEY=VALUE`，**必须**输出这些 key（缺一个，页面/预检就会瞎）：

| key | 含义 | 取值 |
| :--- | :--- | :--- |
| `OS_ID` / `OS_VERSION_ID` / `OS_CODENAME` | 发行版 | `ubuntu` / `24.04` / `noble` |
| `ARCH` | 架构 | `x86_64` / `aarch64` |
| `USER_NAME` | 远端登录用户 | — |
| `SUDO_NOPASSWD` | 免密 sudo | `yes/no` |
| `APT_GET` / `CURL` | 依赖命令 | `yes/no` |
| `DOCKER_INSTALLED` | 是否有 docker 二进制 | `yes/no` |
| `DOCKER_BIN` / `DOCKER_VERSION` | 路径 / 版本串 | — |
| `COMPOSE_PLUGIN` | `docker compose version` 是否可用 | `yes/no` |
| `DOCKER_SERVICE` | `systemctl is-active docker` | `active/inactive/failed/none` |
| `DOCKER_GROUP` / `USER_IN_DOCKER_GROUP` | 组是否存在 / 用户在不在组里 | `yes/no` |
| `CONFLICT_PACKAGES` | 官方冲突包列表 | 空格分隔，空=无 |
| `DOCKER_REPO` | 是否已有官方源 | `yes/no` |
| `APT_REPO_REACHABLE` | 仓库探测（只做警告） | `yes/no` |
| `DISK_FREE_MB` | 根分区剩余 | 数字 |
| `CHECK_OK` | 采集完成标记 | 固定 `yes` |

状态派生（`deriveDockerState`）：

```text
DOCKER_INSTALLED != yes                          → missing
installed=yes 且 (SERVICE != active 或 COMPOSE != yes) → degraded
其余                                              → ok
（ssh 失败 / 脚本没给 CHECK_OK → 整份 collected=false，组件 unknown）
```

预检（`Evaluate`）：

- **blockers**：`OS_ID != ubuntu`；`OS_CODENAME` 为空；`APT_GET=no`；`CURL=no`；
  `DISK_FREE_MB < 1024`。
- **warnings**：`APT_REPO_REACHABLE=no`（出口抖动，交给 `apt-get update` 定论）；
  有冲突包；已装官方版；无免密 sudo；用户不在 docker 组。
- `Ready = len(blockers)==0`。

**脚本容错**：每个外部命令都要带 `2>/dev/null || true`（或先 `command -v` 判断）。
否则在缺 `dpkg` / `systemctl` / `getent` 的环境里，`set -u` 会让脚本半路退出，
`CHECK_OK` 永远打不出来，Go 侧只能判 `collected=false` —— 看起来像「连不上」，
实际是脚本自己挂了。

### 7.5 契约二：安装参数、退出码与 dry-run 语义

```text
ops component install docker --server <name> [--dry-run] [--password-stdin] [--proxy http://host:port]

退出码：0 成功 / 预检通过；1 预检不过或安装失败；2 参数错误
--dry-run：打印计划 + 汇总 blockers，然后 return 0/1；不上传、不执行、不改远端
--password-stdin：sudo 密码只从 stdin 读一行；不进 argv
```

安装时传给远端脚本的变量（作为 `sh -c` 命令字符串前缀，sudo 不会重置它们）：

```text
COMPONENT_RUN_USER=<清单 user>      # 只用于 usermod -aG docker
COMPONENT_OS_CODENAME=<noble>       # 拼 apt 源 Suites
COMPONENT_APT_PROXY=<可选代理>       # 只在本次安装进程内生效
```

固定临时路径：`/tmp/passup-component-docker-install.sh`（不接受任何用户输入拼接）。

### 7.6 脚本骨架

`deploy/component/docker/check.sh`（只读）：

```bash
#!/bin/bash
# 只读：不写文件、不提权、不装包、不拉镜像、不改容器
set -u
kv() { local k="$1" v="${2-}"; v="${v//$'\r'/ }"; v="${v//$'\n'/ }"; printf '%s=%s\n' "$k" "$v"; }

kv OS_ID       "$( . /etc/os-release 2>/dev/null; printf '%s' "${ID:-}" )"
kv OS_CODENAME "$( . /etc/os-release 2>/dev/null; printf '%s' "${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}" )"
kv ARCH        "$(uname -m)"
if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
  kv SUDO_NOPASSWD yes
else
  kv SUDO_NOPASSWD no
fi
# …按 §7.4 的 key 逐项采集（docker --version / systemctl is-active / dpkg-query …）
kv DISK_FREE_MB "$(df -Pm / | awk 'NR==2{print $4}')"
kv CHECK_OK yes
```

`deploy/component/docker/install.sh`（写）：

```bash
#!/bin/bash
set -euo pipefail
RUN_USER="${COMPONENT_RUN_USER:-}"
CODENAME="${COMPONENT_OS_CODENAME:-}"
PROXY="${COMPONENT_APT_PROXY:-}"
ok()   { echo "  [OK]   $*"; }
info() { echo "  [INFO] $*"; }
die()  { echo "  [FAIL] $*" >&2; exit 1; }

# Step 0：前置校验（root、用户名、codename 正则、apt/curl、OS_ID=ubuntu）
# Step 0.5：可选代理（export http(s)_proxy + apt -o，不写 /etc/apt/apt.conf.d）
# Step 1：幂等——已装官方版 + compose 就跳过 apt
# Step 2-5：官方步骤（冲突包 → 依赖 → GPG → deb822 源 → 5 个包）
# Step 6：systemctl enable --now docker + usermod -aG docker "$RUN_USER"
# Step 7：验证 docker --version / docker compose version / docker info（不跑 hello-world）
```

### 7.7 Go 侧骨架

```text
// 执行器抽象：生产是 ssh（项目里是 *shared.SSHTarget），测试/验证可用本地 bash。
// Collect / Install 只依赖这个函数值，不直接依赖 SSHTarget —— 单测才好塞假实现。
type Runner func(cmd string) (out string, code int, err error)

// registry.go
type Component struct { ID, Name, Kind, Depends, Phase string; OfflineImage bool }
var registry = []Component{
    {ID: "docker", Name: "Docker 引擎", Kind: "基础设施", Phase: PhaseReady},
}
func Runnable(id string) bool   // PhaseReady 才允许写
func DependsReady(c Component, states map[string]string) bool

// status.go
func CollectWithLocal(ctx, t, scripts fs.FS, server string, local LocalFacts) StatusView
func deriveDockerState(raw map[string]string) (state, version string)
func dockerCheckItems(raw map[string]string) []CheckItem
func Evaluate(raw map[string]string) Preflight

// install.go
type InstallOptions struct { ID string; DryRun bool; Proxy string }
func Install(ctx, t, scripts, view, opt) int   // Runnable → 校验代理 → Collected → 按 id 分派
func installDocker(...) int                    // printPlan → blockers → if DryRun return → 上传/执行/清理 → 复核

// cmd.go
func parseArgs(args []string) (options, error) // list / install / image-load；--server/--dry-run/--password-stdin/--proxy
func CmdComponent(args []string, scripts fs.FS) int
```

四条实现纪律：

1. `--dry-run` 必须在 `readScript` / 上传**之前** return。
2. 上传用 `root=false`（stdin 送脚本），执行用 `root=true`（stdin 留给 sudo 密码）。
3. 临时脚本成败都 `rm -f`；装完必须 `Collect` 复核，复核失败不推断成功。
4. `view.Collected=false` 时拒绝安装，不能只靠 blockers 间接挡。

### 7.8 界面与六道门

| 端点 | 方法 | 请求 / 参数 | 门 |
| :--- | :--- | :--- | :--- |
| `/api/components/status` | GET | `?name=<清单 name>` | token；只读 |
| `/api/components/run` | POST | `{verb:"install", component, name, confirm:"yes", password?, proxy?}` | 六道门 |
| `/api/components/task` | GET | `?after=<游标>` | token；增量日志 |
| `/api/components/image` | POST | multipart（MinIO 离线镜像用） | 六道门 + 服务端生成临时路径 |

六道门（缺一不可）：

1. `POST` + `confirm=="yes"`（页面要人输 `yes`）；
2. 服务端先跑 `--dry-run`，非 0 不执行；
3. `name` 只认 `servers.json`（未知 404），组件只认 `Runnable` 白名单；
4. sudo 密码只经 runner 的 `password` 参数 → 子进程 stdin；日志按行脱敏；
5. 任务脱离 HTTP 请求（不用 `r.Context()`），单任务互斥（并发 409），日志 `?after=` 增量；
6. 界面不开放 `--force` / 卸载 / 删数据。

前端文件与职责：

| 文件 | 职责 |
| :--- | :--- |
| `types.ts` | 状态视图 / 预检 / 任务 / 请求体类型 |
| `api.ts` | 只发请求，不做判定 |
| `service.ts` | 编排：取状态、启动安装、轮询增量日志 |
| `utils/format.ts` | 纯函数：归一化、`canInstall`、`installHint`、`preflightOf`、代理格式 |
| `pages/ComponentsPage.tsx` | 目录 + 详情 + 确认弹窗 + 日志（只渲染） |

`App.tsx` 加导航项与 pane；**不要**为 Docker 单独加一个导航页（任务锁/日志/依赖是同一份状态）。

### 7.9 实现顺序（照做，每步都能验证）

| # | 做什么 | 验证 |
| :--- | :--- | :--- |
| 1 | 注册表加 docker 条目（`PhaseReady`） | `go build ./...`；`Lookup("docker")` 返回 ready |
| 2 | 写 `check.sh`（§7.4 全部 key + `CHECK_OK`） | 本机 `bash check.sh` 有输出、末行 `CHECK_OK=yes`；`bash -n` 通过 |
| 3 | 写 `install.sh`（§7.6 骨架） | `bash -n`；在测试机 `--dry-run` 不执行 |
| 4 | `status.go`：跑脚本、合并 raw、派生状态/检查项/预检 | 单测：三态、失败数组 `[]`、`Evaluate` blockers |
| 5 | `install.go`：分派 + dry-run 门 + 上传/执行/清理 + 复核 | 单测：给必然连不上的目标，dry-run 返回 0/1 且不触远端 |
| 6 | `cmd.go`：`install docker` + 参数 + `usage` | `ops component install docker --dry-run` 打印计划 |
| 7 | `componentdist.go` / `staleness.go`：确认脚本被嵌入、算构建输入 | 改 `check.sh` 后「先重建」会勾上；重编后远端行为变化 |
| 8 | 脚本源码断言 + 注册表/参数/预检测试 | `go test ./internal/component .` |
| 9 | UI 端点 + 六道门 + 前端页面 | `go test ./internal/ui`；页面能体检/安装/看日志 |
| 10 | 文档 + 真机验收（§7.1 的 8 条） | 见 §7.10 |

### 7.10 测试与真机验收

**单测（必须存在）**：

- `TestRegistryWhitelist`：docker 可安装、未注册 id 拒绝；
- `TestParseArgs`：`install docker` / `--dry-run` / `--password-stdin` / 非法参数；
- `TestEvaluateBlockers`：非 Ubuntu、无 apt、空间不足被拦；仓库不可达只警告；
- `TestInstallDryRunNeverTouchesRemote`：给 `127.0.0.1:1`，dry-run 不产生远端写；
- `TestFailureViewArraysAreEmptyNotNil`：失败响应数组是 `[]`；
- `TestComponentCheckScriptIsReadOnly`：`check.sh` 无写/提权/装包/拉镜像；
- `TestComponentInstallFollowsOfficialDockerDocs`：脚本含官方 key / deb822 / 5 个包 / 不跑 hello-world；
- `TestComponentScriptsHaveNoCredentials`：嵌入目录无真实凭证；
- UI：`TestComponentRunGates`（confirm / 白名单 / 404 / 409）、`TestComponentRunPreflightGate`（预检非 0 不装）、`TestComponentRunDryRunThenInstall`；
- 前端：`canInstall`（依赖门 + 预检门）、`normalizeStatusView`（null 不白屏）、`normalizeProxyInput`。

**真机验收（按顺序，前一步不过不进下一步）**：

```bash
ops component list --server <name> --json                 # 1. 只读：三态正确
ops component install docker --server <name> --dry-run     # 2. 预检：0 且远端无变化
ops component install docker --server <name>               # 3. 真装：服务 active
ops component list --server <name> --json                 # 4. 复核：docker=ok
ops component install docker --server <name>               # 5. 幂等：跳过 apt、秒级完成
ssh <name> 'ls /tmp/passup-component-docker-install.sh'   # 6. 清理：不存在
```

> ⚠️ 取退出码时**不要**写成 `cmd | tail`：`$?` 拿到的是 `tail` 的退出码（永远是 0）。
> 用 `cmd > /tmp/x.log 2>&1; echo EXIT=$?`，或 `cmd | tail; echo ${PIPESTATUS[0]}`。

### 7.11 常见实现错误

| 错误 | 后果 | 正确做法 |
| :--- | :--- | :--- |
| 只写脚本，没加注册表 | 页面/CLI 看不到组件 | 注册表是唯一入口 |
| `check.sh` 里 `docker pull` / 装包 | 体检有副作用，没人敢点「重新检查」 | 只读，源码断言挡 |
| dry-run 放在上传之后 | 「预检」已经改了远端 | 上传前 return |
| 用 0 / 空值兜底「没采到」 | 把「连不上」伪装成「未安装」 | `collected=false` + `unknown` |
| 上传和 sudo 密码都走 stdin | 密码被脚本内容顶掉 / 反之 | 上传 root=false 送脚本；执行 root=true 留密码；脚本从文件读 |
| 凭证拼进 argv / 嵌入脚本 | `ps`、日志、exe 里都能看到 | 运行时拼到上传脚本头部，0600 临时文件，成败都删 |
| 失败响应返回 `null` 数组 | 前端整页白屏 | 从 `emptyView()` 起，前端再 normalize |
| 前端自己拼「能不能装」 | 与后端 blockers 漂移 | 只读后端 `preflight`，前端只禁用按钮 |
| 改了 `deploy/component/**` 不重编 | 远端跑的还是旧脚本 | 重编；`staleness` 把它算作 Go 输入 |
| 为 Docker 加一个导航页 | 任务锁/日志/依赖跨页同步 | 一个目录页 + 详情 |

---

## 8. 真机实测记录（k4）

| 项 | 值 |
| :--- | :--- |
| 目标机 | `192.168.1.204`（ssh 别名 k4），Ubuntu 24.04.2 LTS `noble` x86_64 |
| 账号 / 提权 | `cql`，免密 sudo 可用 |
| 磁盘 | 单块 22 G 系统盘，根分区剩约 15 G |
| 直连测试 | `curl https://download.docker.com/linux/ubuntu/gpg` → `Connection reset by peer` |
| 代理测试 | `curl -x http://192.168.1.221:7897 ...` → `HTTP 200 in 0.37s` |
| 首次安装 | 直连 apt 卡 **25 分钟**只下了约 6 MB（本机 ssh 超时中断，远端 apt 仍在跑） |
| 终止 + 代理重跑 | 终止残留 apt → 临时配代理 → 重跑 → **32 秒完成** |
| 结果 | Docker **29.9.3**、compose **v5.7.0**、`docker.service` active、`cql` 在 `docker` 组 |

关键教训：

1. **本机命令超时 ≠ 远端停止**：ssh 断了，远端 `apt-get` 可能还在跑；先只读复核再决定。
2. **直连探测时好时坏**（一次 200、一次 reset）：不要用一次探测结果硬判「装不了」，
   以 `apt-get update` 的报错为准。
3. 组变更要重新登录才生效；工具侧新 ssh 会话会自动带上。

---

## 9. 复用到别的组件（MinIO / agent / 数据库客户端）

Docker 这套「体检 → 预检 → 安装 → 复核」可以照搬，差异点：

| 维度 | Docker | MinIO |
| :--- | :--- | :--- |
| 依赖 | 无 | `depends: "docker"`，Docker 未就绪时预检拦 |
| 安装来源 | 官方 apt 仓库 | 目标机**已导入的离线镜像**，绝不 `docker pull` |
| 额外前置 | 无 | 离线 tar（校验 `manifest.json`）、root 凭证（本机 `backup/minio.env`） |
| 数据目录 | `/var/lib/docker`（保留） | `/data/minio`（不存在时要么先挂盘、要么明确警告落根分区） |
| 端口 | 无 | 9000 API / 9001 Console |
| 验证 | `docker info` | `GET /minio/health/live` |

其余实现纪律（注册表、只读脚本、dry-run 门、幂等、凭证注入、六道门、embed 重编、
真机验收顺序）完全一致。

---

## 附：官方链接与现有实现对照

**官方**：

- Ubuntu 安装：<https://docs.docker.com/engine/install/ubuntu/>
- Ubuntu 卸载：<https://docs.docker.com/engine/install/ubuntu/#uninstall-docker-engine>
- Debian 安装：<https://docs.docker.com/engine/install/debian/>
- 安装后步骤（非 root、开机自启）：<https://docs.docker.com/engine/install/linux-postinstall/>
- 2026-11 实测：Docker `29.9.3`、compose `v5.7.0`、Ubuntu `24.04.2 LTS (noble)`

**现有实现（照着读代码）**：

| 关注点 | 文件 / 函数 |
| :--- | :--- |
| 注册表 | `pass-up.ops/internal/component/registry.go`（`Component` / `registry` / `Runnable`） |
| 只读采集 | `pass-up.ops/internal/component/status.go`（`CollectWithLocal` / `deriveDockerState` / `dockerCheckItems` / `Evaluate`） |
| 安装 | `pass-up.ops/internal/component/install.go`（`Install` / `installDocker`） |
| CLI | `pass-up.ops/internal/component/cmd.go`（`parseArgs` / `CmdComponent` / `usage`） |
| 代理 | `pass-up.ops/internal/component/proxy.go`（`ValidProxy`） |
| 界面端点 | `pass-up.ops/internal/ui/component.go`（`handleComponentStatus` / `Run` / `Task`） |
| 路由 | `pass-up.ops/internal/ui/ui.go`（`/api/components/*`） |
| 子进程执行器 | `pass-up.ops/backuprun.go`（`backupSubprocessArgs` 的 `component` 前缀） |
| 构建输入 | `pass-up.ops/internal/restart/staleness.go`（`deploy/component/**`） |
| 前端 | `pass-up.ops/web/src/features/components/` |
| 项目内权威文档 | `pass-up.ops/docs/components.md`、`docs/ui.md` §13、`AGENTS.md` 硬约束 25 |
