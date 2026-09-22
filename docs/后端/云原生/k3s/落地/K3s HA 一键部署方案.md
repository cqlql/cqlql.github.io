---
title: K3s HA 一键部署方案（自动化）
icon: mdi:rocket-launch
sort: 5.5
---

# K3s HA 一键部署方案（手工照文档 → 一条命令）

> **文档定位：方案定稿 / 实机待验证。**
> 把「[Ubuntu 高可用部署](../原理与选型/Ubuntu高可用部署.md) → [Kube-vip 部署](../原理与选型/Kube-vip部署.md) → [Kube-vip --services 部署](../原理与选型/Kube-vip Services部署.md)」
> 这三份手工文档收敛成**一条命令**，解决「每次部署都要重读文档、手工敲、结果不可复现」的问题。
>
> **⚠️ 先看清完成度：**
>
> | 层面 | 状态 | 含义 |
> | :--- | :--- | :--- |
> | 方案设计 | ✅ **定稿** | 阶段划分、清单内容、参数取值——不再变 |
> | 脚本与清单 | ✅ **已落盘** | `D:\_work\infra\cluster-infra\k3s-ha`；两层离线测试全绿（产物 97 项 + 编排 78 项），见 §9 |
> | 配置取值 | ✅ **已按本环境填好** | 节点 / VIP / 网卡 / 副本数均取自本仓库既有笔记 |
> | 拓扑隐含约束 | ✅ **已自动化** | 「Traefik 副本数 vs 可承载节点数」由 `preflight`/`verify` 按实际拓扑算，不再只写在文档里（§2.2） |
> | 镜像加速 | ✅ **已固化** | `registries.yaml` 由模板渲染下发（docker.io / ghcr.io 走 `172.16.0.222` 代理），把「ghcr.io 拉不动」从风险变成前置依赖（§2.3） |
> | k3s 下载来源 | ✅ **可切换** | 默认 Rancher 国内镜像；不稳时两条配置切官方源 + 代理，`preflight` 会预检代理（§2.4） |
> | 部署后验收 | ✅ **已升级为链路验收** | `verify` 不再只看配置，而是走 `VIP → /readyz → 证书 SAN → 业务入口逐节点`（§7） |
> | **实机执行** | ⏳ **未验证** | SSH 远程执行、k3s 安装、VIP 漂移**必须真机跑一次才算数**，见 §9.2 记录表 |
> | Traefik `affinity` 取值路径 | ⏳ **待确认** | 见 §9 风险 4，chart 不认时会静默忽略（不报错） |
>
> **换句话说**：脚本可以跑了，但「跑通了」这句话要等第一次实机执行之后才能说。
> 实机验证要收集的事实清单见 §9.2。

## 一、为什么不再手工照文档

### 1.1 现状

部署流程分散在三份文档里，靠人按顺序读、手工敲：

```text
《Ubuntu高可用部署》      三台基础环境 → 首台 --cluster-init → 取 token → 其余 join
        ↓
《Kube-vip 部署》        生成控制面 DaemonSet（--controlplane）→ 投递 → 验证
        ↓
《Kube-vip Services部署》 生成业务 DaemonSet（--services）→ 配 Traefik VIP + Local → 验证
```

### 1.2 四个具体问题

| 问题 | 具体表现 |
| :--- | :--- |
| **易漏关键参数** | 安装首台时漏 `--tls-san <VIP>`，导致用 VIP 访问 apiserver 报 `x509: certificate is valid for ... not 172.16.0.210`，只能事后补 `config.yaml` + 重启 k3s 重签证书（本环境已经踩过，见[排障笔记 §2](../排障/Kube-vip排障（VIP不生效）.md)） |
| **步骤间有隐性依赖** | 顺序错了不报错、只是「不生效」——例如 servicelb 没禁用，Traefik 的 `EXTERNAL-IP` 会是节点物理 IP（不漂移），看起来却像正常 |
| **结果不可复现** | 三台机器手工敲完，没人能保证下次重装一模一样；出问题也无法 diff「这次和上次差在哪」 |
| **配置散落各处** | 参数散在 shell 历史、`config.yaml`、两份 DaemonSet YAML、Traefik 的 HelmChartConfig 里，改一个要记住改几处 |

### 1.3 目标

- **一条命令**完成全部阶段，**幂等**——重复执行安全，不会把已经做好的部分搞坏。
  这里的幂等是**配置幂等**：重复执行后集群最终状态与目标状态一致；但**不等于执行无副作用**
  （`traefik` 阶段会滚动重启 Traefik），定义见 §6.4。
- 所有参数收敛到**一个配置文件**，改配置不改脚本。
- 流程的**唯一事实来源是脚本和清单**，不是文档；文档只解释「为什么这么配」。
- **结果可复现**：同一套脚本 + 同一套配置 + **同一个 K3s 版本**，重装得到同样的集群。
  ⇒ 首次实机验证成功后必须回填 `K3S_VERSION`，见 §5、§6.2。

## 二、环境事实

本方案的所有取值都来自本仓库既有笔记，不是凭空假设。

### 2.1 节点与 VIP 规划

| 项 | 值 | 出处 |
| :--- | :--- | :--- |
| 节点 | `u1` 172.16.0.211、`u2` 172.16.0.212、`u3` 172.16.0.213 | 排障笔记 §环境背景 |
| 角色 | 三台均 `control-plane` + embedded etcd | 同上 |
| 内存 | 16 GiB / 台 | 可观测性方案 §1.4 |
| 网卡 | `enp0s3` | 排障笔记 §环境背景 |
| **控制面 VIP** | `172.16.0.210` | 同上 |
| **业务 VIP 池** | `172.16.0.180-185` | 同上 |
| **Traefik 网关 VIP** | `172.16.0.180` | 排障笔记 §3 方案 A |
| 镜像仓库 | 私有 `172.16.0.222:5000` + docker.io 代理 `:5001` + ghcr.io 代理 `:5002` | 《镜像下载加速实践》、PassUp 部署清单 |

> **两个 VIP 各司其职，不要混。**
> `172.16.0.210` 是**控制面 VIP**（`kubectl` / 节点 join 用，`6443` 端口）；
> `172.16.0.180` 是**业务 VIP**（客户端访问 Traefik 用，`80`/`443`）。
> 详见 [Kube-vip 部署 §6](../原理与选型/Kube-vip部署.md)。

### 2.2 影响取值的两个拓扑细节

这两点会直接改变参数取值，是本方案与「通用教程」的差别所在。

**① 有一台节点带污点，且它也是 control-plane**

本集群 3 台都是 server，其中 1 台额外打了污点（留给监控等辅助组件），常态只有 2 台承载业务 Pod。由此推出两条：

- **kube-vip 的 tolerations 必须容忍「所有」污点**（`operator: Exists` 且不写 `key`）。
  因为它必须跑在**每一台** control-plane 节点上，否则那台就无法持有控制面 VIP——白白砍掉 1/3 的可漂移范围。
  只容忍 `node-role.kubernetes.io/control-plane` 是不够的：那个自定义污点不是控制面污点。
- **Traefik 副本数取 2（= 可承载节点数），不是 3**。注意这个「2」是拓扑算出来的，不是规则本身。见下条。

**② `externalTrafficPolicy: Local` 把「副本数」变成了硬约束**

`Local` 策略下，kube-vip **只在「本节点有 Traefik Pod」的节点上通告 VIP**。于是：

| 配置 | 后果 |
| :--- | :--- |
| 副本数 < 可承载节点数 | 有节点不通告 VIP，单节点故障的可用性窗口被放大 |
| 副本数 > 可承载节点数 | 多出来的副本长期 `Pending` |
| 副本全落在同一台 | 另一台不通告 VIP → **等于没做高可用**（这是最隐蔽的一种） |
| 副本数 = 可承载节点数 = 2（本环境） | 两个业务节点各一个，任一台挂了另一台接管 ✓ |

> **真正的约束不是「副本数 = 2」，而是「副本数 ≥ 可承载 Traefik 的节点数（eligible nodes）」。**
> 本环境之所以取 2，是因为 3 台里那台带污点的节点跑不了 Traefik，eligible nodes 恰好是 2。
> 一旦去掉污点、或扩到 4 台，`TRAEFIK_REPLICAS` 就得跟着改——**而人是会忘的**。

所以方案里做了三件事：

1. `replicas: 2`（由 `TRAEFIK_REPLICAS` 注入）；
2. **podAntiAffinity** 保证两个副本真的摊开；
3. **把这个隐含约束自动化**：`preflight` 与 `verify` 都按实际拓扑算一遍 eligible nodes 并比对
   （`Ready` + 未被 cordon + 没有 Traefik 容忍不了的污点），不一致直接报错：

```text
TRAEFIK_REPLICAS=2，可承载 Traefik 的节点数=2（自动探测（Ready 且无 Traefik 容忍不了的污点））
✓ 副本数覆盖全部可承载节点（Local 策略下每台都会通告业务 VIP）
```

```text
[错误] TRAEFIK_REPLICAS=2 < 可承载节点数=3：还有 1 个节点不会通告业务 VIP，单节点故障时的可用性窗口被放大；
      改 config.env 的 TRAEFIK_REPLICAS（或显式写 TRAEFIK_ELIGIBLE_NODES），或把 TRAEFIK_REPLICAS_MISMATCH 设为 warn/off
```

> 文档《Kube-vip Services部署》第二章讲了 `svc_election` 与 `Local` 要配套，但**没有讲副本数这个隐含约束**。这是本方案补上的。
>
> 另外：`verify` 是本方案的诊断入口，配置不一致时 **`preflight` 只警告放行**（`PREFLIGHT_REPLICAS_SOFT`），
> 问题由 `verify` 作为一项未通过项报出来——不能因为配置不一致，就把「先看看现状」这一步也挡掉。

### 2.3 镜像加速：把「镜像拉不动」从风险变成前置条件

k3s 用 containerd，镜像源由节点上的 `/etc/rancher/k3s/registries.yaml` 决定。
不配加速的话 `ghcr.io`（kube-vip 就来自这里）基本拉不动——这原本是方案里的已知风险之一，
现在改成**由模板渲染下发**：

| 源 | endpoint | 用途 |
| :--- | :--- | :--- |
| `docker.io` | `http://172.16.0.222:5001` | Docker Hub 代理缓存 |
| `ghcr.io` | `http://172.16.0.222:5002` | ghcr.io 代理缓存（kube-vip 等） |
| `172.16.0.222:5000` | `http://172.16.0.222:5000` | 私有仓库（push 自己的镜像） |

三点说明：

- **它是节点级文件，不是 k8s 对象**——进不了 auto-manifests，只能直接写文件。
  所以走和清单一样的路子：`templates/registries.yaml` 进 Git、`config.env` 改 IP/端口、`prepare` 下发。
- **改内容必须重启 k3s 才生效**（containerd 启动时读取）。于是把「写文件」和「要不要重启」拆开：
  `scripts/ensure-registries.sh` 只回答 `yes/no`（内容有没有变化），重启决策留给 `deploy.sh`。
  好处是这段判定能离线测试，而且重复执行**不会**把集群反复重启。
- **代理缓存挂了，containerd 不会自动回退官方源**：拉取会直接失败。所以「加速」在这里是前置依赖，
  §6.1 的 checklist 要求先确认内网三端口可达；真要绕过就把 `MANAGE_REGISTRY` 设成 `false`（脚本不接管该文件）。

> 对应的手工文档是本仓库《镜像下载加速实践》的「K3s 配置镜像加速」一节——
> 这里是把它收敛成一条命令，并给 `verify` 加了一项「registries.yaml 有没有漂移」的比对（见 §7 第 15 项）。

### 2.4 k3s 自身怎么下：国内镜像 / 官方源 + 代理

**这是和 §2.3 完全不同的另一层**，两件事不要混：

| 层 | 管什么 | 怎么配 | 实际走什么 |
| :--- | :--- | :--- | :--- |
| **k3s 安装** | 下载安装脚本 + k3s 二进制 | `K3S_INSTALL_SOURCE`（`cn` / `official`） | 直连，或经 `K3S_DOWNLOAD_PROXY`（HTTP 代理） |
| **容器拉镜像** | containerd 拉业务 / 系统镜像 | `registries.yaml`（§2.3） | 内网 Registry 代理缓存 |

默认走 Rancher 国内镜像（`rancher-mirror.rancher.cn` + `INSTALL_K3S_MIRROR=cn`）。
但国内镜像**偶有不稳**，这时切官方源 + 代理：

```env
K3S_INSTALL_SOURCE="official"
K3S_DOWNLOAD_PROXY="http://172.16.0.222:7897"   # 官方源直连多半不通，必须配代理
```

改完重跑 `./deploy.sh server-first`（首台）或 `./deploy.sh join`，不用动脚本。
`K3S_INSTALL_URL` / `K3S_MIRROR_CN` 留空即按 `K3S_INSTALL_SOURCE` 推导（写死容易自相矛盾）。

三个配套细节：

- **代理必须 export 到远端**：安装脚本本身、以及它下载 k3s 二进制，都是**远端**的 curl/wget 干的，
  本机 export 没有用。所以远端会 `export HTTP_PROXY / HTTPS_PROXY`（含小写），只影响这一次执行，不写进节点环境；
  `K3S_DOWNLOAD_NO_PROXY` 默认排除 `127.0.0.1` 与 `172.16.0.0/16`，免得内网流量被代理吞掉。
- **`preflight` 替你预检代理**：配了 `K3S_DOWNLOAD_PROXY` 时，逐台真下载一次安装脚本，
  提前暴露「代理不通」。**只警告不中断**——否则连 `verify` 都会被挡在门外（同 §2.2 的 `PREFLIGHT_REPLICAS_SOFT` 思路）。
- **失败时直接告诉你怎么办**：安装脚本执行失败时，报错信息里就写着「改 `K3S_INSTALL_SOURCE=official`
  + 填 `K3S_DOWNLOAD_PROXY`」，而不是让你去猜。远端命令带 `pipefail`：
  拉不到脚本会**明确失败**，不会让 `sh` 读到空输入而「假成功」，然后卡在等节点 Ready。

## 三、方案总览

### 3.1 一条命令

```bash
cd D:/_work/infra/cluster-infra/k3s-ha
./deploy.sh all
```

实现方式：**bash + ssh**，零额外依赖。不引入 Ansible——不是为了省事，是因为本环境只有 3 台机器、且日常在 Windows 上操作（Git Bash 直接能跑，不需要 WSL）。节点规模上去后再平移，见 §3.4。

### 3.2 阶段划分

每个阶段都能单独执行，且**先探测现状再动手**，已完成的部分自动跳过。

| 阶段 | 做什么 | 对应手工文档 |
| :--- | :--- | :--- |
| `preflight` | 配置自检（VIP 与节点 IP 冲突 + **Traefik 副本数 vs 可承载节点数** + **k3s 下载代理可达性**）、渲染清单、探测 SSH | — |
| `prepare` | 三台：hostname / hosts / 关 swap / 关 ufw / apt / **registries.yaml（镜像加速）** / 预置清单 | 《Ubuntu高可用部署》二、《镜像下载加速实践》 |
| `server-first` | 首台写 `config.yaml` 并安装（`cluster-init` + `disable servicelb` + `tls-san`）；来源/代理见 §2.4 | 同上 一~三 |
| `join` | 读 token，其余 server 加入（与首台共用同一套来源/代理逻辑） | 同上 四~五 |
| `kube-vip` | 确保两套 DaemonSet 就位，清理 servicelb 遗留 | 《Kube-vip部署》3 / 9.2 |
| `traefik` | 配 Traefik 的 `loadbalancerIPs` + `Local` + 副本数 + 反亲和 | 《Kube-vip Services部署》四 |
| `kubeconfig` | 拉 kubeconfig 并把 `server` 改成 VIP | 《Ubuntu高可用部署》六 |
| `verify` | **只读**验收：节点 / 两套 DS / VIP 落点 / apiserver **完整链路** / 业务入口（含逐节点）/ 版本固定提醒（见 §7） | 两篇的「验证」章 |
| `uninstall` | 清本方案管理的 kube-vip / Traefik 定制资源（含 auto-manifests 里的清单）。**≠ 恢复到部署前**：k3s 本身与 `servicelb` 的禁用状态都不会自动恢复（见 §8） | 《Kube-vip部署》10 |

### 3.3 四个关键设计

**设计 1：新装走 K3s auto-manifests，已装走 `kubectl apply`**

`prepare` 阶段把 RBAC + 两套 DaemonSet 写进 `/var/lib/rancher/k3s/server/manifests/`，
K3s 启动时自动 apply——这正是 [kube-vip 官方 K3s 指南](https://kube-vip.io/docs/usage/k3s/)推荐的
**DaemonSet × auto-manifests** 组合，好处是「装好 k3s 即自动就位」，整条链路没有手工 `kubectl`。

> **但已装集群不能这么做。** DaemonSet 的 `selector` 是**不可变字段**，如果现有 DaemonSet 的 selector
> 与清单不一致，addon 控制器会一直 apply 失败并重试。所以脚本只在「这台还没装 k3s」时预置清单，
> 已装集群改走 `kubectl apply`，并在发现 selector 不一致时明确报出重建命令，而不是让你去看 addon 的报错日志。

**设计 2：清单预先渲染，不现场生成**

手工文档用 `docker run ... manifest daemonset` 现场生成 YAML。方案里改成**预渲染模板**
（`manifests/*.yaml`），`__VIP_CP__` / `__INTERFACE__` 等占位符在本地替换。收益：

- 去掉对 `docker` / `k3s ctr` 的依赖（节点上可能都没有）；
- 去掉生成步骤对 `ghcr.io` 的网络依赖（生成要拉镜像，但拉不动时 YAML 也生不出来）；
- 清单进 Git，可 review、可 diff。

**设计 3：k3s 参数写 `config.yaml`，不用一长串命令行**

```yaml
# /etc/rancher/k3s/config.yaml
cluster-init: true
write-kubeconfig-mode: "644"
disable:
  - servicelb
tls-san:
  - 172.16.0.210
```

可读、可 diff、可手工改。附带好处：「已装集群要补 `disable servicelb`」这条路径天然打通——
改的就是这个文件。

**设计 4：配置自检拦住致命坑**

`preflight` 会检查 **VIP 是否等于任何节点物理 IP**，命中就直接退出。这是本仓库排障笔记里
代价最大的一次事故（Traefik VIP fallback 成节点 IP → 漂移时二层抢 ARP → `u2` 被挤成 `NotReady`，
连 SSH 主机密钥都在跳）。脚本把它变成启动前的硬性校验。

### 3.4 为什么不直接上 Ansible

`k3s-ansible` 这类现成方案确实支持 kube-vip，但：

- 本环境 3 台机器，Ansible 的 inventory/vault/role 体系属于净增复杂度；
- 日常操作在 Windows 上，Ansible 控制端要 WSL 或另开一台 Linux；
- 最关键的是——**这套流程的坑是本地特有的**（污点节点、`Local` 副本数、servicelb 归一化），
  用通用 role 仍然要写一层 override，不如直接写脚本透明。

真要迁移时成本很低：本脚本的阶段划分与 Ansible task 是 1:1 的，`manifests/` 可直接当 template。

## 四、比手工文档多固化的七件事

这些事都是「手工敲会漏、漏了不报错、只在特定条件下才炸」的类型，因此写进清单和脚本固化下来。
其中第 5~7 条不只是「写进清单」，而是**写成了每次执行都会重算的校验**。

| # | 事项 | 手工文档的状态 | 漏掉的后果 |
| :--- | :--- | :--- | :--- |
| 1 | **`--tls-san <VIP>`** | 《Ubuntu高可用部署》§三的安装命令**没有**；《Kube-vip部署》§2.2 才提到要加 | 用 VIP 访问 apiserver 报 `x509` 证书错误（本环境已踩过） |
| 2 | **两套 DaemonSet 的 `selector` 要不同** | 文档只说要改 `metadata.name`（§9.3） | 两个 DaemonSet 控制器争抢同一批 Pod、互相覆盖 |
| 3 | **Traefik 副本数 + podAntiAffinity** | 文档只讲了 `Local` 要配 `svc_election`，没讲副本数约束 | `Local` 下单副本 / 副本挤在一台 → 入口实际没有高可用（见 §2.2） |
| 4 | **servicelb 归一化** | 文档给了 `disable: - servicelb` 的追加写法 | 若 `disable:` 块后面还有别的 key，往文件末尾追加会写到**块外**，产出非法 YAML |
| 5 | **可承载节点数校验** | 无——文档里连「副本数」都只是口头约定 | 拓扑变了（去污点 / 扩节点）没人改 `TRAEFIK_REPLICAS` → 有节点不通告 VIP，而 `verify` 之外的检查**看起来一切正常**（见 §2.2） |
| 6 | **VIP 链路验收（`/readyz` + 证书 SAN）** | 文档只验「VIP 端口可达」 | `curl -k` 的「可达」会同时掩盖「链路没通」和「证书缺 SAN」，直到用 `kubectl` 访问 apiserver 才炸出 `x509`（见 §7 第 5、6 项） |
| 7 | **`registries.yaml`（镜像加速）** | 手工文档让人 `nano` 这个文件，没有任何检查 | 漏配 → `ghcr.io` 上的 kube-vip 拉不动（原本的已知风险 3）；手改后与脚本产物不一致，重装 / 扩容时行为不同（见 §2.3、§7 第 15 项） |

> 关于第 2 条：本环境的排障命令里用的就是 `app.kubernetes.io/name=kube-vip-services`
> （见[排障笔记 §5](../排障/Kube-vip排障（Service VIP 与节点 IP 冲突）.md)），说明**当时已经区分过 label**。
> 但文档没把这条规则写下来，重装时全靠记性——所以固化进清单。

第 4 条这个坑的修复过程本身也值得记一笔，因为它暴露了「抽出去没接上」这类问题：

1. 写脚本时先被**离线自测**抓出：`disable:` 块之后还有 `write-kubeconfig-mode:` 时，
   追加的 `- servicelb` 会落到块外、产出非法 YAML；
2. 修法是把归一化逻辑抽成独立脚本 `scripts/ensure-servicelb-disabled.sh`
   （对 5 种输入形态——文件不存在 / flow 写法 / block 写法 / 块后有其他 key / 已含 servicelb——
   逐个测过，且保证幂等）；
3. **但抽出去之后 `deploy.sh` 里的引用没真正落盘**，独立脚本成了死代码，
   `deploy.sh` 里仍是带坑的旧内联版本 —— 这个由**编排集成测试**抓出来（详见 §9）。

教训是：把逻辑抽成独立文件时，「文件被引用」这件事本身需要断言。现在 `selftest.sh` 里有
**接线检查**，会强制校验 `scripts/*.sh` 与 `manifests/*.yaml` 都被 `deploy.sh` 引用。

## 五、参数表

全部集中在 `cluster-infra/k3s-ha/config.env`（已按本环境填好）：

| 变量 | 本环境取值 | 说明 |
| :--- | :--- | :--- |
| `NODES` | `172.16.0.211 u1` / `.212 u2` / `.213 u3` | 第一个是 bootstrap 首台 |
| `VIP_CP` | `172.16.0.210` | 控制面 VIP |
| `VIP_TRAEFIK` | `172.16.0.180` | 业务 VIP（池内、非节点 IP） |
| `VIP_INTERFACE` | `enp0s3` | 显式写死，避免重启后自动探测选错 |
| `TRAEFIK_REPLICAS` | `2` | **必须覆盖所有允许承载 Traefik 的节点**（eligible nodes，本环境为 2）——不是「固定等于 2」（见 §2.2） |
| `TRAEFIK_ELIGIBLE_NODES` | 空（自动探测） | 期望承载 Traefik 的节点数；留空 = `preflight`/`verify` 按实际拓扑探测。集群还没装时只做「副本数 ≤ 节点总数」的静态检查 |
| `TRAEFIK_REPLICAS_MISMATCH` | `fail` | 副本数与可承载节点数不一致时：`fail` 报错退出 / `warn` 只提示 / `off` 跳过 |
| `KUBE_VIP_IMAGE` | `ghcr.io/kube-vip/kube-vip:v1.2.2` | 配了镜像加速后正常走 `:5002` 代理；仍拉不动时换国内镜像或 `172.16.0.222:5000` |
| `MANAGE_REGISTRY` | `true` | 是否由脚本接管 `/etc/rancher/k3s/registries.yaml`（镜像加速，见 §2.3） |
| `REGISTRY_HOST` | `172.16.0.222` | 内网 Registry 主机；留空 = 不接管 |
| `REGISTRY_PRIVATE_PORT` / `REGISTRY_DOCKERIO_PORT` / `REGISTRY_GHCR_PORT` | `5000` / `5001` / `5002` | 私有仓库 / docker.io 代理 / ghcr.io 代理（同一台机器的三个端口） |
| `REGISTRY_INSECURE` | `true` | 私有仓库走 HTTP 或自签证书时跳过 TLS 校验 |
| `SSH_USER` | `root` | 非 root 用户需**免密 sudo**（脚本用 `sudo -n`） |
| `UFW_MODE` | `disable` | 或改 `allow` 保留 ufw 并放行 k3s 端口 |
| `K3S_INSTALL_SOURCE` | `cn` | k3s 安装来源：`cn` = Rancher 国内镜像；`official` = 官方 `get.k3s.io`（国内直连多半不通，要配代理）（见 §2.4） |
| `K3S_DOWNLOAD_PROXY` | 空 | 下载 k3s（安装脚本 + 二进制）走的 HTTP(S) 代理；本环境的代理是 `http://172.16.0.222:7897`。**与容器拉镜像无关** |
| `K3S_DOWNLOAD_NO_PROXY` | `localhost,127.0.0.1,172.16.0.0/16,10.0.0.0/8` | 代理白名单：内网地址不走代理 |
| `K3S_INSTALL_URL` / `K3S_MIRROR_CN` | 空（自动推导） | 高级覆盖；留空即按 `K3S_INSTALL_SOURCE` 推导——写死容易自相矛盾 |
| `K3S_VERSION` | 空（最新 stable） | **首次实机验证成功后必须立刻回填**当前版本号并提交 Git，否则重装版本会漂（见 §6.2） |
| `KUBECONFIG_OUT` | `~/.kube/k3s-ha.yaml` | `server` 已改写为 VIP |

需要临时覆盖而不动 Git 里的文件时，新建 `config.local.env`（已在 `.gitignore` 中排除）。

> **`K3S_VERSION` 为什么不能再当「建议」**：
> 留空 = 每次装**当时的最新 stable**。于是「今天部署 → K3s X、三个月后重装 → K3s Y」，
> 这和「结果可复现」是天然冲突的。第一次实机验证成功的那一刻，`verify` 会把版本号打出来，
> 当场回填 + 提交，之后 `./deploy.sh all` 才是真正意义上的
> 「同一套脚本 + 同一套配置 + 同一个 K3s 版本 → 尽可能得到同样的集群」。

## 六、执行步骤

### 6.1 执行前 checklist

- [ ] **SSH 通**：`SSH_USER` 能登录三台，且 root 或**免密** `sudo -n true` 能过。
      本环境的运维习惯是非 root + `sudo -S`（会提示密码），**这种需要先在 `/etc/sudoers.d/` 配 NOPASSWD**，
      否则脚本的 `sudo -n` 会失败——不建议把密码写进脚本。
- [ ] **VIP 空闲**：`172.16.0.210` / `172.16.0.180` 在局域网内 ping 不通（未被占用），
      且**不等于** `211/212/213` 任何一个。
- [ ] **镜像加速可用**：三台都能访问内网 Registry 的三个端口
      （`curl -sI http://172.16.0.222:5001/v2/` / `:5002/v2/` 有响应即可）。
      代理缓存不可用时 containerd **不会自动回退官方源**，`ghcr.io` 上的 kube-vip 会直接拉不动。
- [ ] **镜像可达**：三台能拉到 `KUBE_VIP_IMAGE`（配好加速后走 `:5002` 代理）。
      拉不动先换镜像地址或先修加速，别等到部署时才发现。
- [ ] **k3s 下载路径可用**：默认走国内镜像即可；若要用官方源，先在 `config.env` 里设
      `K3S_INSTALL_SOURCE="official"` + `K3S_DOWNLOAD_PROXY="http://172.16.0.222:7897"`，
      `preflight` 会逐台真下载一次安装脚本来验证（见 §2.4）。
- [ ] **确认污点节点的 taint key / effect**：`kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints`
      —— 本方案不依赖它的具体 key（kube-vip 容忍所有污点），但 **Traefik 可承载节点数**依赖它：
      `NoSchedule` 下那台不算可承载节点（本环境 eligible = 2）；若是 `PreferNoSchedule`，
      它仍算可承载节点（eligible = 3），此时 `TRAEFIK_REPLICAS` 应为 3，否则 `preflight` 会报错。
      不用手工算：`preflight` 会按实际拓扑算一遍并比对（`TRAEFIK_ELIGIBLE_NODES` 留空即自动探测）。
- [ ] **维护窗口**：`kube-vip` 阶段在「config.yaml 缺 `disable servicelb`」时会**重启 k3s**（短暂中断）。

### 6.2 场景 A：全新部署（重装 / 新集群）

```bash
cd D:/_work/infra/cluster-infra/k3s-ha

bash tests/selftest.sh      # 可选：产物与静态检查（秒级，97 项）
bash tests/integration.sh   # 可选：编排集成测试（Git Bash 约 2.5 分钟，78 项）
./deploy.sh all             # 一条命令跑完 8 个阶段
```

产物：3 节点 HA 集群 + 两个可漂移 VIP + `~/.kube/k3s-ha.yaml`。

```bash
export KUBECONFIG=~/.kube/k3s-ha.yaml
kubectl get nodes
```

#### 第一次实机：把 `all` 拆开跑

**第一次真机验证不要直接 `./deploy.sh all`。** 不是因为脚本不成熟，而是第一次要能回答
「到底是哪一段出了问题」，而不是 `all → 失败 → 开始翻日志`：

```bash
./deploy.sh preflight
./deploy.sh prepare
./deploy.sh server-first
#  人工确认这一段：
#    systemctl status k3s
#    kubectl get nodes
./deploy.sh join
./deploy.sh kube-vip
./deploy.sh traefik
./deploy.sh kubeconfig
./deploy.sh verify
```

每段单独看结果，出问题就能立刻定位到「prepare / server-first / join / kube-vip / Traefik」中的哪一段。
**第一次全部通过之后**，再用 `./deploy.sh all` 做一次真正的端到端验证。

> 顺序上有两处需要人工停一下：`server-first` 之后要确认首台 `Ready` 且拿到 VIP（或已知会回退到节点 IP），
> `join` 之后要确认 3 台都是 `Ready`——这两步正常，后面 kube-vip / Traefik 才谈得上验证。

#### 成功之后立刻钉住版本（必做）

`verify` 的最后一项就是「版本固定」：`K3S_VERSION` 为空时它会打印当前版本并提示回填。

```bash
# 例：verify 输出
! K3S_VERSION 为空：本次装的是当时的 latest（v1.30.x+k3s1），下次重装可能拿到别的版本
!   config.env  →  K3S_VERSION="v1.30.x+k3s1"
```

把这一行写进 `config.env` 并提交 Git。**这一步做完，「可复现部署」才成立**——
在此之前，同一套脚本和配置，今天和三个月后装出来的不是同一个集群。

### 6.3 场景 B：现有集群收敛（本环境当前状态）

本环境集群**已经存在**且已部署 kube-vip（`kube-vip-ds` + `kube-vip-services`），
所以不是「重新装一遍」，而是把手工敲过的状态**收敛成脚本可复现的状态**。

```bash
cd D:/_work/infra/cluster-infra/k3s-ha

./deploy.sh verify       # ① 先看现状：它按 §7 的 15 项逐条报出（含副本数、registries.yaml 漂移）
./deploy.sh prepare      # ② 节点级收敛：registries.yaml 等（内容有变化 → 该节点重启 k3s）
./deploy.sh kube-vip     # ③ 对齐两套 DaemonSet（已存在则只做 selector 一致性检查）
./deploy.sh traefik      # ④ 对齐 Traefik：VIP + Local + 副本数 + 反亲和
./deploy.sh kubeconfig   # ⑤ 刷新本地 kubeconfig
./deploy.sh verify       # ⑥ 复验
```

> 第 ① 步不会被「配置与拓扑不一致」挡住：`verify` 这类诊断/清理命令下，`preflight` 的副本数校验
> 只警告放行（`PREFLIGHT_REPLICAS_SOFT`），问题由 `verify` 作为一项未通过项报出来——
> 否则你连现状都看不了。若 `verify` 报了「副本数 < 可承载节点数」，先改 `config.env` 再往下走，
> 否则 ④ 会把一个「有节点不通告 VIP」的配置固化下来。

**这一步会动什么，要提前知道：**

| 阶段 | 对现有集群的影响 |
| :--- | :--- |
| `verify` | 只读，无影响 |
| `prepare` | 写 `registries.yaml`（以及 hostname/hosts 等）；**只有内容真的变了才重启 k3s**，内容一致就是 no-op |
| `kube-vip` | 若 `config.yaml` 已含 `disable servicelb` → 不动 k3s；清理残留 `svclb-*`；两套 DaemonSet 已存在则**只检查不重建** |
| `traefik` | 会**滚动重启 Traefik**（改 values 触发 helm 重渲染）——入口有秒级抖动 |
| `kubeconfig` | 只写本地文件 |

> 若 `kube-vip` 阶段报出 selector 不一致，说明现有 DaemonSet 的标签与本仓库清单不同。
> 此时需要重建（会重启 kube-vip Pod，VIP 短暂无主后重新选举）：脚本会打印确切的删除命令，
> **由人确认后执行**，不会自动删。

### 6.4 幂等怎么定义：配置幂等，不是「执行无副作用」

先把定义收紧——这里是本方案最容易读歪的一处：

> **幂等 = 配置幂等（最终状态幂等）。**
> 重复执行后，集群的**最终状态**与目标状态一致，不会把已经做好的部分搞坏；
> 但为了重新 reconcile 配置，部分阶段会重新下发、并触发滚动更新。
> 所以**不能把 `all` 理解成「零影响的重复执行」**。

| 类型 | 阶段 | 重跑时的行为 |
| :--- | :--- | :--- |
| **探测后跳过**（真正什么都不做） | `prepare`（已装 k3s 时不预置清单）、`server-first`、`join` | 打印「跳过」，不动任何东西 |
| **重新 reconcile**（最终状态幂等，但有副作用） | `kube-vip`、`traefik`、`kubeconfig` | 重新 apply / 重新拉取；结果一致，但 `traefik` 会**触发一次 Traefik 滚动重启** |
| **只读** | `verify` | 不发写操作，只探测 + 断言（配置不一致时也只警告、不退出） |

所以在生产集群上日常只想「看看现状」时，用 `./deploy.sh verify`（只读），
不要随手 `all`——`all` 会顺带重启 Traefik。

## 七、验收判据

`./deploy.sh verify` 会逐项检查，下面是它检查的内容与期望值。
**标了「提示项」的只打印不判定，其余各条必须全部成立**才算部署成功。

**验收原则：看链路，不只看配置。** 「网卡上有 `172.16.0.210/32`」不等于「通过 VIP 能访问 apiserver」，
所以要一路探到应用层：

```text
控制面： 节点 Ready → kube-vip DS 3/3 → VIP 落在网卡 → 6443 TCP 可达 → /readyz = ok → 证书 SAN 含 VIP
业务面： 172.16.0.180 → Traefik EXTERNAL-IP → externalTrafficPolicy=Local → 2 副本分散在不同节点 → curl 有响应
```

| # | 检查 | 期望 | 不通过的常见原因 |
| :--- | :--- | :--- | :--- |
| 1 | 节点状态 | `u1`/`u2`/`u3` 全 `Ready` | etcd 没组起来 / 网络不通 |
| 2 | 两套 DaemonSet | `kube-vip-ds`、`kube-vip-services` 各 3/3 ready | 镜像拉不动（看 `describe pod` 的 Events） |
| 3 | 控制面 VIP 落点 | 某台节点网卡上有 `172.16.0.210/32` | kube-vip 没拿到 leader |
| 4 | apiserver 链路 · TCP | `https://172.16.0.210:6443` 可达 | 见 #3 与 #5 |
| 5 | apiserver 链路 · `/readyz` | 经 VIP 请求 `/readyz` 返回 `ok` | VIP 只是「绑在网卡上」而链路没通：kube-vip Pod 没就绪 / apiserver 异常 |
| 6 | apiserver 链路 · 证书 SAN | 证书 SAN 含 `172.16.0.210` | 首台漏 `--tls-san`（见 §四 第 1 条）。**注意 `curl -k` 会跳过校验**，所以这条单独查 |
| 7 | 本机直连（提示项，不判定） | 本机 `kubectl --kubeconfig=~/.kube/k3s-ha.yaml get --raw=/readyz` = `ok` | 本机与 `172.16.0.0/24` 不通时失败属预期，以远端结果为准 |
| 8 | 业务 VIP | Traefik `EXTERNAL-IP = 172.16.0.180` | 是 `211/212/213` → servicelb 还在抢 / 没写 `loadbalancerIPs`；是 `<pending>` → 业务套没起来 |
| 9 | 源 IP 保留 | `externalTrafficPolicy = Local` | HelmChartConfig 没生效 |
| 10 | Traefik 副本分布 | 2 个副本在**不同**节点 | 反亲和没生效 → `Local` 下等于没做高可用 |
| 11 | 副本数 vs 可承载节点数 | 两个数相等（本环境都是 2） | 拓扑变了（去掉污点 / 增减节点）而 `TRAEFIK_REPLICAS` 没跟着改（见 §2.2） |
| 12 | 业务连通 | `curl http://172.16.0.180` 有响应（HTTP 状态码即可） | Ingress 未配路由时 404 也算通；无响应才算不通 |
| 13 | 逐节点业务入口 | 每个承载 Traefik 的节点，本机访问 VIP 都通 | 该节点没在通告 VIP（`Local` 策略下的隐蔽故障） |
| 14 | 版本固定（提示项，不判定） | `K3S_VERSION` 已回填 | 不回填则每次重装版本会漂（见 §5、§6.2） |
| 15 | 镜像加速配置（提示项，不判定） | 三台上 `/etc/rancher/k3s/registries.yaml` 与脚本渲染产物**逐字节一致** | 手工 `nano` 改过、或压根没有这个文件 → 拉取行为与脚本不一致（见 §2.3） |

> #5 和 #6 是这次补上的：`curl -k` 的「可达」会同时掩盖「VIP 链路没通」和「证书缺 SAN」两件事，
> 而后者正是本环境踩过的坑（用 VIP 访问 apiserver 报 `x509`）。
> #15 只比对不改动：它不是「功能成立与否」，而是「配置有没有漂移」，所以和 #14 一样只提示不判定。

补充两条人工确认（`verify` 会打印但不判定）：

```bash
# VIP 当前持有者（holderIdentity 是节点名）
kubectl get lease -n kube-system plndr-cp-lock -o jsonpath='{.spec.holderIdentity}'

# 漂移次数（>0 说明发生过故障切换）
kubectl get lease -n kube-system plndr-cp-lock -o jsonpath='{.spec.leaseTransitions}'
```

> **想验证漂移，别停节点。** 按[排障笔记 §6](../排障/Kube-vip排障（VIP不生效）.md)的做法：
> 删掉当前 leader 上的 kube-vip Pod，观察 VIP 漂到另一台——比关机安全得多。

## 八、回滚

| 想撤销 | 命令 |
| :--- | :--- |
| 清本方案管理的 kube-vip / Traefik 定制资源 | `CONFIRM_UNINSTALL=yes ./deploy.sh uninstall`（移除 auto-manifests 里的清单 + 删 DS/RBAC/HelmChartConfig） |
| 恢复 K3s 内置 servicelb | 删 `/etc/rancher/k3s/config.yaml` 里的 `disable:` 段 → `systemctl restart k3s` → 清残留 `svclb-*` |
| Traefik 回默认 | `kubectl delete helmchartconfig traefik -n kube-system`（回到 K3s 内置默认值） |
| 整个集群重装 | 三台执行 `k3s-uninstall.sh`，然后 `./deploy.sh all` |

> ### `uninstall` ≠ 恢复到部署前的完整状态
>
> 这一点要写清楚，因为它涉及的东西分属两层，而脚本只负责其中一层：
>
> | 项目 | `uninstall` 之后的状态 |
> | :--- | :--- |
> | auto-manifests 里的 3 份 kube-vip 清单 | 已删除 |
> | `kube-vip-ds` / `kube-vip-services` / RBAC | 已删除 |
> | Traefik 的 `HelmChartConfig` | 已删除（Traefik 回到 K3s 内置默认值） |
> | **K3s 本身** | **未动** |
> | **`config.yaml` 里的 `disable: servicelb`** | **保留**（servicelb 仍是禁用状态） |
> | 已经产生的 `svclb-*` 等遗留资源 | **不会自动回滚** |
>
> 更准确的说法是：**`uninstall` = 移除本方案管理的 kube-vip / Traefik 定制资源；
> K3s 本身及 `servicelb` 的禁用状态不自动恢复。**
> 想回到 K3s 默认，得按上表第 2 行手工做一遍（删 `disable:` 段 + 重启 + 清残留）。
>
> 后续可以考虑单独提供 `restore-defaults` 把它做成一条命令；当前先不做（属于 P2，
> 第一次实机验证前不引入新的自动化面）。

> **删 DaemonSet 不会残留 VIP**：kube-vip 进程随 Pod 回收时会自动把网卡上的 `/32` 剥离。
> 可用 `ip -4 addr show dev enp0s3` 确认 `.210` / `.180` 已消失。

## 九、风险与未验证项

### 9.1 已知风险与离线覆盖

**已知风险**

| # | 风险 | 影响 | 应对 |
| :--- | :--- | :--- | :--- |
| 1 | `kube-vip` 阶段可能重启 k3s | 该节点短暂中断 | 仅当 `config.yaml` 缺 `disable servicelb` 才触发；放维护窗口执行 |
| 2 | `traefik` 阶段滚动重启 Traefik | 入口秒级抖动 | 避开业务高峰 |
| 3 | ghcr.io / docker.io 拉不动 | kube-vip Pod 起不来，其他镜像同样受影响 | 已由 `registries.yaml` 走内网代理（§2.3）；**代理缓存本身挂了不会自动回退官方源**，先修缓存；临时可把 `KUBE_VIP_IMAGE` 换成 `172.16.0.222:5000/...` 后重跑 `./deploy.sh kube-vip` |
| 4 | Traefik chart 的 `affinity` 取值路径未在真机确认 | 若 chart 不认该键，helm 会**静默忽略**（不报错），反亲和失效 → 副本可能挤在一台 | 部署后按 §7 第 10 项确认副本分布；若未摊开，改用 chart 支持的其他键或给节点加 label + `nodeSelector` |
| 5 | 「可承载节点数」的判定依赖一份「Traefik 能容忍的污点」白名单（`CriticalAddonsOnly` / `control-plane` / `master`） | 若以后给 Traefik 加了额外 toleration（比如容忍业务节点的自定义污点），白名单没同步 → eligible nodes 被低估，校验结果偏保守 | 加 toleration 时同步改 `deploy.sh` 的 `TRAEFIK_TOLERATED_TAINTS`；或直接显式写 `TRAEFIK_ELIGIBLE_NODES` |
| 6 | 仓库 `core.autocrlf=true` 且没有 `.gitattributes` 时，`.sh` 在 Windows 上会被 checkout 成 CRLF | bash 直接报 `syntax error near unexpected token $'do\r'`，脚本一行都跑不起来（第一次实机最容易卡在这，且现象像"语法写错了"） | 已在 `k3s-ha/.gitattributes` 把 `*.sh` / `*.yaml` / `config.env` 钉为 `eol=lf`；本地若已被改坏，`sed -i 's/\r$//' <文件>` 可救回 |
| 7 | `registries.yaml` 内容非法会让**该节点的 k3s 直接起不来**（k3s 启动时解析它） | 节点 `NotReady`，且错误信息不像"配置"问题 | 文件由模板渲染下发，且离线自测里有「YAML 合法 + 无残留占位符」断言；写入脚本在覆盖前留 `.bak`，源文件缺失时不落盘（宁可报错也不写坏） |
| 8 | **Rancher 国内镜像偶发不稳 / 官方源直连不通** | 卡在安装阶段：拉不到安装脚本或二进制，节点一直不 `Ready` | 切官方源 + 代理：`K3S_INSTALL_SOURCE=official` + `K3S_DOWNLOAD_PROXY=http://172.16.0.222:7897`（见 §2.4）；`preflight` 会预检代理，安装失败信息里也直接给出这段切换姿势 |

**未验证项（诚实清单）**

1. **实机端到端未跑过**。已有的验证分两层：

   | 层次 | 手段 | 覆盖 | 结果 |
   | :--- | :--- | :--- | :--- |
   | 产物与静态 | `tests/selftest.sh` | 清单渲染、两套 DaemonSet 的名字/selector/env/容忍策略、Traefik 的 `Local`+副本数+反亲和、**`registries.yaml` 结构与 YAML 合法性**、`config.yaml` 生成、servicelb 归一化 5 种形态、**`registries.yaml` 写入脚本（首次/幂等/变更/备份/缺参 5 种形态）**、**可承载节点数计算（7 种拓扑）+ `pass/low/high` 判定**、**k3s 安装来源推导（cn / official / 覆盖 / 非法值）**、`scripts/`+`manifests/`+`templates/` 接线检查、**远端参数 `%q` 往返转义**（jsonpath / 多行 hosts 块 / token）、**26 段远端脚本体逐段 `bash -n`**（这些 body 本地从不解析，只在真机炸） | 97 项全绿 |
   | 流程编排 | `tests/integration.sh` | 用桩替换远程执行层，模拟三台节点跑六个场景：**全新部署**（预置时机、`cluster-init` 只给首台、token 传递与顺序、join 指向 VIP、chmod、registries.yaml 下发但**不重启**——因为 k3s 还没装）、**已装集群**（不预置、不重复安装、无需 join 时不读 token、registries.yaml 变了才重启、无变化不重启）、**幂等**（连跑两遍）、**`verify` 正反例**（副本摊开应通过；副本挤在一台应报失败；且确实查了 `/readyz`、证书 SAN、逐节点业务链路、registries.yaml 漂移）、**拓扑变化**（污点去掉后 eligible=3 而副本数=2 → `preflight` 必须报错）、**诊断不被挡**（配置不一致时 `verify` 的 preflight 只警告放行，但 `verify` 仍判未通过）、**下载退路**（cn 走国内镜像带 `INSTALL_K3S_MIRROR=cn`；official 走 `get.k3s.io` 且代理地址确实传到远端；代理不通时 preflight 只警告不退出） | 78 项全绿 |

   **但 SSH 真实认证、k3s 实际安装、VIP 真实漂移这三件事，只有真机能确认。**
   集成测试的桩是按「预期行为」写的，它能证明编排自洽，不能证明真机行为与预期一致。
2. **污点节点的 taint key 未知**（笔记里是 `<taint-key>` 占位符）。本方案不依赖它的 key，但
   **effect 会影响可承载节点数**（`NoSchedule` → eligible 2，`PreferNoSchedule` → eligible 3），
   §6.1 建议先查清；`preflight` 会自动算，不一致会直接报出来。
3. **`TRAEFIK_REPLICAS=2` 依赖「污点节点不跑业务 Pod」**。这个前提现在由 `preflight`/`verify`
   每次执行时按实际拓扑复核（见 §2.2），不再是「写在文档里、靠人记得改」；
   但支撑它的污点白名单仍需与 Traefik 的 tolerations 保持一致（见风险 5）。
4. **Traefik chart 的 `affinity` 取值路径未在真机确认**（见 §9 风险 4），部署后按 §7 第 10 项验证副本分布。

> **集成测试抓到过的两个真 bug**（说明这套测试不是摆设）：
> ① 抽出去的 `scripts/ensure-servicelb-disabled.sh` **没接进 `deploy.sh`**，成了死代码，
> 而 `deploy.sh` 里还留着旧的内联版本（带 §四 第 4 条那个 YAML 坑）；
> ② `phase_join` 在「所有节点都已装」时**仍去读 node-token**，读不到就会白 `die` 一次。
> 两个都已修，并补了「接线检查」防止第一类问题复发。

### 9.2 实机验证要带回来的事实（记录表）

第一次实机跑完，把下面这些填实。**这份表格填满之前，文档状态就停在「方案定稿 / 实机待验证」。**

| # | 事实 | 怎么取 | 结果 |
| :--- | :--- | :--- | :--- |
| ① | K3s 实际版本 + 这次用的安装来源 | `k3s --version`，把版本回填 `config.env` 的 `K3S_VERSION`；来源看 `K3S_INSTALL_SOURCE` 与 preflight 的输出（国内镜像 / 官方 + 代理） | ⏳ |
| ② | 3 节点 join 是否正常 | `kubectl get nodes -o wide`（3 台 `Ready`、版本一致） | ⏳ |
| ③ | kube-vip 两套 DS 是否 3/3 | `kubectl get ds -n kube-system kube-vip-ds kube-vip-services` | ⏳ |
| ④ | 控制面 VIP 是否正常漂移 | 删掉当前 leader 上的 kube-vip Pod，看 VIP 换节点；同时看 `plndr-cp-lock` 的 `holderIdentity` / `leaseTransitions` | ⏳ |
| ⑤ | Traefik 是否确实 2 副本分散 | `kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik -o wide` | ⏳ |
| ⑥ | `externalTrafficPolicy=Local` 是否生效 | `kubectl get svc -n kube-system traefik -o jsonpath='{.spec.externalTrafficPolicy}'` | ⏳ |
| ⑦ | 业务 VIP 是否始终为 `172.16.0.180` | `kubectl get svc -n kube-system traefik`（`EXTERNAL-IP`） | ⏳ |
| ⑧ | 节点故障 / 删 kube-vip Pod 后的 VIP 漂移 | 参照 ④ 与排障笔记 §6；顺带确认漂移后 `curl http://172.16.0.180` 仍通 | ⏳ |
| ⑨ | 镜像加速是否真的生效 | 三台 `sudo k3s ctr image pull docker.io/library/nginx:alpine` 走 `:5001`；kube-vip 镜像走 `:5002` 拉成功；`verify` 第 15 项报「一致」 | ⏳ |

> **漂移验证别停节点。** 按[排障笔记 §6](../排障/Kube-vip排障（VIP不生效）.md)的做法：删掉当前 leader 上的
> kube-vip Pod，观察 VIP 漂到另一台——比关机安全得多。
>
> **验收方式：** 先按 §6.2 把 `all` 拆开跑一遍并逐段确认，再跑一次 `./deploy.sh all`（端到端）+
> `./deploy.sh verify`（15 项判据）。全绿且上表填满后，文档状态可从
> **「方案定稿 / 实机待验证」升级为「已验证 / 可重复部署」**。

## 十、关联阅读

- [Ubuntu 高可用部署](../原理与选型/Ubuntu高可用部署.md) —— 手工流程第一段（本方案 `prepare`/`server-first`/`join` 的来源）
- [Kube-vip 部署 (ARP 模式)](../原理与选型/Kube-vip部署.md) —— 控制面 VIP + Service LB 原理与手工流程
- [Kube-vip --services 部署](../原理与选型/Kube-vip Services部署.md) —— 业务 VIP 与 Traefik 入口
- [VIP 方案选型](../原理与选型/VIP方案选型.md) —— 为什么选 kube-vip 而不是 Keepalived+HAProxy
- [Kube-vip 排障（VIP 不生效）](../排障/Kube-vip排障（VIP不生效）.md) —— `tls-san` 缺失导致的 x509
- [Kube-vip 排障（Service VIP 与节点 IP 冲突）](../排障/Kube-vip排障（Service VIP 与节点 IP 冲突）.md) —— VIP 踩节点 IP 的完整事故复盘
- [Ingress / Service / Traefik 入口的关系](../原理与选型/Ingress与Service与Traefik入口的关系.md) —— 为什么 Traefik 是那个 LoadBalancer

代码位置：`D:\_work\infra\cluster-infra\k3s-ha\`（README 有完整的排查表与设计说明）。
