# 环境组件（Docker / MinIO 安装、更新、卸载）

> 2026-11-06 落地安装 / 离线镜像导入；**2026-11-07 落地更新 / 卸载**（§8）；
> **2026-11-07 追加从已登记服务器直接复制镜像**（§9，省掉手工 `docker save` + 拷文件）。
> 解决的问题：备份端 `k1`（172.16.0.211）上**既没有 Docker，也没有
> MinIO 服务**；而 `deploy/backup/minio/` 只把 `mc` 当 S3 客户端，假定「备份端本机 9000
> 的 MinIO 服务」已经存在。备份失败不是脚本坏了，是服务端从来没进过部署范围。
> 交互原型见 [components-prototype.html](components-prototype.html)
> （**同步维护**：本文是判据，原型是交互速览；冲突时以本文为准）。

## 1. 目标机实测约束（只读体检结论）

| 事实 | 结论 |
|---|---|
| Ubuntu 24.04.2 LTS `noble` x86_64、`sudo -n true` 可用 | 可按 Docker 官方 apt 仓库（deb822 `docker.sources`）装引擎 |
| `download.docker.com` 偶发 200 / 偶发 Connection reset | 仓库可达性只做**警告**，不硬拦；权威结论交给 `apt-get update` |
| Docker Hub 超时、`quay.io` manifest 401、`dl.min.io` 二进制 410 | 🔴 **绝不能在线拉镜像**：MinIO 只认人从本机导入的离线 tar |
| `/data` 存在（root:root），根分区剩 32 G | MinIO 数据落 `/data/minio`，保留已有 `/data/backups` |
| 本机 `backup/minio.env` 的 `DEST_URL=http://127.0.0.1:8007` | 8007 是**生产端**端口；备份端本机 MinIO 是 9000，装完服务仍连不上，必须到「配置」页改并同步远端 |

> **2026-11-06 晚换电脑后接 k4（192.168.1.204）**：同为 Ubuntu 24.04.2 `noble`、
> 免密 sudo、Docker/MinIO 全缺，但**只有一块 22 G 系统盘、根分区剩约 16 G，
> 既没有独立数据盘也没有 `/data`**。原来「`/data` 不存在」是硬 blocker，会把这类
> 测试机永远挡在 MinIO 安装之外。现改为：预检给一条**明确警告**（数据落在根分区、
> 非独立数据盘，生产环境应先挂载数据盘到 `/data`），安装脚本
> `mkdir -p /data/minio` 连父目录一起创建；`check.sh` 在 `/data` 不存在时退回
> 报告根分区余量，页面不再显示空值。k1 上 `/data` 已存在时行为不变。

## 2. 注册表是唯一声明

`internal/component/registry.go` 的一张有序表就是全部声明：

```go
{ID: "docker", Name: "Docker 引擎", Kind: "基础设施", Phase: PhaseReady,
 Verbs: []string{VerbInstall, VerbUpdate, VerbUninstall}},
{ID: "minio",  Name: "MinIO 服务",  Kind: "备份存储", Depends: "docker",
 Phase: PhaseReady, OfflineImage: true,
 Verbs: []string{VerbInstall, VerbUpdate, VerbUninstall}},
```

- 目录、依赖链、动作白名单、检查项都由它推导；**新增组件 = 加一条声明 + 放一份
  `deploy/component/<id>/check.sh`（可选 `install.sh` / `update.sh` / `uninstall.sh`）**，
  导航项与页面数不变。
- 🔴 `RunnableVerb(id, verb)` 是**唯一**的写操作白名单：CLI、界面后端、执行器都问它，
  不各自抄字符串。`planned` 组件一律拒绝；`image-load` 另走 `SupportsImage`
  （只有 `OfflineImage=true` 能导入 tar）。
- 🔴 **不写 `Verbs` 的组件只获得 `install`**：破坏性动词必须显式声明，
  否则「加一条声明」会顺手给新组件开卸载权限。
- `Verbs` 的顺序就是页面按钮的顺序（安装 → 更新 → 卸载）；
  `DependsReady` 按 `depends` 推导上游是否就绪，MinIO 的安装 / 更新预检会再挡一次
  「Docker active」。
- 脚本树由仓库根 `componentdist.go` 整目录 `//go:embed`，`main.go` 注入给
  `internal/component`（embed 路径不能含 `..`）。改了 `deploy/component/**` 必须重新
  `go build`；`internal/restart/staleness.go` 也把它算作 Go 构建输入（四份写脚本同样覆盖）。

## 3. CLI

```
ops component list --server <name> [--json]        # 只读体检（界面状态源 + 写动作计划）
ops component install docker --server <name> [--proxy <http://host:port>] [--dry-run] [--password-stdin]
ops component install minio  --server <name> [--dry-run] [--password-stdin]
ops component update docker --server <name> [--proxy <http://host:port>] [--dry-run] [--password-stdin]
ops component update minio  --server <name> [--image-ref <已导入镜像:标签>] [--dry-run] [--password-stdin]
ops component uninstall docker --server <name> --ack-downstream [--dry-run] [--password-stdin]
ops component uninstall minio  --server <name> [--purge-data] [--dry-run] [--password-stdin]
ops component image-load minio --server <name> --image-tar <本机 .tar> [--dry-run]
ops component images --server <name> [--json]     # 只读：这台机器本地的 MinIO 镜像（复制用候选）
ops component image-copy minio --server <name> --from-server <源机 name> \
        [--image-ref <源机镜像:标签>] [--dry-run] [--password-stdin]
```

- `--server` 只接受 `servers.json` 里的 `name`，不接受任意 host（硬约束 12）。
- `--dry-run` **绝不改远端**：上传与执行都在 dry-run 分支之前 return；界面由服务端
  先跑一次，非 0 就不执行正式动作。
- sudo 密码只有 `--password-stdin`，不进命令行 / `ps` / 日志。
- `list` 会依次跑每个 ready 组件的 `check.sh`，合并 `KEY=VALUE`；任一脚本没给出
  `CHECK_OK=yes` 或 ssh 自身失败（exit 255）就整体 `collected=false`、组件标 `unknown`，
  **不用 0 / 空值冒充「未安装」**（硬约束 3）。`list --json` 另带 `actions`（§8.4）。
- `check.sh` 只读：不写文件、不提权、不装包、不拉镜像、不改容器
  （`componentdist_test.go` 的 `TestComponentCheckScriptIsReadOnly` 逐个挡回归）。
- 🔴 附加参数各归其位，由 `ValidateActionFlags` 一处裁决（CLI 与界面后端同一份）：
  `--image-ref` 只 `update minio`、`--purge-data` 只 `uninstall minio`（默认关）、
  `--ack-downstream` 是 `uninstall docker` 的**必填**确认、`--proxy` 只
  `install` / `update docker`。界面和 CLI 都**不开放 `--force`**。
- `image-copy` 的两个专属参数由 `parseArgs` 直接裁决（它不走 `ValidateActionFlags`）：
  `--from-server` **必填**、`--image-tar` 与它互斥；`image-load` 反过来不接受
  `--from-server`。`--image-ref` 在两者语义不同但都要过 `ValidImageRef` 的字符集门：
  `image-copy` 还要求它出现在**源机**本地镜像清单里（§9）。

### 3.1 安装 / 更新 Docker 时的 apt 代理（可选，2026-11-06 追加，07 扩展到更新）

**背景**：换电脑后的 k4 直连 `download.docker.com` 会被 reset，一次 `apt-get install`
空转 25 分钟；临时在远端写 `/etc/apt/apt.conf.d/` 虽然能加速（配好后 32 秒装完），
但那是手工改系统配置，界面上无从选择，也不该由工具悄悄留下。

**实现**：弹窗里勾选「本次走代理」并填 `http://host:port`，或 CLI 用
`--proxy`。值经 `component.ValidProxy` 严格校验（只允许 `http://host:port`，
**不含认证 / 路径 / 空格 / shell 元字符**，端口 1–65535），Go 侧作为
`COMPONENT_APT_PROXY=<quoted>` 拼进远端 `sh -c` 命令字符串；脚本内
`export http_proxy/https_proxy`（给 curl）并给每条 `apt-get` 加
`-o Acquire::{http,https}::Proxy=`（不依赖 sudo 的环境继承）。

🔴 **只在本次进程内生效，绝不写 `/etc/apt/apt.conf.d/` 等任何远端配置**，
装完 / 升完自动失效。代理只给 `install docker` 与 `update docker`（两者都跑 apt），
MinIO 与卸载动作不跑 apt/curl，传了直接 400。
服务端预检（`--dry-run`）与正式动作带**同一组** `--proxy` 参数，六道门其余不变。
代理地址会打印在计划与任务日志里（它不是凭据；正因如此格式里禁止 `user:pass@`）。

界面把上次成功的地址记在 `localStorage`（只是普通网络偏好；访问令牌仍只在
内存 + 地址栏，绝不落盘）。锁死回归：`TestValidProxy`、
`TestComponentRunProxyGates` / `TestComponentRunProxyPassedToBothCalls` /
`TestComponentRunExtraFlagGates`、
`TestComponentInstallFollowsOfficialDockerDocs` 与
`TestComponentWriteScriptsBoundaries` 的脚本级断言、
`web/test/components.test.ts` 的 `normalizeProxyInput`。

## 4. MinIO 凭证与离线镜像（红线最密集的一段）

🔴 **`deploy/component/` 整目录编进 exe**：里面不许出现任何真实凭证、`.env`、私钥或日志。
`.gitignore` 与 `TestComponentScriptsHaveNoCredentials` 各挡一道；后者只把
「变量名 = 字面值」判为泄漏，`-e MINIO_ROOT_PASSWORD="$VAR"` 这种变量引用不算。

凭证链路：

1. Go 侧从**本机** `backup/minio.env`（配置目录，0600，不入 Git）读
   `DEST_KEY` / `DEST_SECRET`；占位符（`YOUR_*` / `CHANGE_ME*` / 空）一律视为未配置。
2. 页面可见的只有两个布尔标记与 `DEST_URL` 端口（`StatusView.local`），**明文不进
   HTTP 响应、不进任务日志**。
3. 安装**与更新**时把凭证用 `shared.ShQuote` 拼在上传脚本头部（内存 → ssh stdin →
   远端 `/tmp/passup-component-minio-{install,update}.sh`，0600/0700）。
   脚本本体没有凭证；`docker run` 用 `-e` 注入，不 echo、不 inspect 全量配置。
4. 执行完（成功 / 失败 / 远端报错）都 `rm -f` 那个临时脚本。

离线镜像链路：

1. 人从本机选 `docker save` 导出的 `.tar`；CLI 用 `archive/tar` 校验里面有
   `manifest.json`（只在本机读，不解压、不落盘），上限 2 GiB。
2. CLI 上传到远端固定 0600 临时路径 → `docker load -i` → 清理；**从不 `docker pull`**。
3. 界面走 `POST /api/components/image`（multipart）：临时文件由服务端
   `os.CreateTemp` 生成，**接口不接收任何本机路径**，任务结束（含失败）即删。
4. 目标机没有离线镜像时 `EvaluateMinio` 直接判 blocker，安装按钮禁用、dry-run 非 0，
   不会把「装一半」留在远端。
5. 🔴 **更新用的新镜像同样只能来自人导入的 tar**：候选是只读体检采到的
   `MINIO_IMAGE_LINES` 里「与当前容器镜像不同」的那些；CLI `--image-ref` 与界面下拉
   都必须在候选白名单里，Go 侧 `safeImageRef` 再卡一次字符集。
6. 「从另一台已登记服务器复制镜像」（§9）是**同一条离线镜像红线的另一条输入路径**：
   它走 `docker save` / `docker load`，不是 `docker pull`，也不经任何镜像仓库。

## 5. 写脚本的行为边界

| | Docker 引擎 | MinIO 服务 |
|---|---|---|
| 来源 | 官方 apt 仓库（deb822） | 目标机**已导入**的离线镜像，或从已登记服务器复制（§9） |
| 提权 | 安装 / 更新 / 卸载期 root（`sudo -n sh -c`） | 同左 |
| 幂等 | 已装官方版就跳过 apt，只补服务与用户组 | 已有容器只做健康检查（stopped 则 `docker start`），**不重建、不换镜像** |
| 验证 | `docker info`（不跑 hello-world） | `GET /minio/health/live` 20 次重试 |
| 保留 | `/var/lib/docker`、容器 / 镜像、crontab | `/data/minio`、`/data`、`/data/backups`、其它镜像、引擎、crontab、`backup.env` |
| 不做 | `docker pull` / `docker run` | `docker pull` / `docker rm` / 删数据 / 跑备份 |
| `/data` 不存在 | — | `mkdir -p` 自动创建并**警告数据落在根分区**；不自动挂载磁盘、不改已有挂载点 |

更新与卸载脚本（`deploy/component/<id>/{update,uninstall}.sh`）另守这些边界：

| | `update.sh` | `uninstall.sh` |
|---|---|---|
| Docker | `apt-get install --only-upgrade` 五个官方包 → `systemctl restart docker` → `docker info` + 下游健康检查；不换 / 不重建 MinIO 容器镜像 | `systemctl stop` + `apt purge`；`COMPONENT_ACK_DOWNSTREAM=yes` 是脚本第二道门；保留 `/var/lib/docker`、镜像、`/data/minio` |
| MinIO | 记录原镜像标签 / 端口 / 挂载 / 重启策略 → `docker stop` + `docker rm`（**无 `-v`**）→ 按原配置用新镜像重建；失败回滚到原镜像标签 + 原容器配置 | `docker stop` + `docker rm`（**无 `-v`**）；只有 `COMPONENT_PURGE_DATA=yes` 分支才 `rm -rf /data/minio`（硬编码常量路径） |
| 都不做 | `docker pull` / `docker rm -v` / 删数据 / 碰 crontab / 改 `backup.env` | 同左；卸载后**不改 crontab / logrotate / backup.env** |

## 6. 界面：一个目录页，不拆导航

「环境组件」是第 3 个导航项（`web/src/features/components/`），一页内五段：
全局状态条 → 组件目录（点行切详情）→ **备份依赖区（§10）** → 选中组件详情 →
任务日志（全局一份）。MinIO 专属的「离线镜像」区按 `offline_image` 条件渲染，
插在详情与日志之间，不污染 Docker 详情。
判据见 `docs/ui.md` §7（零跨页共享状态）与 §13；交互速览见
[components-prototype.html](components-prototype.html)（同步维护，冲突以本文为准）。

写操作的六道门（照抄 `docs/ui.md` §9，install / update / uninstall / image-load 各一套）：

1. `POST` + `confirm=="yes"`（页面要人输 `yes`）；
2. 服务端自己先跑 `--dry-run`，非 0 不执行；
3. `name` 只认 `servers.json`（未知 404），组件 / 动词只认注册表白名单；
   附加参数由 `ValidateActionFlags` 服务端再验一次（§3）；
4. sudo 密码只在单次请求内存 → 子进程 stdin，日志按行脱敏、任务结束清空；
5. 任务脱离 HTTP 请求、与备份部署**共用同一把后台任务锁**（并发 409，重启门自动覆盖）、
   日志 `?after=` 增量轮询；
6. 🔴 **不开放 `--force`**；删数据是**独立勾选项且默认不勾**，
   卸引擎的连带影响**必须勾选才能提交**（§8.3）。

`ui` 不 import `component` 的执行器：执行器由 `main.go` 注入，根包 `backuprun.go` 再起一个自己
执行同一条 CLI 命令（`args[0]=="component"` 时不补 `backup` 前缀）。
界面组件白名单 / 参数校验由 `internal/component` 的纯函数提供，不碰 SSH。

## 7. 构建与验证顺序

```
# 改了 deploy/component/** 或 web/** 都要按这个顺序重建
cd web && npm test && npm run typecheck && npm run build
go vet ./... && go test ./... && go build -o ops.exe .

# 只读真机验证（都不改远端）
ops.exe component list --server k1 --json
ops.exe component install docker --server k1 --dry-run
ops.exe component install minio  --server k1 --dry-run
ops.exe component update docker --server k1 --dry-run
ops.exe component update minio  --server k1 --image-ref <已导入镜像:标签> --dry-run
ops.exe component uninstall docker --server k1 --ack-downstream --dry-run
ops.exe component uninstall minio  --server k1 --dry-run
ops.exe component image-load minio --server k1 --image-tar <本机 .tar> --dry-run
ops.exe component images --server k1
ops.exe component image-copy minio --server k1 --from-server <源机 name> --dry-run
```

回归要点：`internal/component/component_test.go`（注册表 / 动词与参数白名单 /
`EvaluateMinio` blocker / 四态推导 / §8.1 六场景按钮门 / 影响清单 / 四处 dry-run 门 /
§9 的 image-copy 参数门与 2 GiB 上限）、
`componentdist_test.go`（八份脚本完整 / `check.sh` 只读 / 无凭证 /
`TestComponentWriteScriptsBoundaries` 的四份写脚本边界与「删数据只在 yes 分支」）、
`internal/ui/component_test.go`（确认门 / 预检门 / 附加参数门 / 409 / multipart 导入
与临时文件清理 / 预检与正式动作同参数 / image-copy 的源机白名单与只读镜像清单接口）、
`web/test/components.test.ts`（动作计划归一化 / available + busy 门 / 附加勾选 /
更新卸载请求参数）、`internal/restart/staleness_test.go`（四份写脚本算 Go 构建输入）。

## 8. 更新与卸载（2026-11-07 落地）

> 2026-11-06 时这两个动词仍是设计态；**本节现在是已实现判据**。
> [交互原型](components-prototype.html) 已同步为「已接入」（六个场景仍可点开看弹窗，
> 读起来比文档快），冲突时以本节为准。

### 8.1 状态、依赖与按钮门

`check.sh` 的 `KEY=VALUE` 是唯一真源。实现里有五种状态：
`missing / ok / update / degraded / unknown`（`planned` 只给尚未接入的占位组件），
`ready = ok || update || degraded`。
🔴 `unknown`（ssh exit 255、`collected=false`）**不是 `missing`**，
所有写按钮一律禁用（硬约束 3）。上游 `depends` 未就绪时下游的安装也禁用。

`update` 态完全由**只读**采集推导，绝不在线查版本：Docker 看
`apt-cache policy docker-ce` 的 `Installed` / `Candidate`（`docker/check.sh`）；
MinIO 看目标机已导入镜像里有没有「与当前容器镜像不同」的标签
（`minio/check.sh` 的 `MINIO_UPDATE_CANDIDATE` + `MINIO_IMAGE_LINES`）。
daemon 查不动（`MINIO_DOCKER_QUERY=no`）时最多是 `ok`，不猜成可更新。

| 场景 | Docker | MinIO | 允许的动作 | 页面要说清的事 |
|---|---|---|---|---|
| 都未装 | `missing` | `missing` | 只装 Docker | 先引擎后服务；装引擎不需要离线镜像 |
| 仅引擎就绪 | `ok` | `missing` | 单独装 MinIO | 不重装引擎；远端没离线镜像就先导入 tar |
| 两者正常 | `ok` | `ok` | 卸载（更新按钮禁用） | `DEST_URL` 端口不符是配置问题，见 §8.5 |
| MinIO 有新版 | `ok` | `update` | 只更新 MinIO | 换镜像只重建容器，引擎一个包都不动 |
| 引擎有新版 | `update` | `ok` | 只更新 Docker | apt 升级会重启 docker.service，MinIO 短暂中断 |
| 检查失败 | `unknown` | `unknown` | 全部禁用 | 传输层失败，修好网络 / sshd 后重新检查 |

按钮门由 Go 侧 `BuildActions` 算好、随 `GET /api/components/status` 的
`actions[组件id][]` 下发：`busy || !checkOk` 一律禁；`install` 还要
`state==missing && 上游就绪 && preflight.ready`，`update` / `uninstall` 还要 `ready`；
`update` 另要「有新版本」（§8.2）。前端只做 `plan.available && !busy`，
任务在跑时服务端 409，刷新页面不打断已在跑的远端任务，「重新检查」在任务运行中也禁用。
组件专属区块（离线镜像、目标镜像下拉）按组件 `id` 条件渲染。

### 8.2 更新：只动一个组件

| | Docker 引擎 | MinIO 服务 |
|---|---|---|
| 触发 | apt 有可升级的 `docker-ce` 包 | 远端已导入镜像的标签 ≠ 当前容器镜像标签 |
| 动作 | 只升引擎包 → 重启 `docker.service` | 记录当前容器配置（端口 / 挂载 / 重启策略 / 凭证引用）→ 用新镜像重建容器 |
| 预检门 | 目标版本可用 + 记录 MinIO 容器状态 | 目标镜像已**离线导入** + 数据卷存在 + Docker active + 本机凭证已配 |
| 验证 | `docker info` + `GET /minio/health/live` 200（下游原本在跑时） | `GET /minio/health/live` 200 |
| 保留 | `/var/lib/docker`、已导入镜像、`/data/minio` | `/data/minio`、其它镜像、Docker 引擎 |
| 不做 | 不换 / 不重建 MinIO 容器的镜像 | 不 `docker pull`、不 `docker rm -v`、不删数据、不碰引擎 |

🔴 **失败回滚只回到原镜像标签 + 原容器配置，数据卷从头到尾不参与回滚**。
这和 Flyway 单向（硬约束 7，数据库不回滚）是两回事，别混成一条。
🔴 升级引擎会让下游 MinIO 容器短暂中断，这条连带影响由 Go 侧写进
`ActionPlan.impacts`（确认弹窗），不能只出现在任务日志末尾。

实现：`deploy/component/docker/update.sh` 与 `minio/update.sh`，
CLI / 界面参数与白名单见 §3、§4，`RunAction` 在上传脚本前复用同一份动作计划再验一次。
MinIO 更新重建容器要重新注入 root 凭证，链路与安装完全相同（§4）。

### 8.3 卸载：两条底线 + 两个额外勾选

默认只移除容器 / 引擎包，**数据、镜像、上游引擎一律保留**；不改 crontab / logrotate /
`backup.env`，但结果里要明说「minio 备份定时任务仍在，下一次执行会失败」。

| | 卸 MinIO | 卸 Docker 引擎 |
|---|---|---|
| 默认动作 | `docker stop minio` + `docker rm minio`（**不加 `-v`**） | 停 `docker.service` + `apt purge` 引擎包 |
| 保留 | `/data/minio` 全部数据、已导入镜像、Docker 引擎 | `/var/lib/docker`、已导入镜像、`/data/minio` |
| 连带影响 | 无（引擎保留） | 🔴 下游 MinIO 容器一起停，备份链路中断 |
| 额外确认 | 「同时删除 `/data/minio` 数据目录」，**默认不勾**、标注不可逆 | 「我已知晓会连带停止 MinIO 备份服务」，**必须勾选才能提交** |
| 建议顺序 | — | 先单独卸 MinIO，再回来卸引擎 |

🔴 删数据是独立勾选项且默认不勾；脚本里 `rm -rf /data/minio` 只能出现在
`COMPONENT_PURGE_DATA=yes` 分支，路径是硬编码常量、不拼用户输入
（`TestComponentWriteScriptsBoundaries` 用分支位置断言挡回归）。
🔴 卸载后 `preflight` 报错 / 备份连不上是**预期结果**，不是要顺手修好；不许为消掉报错
去删 crontab 或改配置。界面和 CLI 都不开放 `--force`（§6 六道门第 6 条）。

### 8.4 确认弹窗与任务日志

- `internal/component/actions.go` 的 `ActionPlan` 是前端唯一判据：
  `verb / label / available / reasons / title / description / impacts / checks / images /
  danger / submit_label`。🔴 影响清单、能否执行、阻塞原因**由 Go 侧按注册表与体检结果算**
  （`BuildActions`），前端只渲染并据此禁用按钮，不硬编码成前端常量
  （AGENTS.md「不要在前端算指标」）。
- 每次写动作的弹窗都逐条列**这个动词 + 这个组件**的 `impacts`（保留什么 / 改动什么 /
  连带停什么），危险动词用危险样式，提交按钮文案取 `submit_label`。
- `checks[].required=true` 是必勾（卸引擎），其余默认不勾（删数据）；
  `images` 是 MinIO 更新的候选镜像下拉，选中值作为 `--image-ref` 回传，
  CLI 再验它必须在体检候选里。
- 提交条件 = 手输 `yes` + 勾上所有必勾项 + 选好目标镜像；服务端仍按 §6 六道门再验一次
  （`confirm=="yes"` → 先跑 `--dry-run` → `name` 只认清单、动词只认注册表白名单 →
  密码只经 stdin → 单任务 409 / 增量日志 → 不开放 `--force`）。
- 任务日志沿用全局一份：阶段条 + `?after=` 增量轮询 + 按行脱敏 `***` +
  任务脱离 HTTP 请求、刷新不打断；凭证不进日志、任务结束清空。
  预检与正式动作带同一组附加参数（`--proxy` / `--image-ref` / `--purge-data` /
  `--ack-downstream`），否则「预检过了」不代表「正式动作会这么跑」。

### 8.5 与现状的边界

`DEST_URL` 改端口与「同步到远端」走「配置」页（[ui.md](ui.md) §12），组件页只提示不代改；
更新 / 卸载接进来同样走 `registry.go` 同一张声明表的动词白名单，不给 MinIO 开特例，
新增组件的成本仍是「一条声明 + 一份 `check.sh`（可选三份写脚本）」（§2）。
离线镜像链路（§4）与凭证运行时注入不变：更新用的新镜像同样只能来自人导入的 tar，
**绝不在线拉**；`deploy/component/**` 里不许出现真实凭证。

### 8.6 落地时相对设计稿定下的三处偏差

1. **多了 `degraded` 态**（已装但服务 / 插件异常、容器停了或不健康）：
   设计稿只写四态与 `ready = ok || update`。实现把它算进 `ready`，
   因为「带病运行」时更新 / 卸载正是修复手段；影响清单会额外显示下游当前状态。
   `unknown` 仍是一律禁用，没有放宽。
2. **MinIO 更新要显式选目标镜像**：设计稿只说「标签不同就更新」，
   没说多个候选怎么办。实现把 `actions[id].update.images` 作为白名单下拉，
   CLI 用 `--image-ref`（省略时取第一个候选），绝不悄悄挑一个镜像。
3. **代理扩展到 `update docker`**：两者都跑 apt，同一条链路、同一份
   `ValidProxy`；§3.1 的「只给 install docker」已随之改口径。
   其余动作（MinIO、卸载、导入）传 `--proxy` 仍直接 400。

> 2026-11-07 之前本节叫「尚未接入：更新与卸载的判据（设计，不是现状）」，
> 原型里的「设计态 · 未接入」标注已全部去掉；历史见 git 与当天工作日志。

## 9. 从已登记服务器直接复制镜像（`image-copy`，2026-11-07 落地）

**背景**：换机后手边没有现成的 `.tar`，而主服务器（`prod`）上早就跑着 MinIO 容器，
镜像就在本地。走「主服务器 `docker save` → 拷 tar 到本机 → 界面 `image-load`」
纯属体力活，而且 tar 会白占本机磁盘。

**链路**（本机只做管道中转）：

```
源机  docker save <ref>  ──ssh stdout──▶  本机 pipe  ──ssh stdin──▶  目标机 0600 临时 tar
                                                              └─▶ docker load -i ─▶ rm -f
```

- 本机**不落磁盘**：没有临时 tar、不需要本机磁盘余量，也不用担心清不干净。
- **不是 `docker pull`**：`docker save` / `docker load` 的语义与离线 tar 完全一致，
  `docs/components.md` §1 那条「目标机拉不到 Docker Hub / quay.io / dl.min.io」的红线不变。
- 不做「源机 → 目标机直连」：那要求源机能 ssh 目标机、还要多维护一套信任关系；
  经本机中转时两跳都用清单里已有的凭据，链路只有一条。

**判据**：

1. 源机同样只认 `servers.json` 的 `name`（`--from-server`），**源 ≠ 目标**：
   名字相同或 `host:port` 相同都直接拒绝（硬约束 12，不代理任意主机）。
2. 源机镜像只接受**源机本地确实存在**的引用：`docker images` 的只读清单就是白名单，
   `--image-ref` 必须在里面；省略时取第一个候选（`docker images` 默认按创建时间倒序，
   即最新的那个）。不接受手填任意字符串，`ValidImageRef` 再卡一次字符集。
3. 源机 docker 权限**两路都试**：先按清单 user 直接跑 `docker info`，失败再试 `sudo`
   （免密 / 清单里的一次性密码）。走的哪条会写进计划与任务日志，不让人猜。
   源机只跑只读命令（`info` / `images` / `save`），不写源机任何文件。
4. 目标机 docker 可用性用**同一套**探测，`docker load` 按探测结果决定是否提权；
   与 `image-load` 一致，`docker load` 只是导入镜像，不动容器。
5. 传输上限与 `image-load` **同一个 2 GiB 常量**；超了就地中断管道（不写满 `/tmp` 再失败），
   目标机临时文件照样删。
6. 任一环节非 0（源机 save / 目标机写文件 / `docker load`）→ 关管道 + 删
   `/tmp/passup-component-minio-image.tar`；**不做任何回滚**——只导入镜像，
   容器 / `/data/minio` 从头到尾没参与。
7. `--dry-run` 只读：只查源机镜像清单与两侧 docker 可用性，**不传一个字节**。
8. 只做 save / load：不启动 / 不重建容器、不动 `/data/minio`、Docker 引擎、crontab、`backup.env`。

**与 `image-load` 的分工**（两者都是离线镜像，别混成一条）：

| | `image-load` | `image-copy` |
|---|---|---|
| 输入 | 本机选中的 `.tar` | 另一台已登记服务器上的镜像 |
| 本机磁盘 | 服务端 `os.CreateTemp` 临时文件，任务结束即删 | 只用管道，**不落盘** |
| CLI | `--image-tar <本机 .tar>` | `--from-server <源机 name> [--image-ref]` |
| 界面入口 | 离线镜像区「选择 .tar → 导入到远端」 | 离线镜像区「来源服务器 → 从服务器复制…」 |
| 只读候选接口 | —（前端直接拿到 multipart 文件） | `GET /api/components/images?name=<源机>` |

**界面**：离线镜像区新增「来源服务器」下拉（清单里除目标机外的所有 name）+「从服务器复制…」；
弹窗里现拉源机只读清单做镜像下拉，仍要手输 `yes` + 可选一次性 sudo 密码。
任务与安装 / 导入**共用同一把后台任务锁**（409）与同一份增量日志。
🔴 源机下拉的候选**只来自源机**，查不动（`collected=false`）时按钮禁用并说清
「没采到 ≠ 没有镜像」，绝不让前端自己猜一个引用出来。

**CLI**：

```
ops component images --server prod [--json]                       # 只读：源机本地 MinIO 镜像
ops component image-copy minio --server k4 --from-server prod [--image-ref X] [--dry-run]
```

**边界（这轮明确不做）**：

- **不做 ssh 密码认证**：源机必须能免密钥登录（与本工具其它链路一致）。
  一次性 `--password-stdin` 只给 sudo，不给 ssh。
- **不做压缩**：`docker save` 的层本身已是压缩 tar，LAN 上直传够快；跨公网慢就先本机导入。
- **不进 `Verbs`**：`image-copy` 与 `image-load` 一样按 `OfflineImage` 授权
  （`SupportsImage` / `SupportsImageCopy`），**不出现在安装 / 更新 / 卸载那一排按钮里**，
  也不进 `BuildActions` 的按钮计划——它不是组件的生命周期动词。

**回归**：`internal/component/component_test.go` 的 `TestImageCopyWhitelist` /
`TestParseArgsImageCopy` / `TestPickSourceImage` / `TestCappedReaderStopsOversize`；
`internal/ui/component_test.go` 的 `TestComponentRunImageCopyGates` /
`TestComponentRunImageCopyArgs` / `TestComponentImagesReadOnly`；
`web/test/components.test.ts` 的 `normalizeSourceImages` / `copyReady` / image-copy 请求参数。

## 10. 备份依赖区（2026-11-07 新增）

> **不是注册表里的新组件**。`pg_restore` / `mc` / `cron` / `nc` 是备份链路的**命令行依赖**，
> 没有「服务状态 / 容器 / 离线镜像 / 更新 / 卸载」那套生命周期，硬塞进 `registry.go`
> 会白白给它们开出更新 / 卸载权限（§2 的红线）。所以这一区独立渲染，
> 数据源是 `GET /api/backup/deps`（`ops backup deps --json`），写动作是
> `POST /api/backup/run` 的 `mode=deps`，与「备份能力部署」页同一套后端。

- 只读状态：`items[]`（命令 / 用途 / 已装 / 版本 / 安装来源）、`missing[]`、`plan[]`
  （这次会装什么）、`docs[]`（PGDG 与 mc 官方文档）由 Go 侧下发，前端只渲染；
  `collected=false` 显示「未采集到状态」并禁用安装按钮（硬约束 3）。
- 写动作同样六道门：`confirm=="yes"` + 服务端 `--dry-run`、name 只认清单、
  组件固定 `all`、一次性 sudo 密码经 stdin + 日志脱敏、任务脱离请求 + 409。
  **任务日志仍走 `/api/components/task`**（与组件安装 / 导入共用同一把锁、同一份状态），
  `startDepsRun` 只是把「发请求」换成 `runDeps`，轮询链路不变。
- 可选的「PG 主版本」输入框（1..99 纯数字）：留空装发行版 `postgresql-client`，
  填了按 PostgreSQL 官方 PGDG 仓库装版本化客户端；服务端与 CLI 各验一次。
- 装完自动复查命令、任务结束自动刷新组件体检与依赖状态；**不上传备份脚本、
  不写 crontab / logrotate / backup.env、不跑备份、不 `docker pull`**。
  完整判据与官方安装源见 [backup-deploy.md](backup-deploy.md) §10.2 /
  [ui.md](ui.md) §9.7。
- 回归：`web/test/components.test.ts` 的 `normalizeBackupDeps` / `depsRunEnabled` /
  `startDepsRun`，`internal/ui/deps_test.go`，`internal/backup/deps_test.go`。
- **卸载（2026-11-07 晚）**：同一区多一个「卸载依赖（复测用）」按钮，
  走   `POST /api/backup/run` 的 `mode=deps-uninstall`；可勾选项与影响清单来自只读状态里的
  `uninstall` 计划（Go 侧下发），默认全不勾且至少选一个，仍要输 `yes` + 服务端
  `--dry-run`。只删 `/usr/local/bin/mc` 与 `postgresql-client[-<n>]` /
  `postgresql-client-common` 包（后者提供 pg_restore 壳链接，留着会假阳性），
  不卸系统基础包、不 autoremove、不碰数据与定时任务；装回来点旁边「安装缺少依赖」即可。
  判据见 [backup-deploy.md](backup-deploy.md) §10.3 / [ui.md](ui.md) §9.7。
- 交互原型 `components-prototype.html` 本轮**未**补这一区；原型只是交互速览，
  判据以本文与 `docs/ui.md` §9.7 为准。
