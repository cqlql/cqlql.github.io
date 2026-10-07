---
title: PostgreSQL 高可用改造方案（CloudNativePG）
icon: mdi:database-sync
sort: 8
---

> 本文记录把集群内 PostgreSQL 从「StatefulSet 单实例」换成 **CloudNativePG** 高可用的方案。
>
> **状态：方案已定，尚未实施。**
>
> ⚠️ 本文与代码仓库的分工：**本文回答「为什么这么做、做成什么形态、边界在哪」**；
> **「第几步跑什么命令、改哪些文件」在 `cluster-infra/postgres/CNPG-HA-PLAN.md`**（执行清单）。
> 执行清单里有 `deploy.sh` 的函数名、`selftest.sh` 的断言行号、`config.env` 的键名 ——
> 那些与代码行号级耦合，跨仓必然漂移，所以**只留在代码仓库**。
>
> 本文的实测数字均为 **2026-10-06** 的快照；取值与键名以 `cluster-infra/postgres/` 为准。

## 一、当前真实形态

```text
┌─ k3s 集群（3 节点：k1 / k2 / k3）──────────────────────────────┐
│                                                                │
│   postgres 命名空间（独占）                                     │
│     postgres-0   StatefulSet replicas=1   ← 单实例，无副本      │
│       PVC data-postgres-0（local-path，节点本地）               │
│                                                                │
│   Service postgres：ClusterIP + NodePort                       │
│     集群内 → postgres.postgres.svc.cluster.local:5432          │
│     集群外 → <任意节点>:<NodePort>  ← 唯一用途是备份机           │
│                                                                │
│   k1 / k2  无污点 → 业务落这两台                                │
│   k3       带 k3s-monitoring:NoSchedule → 监控栈 + 备份机专属    │
└────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─ 备份机（= k3 主机，集群外）───────────────────────────────────┐
│   cron 03:00  pg_dump 直连 <节点>:<NodePort>                   │
│   → 落 MinIO /data/backups/minio                              │
│   ⚠️ 备份机 pg_dump 主版本必须 ≥ 生产端                         │
└────────────────────────────────────────────────────────────────┘
```

**关键事实：**

- PostgreSQL 是**单实例**。这是刻意的取舍，不是「还没来得及做 HA」——
  3 台里 k3 有污点，实际只有 k1/k2 能承载业务；而 PostgreSQL 之间不会自己互相复制，
  多副本只会得到「三个各自独立、互不复制的主库」。那不是高可用，是数据分裂。
- 只有 `local-path` 一个 StorageClass → **卷绑节点、不支持在线扩容**。
- 运行 `postgres:18.6`（2026-10-06 从 16.4 升上来，与开发机同主版本）。
- 备份是**逻辑备份 + 每天一次**：RPO = 24 小时，`restore` 从未真正跑过。

## 二、为什么值得做

### 2.1 自动 failover —— 把「节点故障」从全站事故降级为一次切换

⚠️ **先纠正一处容易犯的论证错误**：本环境确实观测到过「节点假死」
（一天三次：k2 18:24、k1 22:26、k3 01:24；症状是 ping 通、端口仍监听
22 / 2380 / 6443 / 10250 / 2379，但 **sshd 卡死在认证阶段**），
近因是 **load 压死**（k3 实测 load 76 / 4 核，负载降下来**自愈**）。

但它的**根因是实验环境本身，不是方案缺陷**。实测（2026-10-06）：

| 项 | 实测值 |
| :--- | :--- |
| 虚拟化平台 | `systemd-detect-virt` = **`oracle`**；product = VirtualBox / innotek GmbH；MAC 前缀 `08:00:27` |
| 三台 CPU | **同一型号**（AMD Ryzen 9 9955HX 16-Core） |
| 三台 uptime | **28 / 29 / 31 分钟**（同步 → 指向同一宿主机） |
| 单机配置 | 各 4 vCPU / 5.8GiB → **三台共要 12 vCPU**，而宿主机是一颗移动端 CPU |

**12 vCPU 对一颗笔记本 CPU，本身就是超配**；再叠加 VirtualBox 的 CPU 调度开销，
「load 高时 VM 里的 sshd 抢不到 CPU」几乎是必然。当前三台 load 都在 1.5 以下，
与「负载降下来自愈」这条现象一致。

⚠️ **所以本环境不适合用来论证「正式环境需要什么」** —— 但 CNPG 的价值**并不依赖**这个论证：

节点故障的形态远不止「假死」—— 硬件故障、内核 panic、磁盘满或坏、运维误操作、
内核升级重启，后果完全一样：**PG 落在哪台、哪台出问题，数据库就不可用**。

⚠️ **RTO 实测约 3 分钟**（2026-10-06 failover 演练，删 primary Pod 实测 **186 秒**，
见 §8 已知边界）。本文原先写「压到秒级」，**那是错的**。
但相比原来的「人工介入、几十分钟」，仍然是数量级的改进 —— 而且它是**自动**的。

⚠️ 还有一条必须说清的边界：**若三台 VM 同宿主机（本环境极可能如此），
则「3 节点 HA」在物理层就是假的** —— 宿主机一挂三台全挂，任何软件层 HA 都救不了。
所以在**本环境**做 failover 演练，验证的是「**软件层行为正确**」
（复制真的在跑、能提升、切换后业务恢复），**不是**「真的高可用」。
**正式环境（物理机 / 独立服务器）才是有意义的 HA。**

⚠️ 另一个前提：控制面要还活着。3 台 etcd，单节点故障仍有 quorum —— 这条成立。

### 2.2 PITR —— 最被低估的一条

现在是「每天一次 `pg_dump`」，RPO = 24 小时。CNPG 用 Barman Cloud 把 WAL 连续归档到对象存储后：

- RPO 接近 0；
- 能恢复到**任意时间点**（`recoveryTarget.targetTime`）。

对「误删数据 / 误跑迁移」这类事故，这个价值**大于** HA 本身 ——
HA 解决「机器坏了」，PITR 解决「人错了」。

### 2.3 两块地基是免费的

- **对象存储现成**：集群里已有 MinIO（`minio` 命名空间，3 个桶），
  CNPG 的备份后端就是 S3 兼容对象存储。
- **镜像拉取比 MinIO 省事**：CNPG 的 operator / PG / 插件镜像都在 `ghcr.io`，
  而节点 `registries.yaml` **已经镜像了 `ghcr.io`** —— 不需要像 MinIO 那样绕私有仓库。

## 三、代价（实测，不是估算）

### 3.1 内存：limits 会超卖到 100% 以上

实测 2026-10-06（requests / limits）：

| 节点 | 现状 requests | 现状 limits | 改造后 limits（估） |
| :--- | :--- | :--- | :--- |
| k1 | 1020m (25%) / 1888Mi (31%) | **5376Mi (91%)** | **约 104%** |
| k2 | 820m (20%) / 1900Mi (32%) | 5034Mi (85%) | 约 94% |
| k3 | 740m (18%) / 1472Mi (24%) | 4224Mi (71%) | 不变（有污点） |

两个必须写下来的判断：

1. **单实例的 limit 要从 1Gi 降到 512Mi**。库只有 10MB / 46 表，
   PG 的内存吃在 `shared_buffers`（现状显式设 128MB）与连接上，
   在 2 实例形态下没有理由 ×2。
2. **k1 的 limits 会从 91% 升到约 104%**。这是「所有容器同时打满 limit」的数字，
   不是实际用量。但本环境的宿主机是**单台 + 超配**（见 §2.1），CPU 争抢已经真实出现过 ——
   所以这条要在实施前后各采一次 `kubectl top pods -A --sort-by=memory` 对比留档。

### 3.2 零冗余度：这是本拓扑的硬边界

`instances: 2` + 只有 k1/k2 可承载 = **任何一台不可用，HA 就退化成单实例**。
更麻烦的是：`required` 反亲和 + `local-path` 的 PV `nodeAffinity` 意味着
**第二个副本在那台机器回来之前无法重建**（Pod 会一直 Pending）。

想在故障期间仍保持 2 副本，只能给 CNPG 的实例加 toleration 让第 3 个落到 k3 ——
而 k3 的污点就是为「监控栈 + 备份机专属」设的，**不建议反设计**。

**结论**：CNPG 在这里的价值是「单节点故障时业务不中断」，
**不是**「永远保持 2 副本」。这两句话的差别要讲清楚，否则会形成错误预期。

### 3.3 M2 的硬前置：cert-manager

barman cloud 插件的官方安装文档明确要求 `cert-manager`（`cmctl check api` 必须过），
且**插件必须装在 operator 所在的同一个命名空间**。本集群目前**没有** cert-manager。

也就是说：**「WAL 归档 + PITR」的入场券是再引入一个集群级组件**。
这是整件事里最容易被低估的成本项 —— 所以方案分成两个里程碑，别混在一起估。

### 3.4 控制台：几乎零改动（见第四节）

## 四、关键决策：改造现有对象，不新增受管对象

**决定**：`postgres` 仍是同一个受管对象，只把实现从「StatefulSet + Service + Secret + ConfigMap」
换成「CNPG Cluster CR + operator」。

**判据**（受管对象之所以独立，看这四条）：换实现形态后**这四条一条都没变** ——

| 判据 | 换实现后 |
| :--- | :--- |
| 事实来源 | 仍是集群级基础设施，仍与本仓配置同源 |
| 工具链 | 仍是 `kubectl`（新增 `cnpg` 插件，同类） |
| 失败模式 | 仍是「Pod 起来了、探针过了，但数据卷是空的」；**新增**一条「Pod 都 Ready 但复制断了 / 没有可提升的副本」 |
| 命名空间 | 仍是 `postgres` 独占 |

**为什么这个决策值钱** —— 控制台侧几乎不用动：

| 要改的地方 | 新增对象的做法 | 本方案 |
| :--- | :--- | :--- |
| `System` 枚举 / 前端菜单 | 要加 | **不动** |
| 命令表条数、`handlers_test` 计数 | 要改 | **不动**（命令名与条数都不变） |
| 命令重名 `known` 清单 | 可能变 | **不动** |
| `-script-<x>` 新 flag（要手动重启控制台） | 要 | **不动** |
| `postgres/deploy.sh` 实现 | 新建 | 重写 `phase_release` / `phase_status` / `remove_object` |
| `postgres/tests/selftest.sh` | 新建 | 改（**两条断言要反转**，见执行清单 §4.3） |

## 五、目标形态

| 组件 | 命名空间 | 形态 | 副本 |
| :--- | :--- | :--- | :--- |
| `cnpg-controller-manager` | `cnpg-system` | Deployment（operator） | 1 |
| `passup-pg` | `postgres` | CNPG `Cluster`（primary + replica） | **2** |
| `passup-pg-rw` | `postgres` | Service（operator 自动建，指向 primary） | — |
| `passup-pg-backup` | `postgres` | **我们定义**的 NodePort Service（给集群外备份机） | — |
| `passup-pg-app` / `passup-pg-superuser` | `postgres` | **我们渲染**的 Secret（业务角色 / 超管口令） | — |
| PVC ×2 | `postgres` | `local-path`，每实例一个（operator 派生） | — |

**三个设计要点：**

1. **口令仍由本仓决定**。CNPG 的行为是：`<cluster>-app` / `<cluster>-superuser` 这两个
   Secret **不存在时**才生成随机口令。我们先渲染出来，CNPG 就用我们的 ——
   这保住了「口令由 `config.local.env` 决定、留空即 error、绝不猜也不随机生成」这条原则。
2. **备份链路零改动**。`backup` 对象只认「一个能连的 5432」，
   CNPG 的 NodePort Service 继续扮演这个角色 → 备份对象、cron、口令都不用改。
   这是本方案最值钱的一条性质。
3. **迁移不停机**。CNPG 支持从任意可连的 PG 做 `pg_basebackup` 物理克隆，
   而旧 StatefulSet 的 Service 就在同一个命名空间里，Pod 网络直接可达 →
   **不需要 dump/restore**（这与 2026-10-06 那次大版本升级的做法不同）。

## 六、两个里程碑

### M1 —— 只拿 HA（备份链路零改动、控制台零改动）

装 operator → 建 2 实例 Cluster（从旧实例物理克隆）→ 切应用连接串 →
验证备份仍能跑 → 收口（下线旧对象、把 NodePort 换回原端口并重跑 `backup/install`）。

⚠️ **M1 的最终验收不是「Pod 都 Running」，而是亲眼看到一次 failover**
（先用 `kubectl cnpg` 做优雅 switchover，再删 primary Pod 做一次真故障 —— 两者现象不同）。
没看到过，这套改造就只是「换了个跑法」。

### M2 —— WAL 归档 + PITR（做完 M1 再评估）

装 cert-manager → 装 barman 插件 → 建 `ObjectStore` 指向 MinIO 新桶 →
Cluster 引用插件 → 加 `ScheduledBackup` → **跑一次 PITR 恢复演练**。

⚠️ 上了 WAL 归档之后，`backup` 对象那条 cron `pg_dump` 就是**第二套备份**了。
建议**两套都留**（逻辑备份能跨大版本恢复，物理归档不能），
但要在两份 README 里写清分工 —— 否则下一个人会以为其中一套是多余的。

### 6.3 配套项的时机（容易搞反）

「上 CNPG 之前总得先把监控和恢复演练做了吧？」—— 这句话**只对一半**：
**恢复演练必须在前，监控接入必须在后**。判据是「它是不是 CNPG 的实现细节」。

| 配套项 | 时机 | 为什么 |
| :--- | :--- | :--- |
| **真实 restore 演练** | **动数据之前（必须）** | 迁移要动数据卷，它是唯一的退路；而 M1 明确**不改备份链路** → 这条恢复路径在 CNPG 之后**依然存在**（M2 也建议两套并存），所以演练结论可复用 |
| **备份心跳告警** | 现在或之后都行 | 盯的是「最近一次成功备份是多久以前」，与 PG 是 StatefulSet 还是 CNPG 无关 |
| **PG 指标接入监控** | **M1 收口之后** | CNPG 每个实例**自带 exporter**（指标前缀 `cnpg_`）；现在按原生 PG 搭一套，CNPG 之后**多余且要重写**。⚠️ 本集群是**原生 Prometheus**（没有 prometheus-operator），CNPG 的 `enablePodMonitor` 用不了，接入方式两边都得另想办法 |
| **告警规则清单** | 现在定策略，M1 后实现 | **策略**（盯什么信号：库连不上 / 复制断了 / 没有可提升的副本 / 磁盘将满 / 备份超期）**不随实现变**；**配置**（怎么抓）才随实现变 |

一句话：**安全网要在动数据之前铺好，观测手段要等形态稳定了再装** ——
否则同一件事做两遍，而且第二遍还得先拆掉第一遍。

## 七、已知边界（写下来是为了不让人以为是漏了）

1. ⚠️ **删 `Cluster` 会连带删 PVC（实测确认，2026-10-06）** —— CNPG 创建的 PVC 带
   `ownerReference → Cluster`，删 Cluster 触发 k8s GC **级联删除**，而 `spec.storage`
   **没有保留开关**（CNPG 官方 issue #8442）。这直接冲击本仓「数据不随一条命令消失」的原则：
   **`uninstall` 在 CNPG 下默认会删数据**，而现有对象的约定是「uninstall 保留 PVC、
   连 `purge` 都不删 PVC」—— 语义完全相反。
   对策：删 Cluster **之前**先摘掉 PVC 的 `ownerReference`（已实测有效，PVC 保留），
   细节见执行清单 §9.1②。这是本方案里爆炸半径最大的一处变化。
2. **零冗余度**：见 §3.2。
3. **节点永久下线要人工介入**：确认实例回不来后删掉被钉住的 PVC，
   但受上一条限制仍是 Pending —— 真正的出路是恢复节点。
4. **`local-path` 不支持在线扩容**：填小了要重建 PVC（= 迁移数据）。
5. **`local-path` 也没有快照能力**（operator 启动日志实测 `haveVolumeSnapshot: false`）
   → 备份只能走对象存储，不能用 volumeSnapshot。
6. **limits 超卖加剧**：见 §3.1。
7. **`status` 是快照**：答得了「此刻对不对」，答不了「这三天有没有波动」。
8. **PG 大版本升级的形态变了**：CNPG 下走 operator 的 major version upgrade 流程，
   不再是「dump → 删 PVC → 恢复」那套。
   ⚠️ 但 `backup` 对象那条「备份机客户端主版本必须 ≥ 生产端」的约束**依然成立**。
9. ⚠️ **自动 failover 的实测 RTO 是约 3 分钟，不是秒级**（2026-10-06 演练，删 primary Pod）：
   - **186 秒**才完成切换。时间主要花在「operator 判定 primary 不健康」上 ——
     CNPG 靠 **lease 过期**判定，而不是靠「Pod 消失」；提升本身只用了几秒。
   - ✅ 数据**零丢失**（新 primary / 重建实例 / 旧库三边指纹一致）；
     应用侧 **0 error**，只有 Hikari 的 `Failed to validate connection` WARN（连接池自愈）。
   - ⚠️ **但那 186 秒里数据库是不可用的**。本次演练没看到业务报错，
     只是因为**这个环境静置、没有真实流量** —— 有流量时那就是 186 秒的全站故障。
     **不要把「演练没报错」读成「业务无感」。**
   - 📌 值得进一步研究：CNPG 的 lease 参数（`leaseDuration` 等）是否可调，
     以及本环境 operator 的资源限制（CPU limit 500m）是否拖慢了判定。
   - 📌 应用侧可优化：Hikari 日志明确提示 `consider using a shorter maxLifetime value`。

## 八、待实测确认

以下在写方案时**没有实测**，实施时必须先验证。前两条是**设计前提** ——
不成立的话方案形态要改，所以它们必须先验（用一个一次性小集群即可，成本很低）：

1. **CNPG 删除 `Cluster` 后 PVC 是否保留** —— 它决定 `purge` 那条
   「不删 PVC」的语义能否照搬。⚠️ 关系到数据安全，**必须在动手之前验掉**。
2. **`managed.services.additional` + NodePort 组合**能否如期生成指向 primary 的 Service
   （字段名来自 1.30 官方文档，未在本集群跑过）。
3. `externalClusters` + `bootstrap.pg_basebackup` 从**同一命名空间的 ClusterIP Service** 克隆
   （文档说的是「外部集群」）→ 退路是 dump → `bootstrap.initdb` → 恢复。
4. 源库 `pg_hba` 是否放行复制连接（现状用的是镜像默认值）。
5. HikariCP 在 failover 时的重连行为（切换时已建立的连接会断）。
6. operator 的默认资源 requests / limits（预算表里那个数是建议值，不是实测值）。

## 九、与既有文档的关系

| 文档 | 位置 | 回答什么 |
| :--- | :--- | :--- |
| **本文** | `cqlql-notes/.../k3s/落地/` | 为什么做、做成什么形态、边界在哪 |
| `postgres/README.md` | `cluster-infra/postgres/` | 本对象当前是什么、命令表、已知边界 |
| `postgres/CNPG-HA-PLAN.md` | `cluster-infra/postgres/` | **执行清单**：分阶段步骤、验收、回退 |
| `postgres/config.env` | `cluster-infra/postgres/` | 键的语义与默认值（唯一事实来源） |
| `backup/README.md` | `cluster-infra/backup/` | 备份链路（本方案不动它，但要知道为什么不用动） |

> ⚠️ 实施完成、M1 收口之后，`postgres/README.md` 与 `cluster-infra/README.md` 里
> 「刻意不是高可用」那几段**会变成假话**，必须同步改掉 ——
> 本文也在那时应当从「尚未实施」改成「已实施（日期）」。
