# 环境组件（Docker / MinIO 安装）

> 2026-11-06 落地。解决的问题：备份端 `k1`（172.16.0.211）上**既没有 Docker，也没有
> MinIO 服务**；而 `deploy/backup/minio/` 只把 `mc` 当 S3 客户端，假定「备份端本机 9000
> 的 MinIO 服务」已经存在。备份失败不是脚本坏了，是服务端从来没进过部署范围。
> 交互原型见 [minio-bootstrap-prototype.html](minio-bootstrap-prototype.html)（设计稿，不维护）。

## 1. 目标机实测约束（只读体检结论）

| 事实 | 结论 |
|---|---|
| Ubuntu 24.04.2 LTS `noble` x86_64、`sudo -n true` 可用 | 可按 Docker 官方 apt 仓库（deb822 `docker.sources`）装引擎 |
| `download.docker.com` 偶发 200 / 偶发 Connection reset | 仓库可达性只做**警告**，不硬拦；权威结论交给 `apt-get update` |
| Docker Hub 超时、`quay.io` manifest 401、`dl.min.io` 二进制 410 | 🔴 **绝不能在线拉镜像**：MinIO 只认人从本机导入的离线 tar |
| `/data` 存在（root:root），根分区剩 32 G | MinIO 数据落 `/data/minio`，保留已有 `/data/backups` |
| 本机 `backup/minio.env` 的 `DEST_URL=http://127.0.0.1:8007` | 8007 是**生产端**端口；备份端本机 MinIO 是 9000，装完服务仍连不上，必须到「配置」页改并同步远端 |

## 2. 注册表是唯一声明

`internal/component/registry.go` 的一张有序表就是全部声明：

```go
{ID: "docker", Name: "Docker 引擎", Kind: "基础设施", Phase: PhaseReady},
{ID: "minio",  Name: "MinIO 服务",  Kind: "备份存储", Depends: "docker",
 Phase: PhaseReady, OfflineImage: true},
```

- 目录、依赖链、动作白名单、检查项都由它推导；**新增组件 = 加一条声明 + 放一份
  `deploy/component/<id>/check.sh`（可选 `install.sh`）**，导航项与页面数不变。
- `Runnable(id)` 是写操作的唯一白名单：`planned` 组件一律拒绝；
  `SupportsImage(id)` 是 `image-load` 的第二道白名单（只有 `OfflineImage=true` 能导入 tar）。
- `DependsReady` 按 `depends` 推导上游是否就绪；MinIO 的安装预检会再挡一次「Docker active」。
- 脚本树由仓库根 `componentdist.go` 整目录 `//go:embed`，`main.go` 注入给
  `internal/component`（embed 路径不能含 `..`）。改了 `deploy/component/**` 必须重新
  `go build`；`internal/restart/staleness.go` 也把它算作 Go 构建输入。

## 3. CLI

```
ops component list --server <name> [--json]        # 只读体检（界面状态源）
ops component install docker --server <name> [--dry-run] [--password-stdin]
ops component install minio  --server <name> [--dry-run] [--password-stdin]
ops component image-load minio --server <name> --image-tar <本机 .tar> [--dry-run]
```

- `--server` 只接受 `servers.json` 里的 `name`，不接受任意 host（硬约束 12）。
- `--dry-run` **绝不改远端**：上传与执行都在 dry-run 分支之前 return；界面由服务端
  先跑一次，非 0 就不执行正式动作。
- sudo 密码只有 `--password-stdin`，不进命令行 / `ps` / 日志。
- `list` 会依次跑每个 ready 组件的 `check.sh`，合并 `KEY=VALUE`；任一脚本没给出
  `CHECK_OK=yes` 或 ssh 自身失败（exit 255）就整体 `collected=false`、组件标 `unknown`，
  **不用 0 / 空值冒充「未安装」**（硬约束 3）。
- `check.sh` 只读：不写文件、不提权、不装包、不拉镜像、不改容器
  （`componentdist_test.go` 的 `TestComponentCheckScriptIsReadOnly` 逐个挡回归）。

## 4. MinIO 凭证与离线镜像（红线最密集的一段）

🔴 **`deploy/component/` 整目录编进 exe**：里面不许出现任何真实凭证、`.env`、私钥或日志。
`.gitignore` 与 `TestComponentScriptsHaveNoCredentials` 各挡一道；后者只把
「变量名 = 字面值」判为泄漏，`-e MINIO_ROOT_PASSWORD="$VAR"` 这种变量引用不算。

凭证链路：

1. Go 侧从**本机** `backup/minio.env`（配置目录，0600，不入 Git）读
   `DEST_KEY` / `DEST_SECRET`；占位符（`YOUR_*` / `CHANGE_ME*` / 空）一律视为未配置。
2. 页面可见的只有两个布尔标记与 `DEST_URL` 端口（`StatusView.local`），**明文不进
   HTTP 响应、不进任务日志**。
3. 安装时把凭证用 `shared.ShQuote` 拼在上传脚本头部（内存 → ssh stdin → 远端
   `/tmp/passup-component-minio-install.sh`，0600/0700）。
   `install.sh` 本体没有凭证；`docker run` 用 `-e` 注入，不 echo、不 inspect 全量配置。
4. 执行完（成功 / 失败 / 远端报错）都 `rm -f` 那个临时脚本。

离线镜像链路：

1. 人从本机选 `docker save` 导出的 `.tar`；CLI 用 `archive/tar` 校验里面有
   `manifest.json`（只在本机读，不解压、不落盘），上限 2 GiB。
2. CLI 上传到远端固定 0600 临时路径 → `docker load -i` → 清理；**从不 `docker pull`**。
3. 界面走 `POST /api/components/image`（multipart）：临时文件由服务端
   `os.CreateTemp` 生成，**接口不接收任何本机路径**，任务结束（含失败）即删。
4. 目标机没有离线镜像时 `EvaluateMinio` 直接判 blocker，安装按钮禁用、dry-run 非 0，
   不会把「装一半」留在远端。

## 5. 安装脚本的行为边界

| | Docker 引擎 | MinIO 服务 |
|---|---|---|
| 来源 | 官方 apt 仓库（deb822） | 目标机**已导入**的离线镜像 |
| 提权 | 安装期 root（`sudo -n sh -c`） | 安装期 root |
| 幂等 | 已装官方版就跳过 apt，只补服务与用户组 | 已有容器只做健康检查（stopped 则 `docker start`），**不重建、不换镜像** |
| 验证 | `docker info`（不跑 hello-world） | `GET /minio/health/live` 20 次重试 |
| 保留 | `/var/lib/docker`、容器 / 镜像、crontab | `/data/minio`、`/data/backups`、其它镜像、引擎、crontab、`backup.env` |
| 不做 | `docker pull` / `docker run` | `docker pull` / `docker rm` / 删数据 / 跑备份 |

## 6. 界面：一个目录页，不拆导航

「环境组件」是第 3 个导航项（`web/src/features/components/`），结构来自原型 v3：
全局状态条 → 组件目录（点行切详情）→ 选中组件详情 → 任务日志（全局一份）。
MinIO 专属的「离线镜像」区按 `offline_image` 条件渲染，不污染 Docker 详情。
判据见 `docs/ui.md` §7（零跨页共享状态）与 §13。

写操作的六道门（照抄 `docs/ui.md` §9，安装与导入各一套）：

1. `POST` + `confirm=="yes"`（页面要人输 `yes`）；
2. 服务端自己先跑 `--dry-run`，非 0 不执行；
3. `name` 只认 `servers.json`（未知 404），组件 / 动词只认注册表白名单；
4. sudo 密码只在单次请求内存 → 子进程 stdin，日志按行脱敏、任务结束清空；
5. 任务脱离 HTTP 请求、与备份部署**共用同一把后台任务锁**（并发 409，重启门自动覆盖）、
   日志 `?after=` 增量轮询；
6. 界面不开放 `--force` / 更新 / 卸载 / 删数据选项。

`ui` 不 import `component`：执行器由 `main.go` 注入，根包 `backuprun.go` 再起一个自己
执行同一条 CLI 命令（`args[0]=="component"` 时不补 `backup` 前缀）。

## 7. 构建与验证顺序

```
# 改了 deploy/component/** 或 web/** 都要按这个顺序重建
cd web && npm test && npm run typecheck && npm run build
go vet ./... && go test ./... && go build -o ops.exe .

# 只读真机验证（都不改远端）
ops.exe component list --server k1 --json
ops.exe component install docker --server k1 --dry-run
ops.exe component install minio  --server k1 --dry-run
ops.exe component image-load minio --server k1 --image-tar <本机 .tar> --dry-run
```

回归要点：`internal/component/component_test.go`（注册表 / 参数白名单 /
`EvaluateMinio` 六类 blocker / 两处 dry-run 门）、`componentdist_test.go`
（脚本完整 / 只读 / 无凭证 / MinIO 不 pull 不删数据）、`internal/ui/component_test.go`
（确认门 / 预检门 / 409 / multipart 导入与临时文件清理）、
`web/test/components.test.ts`（依赖门 / 预检门 / 文案按组件 / 上传后轮询）、
`internal/restart/staleness_test.go`（组件脚本算 Go 构建输入）。

## 8. 尚未接入

更新 / 卸载（含原型里的「换 MinIO 镜像」「卸引擎连带影响」）仍是界面里置灰的按钮；
本轮只做 `install` 与 `image-load`。`DEST_URL` 改端口与同步远端仍走「配置」页。
