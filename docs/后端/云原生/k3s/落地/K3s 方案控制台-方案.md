---
title: K3s 方案控制台（方案）
icon: mdi:application-cog
sort: 15
---

# K3s 方案控制台（把已验证的方案产品化）

> **文档定位：方案 + 落地说明。** P0~P5 已全部实施，本文按**当前实现**描述。
> 上游两份方案都已实机验证：
> - [K3s HA 一键部署方案](./K3s HA 一键部署方案.md) —— `cluster-infra/k3s-ha/`，`verify` 全绿、VIP 真实漂移
> - [可观测性栈 k3s 部署方案](./可观测性栈 k3s 部署方案.md) —— `cluster-infra/monitoring/`，17 条规则 + 端到端钉钉链路
>
> 本文回答的是**下一个问题**：脚本已经跑通了，为什么还需要一个控制台、以及它到底该做什么。
>
> **定位**（注意不是「部署控制台」）：
>
> > **K3s 方案控制台** —— 把已验证的 K3s HA、VIP、Traefik、Registry、监控等基础设施方案，
> > 固化为**可配置、可校验、可执行、可观测**的操作系统。
>
> 「部署控制台」容易让人理解成「一个带网页的部署脚本」，而这个项目的实际设计不是那个。
> 它真正要回答的不是「如何执行 `deploy.sh`」，而是：
>
> > **我怎样确定这套基础设施方案现在处于正确状态？**
>
> 这也解释了为什么已经有 `./deploy.sh all`，仍然会觉得「不踏实」。
> 它要闭合的是一个环：
>
> ```text
> 准备一次方案配置 → 自动校验 → 看到执行计划 → 确认影响面
>        → 执行 → 实时日志 → 16 项验证
>        → 明确告诉你：这套集群现在到底对不对
> ```
>
> 它不追求功能多。**这个环跑通，就已经解决了最初那个痛点**——
> 不是让我少敲几个命令，而是让我不用一直担心「是不是哪里忘了、是不是哪个参数错了」。

## 一、起点：脚本减少了「手工操作」，但没有减少「人的不确定性」

三份手工文档收敛成 `./deploy.sh all` 之后，复杂度并没有等比下降。它分三层：

```text
操作复杂度   要敲多少条命令、按什么顺序        →  已消灭（main() 阶段编排）
决策复杂度   每个值该填什么、为什么是这个值     →  已转移（config.env 逐行写明理由）
验证复杂度   我现在到底在不在一个有效状态      →  部分自动化，但输出是给人看的
```

真正让人不踏实的不是第一层，是**第三层**：脚本说「完成」了，我怎么知道它真的对？

这一点在两份方案里其实已经被反复印证——看《K3s HA 一键部署方案》§四「比手工文档多固化的八件事」
的「漏掉的后果」一列，出现频率最高的词组是同一个：

> **「看起来一切正常」**

- 污点丢了 → 不报错，只是少一个节点通告 VIP
- `curl -k` 通了 → 证书缺 SAN 被掩盖，直到 `kubectl` 访问 apiserver 才炸 `x509`
- servicelb 没禁 → `EXTERNAL-IP` 是节点物理 IP，看着像正常

所以「控制台」要解决的，本质上是**把「看起来正常」和「真的正常」之间的缝补上，并且让它可见**。

## 二、先划边界：哪些已经在脚本里了

在动手之前必须承认一件事：**三层里有两层已经存在，而且质量不低。**

| 层 | 现状 | 证据（`cluster-infra/`） |
| :--- | :--- | :--- |
| 输入 | `config.env` 是唯一事实来源，每行都写了「为什么是这个值 / 改它要连带改什么」 | `k3s-ha/config.env` 11 KB、`monitoring/config.env` 8.8 KB |
| 校验 | `preflight` 已经在**重算拓扑**，不是检查配置有没有填 | `check_traefik_replicas`、VIP 冲突检测、代理真下载一次安装脚本、渲染残留 `__XXX__` 检测 |
| 执行 | 阶段幂等，且区分「配置幂等」与「无副作用」 | `main()` 的 `PREFLIGHT_REPLICAS_SOFT` 分流 |
| 状态 | `verify` 16 项，**查链路不查配置** | 控制面走到 `/readyz` + 证书 SAN；业务面逐节点 curl |
| 输出 | 三种前缀 + 退出码 | `ok ✓` / `warn !` / `die [错误]`；`phase_verify` 末尾 `return "$fail"` |

**也就是说：校验层和状态层已经写好了，缺的只是「机器可读」和「人类可读」之间那一层薄壳。**

这决定了整个项目的性质——**它不是从零做一个运维平台，是给一个已经正确的判定逻辑做视图。**

## 三、架构与边界：GUI 里不许复制「方案判定逻辑」

### 3.1 目标架构

```text
                    Browser
                       │
                       ▼
              ┌─────────────────┐
              │  React + antd   │
              │  状态 / 配置 /   │
              │  任务 / 日志     │
              └────────┬────────┘
                       │ HTTP / SSE
                       ▼
              ┌─────────────────┐        ┌──────────────────────┐
              │    Go API       │───────▶│ Prometheus /         │
              │  Task Manager   │  GET   │ Alertmanager / Loki  │
              │  Auth           │        │（只读，可留空不接）    │
              │  Stream         │        └──────────────────────┘
              │  JSON Adapter   │
              └────────┬────────┘
                       │ exec
                       ▼
              ┌─────────────────┐
              │   deploy.sh     │
              │  preflight      │
              │  prepare        │
              │  server-first   │
              │  join           │
              │  kube-vip       │
              │  traefik        │
              │  verify         │
              └────────┬────────┘
                       │ SSH
          ┌────────────┼────────────┐
          ▼            ▼            ▼
         k1           k2           k3
```

三条通道，三种语义，**互不替代**：

| 通道 | 回答什么 | 语义 |
| :--- | :--- | :--- |
| `deploy.sh --json` | 这套方案现在对不对？ | **判定**：`ok` / `warn` / `error` / `skip` |
| `deploy.sh`（内部走 kubectl） | 有几个对象、在不在？ | **存在 / 数量 / 相位** |
| Prometheus / Alertmanager / Loki | 用了多少、有无告警、日志说了什么？ | **数值 / 时间序列** |

> **Kubernetes API 没有以 `client-go` 的形式接进来**（§5.3）：对象态走 `deploy.sh` 已有的
> kubectl 通道就够，控制台里没有一行 K8s 客户端代码。运行态那三个数据源是**只读 HTTP 客户端**
> （`internal/metrics/`），地址由启动参数给出，**留空 = 不接**。

### 3.2 边界怎么划：三类，不是两类

这是本文最重要的一条，也是最容易在实施时被违反的一条。

初稿写的是「**校验逻辑必须留在脚本里，一行都不许搬进后端**」——**原则对，但表述过死**。
因为 Go 后端必然会有自己的校验，例如：

```text
任务是否正在运行
用户是否有权限执行
参数是否完整
是否允许同时执行两个部署任务
当前任务是否可以取消
```

这些**不是 K3s 方案校验**，不能也不该塞进 Bash。准确的说法是：

> **K3s 集群的事实判定与方案校验，以 `deploy.sh` 为唯一事实来源，Go 不复制这些判定逻辑；
> Go 可以拥有控制台自身的任务、权限、状态和参数校验。**

```text
Go
│
├── 控制台校验（Go 自己的领域）
│   ├── 参数完整性
│   ├── 任务状态
│   ├── 并发控制
│   └── 权限
│
├── 控制台自己的写操作（Go 的领域）
│   └── config-edit：编辑 config.local.env
│       └── 但「这份值合不合法」整包交给 ↓ validate-config
│
└── 调用 Bash
       │
       └── K3s 事实校验（deploy.sh 是唯一事实来源）
           ├── VIP 冲突 / 同网段 / 空闲
           ├── kube-vip 两套 DaemonSet
           ├── Traefik 副本数 vs eligible nodes
           ├── TLS SAN
           ├── Registry 可达性
           └── …
```

判据很简单：

> **如果判定的是「集群是否符合本方案要求」，由 Bash 负责；
> 如果判定的是「控制台是否允许执行某个操作」，由 Go 负责。**

这条比「要不要 SSH」更本质。因为会出现这种情形：

```text
Go 调用 verify --json
        ↓
Go 根据结果决定：
  · 是否允许显示「执行」
  · 是否要求二次确认
  · 是否允许继续下一阶段
```

这**仍然是 Go 的控制流程**，而不是 Go 在**重新判断 K3s 是否正确**。
两者容易混淆，区别在于：前者消费 `verify` 的结论，后者自己产出一个结论。

#### 第三类：控制台自己的写操作

上面的二分（K3s 判定 → Bash / 控制台自身校验 → Go）还不够用。
`config-edit`（在控制台里改配置）**既不是 K3s 判定，也不是「校验」**——
它是控制台**自己写文件**。归在 Go 这一侧，但它带来的诱惑很具体：

```text
要校验「VIP 能不能填这个值」
    ✗ 错的做法：Go 里写 if !isValidIP(vip) { ... }
    ✓ 对的做法：把候选值写成一份配置，跑 deploy.sh validate-config，看它怎么说
```

错的做法看起来更「顺手」，而且**单看代码完全合理**——它只是把一个 IPv4 正则放在 Go 里。
但那样一来，「什么算合法 VIP」就有了两份定义（Go 一份、`deploy.sh` 一份），
两边必然在某个边界条件下给出不同答案，而那时候**不知道该信谁**。

所以硬约束是：**控制台连「VIP 不能等于节点 IP」这条规则都不认识**。
它只负责把候选值递过去、把结论显示出来。实测里那条 `VIP_CP=192.168.1.201`
被拦下的判定项，文案与 `fix` 全部原样来自 `deploy.sh`，Go 一行判断都没有。

#### 为什么方案判定不能复制到 Go

理由不是「懒得搬」，而是三条都不可妥协的：

1. **离线测试已经压在这套 bash 上了。** `k3s-ha/tests/selftest.sh`（离线，秒级）+ `integration.sh`。
   把 `check_traefik_replicas` 翻译成 Go，等于把这些断言的保护范围砍掉一半。
2. **两份事实来源必然漂移。** 一旦 Go 里也有一份「副本数 vs eligible」的判断，
   两边就会在某个边界条件下给出不同答案——而那时候你**不知道该信谁**。
   这恰恰是控制台要消灭的「不可确认」，它会亲手把它造回来。
3. **校验的价值在于「每次执行都重算」。** 方案 §四 第 5~7 条的原话是
   「不只是写进清单，而是写成了**每次执行都会重算的校验**」。搬到 Go 就变回静态配置了。

### 3.3 推论：Go 后端可以薄到不可思议

```text
POST /api/run              →  os/exec 起一个 bash deploy.sh <phase>
GET  /api/tasks/{id}/events →  读 stdout/stderr，按行推 SSE
GET  /api/commands         →  一张命令表 + 当前放行策略
```

没有 ORM、没有数据库、没有 K8s 客户端。加上 §3.2 划出来的那几类控制台校验，
就是 Go 的全部内容。

## 四、动作的「影响面」必须是一等公民

这是现有脚本已经想清楚、但 GUI 最容易做丢的一件事。

`deploy.sh` 的头部注释明说：

> 幂等 = 「配置幂等」，而不是「执行无副作用」……**`traefik` 阶段会触发一次 Traefik 滚动重启**
> ——所以不能把 `all` 当成「零影响重复执行」。只想「看看现状」请用 `./deploy.sh verify`。

对照成控制台的动作表：

| 动作 | 改集群吗 | 影响面 | GUI 该怎么表现 |
| :--- | :--- | :--- | :--- |
| `verify` / `show-config` / `consistency` | 否 | 无 | 随时可点，结果即对应页面 |
| `preflight` | 否，但会 SSH 到每台 + 渲染清单到临时目录 | 无 | 带「会连 3 台机器」提示 |
| `topology` | 否，但要连集群 | 无 | 集群不可达时如实报 `reachable:false`，不算失败 |
| `kubeconfig` | 是，但只写本机文件 | 最低 | 写操作里影响最小的一条 |
| `prepare` / `taint` | 是 | 改节点（apt / swap / hosts / registries.yaml / 污点） | 需二次确认 |
| `server-first` / `join` / `kube-vip` | 是 | 装 k3s、重启 k3s 服务 | 需二次确认 |
| `traefik` | 是 | **会滚动重启业务入口** | 需二次确认 |
| `all` | 是 | 包含上面全部 + 可能的 k3s 重启 | **不许做成无脑大按钮** |
| `uninstall` | 是 | **≠ 恢复出厂** | 必须逐条列出「不会恢复什么」，还要手抄命令名 |
| `release`（PassUp） | 是 | 重建全部后端副本，业务短暂不可用 | 需二次确认 + 手抄命令名 |
| **改配置**（`config-edit`） | 否，**但改的是「之后每一次部署」** | 比跑一条命令的后果更长远 | **两步**：先预览（校验 + diff），再确认写入 |

最后两行的「否，但」值得说清。`config-edit` 不碰集群，看起来最无害；但它改变的是
**后面每一次 `deploy.sh` 会读到什么**——这个后果比跑一条命令长远得多。
所以它在界面上不走「一键执行」，而且走的是唯一一个「两步」的写路径：

```text
① 预览：候选值 → 跑 deploy.sh validate-config → 显示校验结论 + 会变的行（**不写盘**）
② 写入：重新校验一遍 → 写文件 → 留 .bak → 记审计
```

第 ① 步是**不写盘**的，所以它在有任务跑的时候也能用（只读）；
第 ② 步要独占，因为部署脚本启动时就把配置读进内存了 ——
这期间改配置会让「脚本看到的值」和「文件里的值」不一致，事后极难解释。

确认令牌绑的是「键 + **改前全文** + 改后全文」，不只是键和值。
这样文件在预览之后被别人动过（哪怕动的是别的键），令牌就失效，强制重新预览 ——
**把「确认」绑到具体内容上，是它唯一有意义的实现方式。**

最后一行值得单独说。`uninstall` 的语义在方案 §八 里被刻意写清楚了：

> **`uninstall` = 移除本方案管理的 kube-vip / Traefik 定制资源；K3s 本身及 `servicelb` 的禁用状态不自动恢复。**

如果 GUI 把它渲染成一个「删除集群」按钮，用户点完会以为回到了干净状态，实际不是。
**这类「边界语义」正是控制台最该显式表达的东西**——脚本用文档写了，控制台要把它变成界面的一部分。

## 五、技术栈

### 5.1 前端：React + TypeScript + Ant Design（对齐 `pass-up.frontend`）

**不引入第二套心智**——直接沿用已有的 React 基线。基线取自 `pass-up.frontend`：

| 项 | 取值 | 出处 |
| :--- | :--- | :--- |
| 框架 | React 19.2 + react-dom 19.2 | `pnpm-workspace.yaml` 的 `catalog:` |
| 语言 | TypeScript ~6.0 | 同上 |
| 构建 | Vite 8.1 | 同上 |
| 组件库 | **antd 6.5** + `@ant-design/icons` 6.3 | `apps/admin`、`packages/shared` 的 dependencies |
| 路由 | react-router-dom 7.18 | `apps/admin` |
| 状态 | zustand 5.0 | `catalog:` |
| 请求 / 时间 | axios 1.18 + dayjs | `apps/admin` |
| Lint | oxlint 1.76 + eslint 10 | 顶层 `devDependencies` |

**工程结构照抄 `pass-up.frontend` 的形状**：pnpm workspace + `apps/*` + `packages/*`，
依赖版本走 `catalog:` 集中管理，`packages/` 下复用 `shared` / `vite-config` / `tsconfig` / `eslint-config`
四个基础包。这样两个项目的依赖升级、lint 规则、tsconfig 是同一套心智，不用维护两份。

> 一个提醒：`pass-up.frontend` 用了 `@ant-design/x`（antd 的 AI 对话组件库）。
> 控制台不需要它，别顺手带上。

**实现时相对基线的偏离**（都是有意为之）：

| 偏离 | 理由 |
| :--- | :--- |
| `vite-config` 砍掉 `@tailwindcss/vite` / `code-inspector-plugin` / `react-compiler` / `assetsDir: assets<version>` | 前三个与「把已正确的判定逻辑可视化」无关，少一个 babel 环节就少一处构建风险；`assetsDir` 是给「静态资源走对象存储、新旧 chunk 并存」用的，而控制台的前端产物由 Go 二进制直接托管，Vite 默认的 content-hash 文件名已经够用 |
| 新增「动作清单」视图 | §四 那条约束（影响面是一等公民）如果不落到界面上，就永远只是一句文档；把「当前不开放的动作 + 各自影响面」列出来，恰恰是最诚实的呈现方式 |

#### 明确不用 Tailwind CSS

`pass-up.frontend` 目前带着 `tailwindcss@4.3`，但**控制台项目不带**。

理由不只是「可读性」——在这个项目上它还有一层更硬的问题：

1. **可读性**：控制台的 UI 是**大量表单 + 状态表格 + 日志流 + 步骤条 + 拓扑图**，
   这些几乎全是 antd 组件；真正需要自定义样式的只有布局外壳和少数状态色。
   用 utility class 表达这些，会把「一个组件长什么样」拆散到十几个 class 字符串里。
2. **优先级打架（这条才是关键）**：antd 6 用的是 **CSS-in-JS**，样式注入顺序不受你控制。
   想覆盖 antd 组件内部结构时，Tailwind 的 utility 经常压不住，最后要靠 `!important` 兜底
   ——**这是维护成本，不是审美问题**。
3. **antd 已经把视觉规范收敛在 theme token 里了**，再叠一层 utility 等于两套规范并存。

**替代方案**（按推荐顺序）：

| 场景 | 做法 |
| :--- | :--- |
| 布局 | antd 的 `Layout` / `Grid` / `Space` / `Flex`，**不写自定义 CSS** |
| 需要微调 | **CSS Modules**（`xxx.module.css`）——类名有语义、可跳转、可被 lint |
| 全局主题 | `ConfigProvider` + theme token（`components` 覆盖），而不是用 class 盖 antd 内部结构 |
| 状态色（通过 / 警告 / 失败） | 定义**一组语义化 CSS 变量**，禁止散落的 `text-green-600` 这类写法 |

> 状态色那一条对本项目尤其重要：`verify` 的四态（`ok` / `warn` / `error` / `skip`）
> 是整个界面的核心语义，它必须是**一处定义、全局引用**的 token，
> 而不是每个组件各写一遍颜色类名。实现上落在 `types.ts` 的 `LEVEL_META` / `RISK_META` /
> `SOURCE_META` —— 它们只提供标签与颜色，**不含任何判定**。

### 5.2 后端：Go，但理由不是「别和 PassUp 绑在一起」

「避免技术栈耦合」是对的，但太弱了。真正的理由是**部署形态**：

| 维度 | Go | Java |
| :--- | :--- | :--- |
| 产物 | 单静态二进制，`./k3s-console` 即跑 | JAR + JVM |
| 运行时资源占用 | **低**，适合部署在资源受限的 Linux 管理机上 | JVM 基线本身就不小 |
| 进程/流编排 | `os/exec` + goroutine 天然顺手 | 需线程池 + 流处理框架 |
| SSH | `golang.org/x/crypto/ssh` 一等公民 | 需 JSch / sshd 库 |

> 「资源占用低」是**定性描述**，不写具体 RSS 数字。
> 实际占用取决于 Go runtime、HTTP server、SSH 连接数、子进程、日志缓存、并发任务 ——
> 把某个数字写成选型依据，它会很快变成一个过时且误导的硬指标。
> 真正的技术理由就是上表那三条稳定的：**单静态二进制 / `os/exec` + goroutine / SSH 生态**。

**最关键的一条是内存**：这个控制台大概率要和被它管理的集群跑在同一批机器上，
而那三台节点还要同时承载业务 Pod 与监控栈（Prometheus / Loki / Alloy / Grafana）。
**在一个内存本来就要精打细算的集群旁边，再放一个 JVM 控制台，是自相矛盾的。**

### 5.3 关于 `client-go`：它不是必需品，而且给不了你一半的状态

「接 Kubernetes API」这件事给人的印象是「比较高级所以放后面」。真实原因是：

> **`verify` 的 16 项判据里，有一半是「节点本地事实」，`client-go` 永远拿不到。**

逐项拆开看：

| 判定项 | 数据来源 |
| :--- | :--- |
| 节点状态 / 两套 DaemonSet / 业务 VIP / `externalTrafficPolicy` / 副本分布 / 副本数-vs-eligible / 节点污点 | **k8s API**（7 项） |
| 控制面 VIP 是否落在网卡（`/32`）/ 6443 TCP / `/readyz` / **证书 SAN** / 业务连通 / **逐节点 VIP 通告** / **`registries.yaml` 逐字节一致** | **SSH 到节点**（7 项） |
| 本机直连 / 版本固定提醒 | 本地（2 项） |

那 7 项 SSH 项里有几条是**整份验收里最值钱的**：

- **证书 SAN**：`curl -k` 会跳过校验，只有 `openssl s_client` 才能发现漏写 `tls-san`；
- **逐节点 VIP 通告**：`externalTrafficPolicy: Local` 下每个承载 Traefik 的节点各自通告 VIP，
  「某台没在通告」是**最隐蔽的一类故障**；
- **`registries.yaml` 一致**：`cmp` 逐字节比对，容器拉镜像行为是否和脚本产物一致。

**结论**：控制台的状态层**不是**一个「接 K8s API」的问题，而是一个
**「把 verify 链路跑一遍并结构化」**的问题。`client-go` 只能覆盖那 7 项，
而且是最容易用 `kubectl` 拿的那 7 项。

所以正确顺序是：**先把 `verify` 变成机器可读，再谈 `client-go`。**

> 协议里的判定项比 16 多，是因为**逐节点判据会展开**（`business.vip_advertised@<节点>` ×3、
> `registry.registries_yaml@<节点>` ×3），加上 `traefik.replica_eligible` 被 `preflight` 与 `verify` 共用。
> 但方向不变：**`client-go` 覆盖不到的那一半，恰恰是最值钱的那一半。**

#### 而且 `client-go` 可以不急着做

这一点值得单独写下来，因为它是**优先级**问题，不只是**顺序**问题。

本项目最核心的价值不是「查看 Pod / Deployment / Node」——那些 Headlamp 已经做得很好，
再做一个不会更好。真正的核心链路是：

```text
deploy.sh → verify → 方案判定 → 控制台展示
```

所以接 `client-go` 的定位是：

> **为了补充交互和实时状态，而不是为了替代 `verify`。**

一旦这条原则写清楚，`client-go` 就从「必须做的 V3」变成了「**有明确增量才做的可选项**」。
如果某天发现「节点 CPU / 内存实时曲线」确实需要它，再加；
如果 `kubectl` 的输出已经够用，就不加。**不做也是一种合法结论。**
（当前实现的结论就是不做：对象态走 `deploy.sh` 的 kubectl 通道，资源态走 Prometheus 只读客户端。）

### 5.4 图表：优先用非图表的表达

antd 自身不带图表。本项目需要图的地方有两处，**优先用非图表的表达**：

| 需求 | 首选 | 理由 |
| :--- | :--- | :--- |
| 拓扑关系（节点 → VIP → Traefik → 业务） | **手写 SVG / 纯 CSS**，不用图库 | 拓扑是**固定形状**（3 节点 + 2 个 VIP），不是数据驱动的图。引图库反而更绕 |
| 时序指标（CPU / 内存 / targets） | **不画曲线**，只给当前值 + 一个「去 Grafana」的出口 | 一旦给了曲线，就会有人拿它当 Grafana 用 |

拓扑视图（`TopologyView`）就是手写 SVG / CSS 的做法；运行态总览页**第一版不给时序曲线**。

## 六、控制台自己跑在哪：一台 Linux 管理机

**结论：跑在一台 Linux 管理机上，控制台自己不进被它管理的集群。**

这不是个可以往后拖的问题——后面的 SSH 私钥、`kubectl`、`bash`、`docker`、网络、`kubeconfig`、
任务日志全都依赖它。

### 6.1 为什么不能跑在 Windows

目标是「**让这个东西本身比手工执行脚本更可靠**」。如果控制台自己依赖
Git Bash、`cygpath`、Windows 版 SSH、本机 Docker，那它**重新制造了一层不确定性**——
而这层不确定性还是你自己要维护的：

- `cygpath -m`（Windows 原生 kubectl 读不了 Git Bash 的 `/c/...` 路径）；
- MSYS 会把「看着像 Unix 绝对路径」的环境变量值改写掉（`VITE_BASE_PATH=/admin` 被转成
  `<PortableGit>/admin`，导致 admin 整页白屏而 HTTP 全 200）；
- 构建还会被沙箱的删除保护 shim 拦下，要额外带 `CODEBUDDY_SAFE_DELETE_ENABLED=0`。

这些都是真实踩过的坑，但它们**是开发环境的问题，不该成为运行时的依赖**。

> Windows 下**开发调试**是支持的（见 `console/README.md` 的「Windows 下运行」），
> 但那是开发形态，不是部署形态。

### 6.2 为什么也不建议跑在集群节点上

三个选项对照：

| 选项 | 满足 | 问题 |
| :--- | :--- | :--- |
| **A. Windows 本机** | SSH、本机 kubectl | 依赖 Git Bash / cygpath / 本机 Docker（见 §6.1） |
| **B. 集群内某个节点** | SSH、kubectl、bash 全有 | ① 节点内存要与业务和监控栈抢；② 控制台管的就是这个集群，**集群挂了控制台也没了**，等于把「看门狗」和「被看护对象」放一起；③ `build-image` 用的是**本机 docker**，节点上没有 |
| **C. 集群外一台 Linux 管理机** | 全部满足 | 需要一台机器 + 一次部署——**这是唯一可接受的成本** |

选项 B 的第 ② 条是决定性的：控制台的价值是「集群不对时告诉你哪里不对」，
它**必须在集群之外**才能履行这个职责。

### 6.3 部署形态

```text
                   Windows
                  Browser
                     │
                     ▼
             ┌───────────────┐
             │ Linux 管理机  │
             │               │
             │ K3s Console   │
             │ Go + React    │
             │               │
             │ deploy.sh     │
             │ SSH Key       │
             └───────┬───────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
         k1         k2         k3
```

建议直接做成一个容器镜像，脚本**随镜像打包**而不是挂载宿主机目录——
这样「控制台用的脚本版本」和「镜像 tag」是绑定的，可复现，
也不会出现「镜像里是 A 版脚本、宿主机挂载的是 B 版」这种新的不可确认。

实现上这一点已经体现在前端产物上：Go 用 `//go:embed all:web/dist` 把前端打进二进制，
所以「控制台用的前端版本」和「二进制」也是绑定的。

#### 这个位置带来的直接价值：集群全挂时它还在

这是「跑在集群外」最实际的收益，值得单独写出来。即使三台节点全部失联：

```text
k1 ❌
k2 ❌
k3 ❌
```

只要管理机还活着，你仍然能看到：

```text
Cluster unreachable
```

并且能继续做：

```text
SSH 检查  →  网络检查  →  重新部署  →  恢复
```

如果控制台跑在集群里（§6.2 选项 B），这个场景下**你会同时失去集群和控制台**，
连「它到底怎么了」都问不出来。**这才符合「控制台」的定位**——
它的职责是在系统不正常的时候仍然可用。

> 这也是运行态总览页（§8.8）**刻意不接 `client-go`** 的另一层理由：
> 集群不可达时，`deploy.sh` 仍然能给出「连不上」，而一个 K8s 客户端只能给你一个空列表。

### 6.4 无论跑在哪都必须满足的两条

它们是 `log.Fatalf`，不是提醒：

1. **绑非回环地址必须配 `-token`。**
   这台控制台持有能登录全部节点的 SSH 私钥，裸奔在网络上等于把集群钥匙挂在门口。
   「不需要认证」只有在「别人根本连不上」时才成立。
2. **放行写操作必须配 `-token`，连绑回环也不放过。** 把两种误用放在一起看就明白了：

   | | 被误用的代价 |
   |---|---|
   | 只读控制台 | 多跑几次检查 —— 代价是时间 |
   | 可写控制台 | 集群被改了 —— 代价可能是服务中断 |

   「绑回环」挡住的只是**外部网络**，挡不住本机上的任何进程（包括浏览器里随便打开的一个页面）。
   能改集群的接口不该建立在一个「反正只有本机能访问」的假设上。

`-allow-write` 里写了认不出的命令名会**直接报错**，而不是静默忽略 ——
`-allow-write=traefk` 被忽略的话，用户会以为已经放行了，然后困惑于「界面上为什么还是没有按钮」。

另外，**`build-image` 是唯一一个「必须在有 docker 的机器上跑」的阶段。**
要么在管理机上装 docker，要么把镜像构建挪到 CI（`docker-infra/` 已有 CI）。
建议后者——构建本来就不该是控制台运行时的职责。

## 七、方案验收的覆盖范围

§一 说的「第三层：验证复杂度」，落到实现上就是一张清单：**方案 checklist 里要求了、
但脚本当初没查的项**。它们已经全部补齐，落在 `preflight` 或 `verify`。

| 节 | 缺口 | 现状 | 落在哪 |
| :--- | :--- | :--- | :--- |
| §7.1 | Registry 三端口可达 | ✅ 已覆盖 | `preflight` 的 `registry.port_reachable` |
| §7.2 | 节点规格下限（OS / CPU / 内存） | ✅ 已覆盖 | `preflight` 的 `node.spec` |
| §7.3 | VIP 空闲与同网段 | ✅ 已覆盖 | `preflight` 的 `vip.free` / `vip.same_subnet` |
| §7.4 | 跨文件事实一致性 | ✅ 已覆盖 | `consistency` 命令 + 控制台 `ConsistencyView` |
| §7.5 | 逐项状态不可机器读 | ✅ 已覆盖 | P0 的 `--json` 结果协议 |

> ⚠️ **「覆盖」不等于「进了 `verify`」**：§7.1~§7.3 的三项落在 **`preflight`**，
> `verify` 的 16 项**仍然不含它们**。这不是遗漏，是刻意的 —— 见 §8.4 末的说明。

### 7.1 内网 Registry 端口可达性

`K3s HA 一键部署方案` §6.1 的 checklist 明确写着：

> **镜像加速可用**：三台都能访问内网 Registry 的三个端口（`curl -sI http://<registry>:5001/v2/` / `:5002/v2/` 有响应即可）。

而 `phase_preflight` 当初检查的是 **k3s 下载代理**（逐台真下载一次安装脚本），
**没有查 Registry 三个端口**。它只在 `README.md` 的排障表里以「怎么排查」的形式出现。

这个缺口的代价不低——README 自己写了：

> containerd **不会自动回退官方源**，所以要么修缓存，要么临时把镜像换成私有仓库的直连地址

即：代理缓存不可达时，`ghcr.io` 上的 kube-vip 会**直接拉不动**，且没有回退。

**现在的做法**：`preflight` 有 `registry.port_reachable` ——
逐台、逐端口 `curl --noproxy '*' -sI http://$REGISTRY_HOST:$P/v2/`，只看 HTTP 码（`000` = 不可达）。
探测**在节点上**跑，所以本机那套「代理劫持」在这里是同构的 —— 因此显式 `--noproxy '*'`。
未接管 `registries.yaml`（`MANAGE_REGISTRY=false` 或 `REGISTRY_HOST` 为空）时如实报 `skip`。
等级是 `warn` 而非 `die`，与 `k3s.download_proxy` 同策略：环境会变，不该把人挡在「先看看现状」之外。

### 7.2 节点规格下限（OS / CPU / 内存）

`prepare` 阶段实际做的事是：`hostname` → `/etc/hosts` 托管块 → 关 swap → `modprobe` →
`apt update/upgrade` → `ufw` → 建 auto-manifests 目录。**没有一条检查节点规格。**
而监控方案的内存取值（`limits`、PVC、`ResourceQuota`）全都建立在节点规格上。

**现在的做法**：`preflight` 有 `node.spec` —— 一次 SSH 把三样都取回来：

```bash
. /etc/os-release && echo "$VERSION_ID"     # 期望 >= NODE_MIN_OS_VERSION
nproc                                        # 期望 >= NODE_MIN_CPU
awk '/MemTotal/{print int($2/1024/1024)}' /proc/meminfo   # 期望 >= NODE_MIN_MEM_GIB
```

下界是**配置项**（`NODE_MIN_OS_VERSION` / `NODE_MIN_CPU` / `NODE_MIN_MEM_GIB`），
不是写死在代码里 —— 写死阈值正是监控方案在 `BackendReplicaDown` 上已经后悔过一次的做法。

> ⚠️ 判定里最容易做错的一点：**探测失败必须判为不满足，不能判为满足。**
> `num_ge` 对空值和非数字一律返回「不满足」；工具缺失（没有 `nproc`）时报 `unknown` 而不是 `0`。
> 否则「取不到值」会被静默算成「够用」—— 那正是本方案要消灭的那种绿灯。
> 通过时也会把**实测值**打进 detail，免得只看到一句「通过」。
> 另外，版本号比较前统一 `x=$((10#$x))` 强制十进制：`08` / `09` 会被 `[ -gt ]` 当八进制，
> 直接报 `value too great for base`，而真实版本号里会出现。

### 7.3 VIP 的「空闲」与「同网段」

`preflight` 一直查的是「VIP 不等于任何节点物理 IP」和「`VIP_CP ≠ VIP_TRAEFIK`」——
**这两条是防止漂移时抢 ARP 的硬铁律，是对的。**
但方案 §6.1 的 checklist 还要求 VIP 在局域网内 **ping 不通**（未被占用）且与节点 **同网段**。

**现在的做法**：`preflight` 有两项：

- `vip.free` —— 逐台 ping 两个 VIP；
- `vip.same_subnet` —— 逐台 `ip route get <vip>`，**用内核自己的路由决策**判断是否 on-link
  （输出不带 ` via ` 即直连），而不是自己算网段掩码。

另外还有一条形状校验 `is_ipv4`（VIP 是不是**合法 IPv4**）。它拦不住「这个地址被别的机器占了」——
那是拓扑问题，不是形状问题；但形状必须在写入前挡住，否则非法值会被原样写进 kube-vip 清单和
apiserver 证书，报错点离原因很远（证书生成失败 / DaemonSet CrashLoop），很难倒推回来。

> ⚠️ **只看 ping 会报告一个不存在的故障。**
> 第一版上线后，preflight 在任何**已部署过的集群**上都会报「VIP 可能已被占用」——
> 因为那时 VIP 本来就由 kube-vip 持有、本来就应答 ICMP。
> 那正是本方案最忌讳的一类错误（历史上「依赖地址漏剥显示名 → 恒报不可达」是同一类）。
> → 修法：`node_probe` 额外探测**本机是否已持有该 VIP**（`ip -4 -o addr show | grep -qw`），
> 逐地址区分「本集群自己占的」（ok，属正常）与「别人占的」（warn）。
>
> 另外两个刻意的措辞：`vip.free` 通过时的 detail 里带着「⚠️ 对端禁 ICMP 时本项不成立」，
> 工具缺失一律 `skip` 而不是当成「空闲」——**「没探测到」不等于「没有」**。

### 7.4 跨配置文件的事实一致性

这是**两份 config.env 之间唯一的共享事实**，也是最容易漂移的地方：

```text
k3s-ha/config.env            monitoring/config.env
────────────────────         ────────────────────
NODE_TAINTS=                 TAINT_KEY="k3s-monitoring"
  "k3 k3s-monitoring:          TAINT_EFFECT="NoSchedule"
        NoSchedule"           INFRA_NODE="k3"
                             （且 INFRA_NODE 必须在 k3s-ha 的 NODES 里）
```

`monitoring/config.env` 自己写了「改一处必须改另一处」，但 `monitoring/deploy.sh` 的
`phase_preflight` 发现污点缺失时**只是 warn，不中断**：

```bash
  else
    warn "$INFRA_NODE 缺少污点 ${TAINT_KEY}:${TAINT_EFFECT}（当前：$(printf '%s' "$taints" | tr '\n' ' ')）"
    warn "  这不会挡住部署（nodeSelector 仍会把单实例组件钉住），但说明 k3s-ha 的"
    warn "  NODE_TAINTS 与这里的 TAINT_KEY 已经不一致了，请回去核对 cluster-infra/k3s-ha/config.env"
  fi
```

warn 的理由是成立的（不挡部署），但这意味着**没有任何一个地方能回答「这两份配置现在一致吗」**。

**现在的做法**：`k3s-ha/deploy.sh` 有 `consistency` 命令（`phase_consistency`，只读），
控制台有对应的 `ConsistencyView`，逐项比对两份配置的共享事实并给出 `fix` 文案。
它**故意不跑 `preflight`** —— 集群或网络不正常时也要能用。

### 7.5 逐项状态不可机器读

`verify` 原本输出的是给人看的东西，虽然结构已经很像机读：

```text
    ✓ 全部 3 台都能经代理下载安装脚本
    ! 本机 kubectl 经控制面 VIP 访问失败（本机与该网段不通时属预期）
  [Traefik 业务入口]
    ✓ 业务 VIP 正确（可漂移）
```

`[ -t 1 ]` 已经做了 ANSI 自动降级（非 TTY 不带色），所以解析是**可行**的；
但靠正则匹配 `✓`/`!` 属于**脆弱耦合**——文案改一个字就断。

**现在的做法**：`verify` / `preflight` 有了 `--json`，**判定逻辑一行未改**，只改了输出层。
协议形状见 §8.1 —— 注意这不是「加个输出格式」，而是给 Bash 定了一份**结果协议**。

## 八、实现分期（P0~P5，已全部落地）

| 期 | 状态 | 内容 | 为什么是这个顺序 |
| :--- | :--- | :--- | :--- |
| **P0** | ✅ 已实施 | `verify` / `preflight` 加 `--json` —— **Bash 的结果协议**（§8.1） | 不动判定逻辑、不改现有工作流；这是整个项目唯一的地基 |
| **P1** | ✅ 已实施 | 只读控制台：状态首页 + 拓扑事实 + **方案配置视图** + 配置一致性视图（§8.2） | 零风险，且立刻兑现「不可确认 → 可确认」 |
| **P2** | ✅ 已实施 | 动作编排：带**影响面标签** + 二次确认 + 实时日志流（§8.3） | 此时才有「按钮」，且每个按钮的危险等级已明确（§四） |
| **P3** | ✅ 已实施 | **只补方案验收**：§7.1 / §7.2 / §7.3（§8.4） | 方案态有资格显示成绿的，前提是验收本身完整 |
| **P4** | ✅ 已实施（P4.1 / P4.4） | **第二类受管对象：PassUp**（状态 → 收敛 → 动作）（§8.7） | 此时「协议 → 控制层 → UI → 任务」的骨架已被 P0~P2 验证过一轮，PassUp 是它的第二个消费者 |
| **P5** | ✅ 已实施 | **运行态总览页**：把 Prometheus / Alertmanager / Loki 的**运行事实**接进控制台，与已有的方案态**并列**展示（§8.8） | 前四期都在回答「方案对不对」，这一期开始回答「现在跑得怎么样」 |

**P5 是当前规划的最后一期。** 之后的「多集群 / YAML 编辑 / Pod 操作 / 扩缩容 /
替代 Grafana」**全部不规划**，理由分散在 §十 与 §8.8。
这不是「暂时不做」，而是本项目的价值**在「深」不在「广」**（§九）。

**P4 内部再分四格，顺序不可颠倒**：**P4.1 状态 → P4.2 监听 → P4.3 收敛 → P4.4 动作**。
「不要一上来就做发布按钮」不是保守，而是：没有 P4.2 的发布事件，
「期望版本」就没有来源，P4.3 的收敛比对无从谈起，P4.4 的发布按钮
就成了对着一个读不到的期望瞎发布。
实现上 **P4.2 的「监听」被「发布脚本自己写版本注解」替代了**：
期望版本 = 集群里实存的注解，事实来源仍只有集群一处，不引入事件源。
于是实际顺序是 **① 状态 → ④ 动作**，中间两格由注解代替。

### 8.1 P0：`--json` 不是「输出格式」，是 Bash 的**结果协议**

这一点值得单独强调，因为它决定了整个项目的性质。

做完 P0 之后，链路不再是「Shell → GUI」，而是：

```text
deploy.sh
  │
  ├── 人类输出（现在的 ✓ / ! / [错误]）
  │
  └── JSON 输出  ←── 结果协议
          ↓
        Go API
          ↓
       React
          ↓
      （未来）AI
```

> **GUI 不应该理解 Bash 的文字输出，而应该理解 Bash 的结果协议。**

逐项的最小形状（**四字段是必须的**）：

```json
{
  "id": "traefik.replica_eligible",
  "level": "ok",
  "detail": "replicas=2, eligible_nodes=2",
  "fix": null,
  "source": "cluster",
  "duration_ms": 183
}
```

失败项：

```json
{
  "id": "tls.apiserver_san",
  "level": "error",
  "detail": "VIP <控制面 VIP> is not included in certificate SAN",
  "fix": "检查 TLS_SAN 配置并重新执行 server-first"
}
```

| 字段 | 含义 |
| :--- | :--- |
| `id` | **稳定标识**——文案可以改，`id` 不能改。前端按 `id` 做跳转 / 筛选 / 忽略，不按文案匹配 |
| `level` | `ok` / `warn` / `error` / `skip`，对应现有三种前缀，也是状态色 token 的来源（`skip` 见下） |
| `detail` | 给人看的一句话，含关键数值（`replicas=2, eligible_nodes=2`） |
| `fix` | **可复制的修复命令或动作**，没有则 `null`。脚本里其实已经写了不少（如 `→ 跑 ./deploy.sh taint`） |
| `source` | `node` / `cluster` / `local` / `config` —— UI 直接显示「数据来自：节点 / Kubernetes / 本机 / 配置」。**它同时也是 §3.2 那条边界的自证**：`source=cluster` 的项就是由 Bash 判定的 |
| `duration_ms` | 整数。排查「为什么 `verify` 花了这么久」——一眼能看出是谁慢 |

顶层再包一层：

```json
{
  "system": "k3s",
  "phase": "verify",
  "started_at": "2026-09-25T23:02:03+08:00",
  "summary": { "ok": 31, "warn": 0, "error": 0, "skip": 2 },
  "items": [],
  "data": {}
}
```

- `system`：`k3s` / `passup` / `passup-fe` / `passup-ai` / `monitoring`（§8.7）。
  它是**路由信息**，不参与判定 —— 决定一条命令在哪个脚本上跑、结果算到哪一栏。
- `data`：只有三个只读命令（`show-config` / `topology` / `consistency`）会带。
  `items` 回答「符不符合要求」，`data` 只是「读到了什么」——两者刻意分开。

#### `skip` 是第 4 态，不是「通过」

判定项会因为**外部条件不具备**而根本没跑——节点上没有 `openssl`、本机没有 kubectl、
`MANAGE_REGISTRY=false`、首台还没装 k3s……
这些既不是 `ok` 也不是 `error`。如果它们干脆不出现在结果里，消费方就无法区分
「这项通过了」和「这项压根没跑」——**而这恰好就是本项目要防的「看起来一切正常」**。

所以 `skip` 必须显式出现，且**在 UI 上不能和 `ok` 共用颜色**（实现上是虚框灰标签「未执行」）。

#### 人类输出保持逐字节不变

`--json` 是**增量**：不加参数时 `./deploy.sh verify` 的输出与加协议层之前**逐字节一致**，
退出码也不变（判定逻辑一行没改）。实现上靠两个约定：

- 原来打印过的行（`ok` / `warn` / `log`）**原样保留**，协议项用「只记录不打印」的通道挂上去；
- 原来没打印的项（如 `kubevip.daemonset_*` 只在缺失时才 warn）不会凭空多出一行 ✓。

#### 保留 id：`fatal.unexpected`

deploy.sh 的 ERR trap 在脚本被 `set -e` 打断时记下这一项。**出现它就说明协议是残缺的。**

为什么需要这么一个明确的信号：`set -e` 下任何没被接住的失败都会让脚本当场中止，
而 EXIT trap 吐出的协议只包含中止之前跑到的那些项 ——
于是「跑了 12 项全过」看起来和「全部跑完且全过」一模一样。

所以控制台有一条专门规则：协议里出现 `fatal.unexpected` → 这次执行归 `failed`，
而不是「执行成功、结论里有 0 项问题」。这是整个写通道里最要紧的一条 ——
写操作「显示成功、实际没改完」会让人带着错误认知做下一步。

#### 判定项 id 是对外契约

`k3s-ha/tests/selftest.sh` 对全部协议 id 做**快照断言**：**id 是对外契约，文案可改、id 不可改**。
当前共 **44 项**，覆盖 `preflight` / `verify` / 三个只读命令 / `kubeconfig` 的五个失败分支。
带 `@<节点名>` 后缀的 id 是**逐节点展开**的：同一项在 3 台节点上会产出 3 条，
前缀稳定、后缀可变，消费方按前缀分组即可。

### 8.2 P1：只读控制台

P1 的全部内容是「一张状态卡 + 若干表格」，**不引入任何图表库**（§5.4）。五个视图：

| 视图 | 内容 |
| :--- | :--- |
| **状态首页** | `verify --json` 的渲染结果，按 `level` 分组，每项带 `detail` 与 `fix` |
| **拓扑事实** | VIP 持有者（`plndr-cp-lock` 的 `holderIdentity`）、漂移次数（`leaseTransitions`）、`eligible nodes` vs `TRAEFIK_REPLICAS` |
| **方案配置视图** | 见下 |
| **配置一致性视图** | §7.4 的跨文件事实 |
| **动作清单** | 全部命令 + 影响面 + 影响等级；写操作照实列出但按放行策略决定有没有按钮 |

（P4 追加「应用」栏 `/apps/passup`，P5 追加 `/overview`，共 7 个路由。）

#### 数据出口：三个只读命令，而不是 Go 解析配置

P1 前端需要三份数据：「当前方案配置」「拓扑事实」「跨文件一致性」。
它们**没有**让 Go 去解析 `config.env`，而是给 `deploy.sh` 加了三个只读子命令：

| 命令 | 回答什么 | 连集群吗 |
| :--- | :--- | :--- |
| `show-config --json` | 脚本当前解析到的方案配置（节点 / 污点 / VIP / 副本 / 版本 / registry） | 否 |
| `topology --json` | VIP 持有者与漂移次数、可承载节点数 vs 副本数、副本实际落点 | 是（不可达时如实报 `reachable:false`，不失败） |
| `consistency --json` | §7.4 的跨文件事实 | 否 |
| `validate-config --json` | 只做**纯本地**配置校验，连集群都不连 | 否 |

**为什么不放在 Go 里**：

1. **`config.env` 是 bash 语法**（含数组），`source` 才是它的权威解析器。
   在 Go 里重写一遍解析器，等于把「配置的唯一事实来源」复制成两份，必然漂移。
2. 这些命令**故意不跑 `preflight`**。`preflight` 要 SSH 到每台机器，
   而这些命令存在的意义之一恰恰是「集群或网络不正常时也能看」——
   配置有问题时它们如实报出「脚本读到了什么」，而不是被 preflight 挡在门外。

`validate-config` 的存在理由更具体：它是「控制台改配置之前先验证候选值」的落点，
做法是把 `preflight` 里的本地校验抽成 `validate_config_local()` 两边共用。
**如果控制台自己判断「这个 VIP 合不合法」，规则就有两份定义**，
而两份定义必然在某个边界条件下给出不同答案。
它配合 `CONFIG_LOCAL_OVERRIDE` 使用：把候选值写成临时文件指过来跑一遍，
**通过了才写盘**，而不是写完再回滚。

这几个命令是 §8.5「Go 后端可以薄到不可思议」的兑现：
**Go 侧没有一行配置解析、没有一行方案判定**。

#### 方案配置视图：只读，但必须标注来源

```text
┌─────────────────────────────────────┐
│ K3s HA 配置                         │
├─────────────────────────────────────┤
│ 节点                                │
│   k1   <IP>    control              │
│   k2   <IP>    control              │
│   k3   <IP>    control              │
│                                     │
│ Control Plane VIP     <IP>          │
│ Traefik VIP           <IP>          │
│ Traefik replicas      2             │
│ Registry              <host:port>   │
└─────────────────────────────────────┘

来源：k3s-ha/config.env + config.local.env
```

「来源」那一行是刻意加的：它让用户始终知道**这个值是从哪个文件读出来的**，
而不是让界面变成一个凭空产生配置的地方。
在配置分层之后它变得更必要：同一个键可能被后面的文件覆盖，
只报一个写死的文件名，会让人对着 `config.env` 里那行根本不生效的值发呆。

#### 「改配置」这条写路径

先把可能被误读的地方说清：**「提供修改」不等于「把配置搬进网页」。**

| 约束 | 怎么满足的 |
| :--- | :--- |
| 唯一事实来源必须是**可 git diff 的文件** | 控制台写的就是**文件**（`config.local.env`），不是数据库、不是内存状态。而且写的是**不进 Git** 的那个 —— 「改配置」不会让工作区变脏，也就不会出现「`git checkout` 之后配置被静默回退成上个环境」 |
| 自由表单会**重新引入决策复杂度** | 编辑的是**一个键的值**，不是自由表单。而且：能改哪些键由 `config.env` 里的【环境相关】标记决定（**脚本说了算**，控制台不自己判断）；改之前必须过 `validate-config`（规则与真正部署时同一份）；`source` 如实报出实际加载了哪几个文件 |

能改的键由 `show-config` 的 `data.editable` 报出（`[{key, hint}]`，键与说明都来自
`config.env` 的标记）。当前 **11 个**：`NODES` / `NODE_TAINTS` / `VIP_CP` / `VIP_TRAEFIK` /
`VIP_INTERFACE` / `K3S_DOWNLOAD_PROXY` / `K3S_DOWNLOAD_NO_PROXY` / `REGISTRY_HOST` /
`KUBE_VIP_IMAGE` / `TRAEFIK_REPLICAS` / `SSH_USER`。

改别的键会被拒 —— 比如 `K3S_VERSION` 应当提交进 Git，
写进不进 Git 的 `config.local.env` 会让它**从 Git 里消失**。

**落盘时的几个约束**：

- **独占**：有任务在跑时拒绝（409）。部署脚本启动时就把配置读进内存了。
- **落盘前重新校验**，不复用预览的结论 —— 预览与落盘之间集群状态可能变了。
- **确认令牌绑的是「键 + 改前全文 + 改后全文」**，不只是键和值。
- **只替换值本身**：行尾注释、缩进、其余每一行都原样保留。
  实测改一行 `VIP_CP`，`diff` 只有 `34c34` 一行，文件行数不变。
  那些注释就是这个文件的文档，整体重写会把它们全部抹掉 ——
  而抹掉之后的文件仍然「能用」，只是再没人知道为什么这么填。
- 写盘前留 `config.local.env.bak`。校验已经做过了，但备份防的不是「值不合法」，
  而是「我们自己把文件写坏」—— 那是两件不同的事。
- 审计记一条 `config-edit`，`detail` 是「哪个键从什么改成什么」。

**它不做什么**：**不自动生效**。改完只是文件变了，deploy.sh 是在每次启动时读它的。
具体要跑哪个阶段取决于改的是哪一项（见 `config.env` 里该项的注释），
所以界面只给不会错的建议：先 `./deploy.sh preflight` 看一遍。
刻意不在 Go 里写「键 → 该跑哪个阶段」的映射表：那是方案知识，
写在 Go 里就成了第二份定义，必然和 `config.env` 注释里那份漂移。

#### Go 侧的边界落在哪：一张命令表

§3.2 划的边界「控制台是否允许执行某操作 → Go」，实施后就是
`internal/api/commands.go` 里的一张表。它的字段刻意分成几个正交维度：

- `read_only`：这个命令改不改集群；
- `risk`：影响等级（`low` / `medium` / `high` / `destructive`），**只用于分级确认与呈现，不是安全边界**；
- `allowed`：**控制台当前允不允许从控制台发起**（由启动参数决定）；
- `requires_ack`：除确认影响面外还要手抄命令名（只有真正破坏性的操作）。

写操作全部 `read_only:false`，**并且照样列出来**，附上影响面文案。
理由就是 §四 那一条：用户看到一个没有按钮的界面，会自己去服务器上敲 `all` ——
那才是真正危险的，因为他不会有机会看到「`traefik` 会滚动重启入口」。

所以 `/api/commands` 把写操作连同影响面一起返回，界面照实展示「为什么这里没有按钮」；
`POST /api/run` 拒绝时返回 **403 + `command_not_allowed` + 影响面原文**，而不是一个通用错误。

另外把「命令存在」与「命令被允许」分成两个错误码：未知命令是 `400 unknown_command`，
存在但不放行是 `403 command_not_allowed`。两者的排错方向完全不同。

#### 命令表

| system | 命令 | read_only | risk | requires_ack |
| :--- | :--- | :--- | :--- | :--- |
| `k3s` | `verify` | ✅ | low | — |
| `k3s` | `preflight` | ✅ | low | — |
| `k3s` | `show-config` | ✅ | low | — |
| `k3s` | `topology` | ✅ | low | — |
| `k3s` | `consistency` | ✅ | low | — |
| `k3s` | `sudo-check` | ✅ | low | — |
| `k3s` | `kubeconfig` | ❌ | low | — |
| `k3s` | `prepare` | ❌ | medium | — |
| `k3s` | `apt-mirror` | ❌ | medium | — |
| `k3s` | `taint` | ❌ | medium | — |
| `k3s` | `server-first` | ❌ | high | — |
| `k3s` | `join` | ❌ | high | — |
| `k3s` | `kube-vip` | ❌ | high | — |
| `k3s` | `traefik` | ❌ | high | — |
| `k3s` | `rebalance-traefik` | ❌ | medium | — |
| `k3s` | `all` | ❌ | high | — |
| `k3s` | `uninstall` | ❌ | destructive | ✅ |
| `k3s` | `purge` | ❌ | destructive | ✅ |
| `k3s` | `restore-defaults` | ❌ | high | — |
| `passup` | `status` | ✅ | low | — |
| `passup` | `convergence` | ✅ | low | — |
| `passup` | `release` | ❌ | high | ✅ |
| `passup` | `uninstall` | ❌ | destructive | ✅ |
| `passup` | `purge` | ❌ | destructive | ✅ |
| `passup-fe` | `status` | ✅ | low | — |
| `passup-fe` | `verify` | ✅ | low | — |
| `passup-fe` | `release` | ❌ | high | ✅ |
| `passup-fe` | `uninstall` | ❌ | destructive | ✅ |
| `passup-ai` | `status` | ✅ | low | — |
| `passup-ai` | `verify` | ✅ | low | — |
| `passup-ai` | `release` | ❌ | high | ✅ |
| `passup-ai` | `uninstall` | ❌ | destructive | ✅ |
| `monitoring` | `preflight` | ✅ | low | — |
| `monitoring` | `render` | ✅ | low | — |
| `monitoring` | `verify` | ✅ | low | — |
| `monitoring` | `build-image` | ❌ | medium | — |
| `monitoring` | `label-node` | ❌ | medium | — |
| `monitoring` | `secrets` | ❌ | medium | — |
| `monitoring` | `tls` | ❌ | medium | — |
| `monitoring` | `apply` | ❌ | high | — |
| `monitoring` | `reload` | ❌ | medium | — |
| `monitoring` | `test-alert` | ❌ | medium | — |
| `monitoring` | `deploy` | ❌ | high | — |
| `monitoring` | `all` | ❌ | high | — |
| `monitoring` | `uninstall` | ❌ | destructive | ✅ |

`config-edit` **刻意不进这张表** —— 这张表的语义是「`deploy.sh` 的子命令」，
混进别的东西会让它不再可信，而「控制台认识哪些命令」这件事的全部依据就是它。
它在 Go 里是一个独立的 `consoleCapabilities` 列表，`AllowedWrites()` 把两者合并。

放行方式也**单独开**（`-allow-write=config-edit`）、不与写操作合并：有人只放行
`kubeconfig` 这种低风险命令，那份最小授权的意图不该被「顺手也能改配置」破坏 ——
改配置影响的是**之后每一次部署**，比跑一条命令的后果更长远。

#### 命令的限定名

命令在控制台内部以**限定名** `<system>/<name>` 为键（`passup/status`），
而 `CommandSpec.Name` 保持**裸名** —— 它是传给脚本的参数，脚本不认识 `passup/status` 这种写法。

- 白名单、审计日志、`ConfirmToken` 一律用限定名；
- `-allow-write` 接受限定名，也接受**唯一的**裸名（老配置 `kubeconfig,taint` 不用改就能继续工作）；
- 裸名有歧义时**显式拒绝**并提示写成限定名（`400 ambiguous_command`），而不是随手挑一个 ——
  挑错了会让用户以为在看 A 的判定，实际拿到的是 B 的。

> ⚠️ **重名已经发生了**：命令名与脚本阶段名一一对应（硬约束，不能靠改名绕开），
> 所以 k3s 与 monitoring 都有 `preflight` / `verify` / `all` / `uninstall`；
> k3s 与 passup 都有 `purge`；
> passup / passup-fe / passup-ai 都有 `status` / `verify` / `release` / `uninstall`
> （应用侧三个对象各一套「状态 / 验收 / 发布 / 卸载」）。
> 于是限定名 / 指纹含 `system` / 歧义拒绝这套机制不再只是「提前留着」——
> 它是当下每一条调用路径（前端、白名单、测试）都必须绕开的东西。
> `TestCommandNamesAreCurrentlyUnique` 守的也变成了「重名必须是**已知的那几个**」。
>
> ⚠️ **这张表刻意不写「一共几条」**：条数在这个项目里漂移过四次，而每次错都是
> 「文档看起来对、代码是另一个数」。条数以 `console/internal/api/commands.go` 为准 ——
> 改这张表之前先对一遍它（AGENTS.md §11 已有这条要求）。

### 8.3 P2：动作编排

`preflight` / `taint` / `traefik` / `all` 等带**影响面标签**（§四）、二次确认、实时日志流。

#### 影响等级：四档，只驱动呈现与确认

| `risk` | 含义 | 呈现 | 默认确认 |
| :--- | :--- | :--- | :--- |
| `low` | 只写本机文件，不碰集群 | 灰标签「低影响」 | 点了就跑（只读）/ 弹窗确认（写） |
| `medium` | 改节点或集群对象，但幂等收敛 | 蓝标签「中影响」 | 弹窗确认 |
| `high` | 会中断服务或重启 k3s | 黄标签「高影响」 | 弹窗确认，确认按钮 danger |
| `destructive` | 破坏性，且**不等于恢复出厂** | 红标签「破坏性」 | 弹窗确认 + **手抄命令名** |

`risk` **不是安全边界** —— 真正的边界是 `allowed`（放不放行）。
`risk` 只回答两件事：**上什么色**、**要不要更严的确认**。

颜色沿用与判定项同一套语义 token：界面上「低 = 没影响、高 = 有影响、红 = 不可逆」
应当是**同一个心智**，不管它是用来标记一个判定项还是一个动作。

#### 确认：分级而不是一刀切

确认阶梯由 `requires_ack` 决定，只有两档：

| 档 | 命令 | 界面要求 |
| :--- | :--- | :--- |
| **确认影响面** | 全部写操作（`kubeconfig` / `prepare` / `apt-mirror` / `server-first` / `join` / `taint` / `kube-vip` / `traefik` / `rebalance-traefik` / `all` / `uninstall` / `purge` / `restore-defaults` / `release`） | 摊开影响面原文，点确认 |
| **确认 + 手抄命令名** | `uninstall` / `purge` / `release` | 还要输入框里**原样敲一遍命令名** |

**为什么不统一成「确定吗？」**：如果 `all` 和 `verify` 弹的是同一个框，用户会养成
闭眼点确定的习惯 —— 而那个习惯恰好会在 `uninstall` 上出事。分级的目的是让确认**携带信息量**。
`requires_ack` 只留给真正破坏性 / 影响面最大的操作：如果什么都要抄，人就会闭着眼睛抄 —— 这个信号就废了。

`ack` 的校验在服务端：`strings.TrimSpace(req.Ack) != spec.Name` → `400 ack_mismatch`。

**确认必须在服务端校验**，不能只做在界面上：

- 界面上的确认是给人看的；
- Go 侧的校验是给「绕过界面直接打 API」看的。

两者都要有，但**只有后者是边界**。

#### 影响面指纹：把「确认」绑到具体内容上

每个命令都带一个 `confirm_token`，写操作必须把它原样回传才能执行：

```text
confirm_token = "sha256:" + sha256("v2\0<system>\0<name>\0<risk>\0<impact>")
```

**为什么要指纹，而不是弹个「确定吗」的框**：一个和内容无关的确认框只是在训练人点「确定」。
指纹把「确认」绑到具体那份文案上 —— 影响面文本一改（比如把 `traefik` 的影响面写得更准确了），
指纹就变，之前拿到的确认自动失效，调用方必须重新看一遍。
于是「我以为它只是重启一下」这种因为读了旧版文案而产生的误判，在结构上就不可能发生。

指纹里**必须带上 `system`**：两个受管对象可以出现同名命令，而重名命令的影响面通常完全不同。
不带 `system` 的话，一次针对 `k3s/<cmd>` 的确认会「恰好」匹配上 `passup/<cmd>` ——
那等于用一个对象的影响面文本，授权了另一个对象的改动。

`POST /api/run` 的三步：

```text
POST /api/run  {"command":"traefik"}                        → 428 confirm_required（附当前影响面与指纹）
POST /api/run  {"command":"traefik","confirm":"sha256:旧"}  → 409 confirm_stale（附新指纹）
POST /api/run  {"command":"traefik","confirm":"sha256:正确"} → 202
POST /api/run  {"command":"uninstall","confirm":"…"}         → 400 ack_mismatch（缺手抄命令名）
```

`handleRun` 的校验顺序是
`unknown_command`(400) / `command_not_allowed`(403) → `confirm_required`(428) →
`confirm_stale`(409) → `ack_mismatch`(400) → `busy`(409)。

#### `uninstall` 的「不会恢复什么」来自脚本原文

`uninstall` 的影响面文案（「只移除本方案管理的资源 —— k3s 本身未动、servicelb 仍是禁用状态、
已产生的 `svclb-*` 遗留资源不会自动回滚」）取自 `phase_uninstall` 的原文。
§四 说「脚本用文档写了，控制台要把它变成界面的一部分」—— 变成确认框里的一段话就是字面意义上的「一部分」。

`CONFIRM_UNINSTALL=yes` 由 Go 在放行之后注入，并且**刻意不下发到前端**：
前端不该也不需要知道这个开关。脚本的闸门仍然有效，而不是被控制台绕过去 ——
`TestGatedCommandsInjectTheirScriptGate` 把这条固定住：它把执行器换成一个会**记下收到的
Request** 的假执行器，逐个跑过 `uninstall` / `purge` / `release`，断言那个 `CONFIRM_*`
确实出现在子进程的环境里（本仓的测试脚手架是 Go 侧的 fakeExec，所以做法是记 Request，
而不是原文说的「回显环境变量的桩脚本」——语义等价）。
`release` 同理（`PASSUP_RELEASE_CONFIRM=yes`）。

> ⚠️ 这张环境变量表的键**必须用限定名**（`k3s/uninstall` / `k3s/purge` / `passup/release` /
> `passup/uninstall` / `passup/purge` / `passup-fe/release` / `passup-fe/uninstall` /
> `passup-ai/release` / `passup-ai/uninstall`），
> 与 `AllowedWrites()` / `Token()` 的口径一致。用裸名会让同名命令静默串味。
> `TestWriteEnvKeysAreQualified` 守着这一条。

#### 写操作串行，且写期间只读也一并拒绝

`taint` 和 `traefik` 同时跑，结果不是「更快」，而是两个进程按各自的节奏改同一批节点对象 ——
那种状态连排错都无从下手。所以 `Manager` 持一个 `exclusiveID`，第二个写操作拿到
**409 `busy`**。

**写操作期间只读命令也一并拒绝**：写操作跑到一半时读出来的状态是**中间态**，
拿它做判断只会误导人。界面如实反映这一点（所有按钮都禁用并说明原因），
而不是让用户点下去才发现。

被拒时返回 409 `busy`，并**带上挡住它的那个任务**：只说「忙」的报错会让人反复重试，
说清「被 verify 挡住了」才知道该等还是该取消。

#### 取消：是 `cancelled`，不是 `failed`

`POST /api/tasks/{id}/cancel` 杀掉脚本进程。它单列一个状态，因为**用户看到的文案完全不同**：

- `failed`：脚本自己坏了 → 去查日志；
- `cancelled`：人按了取消 → 「**不会回滚已经做完的步骤**，集群可能停在中间状态；
  `deploy.sh` 的每个阶段都是幂等的，重跑对应阶段即可收敛」。

把它归成 `failed` 会让人以为是脚本的问题，去查半天日志。

`Cancel()` 只对「正在跑」的任务有效。每个任务从 `Manager` 的父 ctx 派生自己的子 ctx，
**不能用 HTTP 请求的 ctx** —— `verify` 要跑几分钟，请求早就返回了。

#### 部署级闸门：`-allow-write=false`

启动参数。留空时整台控制台是只读模式：`/api/commands` 会把写操作的 `allowed`
改写成 `false`，所以界面上**根本不会渲染出可点的执行按钮**，而不是点了才报错；
直接打 API 也得到 403。

这一层存在的理由是部署形态：把控制台放到一台别人也能访问的机器上时，
不必指望界面上的确认弹窗。

#### 审计日志

写操作结束时追加一行 JSON Lines：

```json
{"time":"2026-09-26T00:13:20+08:00","command":"kubeconfig","task_id":"6ab9a845…",
 "status":"failed","exit_code":1,"remote_addr":"127.0.0.1:63963",
 "confirm":"sha256:5157e50a…","summary":{"ok":11,"warn":0,"error":1,"skip":1},
 "note":"脚本中途中止，协议是残缺的 —— 脚本在第 1182 行意外中止…"}
```

- **只记写操作**：审计要回答的是「谁在什么时候把集群改成了什么样」。
  把每次刷新都会跑的 verify 也记进去，只会把真正要看的那几行淹没。
- `confirm` 是这份记录里最有价值的一列：它证明「当时看到并确认的是哪一版影响面」。
- 格式选 JSON Lines 是因为它同时满足两个矛盾的需求：人可以直接 `tail` 着看，
  机器可以逐行解析 —— 不需要为「给人看」和「给工具读」写两份。
- 立刻 `fsync`，不加缓冲：审计日志「稍后写」等于「崩溃时不写」，
  而崩溃时丢掉的那几条恰恰是最要紧的。
- 写入失败会往 stderr 吵一声 —— 它意味着「改了集群但没留下记录」，不能静默。

#### 前端：动作清单从「说明」变成「操作」

- 按 `read_only` 分两组（只读 / 写操作），每组带一句话提示；
  写操作按 `risk` 上标签色，破坏性的按钮是 danger 样式。
- 新增**「影响等级」列**：它让用户在**点之前**就能看出 `uninstall` 比 `verify` 贵。
  把阶梯藏进弹窗里就晚了 —— 那时人已经决定要点了。
- 点执行后弹确认框（影响面原文 + 必要时的手抄输入框），确认后**执行面板**自动打开：
  实时日志 + 结果 + 中止按钮。
- 执行槽位放在 store 而不是组件里：`all` 要跑几分钟，用户中途切去看拓扑是很自然的事。
  组件卸载会断掉 SSE 订阅，但脚本挂在 Go 的 Manager 上下文上照跑；
  回来时凭 `taskId` 重新订阅，服务端会把缓冲的日志整段重放
  （`Task.Subscribe` 在同一把锁里原子地取「已缓冲日志 + 实时通道」）。
  重放意味着本地**必须先清空日志**，否则会看到重复行。
- 只读视图也补上了「中止」：`verify` 要跑几分钟，只有写操作能停是没道理的。
- 执行结束后日志会自动收起 —— 目的是让结论（判定项 / `data`）不用滚屏就能看到。
  但有三种情况**不收起**，因为那时日志就是排查依据：执行**失败**、被**取消**、
  执行成功但**拿不到协议**。另外，你手动动过那个开关之后就不再自动收起。

### 8.4 P3：补齐方案验收

**P3 = 只做一件事：把 §七 里还开着的方案验收补完。**

全部落在 **`preflight`**，新增 3 个判定项、3 个纯函数、2 个远端探测：

| 节 | 判定项 | 实现 | 离线可测的纯函数 |
| :--- | :--- | :--- | :--- |
| §7.1 | `registry.port_reachable` | 逐台逐端口 `curl --noproxy '*' -sI .../v2/`（**在节点上跑**） | — |
| §7.2 | `node.spec` | 一次 SSH 取 `VERSION_ID` / `nproc` / `MemTotal` | `ver_ge` / `num_ge` / `node_spec_verdict` |
| §7.3 | `vip.free` / `vip.same_subnet` | 逐台 `ping` + `ip route get` + `ip -4 -o addr show` | `route_is_onlink` |

- 下界是**配置项**（`NODE_MIN_OS_VERSION` / `NODE_MIN_CPU` / `NODE_MIN_MEM_GIB`），不是写死的阈值。
- §7.2 与 §7.3 共用一轮 SSH（`node_probe` 一次把规格与 VIP 视角都取回来）。
- 三项的等级都是 `warn`（工具缺失 / 探测不到时是 `skip`），与 `k3s.download_proxy` 同策略 ——
  **不阻断，但一定如实显示**。

**为什么把「指标」划出去**：因为**它本来就是 P5 的第一步，不是 P3 的后半。**
落到实现上，「接 Prometheus API」就是「给运行态总览页准备数据」——
而这正是 §8.8 的落点。而且 §5.3 早已把 `client-go` 定成**可选项**：
首页需要的对象态用 `deploy.sh` 现有的 kubectl 通道就能拿，
不必为此引入 K8s 客户端库 —— 所以 **P5 的第一版不接 `client-go`**。

顺序不能反：**方案验收补齐后，方案态才有资格显示成绿的** —— 否则「面板全绿」和「真的正常」
仍然是两件事（这正是 §一 里「看起来一切正常」的另一种形态）。
注意这条**约束的是「怎么显示」，不是「能不能做 P5」**。

#### 硬承诺：方案态必须如实标注未纳入项

§7.1~§7.3 覆盖了，但落在 `preflight`，而 `verify` 的 16 项**仍然不含它们**。
所以：**「16/16 ✓」的准确含义仍然是「已实现的 16 项全绿」，不是「方案没问题」。**

展示方案态时必须同时说明两件事：① 这三项由 `preflight` 覆盖；
② **本次 preflight 跑没跑过**（没跑过就是**未知**，不是通过）。
这是「读不到 ≠ 默认值」在**面板**上的形态。

**为什么这三项不进 `verify`（这是设计，不是遗漏）：**

`verify` 是**部署后验收**，而这三项都是**部署前**属性。尤其 `vip.free` ——
`verify` 跑的时候 VIP 已经被 kube-vip 自己占着，这一项在 `verify` 语义下**永远不可能通过**。
硬塞进去只会造出一条恒假的判定项，然后逼着人去给它加例外，最后变成「反正它总是红的」。
**宁可让它待在 preflight，也不要造一条永远红着的项。**

### 8.5 Go 后端的结构：刻意保持薄

```text
console/
├── main.go                     启动、参数、内嵌前端
├── internal/
│   ├── protocol/               结果协议的类型与解析（只有「协议长什么样」）
│   ├── executor/               把 deploy.sh 当子进程跑，按行分流 stdout/stderr
│   ├── task/                   任务状态机：running/done/failed/cancelled + 并发策略
│   ├── audit/                  写操作留痕（JSON Lines）
│   ├── auth/                   令牌校验（Bearer 或 ?token=）
│   ├── metrics/                运行态只读客户端（Prometheus / Alertmanager / Loki）
│   ├── configfile/             保留注释的逐行编辑 config.local.env
│   └── api/                    命令表 + 放行策略 + 确认协议 + HTTP 路由 + SSE
└── web/                        React 19 + TS + antd 6 + Vite
    └── src/
        ├── api/                协议类型镜像 + fetch/SSE 封装
        ├── components/         标签、汇总条、判定项表、数据渲染、执行面板、确认框
        └── views/              7 个视图
```

`configfile` 这个包值得单说一句，因为它的存在方式本身是个设计结论：
**它不是「解析配置」的包，而是「替换某一行的值」的包。**
如果做成「解析成 map → 改完序列化回去」，`config.local.env` 里那些注释
（为什么这么填、踩过什么坑）会被全部抹掉 —— 而抹掉之后的文件仍然「能用」，
只是再没人知道为什么这么填。

它也不含任何方案判定：不校验 VIP 是否合法、不知道 `NODES` 是什么。
那些整包交给 `deploy.sh`。**它只负责「把这一行的值换成那个字符串，别动别的」。**

**不要**铺成这样：

```text
domain/  application/  infrastructure/
repository/  kubernetes/  cluster/  deployment/  ...
```

后者是「一个业务后端」的形状，而这个项目本质上是一个**控制层**——
它自己不持有领域模型，领域模型在 `deploy.sh` 和 `config.env` 里。
照 DDD 分层铺开，很容易把一个本该很薄的控制层重新做成一个复杂后端，
而且会诱使你把 §3.2 明令禁止的方案判定逻辑搬进来（有了 `domain/cluster/` 就会想往里放东西）。

### 8.6 实现顺序

```text
① 改 deploy.sh：verify --json / preflight --json      ✅ P0
        ↓
② CLI 自己验证 JSON（此时还没有任何 UI，但协议已被真实使用）  ✅ P0
        ↓
③ Go 最小 API（exec + SSE）                            ✅ P1
        ↓
④ React 只读首页                                       ✅ P1
        ↓
⑤ P1 跑通                                             ✅ P1
        ↓
⑥ 再做 P2 的执行按钮                                   ✅ P2
```

**最关键的一条：不要先做 UI。**

真正的第一步是**把 `deploy.sh verify` / `preflight` 做成稳定的机器可读结果协议**。
协议一旦稳定，后面的 CLI、Go、React、AI、日志、监控**都只是消费者**。

这也正是本方案与「给脚本套一个网页」的分界线：
先有协议，再有界面；而不是先有界面，再想办法从彩色文本里抠信息。

**⑥ 之所以放在最后，还有另一层理由**：写按钮会**逼你去验证写通道**，
而那一步才暴露了 `phase_kubeconfig` 一直在「报告成功但什么都没做」（见下）。
换句话说，**只读界面永远发现不了这个缺陷**：它只消费结果，不执行动作。

#### 写操作「报告成功但什么都没做」—— 一个必须写进方案的陷阱

验证写通道时发现 `phase_kubeconfig` 会**打印「已写入」并返回 0，而目标文件一个字都没改**。

根因有两层：

1. **`main` 里的 `case ... || rc=$?` 让 `set -e` 在阶段内部整体失效。**
   那一层是刻意加的（`verify` 判定不通过要 `return 1`，而不是在 `emit_json` 之前退出），
   但 bash 对 AND-OR 列表有豁免：位于 `||` 左边的命令，其 `set -e` 被忽略，
   **而且这个豁免贯穿整个调用树**。所以「命令失败会自动停」这个假设在 `phase_*` 内部不成立。
   （最小复现：函数里写 `false`，它后面的语句照样执行。）
2. `phase_kubeconfig` 原本用 `sed -i` 且**不看退出码**。`sed -i` 内部是
   「写临时文件 + rename」，rename 被拒时（受控目录 / 只读挂载 / 沙箱）原文件不改，
   却在同目录留下一个**含集群凭据**的临时文件 —— 实测权限是默认的 `644`。

后果正是本方案要消灭的那种「看起来一切正常」：控制台会把一次什么都没做的写操作显示成「完成」。

改法：这个阶段的每一步都显式检查退出码，失败时 `die` 出带
`DIE_ID` / `DIE_SOURCE` / `DIE_FIX` 的 error 判定项（5 个 id：
`kubeconfig.fetch` / `.rewrite` / `.vip` / `.chmod` / `.replace`），
并且不再用 `sed -i`，改成「显式临时文件 + `mv`」；`mv` 是唯一的原子替换步骤。
另外补了一条「改写后必须真的出现 VIP」的检查 —— 否则正则会安静地写出一份指向
**节点 IP** 的 kubeconfig：平时能用，一换主就断，而且看不出是哪一步出的问题。

⚠️ **同一类问题在其他阶段仍然存在**：任何 `remote_script` 调用的失败都不会中止阶段。
这次只修了被证明坏掉的那一处（它恰好是 P2 暴露给用户的写操作），
`main` 里加了注释说明这个陷阱，`selftest` 也加了一条静态断言防止它被改回去。

### 8.7 P4：第二类受管对象 —— PassUp

**决策：要加，但作为「第二类受管对象」，而不是把 PassUp 塞进 `deploy.sh`。**

现在控制台管的不止一套方案，**各自持有自己的事实来源与验证协议**：

```text
控制台
├── 受管对象：K3s 基础设施方案
│     k3s-ha/deploy.sh  →  verify --json
├── 受管对象：PassUp 后端
│     passup/deploy.sh  →  status / convergence --json
├── 受管对象：PassUp 前端（2026-10-05 接入，与后端平级）
│     passup-fe/deploy.sh  →  status / verify --json
│     （只读 status 看集群侧；verify 加端到端：对象存储匿名读 / 入口 / chunk 可达）
├── 受管对象：PassUp AI 服务（2026-10-05 接入，与后端/前端平级）
│     passup-ai/deploy.sh  →  status / verify --json
│     （status 看集群侧；verify 加端到端：经 API server 的 Service 代理打 /resume/health。
│       ⚠️ 探针只证明进程活着，**不**证明 LLM 配得对 —— 密钥/模型名要真正调用才暴露）
└── 受管对象：监控栈（第三类，2026-10-04 接入）
      monitoring/deploy.sh  →  preflight / verify --json
      （其余阶段是「动作」：只有实时日志，items 为空）
```

> **为什么前端要单开一个对象，而不是并进 `passup`**：事实来源在另一个仓库
> （`pass-up.frontend`）、工具链不同（前端还要 `node/pnpm` 构建 + `mc` 传对象存储 +
> `docker` 推镜像）、失败模式也不同 —— 后端最典型是「Pod 没 Ready」，
> 前端最典型是**页面 200 但 JS 取不到 → 白屏**（`index.html` 在镜像里、chunk 在对象存储里，
> 两者可以一个通一个不通）。合并会让 `passup/deploy.sh` 那条「只有 release 允许写」的
> 边界变模糊。
>
> 它也是 §8.7「接新对象的前提是脚本认得 `--json`」的第二次实践：`passup-fe/deploy.sh`
> 一开始就带协议层，所以接入本身没有额外前置工序。代价是**命令名与后端重名**
> （`status` / `verify` / `release` 各一套），于是前端、白名单、测试必须全程用限定名
> （`passup-fe/status`）—— 这与 k3s / monitoring 之间 `preflight` / `verify` / `all` /
> `uninstall` 重名是同一类问题，处理方式也相同。

> **AI 服务为什么也要单开**（与前端同构，第三次实践）：事实来源在另一个仓库
> （`pass-up.ai`）、工具链不同（发布还要 `docker` 构建 Python 镜像）、失败模式也不同 ——
> 它最典型的是**Pod 起来了、探针也过了，但密钥/模型名配错，一调 `/resume/parse` 就 500**。
> 它同时把「探针的边界」这件事摆到了台面上：`/resume/health` 只证明「uvicorn 活着、能应答」，
> 证明不了密钥 / 模型名 / LLM 基址 / 配额 —— 所以控制台那一页必须把这句话写出来，
> 而不是让一条绿线看起来像「AI 功能可用」。
> 它**刻意没有 `purge`**（与前端「没有对象可删」不同，这边是「删了也不改变风险面」：
> Secret 里只有一个 LLM key）—— 名不副实的命令比没有它更坏。

控制台只负责统一消费这些协议。**第一版不改名、不扩范围** ——
「K3s 方案控制台」这个名字先留着。

> ⚠️ **接第三类受管对象暴露出一道前置条件**：脚本必须认得控制台传的 `--json`
> （executor 无条件追加它）。`monitoring/deploy.sh` 原本会把 `--json` 当成未知阶段
> 直接 `exit 2` —— 所以先给它补了协议层（`preflight` / `verify` 产出判定项，
> `build-image` / `apply` / `reload` 这些动作阶段 items 为空），才谈得上接命令表。
> 这也解释了它为什么拖到现在才被接进来。
>
> 顺带定下一条命令命名约定：`all` = **含构建镜像**的完整流程，`deploy` = 只部署不碰镜像。
> 两者共用一个阶段组合定义（`phase_deploy`），避免「往部署链里加一步、另一条命令静默少跑」。

#### 为什么不能塞进 `deploy.sh`

```text
deploy.sh
  ├── k3s
  ├── kube-vip
  ├── traefik
  ├── monitoring
  └── passup        ← 不要这样
```

`deploy.sh` 是「K3s 方案」的事实来源。一旦它开始管 PassUp，它就会重新长成一个**巨型总管**，
而 §3.2 那条边界（判定归 Bash）会随之变模糊 —— 因为「Bash 现在管两件事」，
「哪件事该由 Bash 判定」就说不清了。

正确形态是**每个受管对象自己带协议**，控制台做统一的消费者。
这和 §三 的边界并不冲突：判定仍然全在 Bash，只是从「一个脚本」变成「一组脚本」。

#### 硬边界：控制台不许理解 PassUp 的业务代码

```go
// 明确禁止出现这种代码
if passupBackendReady && redisReady && minioReady && flywayVersion == xxx { ... }
```

理由与 §3.2 完全同源：**判定留在脚本里**。PassUp 的状态判定写在 `passup/deploy.sh` 里，
控制台只消费它的 `--json`。否则这套规则会散落在 Go 里，既无法被 CLI 复用，也无法被测试。

#### 协议统一：顶层加一个 `system`

现有协议顶层是 `phase` / `summary` / `items`。要让两个受管对象共用一个消费端，
顶层加 `system`（`k3s` / `passup`），并且**命令表加一个 `system` 维度** ——
因为脚本路径不再唯一（`-script` 从一个变成两个，新增 `-script-passup`）。
执行器持 `Scripts map[string]string`，**认不出的 system 直接拒绝**，不退回默认脚本
（退回默认 = 悄悄在错的脚本上跑命令）。

#### 实际落地形态

| 部件 | 说明 |
| :--- | :--- |
| `cluster-infra/passup/` | `config.env`（模板，含【环境相关】标记）/ `config.local.env.example`（清单）/ `deploy.sh`（事实来源）/ `tests/selftest.sh`。目录结构与 `k3s-ha/` 同构，配置分层约定照搬 |
| `passup/deploy.sh` 只读命令 | `status` / `convergence` / `show-config` / `verify`，协议形状与 `k3s-ha/deploy.sh` 逐字段一致，直接复用同一个消费端 |
| `passup/deploy.sh` 写命令 | `release`（见下）/ `uninstall`（删 Deployment + Service，保留 Secret/ConfigMap 与命名空间）/ `purge`（再连 Secret/ConfigMap 一起删，⚠️ 凭据会丢） |
| `passup-fe/deploy.sh` 写命令 | `release` / `uninstall`（删两个站点的 Deployment + Service、Ingress 与它引用的 Middleware）。**刻意没有 `purge`** —— 前端在集群里没有自己的 Secret/ConfigMap，对象存储那份资源又不删，那条命令会是空壳 |
| `passup-ai/deploy.sh` 写命令 | `release`（构建双 tag → 推仓库 → 写 Secret/ConfigMap → apply + `set image` → 等 rollout → 收尾探测）/ `uninstall`（删 Deployment `resume-ai` + 同名 Service，保留 ConfigMap/Secret 与命名空间）。**刻意没有 `purge`** —— 与前端「没有对象可删」不同，这边是「删了也不改变风险面」（Secret 里只有一个 LLM key） |
| 控制台页面 | `/apps/passup` / `/apps/passup-fe` / `/apps/passup-ai`，左侧导航改成两级：**集群**（状态/拓扑/配置/配置一致性/操作）+ **应用**（PassUp 后端 / 前端 / AI 服务） |

`status` 的 `data`（读到了什么）：副本期望/实际四元组、image + tag + **digest**、
三条探针路径、Secret/ConfigMap 存在性、Pod 列表（name/phase/node/ready/restartCount）、
外部依赖三元组。`items` 仍然只说「符不符合要求」。

#### 发布策略：双 tag + 版本注解

「期望版本」不能用镜像 tag 表达 —— 实测：注册表里 `latest` 的 digest **精确等于** Pod 的 imageID，
而 `latest` 是同一个 tag，**「滚动发布完成」和「代码压根没生效」在字面上完全相同**。
所以发布流程必须引入 tag 之外的版本标识：

```text
源码目录 ──git rev-parse --short=8──> 版本号（如 8020e086）
              │
              ├─ docker build -t <repo>:8020e086 -t <repo>:latest
              ├─ docker push  <repo>:8020e086   ← 部署用这个
              ├─ docker push  <repo>:latest     ← 留给本地 compose
              │
              └─ kubectl patch deploy/… --type=strategic   ← 一次 patch 同时改：
                    spec.template.metadata.annotations:
                        passup.io/version = 8020e086
                        passup.io/commit  = <full sha>
                        passup.io/built-at = <iso>
                    spec.template.spec.containers[0].image = <repo>:8020e086
                 （回读校验注解真的落在 Pod 模板上）
                 kubectl rollout status deploy/… --timeout=600s
```

- ⚠️ **注解必须写在 Pod 模板上**（`spec.template.metadata.annotations`），
  不能用 `kubectl annotate deploy/…`（后者写的是 Deployment 自己的 metadata，
  而 `convergence` 读的是 Pod 模板 → **写完读不到**，且不触发滚动）。
  所以用**一次 `kubectl patch --type=strategic`**，路径显式写出来，
  按容器名定位镜像（配置键 `PASSUP_BACKEND_CONTAINER`），
  并**加回读校验**：patch 后回读注解必须等于期望值，否则报 `reason=annotation_mismatch`。
  **写通道自称成功不算成功。**
- **版本号用短 SHA 而不是硬造 `v0.0.N`**：后端仓库实测**零 git tag**。
  硬造一个版本号只是把「没有版本体系」这件事藏起来 —— 短 SHA 是当前唯一诚实的选择。
- **工作区 dirty 时报 `warn` 而不是 `error`**：开发期确实需要发布未提交的改动，
  但必须说出来 —— 否则「`8020e086` 对应的镜像」这句话是假的。
- **发布失败不自动回滚**：镜像已推的留在仓库里，可控的是 `--skip-build` 重试或
  `kubectl rollout undo`。脚本**没有任何 delete / scale 动作**。
- **确认通道是环境变量而不是参数**：`--yes`（人手动）与 `PASSUP_RELEASE_CONFIRM=yes`（控制台注入）等价。
  控制台**只注入环境变量**，不拼 `--yes` —— 参数是前端可控的字符串，环境变量那条通道前端碰不到。
- **`--dry-run` 必须给出「完整计划」**：`image` / `namespace` / `commit` / `branch` / `dirty`
  一个都不能少，否则确认框成了盲确认；dry-run 还会探一次集群可达性
  （失败报 `warn`，不阻断，但如实说出来）。
- `k8s/overlays/k3s` 的 `images` **不许有 `newTag`**：留着它会与 `patch` 打架
  （`apply` 会把 tag 拉回 latest）。

#### 两个必须先定、且已经定下的问题

**① 写串行是全局的。** 现在是一把全局锁。PassUp 发布要 `kubectl apply`，
K3s 的 `taint` / `all` 也要动同一个集群 —— 这两个**应该互斥**。
第一版保持全局锁（简单、保守），等真的被挡住再按对象细分。

**② PassUp 的「状态」里，PostgreSQL / Redis / MinIO 根本不在集群里。**
它们跑在宿主机 Docker 上，`pass-up.backend` 仓库里**没有**被引用的
postgres / redis / minio 清单（曾经留在 `k8s/deps/` 的那份已于 2026-10-05 删除，
它引用的三个清单文件早已不存在、从未跑通过，见 [PassUp 后端 K8s 部署清单](./PassUp后端部署清单.md) 第五节）。
所以状态视图里这几项的正确来源是**宿主机 Docker**，不是 k8s 对象 ——
照搬 `kubectl get pods` 会得到「查不到」，而「查不到」和「不健康」是两回事。

→ 实现上 `passup.dep.{postgres,redis,minio}` 只做 **TCP 可达性**，地址为配置键
（`PASSUP_DEP_*`），**地址为空时整项 `skip`**，并在文案里写明
「依赖跑在宿主机 Docker 上，是长期形态不是过渡态」。
能不能真用（密码对不对、库在不在）由应用自己回答 —— 集群外面判不了。

#### 两条必须如实显示的「读不到」

- **`skip` 在这个对象上格外重要。** PassUp 有三类「读不到」：
  集群不可达、依赖未配置（地址为空）、版本标识未约定。
  这三件事都不能显示成「正常」，也不能显示成「异常」。界面上它们全都是**虚框灰标签「未执行」**。
  「集群不可达」时相关判定项一律 `skip` 而不是 `error` —— 脚本连不上集群时如实报告，
  而不是把「读不到」当成「读到了坏消息」。
- **探针链路是健康的，但它是空转的 —— 这个区别必须显示出来。**
  集群事件里能看到 `Startup probe failed: connection refused` → 随后通过 → Ready，
  说明探针**本身工作正常**。但探针指向 `/actuator/health*`，
  而该路径**不在应用的安全白名单里**（返回 HTTP 200 + `{"code":401}`）——
  k8s 探针只看状态码，所以它永远通过：**数据库挂了 Pod 照样 Ready**。
  这是应用侧的已知问题，不是集群或控制台能在外面修的。
  所以有判定项 `passup.backend.probes_trustworthy`，把「READY 这一列的可信度」
  如实标出来，而不是假装没看见。

#### 回滚 ≠ 迁移回退

⚠️ **`回滚` 和 `迁移回退` 是两件事，界面上必须分开写。**
数据库迁移（Flyway）**没有**真正的回滚；能回滚的是镜像版本。
把两者合成一个「回滚」按钮，等于给出虚假的安全感 —— 这正是 §四 要防的东西。

> 首次真实发布时 `release` 报失败，原因是 Flyway V25 checksum mismatch
> （DB 里的 V25 与仓库里的 V25 文件不是同一版 —— 后端源码与开发库之间的历史不一致）。
> 这是**后端仓库侧**的问题，集群、控制台、镜像全都无关。
> Flyway 的校验在这里是**好事**：它把「源码与库漂移」如实拦下了。
> ⚠️ **不要在 k3s 侧关掉 validate 来绕过** —— 那是把一致性问题藏起来。

#### P4 的价值：一条完整的验证链

K3s 单独看，更像一个「基础设施验收工具」。接上 PassUp 之后才形成完整的一条链：

```text
机器 → 集群 → 基础设施 → 应用 → 用户入口
```

即 `Node → K3s HA → kube-vip / Traefik → PassUp → Backend / AI → PostgreSQL / Redis / MinIO → 外网入口`。

这条链上任何一环断掉，「整体状态」都不该是绿的。**这才是本项目一开始要回答的那个问题。**

### 8.8 P5：运行态总览页

#### 起因：一个看起来新、其实是 P3 展开的提议

提议的原话是「Grafana 不是天然好用的 K3s 驾驶舱，不如自己做一个很薄的 Dashboard，
把 Prometheus 的数据接过来，一屏看懂整个集群」。方向采纳，但**落点要修正**：

- 本项目**已经有控制台**（`console/`），已经有状态页 / 拓扑页 / PassUp 页。
  所以这不是「再做一个 Dashboard」，而是**给既有控制台补上第二、第三类数据源**。
  **不新建 `k3s-console/`，不新建仓。**
- 这件事就是 **§8.4 的 P3** 的展开：「校验补齐后指标才有意义 ——
  否则『面板全绿』和『真的正常』仍然是两件事」。

#### 三类事实来源，三种语义

有一张流传的「Grafana 能不能看到」的表，其中四行在本监控栈里**做不到**：

| 声称 Grafana 能 | 本栈实际情况 |
| :--- | :--- |
| 节点是否 Ready | ❌ 需要 kube-state-metrics |
| Pod 数量 | ❌ 同上 |
| Deployment 副本数 | ❌ 同上 |
| Pod 是否 Pending | ❌ 同上 |

原因是硬性的：**监控方案明确拒绝引入 kube-state-metrics**
（《可观测性栈 k3s 部署方案》§5.1 阈值 `3` 写死的理由、§六「不要再扩大范围」）。
没有 KSM 就没有 `kube_node_status_condition` / `kube_deployment_status_replicas` / `kube_pod_status_phase`。
Prometheus 现有的 10 个 target 是 node-exporter×3 / alloy×3 / loki / alertmanager /
prometheus / grafana —— **全是「资源」和「自身」，没有一个是「对象状态」。**

这不是缺陷，是一条必须承认的分工。它给出了整个页面的骨架：

| 问什么 | 谁回答 | 语义 |
| :--- | :--- | :--- |
| 这套方案现在对不对？ | `deploy.sh`（verify / status / convergence） | **判定**：ok / warn / error / skip |
| 有几个对象、在不在？ | Kubernetes API（kubectl / `deploy.sh`） | **存在 / 数量 / 相位** |
| 用了多少、有无告警、日志说了什么？ | Prometheus / Alertmanager / Loki | **数值 / 时间序列** |

**硬约束：三类并列展示，不合并成一句「正常」。** 一旦合并，就等于在 UI 里
复制了一份方案判定（§3.2 明令禁止），而且是用最弱的那一路数据去替另外两路背书。

#### 它是「驾驶舱」，不是「监控大屏」

布局是六区，但更该记住的是**信息层次**：首页只回答三个问题，答完就把人送走。

```text
① 现在有没有问题？
     方案   ✓ 已实现的 16 项通过 · ⚠ 3 项尚未纳入方案验收（§7.1 / §7.2 / §7.3）
     运行   ✓ 3/3 节点采集正常 · ✓ PassUp 3/3 · ⚠ 1 个告警

② 如果有问题，在哪？
     Node k2     CPU 82%   内存 91%
     PassUp      错误率 ↑
     Alert       BackendMemoryHigh

③ 点进去看细节（跳出去，不在本页做）
     节点 / K8s 对象  →  kubectl / API
     方案问题         →  deploy.sh verify
     告警             →  Alertmanager
     日志             →  Loki
     趋势 / 历史      →  Grafana
```

**第 ③ 步是关键：首页不承接细节，只负责指路。** 一旦它开始承接细节，就会长出
时间选择器、图表、过滤器和钻取 —— 然后变成第二个 Grafana，而那个方向 §8.8 与 §十 都已否掉。

注意第 ① 步里方案态那行**不是**「16/16 ✓」，而是「已实现的 16 项通过 + 3 项尚未纳入」——
这正是 §8.4 末那条硬承诺在界面上的样子。

#### 一屏六区

```text
┌──────────────────────────────────────────────────────────────┐
│ 全局状态条  方案态 16/16 ✓ · 运行态 Prometheus 可达 · 告警 0    │
├──────────────────────────────────────────────────────────────┤
│ 节点     Node / 采集 / CPU / 内存 / 磁盘                       │
├────────────────────────────────┬─────────────────────────────┤
│ 业务 PassUp（可采集副本 / 目标） │ 告警                        │
│                                │ firing / pending + 持续时长  │
├────────────────────────────────┼─────────────────────────────┤
│ 拓扑    3 节点 + 污点落点 + 副本 │ 最近错误   Loki 最近 ERROR  │
└────────────────────────────────┴─────────────────────────────┘
```

宽窄不是随便分的：宽的两块是表格与拓扑（固定形状、需要横向空间），
窄的两块是列表（条数不定、纵向滚动）。

**拓扑区直接复用已有的 `TopologyView` 实现** —— §5.4 早已定过「拓扑用手写 SVG / 纯 CSS，
不用图库」，那正是它现在的做法。

#### 落地形态

| 部件 | 文件 | 说明 |
| :--- | :--- | :--- |
| 只读客户端 | `console/internal/metrics/` | Prometheus `Vector` / `Instant`、Alertmanager `Alerts`、Loki `RecentErrors` |
| 数据出口 | `console/internal/api/overview.go` | `GET /api/overview`，**永远 200** |
| 页面 | `console/web/src/views/OverviewView.tsx` | 六区里的四区（节点 / 业务采集侧 / 告警 / 最近错误） |
| 参数 | `-prometheus` / `-alertmanager` / `-loki` | 留空 = 不接，界面显示「未配置」而不是 0 |

**四条不可退让的设计点**（都写了测试守着）：

1. **`Present` 与 `Value` 必须分开。** Prometheus 查不到序列返回的是**空结果**，不是 0。
   渲染时 `present=false` 画「—」，绝不画数字。`TestInstant_AbsentIsNotZero` 同时断言
   「没查到 → `Present=false`」与「查到 0 → `Present=true, Value=0`」——
   **只测前者是不够的**，那样会把「真的 0」也误判掉。
2. **只读是结构上的。** `metrics.Client` **只有 GET**，`TestClientOnlyIssuesGET`
   遍历三种查询逐个断言方法名。
3. **接口永远返回 200。** 数据源全挂是这条接口要**报告的**事实，不是它自身的失败。
   用 5xx 表达只会让前端显示「加载失败」，把「监控栈挂了」这条真正有用的信息丢掉。
4. **`warnings` 字段是最要紧的字段。** 没有它，一个全空的 Overview 和一个全绿的
   Overview 在界面上长得一模一样。每一处读不到都要在这里留一句人能看懂的话
   （例如「告警数未知，不是无告警」）。

**「没配」与「连不上」全程分开**：前者是部署决策（不用管），后者是故障（要去修）。
`SourceStatus` 用 `Configured` 与 `Reachable` 两个字段分列，启动日志也逐个打印配没配。
混成一句「不可用」，人就不知道要不要去修。

#### 逐区降级规则

其余都是取数与摆位，**这一张表才是把 §一「看起来一切正常」挡在门外的东西**：

| 区 | 读不到时显示 | **绝不能显示** |
| :--- | :--- | :--- |
| 全局条·方案态 | `verify 未执行` / `上次 3h 前` | 绿 |
| 全局条·运行态 | `Prometheus 不可达` | `0 告警` |
| 节点·CPU / 内存 / 磁盘 | `—`（无序列） | `0%` |
| 节点·采集 | `未知（无序列）` | `✓` |
| 业务·副本 | 交给 `convergence` 的判定 | 首页自算的 `3/3` |
| 业务·版本 | `无 passup.io/version 注解` | `已发布` |
| 告警 | `Alertmanager 不可达` | `无告警` |
| 最近错误 | `Loki 不可达` | `无错误` |

⚠️ **「业务·副本」与「业务·版本」两行不能由首页自己算。**
它们已经有 `passup/deploy.sh convergence` 在做判定，首页只能消费它的结论 ——
这与 §3.2 的硬约束是同一件事，只是换了个页面。
`count(up{job="passup-backend"} == 1)` 数的是**能被采集到的副本数**，
不是 Deployment 的期望副本数 —— 拿它当「副本数 3/3」用会得出错误结论。

⚠️ **`无序列 ≠ 0`。** Prometheus 拿不到序列时返回**空结果**，不是 0。
若代码写成 `?? 0`，新节点、刚重启的 Pod、被 relabel 掉的目标会全部显示成
「CPU 0%」——**看着比谁都健康**。这与「读不到 ≠ 默认值」是同一条原则，只是换了数据源。

#### 怎么暴露这三个 API，不归本方案管

控制台侧**只认 URL**（`-prometheus` / `-alertmanager` / `-loki`），指向哪由使用者决定：

```text
控制台  ──(任意可达的 URL)──>  Prometheus / Alertmanager / Loki
                ↑
        这一段怎么搭，本方案不规定
```

（NodePort / 反向代理 / SSH 隧道 / 干脆不接，都行。）
这反而更干净：**控制台侧不依赖任何暴露形态**，将来换方式不用改一行控制台代码。

> **一条仍然值得记住的判断**（不再作为本方案的约束）：
> **basicAuth 给的是「认证」，不是「授权」。** 三个 API 的写面与读面**在同一个端口上**：
>
> ```text
> Prometheus    GET  /api/v1/query              ← 想读的
>               POST /-/reload                  ← 同端口，重载配置
> Loki          GET  /loki/api/v1/query_range   ← 想读的
>               POST /loki/api/v1/delete        ← 同端口，删日志
> Alertmanager  GET  /api/v2/alerts             ← 想读的
>               POST /api/v2/silences           ← 同端口，静默告警
> ```
>
> 所以「配个口令」并不会让它们变成只读 —— 它只是把写面一起推到了网络上。
> 谁将来要暴露它们，这一条仍然适用。

⚠️ **「只读」这条原则本身仍然成立，而且落在控制台这一侧**：
`metrics.Client` 只有 GET，有测试逐个断言方法名。**客户端不构造写请求，
是控制台能自己保证的那一半。**

#### 前置条件

| # | 前置 | 状态 |
| :--- | :--- | :--- |
| 1 | 落节点 / 业务 / 告警三区 | ✅ 已实施 |
| 2 | 接 Loki 与拓扑 | ✅ Loki 已接；拓扑区已有 `TopologyView`，只需从本页链接过去 |
| 3 | **监控栈本身要存在** | ✅ 已解除（监控栈已在新集群上重新部署） |

**P3（§7.1~7.3 的方案验收补齐）不在这张表里 —— 它不是 P5 的前置。**
两者的关系是：P5 不阻塞在 P3 的完整性上，只受 §8.4 末那条硬承诺约束
（**方案态必须如实标注未纳入项**）。那是「怎么显示」的要求，不是「能不能做」的门槛。

方案态那格不标注，全局条就是假绿。

#### 明确不做

| 不做 | 理由 |
| :--- | :--- |
| K8s 写操作（扩缩容 / 删 Pod / 改 YAML） | 那是 `kubectl` 的活。做了就会从「首页」膨胀成「再造一个 Rancher」 |
| 时间序列钻取（过去 24h 曲线） | 那是 Grafana 的活。首页只给当前值 + 一个「去 Grafana」的出口 |
| 通用 Dashboard（任意 namespace / 任意资源） | 本页的价值恰恰是 Headlamp 不会有的那些：污点落点、2:1 分布、`externalTrafficPolicy` 下的逐节点 VIP 通告（§九） |
| 为首页新增采集链路（加 KSM / 加 exporter） | 现有 10 个 target 能回答的才回答，回答不了的老实说回答不了 |

#### 一句话收口

**这件事值得做，但它不是「替代 Grafana」，也不是「新做一个 Dashboard」——
它是既有控制台的第三个数据源。它最大的风险不是做不出来，
是把三个来源的数字糊成一个绿色的「正常」。**

## 九、参考项目

| 项目 | 关系 |
| :--- | :--- |
| **Headlamp** | Kubernetes Dashboard 已于 2026-06 归档，官方博客推荐迁移到 Headlamp。**重点学它的交互**（多集群、可扩展、应用视图） |
| Kubernetes Dashboard | 虽已归档，`Node` / `Pod` / `Deployment` / `Events` 的页面组织方式仍有参考价值 |

**但要看清区别**——这决定了本项目不是「再做一个 Dashboard」：

```text
Headlamp            →  管理「任意 Kubernetes」
本项目控制台        →  固化「这一套 K3s 方案」
```

本项目最有价值的部分，恰恰是 Headlamp 天然不会有的那些：

```text
3 节点 → K3s HA → embedded etcd → kube-vip
      → 控制面 VIP → Traefik → 业务 VIP
      → externalTrafficPolicy: Local
      → 副本数 / eligible nodes 约束   ← 通用工具不知道这条
      → Registry → Verify Chain
```

「副本数必须 ≥ 可承载 Traefik 的节点数」这种约束，**通用工具不可能内置**，
因为它不是 K8s 的规则，是**这套方案的规则**。把它固化进界面，才是这个项目存在的理由。

## 十、明确不做什么

| 不做 | 理由 |
| :--- | :--- |
| 图形化 YAML 编辑器 | 配置的唯一事实来源必须是**可 git diff 的文件**，GUI 只是它的视图 |
| 任意字段的自由表单 | 自由表单会**重新引入决策复杂度**，正好是控制台要消灭的东西。要的是「声明拓扑，副本数自己算」 |
| 在 Go 里复制 **K3s 方案判定**（VIP / Traefik / TLS SAN / Registry…） | 见 §3.2。这是硬约束。注意边界：**控制台自身的**任务/权限/并发/参数校验属于 Go，不在此列 |
| 在 Go 里复制 **PassUp 的业务判定** | 见 §8.7。同源约束 |
| 多集群管理 | 本项目的价值在「深」不在「广」 |
| 一个笼统的「一键部署」大按钮 | 见 §四。动作必须带影响面 |
| 把配置搬进网页自由表单 | 见 §8.2。控制台编辑的是**文件**（`config.local.env`）里的**一个键**，且改之前必须过 `validate-config` |
| 引入图表库画时序曲线 | 见 §5.4 / §8.8。表格能表达的不画图；趋势看 Grafana |
| P5 做 K8s 写操作（扩缩容 / 删 Pod / 改 YAML） | 见 §8.8。那是 `kubectl` 的活 |
| P5 做时间序列钻取（过去 24h 曲线） | 见 §8.8。那是 Grafana 的活 |

## 十一、关联阅读

- [K3s HA 一键部署方案（自动化）](./K3s HA 一键部署方案.md) —— §四「多固化的八件事」、§七「16 项验收判据」
- [可观测性栈 k3s 部署方案](./可观测性栈 k3s 部署方案.md) —— §十「实施结果」
- 代码：`cluster-infra/console/`（`main.go` + `internal/` + `web/`），另有 `console/README.md`
- 代码：`cluster-infra/k3s-ha/`（`deploy.sh` + `config.env` + `manifests/` + `tests/`）
- 代码：`cluster-infra/passup/`（`deploy.sh` + `config.env` + `tests/`）
- 代码：`cluster-infra/monitoring/`（`deploy.sh` + `config.env` + 各组件清单）
- **前端基线**：`pass-up.frontend` —— §5.1 的技术栈与工程结构直接取自该仓
  （`pnpm-workspace.yaml` 的 `catalog:` + `apps/*` + `packages/{shared,vite-config,tsconfig,eslint-config}`）
