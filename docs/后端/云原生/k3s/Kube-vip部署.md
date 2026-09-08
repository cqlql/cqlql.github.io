---
title: Kube-vip 部署 (ARP 模式)
icon: mdi:lan
sort: 4
---

在 K3s 中部署 Kube-vip，本文以官方现行推荐的 **DaemonSet** 方式为主线：部署一次自动覆盖所有 Control Plane 节点，具备控制器级别的自愈与滚动升级能力。以下是针对 **ARP 模式（最常用、最简单的局域网 VIP 漂移模式）** 的完整部署流程。

> 旧教程中常见的「`manifest pod` 生成裸 Pod 丢进 `/var/lib/rancher/k3s/server/manifests/`」方式已被官方弃用，完整步骤与迁移说明单独归档在 👉 [Kube-vip 部署：Auto-Manifests 裸 Pod 方式（旧）](./Kube-vip部署-AutoManifests裸Pod（旧方式）.md)。

## 1. 部署方式选型

### 两个正交维度：资源形态 × 投递通道

讨论"怎么部署 kube-vip"时，其实混着两个互不依赖的维度，先拆开：

| 维度 | 选项 | 说明 |
|:-----|:-----|:-----|
| **① 资源形态**（谁守护 Pod） | 裸 Pod / DaemonSet / Static Pod | 决定 Pod 被删后谁来重建、怎么升级 |
| **② 投递通道**（YAML 怎么进集群） | K3s Auto-Manifests 目录 / `kubectl apply -f` | 决定是随 K3s 启动自动就位，还是集群就绪后手动提交 |

二者可以自由组合，官方现行 [K3s 安装文档](https://kube-vip.io/docs/usage/k3s/) 用的就是 **DaemonSet × Auto-Manifests 目录**（目录机制照用，只是里面放的资源从裸 Pod 换成了 DaemonSet，官方原话："kube-vip runs as a DaemonSet under K3s and **not a static Pod**"）；本文示例用 **DaemonSet × `kubectl apply`**，两种投递通道效果等价。

### 三种资源形态对比：谁在管理这个 Pod？

| 方式 | 管理主体 | 典型路径 / 方式 |
|------|---------|----------------|
| **DaemonSet（推荐）** | Kubernetes DaemonSet Controller | `kubectl apply -f`，或放入 `server/manifests/` |
| **K3s Auto-Manifests 裸 Pod（旧）** | 无人管理（K3s Server 只负责 apply 一次） | `/var/lib/rancher/k3s/server/manifests/` |
| **Static Pod** | 节点上的 kubelet | `/etc/kubernetes/manifests/`（需 kubelet 开启） |

### 为什么不用 Static Pod？

K3s 为了轻量化，其 kubelet 默认**没有**配置 `--pod-manifest-path` 参数。直接往 `/var/lib/rancher/k3s/agent/podmanifests/` 放文件，kubelet 根本不会理睬。K3s 推荐使用 `/var/lib/rancher/k3s/server/manifests/`（注意是 `server` 不是 `agent`），这是 K3s 内置的 AddOn 自动部署路径。

### 核心对比一览（已修正自愈语义）

| 特性 | Static Pod | Auto-Manifests 裸 Pod（旧） | DaemonSet（推荐） |
|:------|:-----------|:----------------------------|:------------------|
| **管理主体** | kubelet（节点级守护进程） | 无人管理（K3s Server 只做 apply） | DaemonSet Controller（集群级控制器） |
| **容器进程崩溃** | **kubelet 重启容器** | **kubelet 一样会重启容器**（`restartPolicy: Always` 对裸 Pod 同样生效，并非完全没人管） | **kubelet 重启容器** |
| **Pod 被 `kubectl delete`** | **立即重建**（kubelet 按宿主机清单拉起） | **不会重建**：只能 `touch` manifests 文件触发重新 apply，或重启 K3s | **立即重建**（控制器检测到副本缺失） |
| **节点重启后** | **自动重建**（kubelet 启动后读取目录） | **会回来**：K3s server 启动时会对 manifests 目录重新 apply 一遍（并非"文件没变就不恢复"） | **自动重建**（调度到重启后的节点） |
| **依赖 API Server 吗？** | **不依赖**（集群挂了 kubelet 依然守护它） | **依赖**（通过 API Server apply 出来） | **依赖**（需要 API Server 协调） |
| **升级方式** | 登录服务器改文件 | 登录服务器改文件 | `kubectl edit` / `kubectl set image` 滚动升级 |
| **多节点部署** | 手动复制文件到每个节点 | 手动复制文件到每个节点 | `kubectl apply` 一次，自动调度；新 Master 加入自动覆盖 |
| **典型用途** | 集群引导（启动 etcd、apiserver） | 旧版教程的 kube-vip 装法（已不推荐） | 生产环境长驻服务（网络插件、kube-vip 等） |

> **一句话总结**：容器崩溃三者都靠 kubelet 重启，差别在「**Pod 对象整体消失后谁兜底**」——Static Pod 靠 kubelet、DaemonSet 靠控制器、裸 Pod 没人兜底。

### 对部署 kube-vip 的建议

1. **K3s 新部署（推荐）**：直接用 **DaemonSet**。想实现"装好 K3s 即自动就位"，就把 RBAC + DaemonSet YAML 预置进 `/var/lib/rancher/k3s/server/manifests/`（官方 K3s 路径）；想集群起来后再手动提交，就按本文 `kubectl apply` 流程走，两者等价。
2. **历史集群里已有裸 Pod**：能跑，但建议迁移到 DaemonSet（获得 Pod 删除自愈、新节点自动覆盖、滚动升级），步骤见归档文档。
3. **标准 K8s（如 kubeadm）**：Static Pod 是控制面引导的标配，但 kube-vip 这类附加组件仍然推荐 **DaemonSet**——Static Pod 无法通过 `kubectl rollout` 平滑升级。

> 裸 Pod 与 DaemonSet 的生成命令几乎一样，只需把 `manifest pod` 改成 `manifest daemonset`，并补上 `--inCluster`（必须）与 `--taint`（建议）。

## 2. 准备工作与参数确认

在开始前，请先确认以下信息：

- **VIP（虚拟 IP）**：准备一个未被分配的局域网 IP（例如 `192.168.1.200`），选定前先在局域网内 `ping` 确认无法 ping 通（没被其他设备占用）。
- **网卡名称**：主节点的网卡名（例如 `eth0` 或 `ens33`），可通过 `ip a` 查看。
- **版本号**：到 [kube-vip Releases](https://github.com/kube-vip/kube-vip/releases) 查看最新版本标签，下文以 `v1.2.2` 为例。

### 2.1 核心参数：`--controlplane` 与 `--services`

> **参数语义变化（v1.x 重要）**：旧版本中的 `--active` 是 v0.8 之前旧架构遗留的 Flag，在 **v1.x** 中已被彻底重构，拆分为两个职责明确的开关：
>
> - **`--controlplane`**：让 Kube-vip 接管 **Kubernetes 控制面（Control Plane）** 的 VIP。它会监听 API Server 的 **6443 端口**，在多个 Master 节点间做 ARP 广播与选主（Leader Election），对外提供统一、可漂移的 `https://VIP:6443` 访问入口。这也是**多 Master 高可用（HA）场景所必须的参数**。
> - **`--services`**：让 Kube-vip 同时充当 **Service LoadBalancer（负载均衡器）**，给 `type: LoadBalancer` 的 Service 绑定并通告外部 VIP（VIP 由 kube-vip-cloud-provider 自动分配、或手动 `loadbalancerIPs` 指定）。开启后访问这些 Service 不再需要云厂商 LB，局域网内即可直接路由。
>
>   注意：**不建议和 `--controlplane` 混在同一实例里开启 `--services`！** 官方推荐 Control Plane HA 与 Service LB 分开部署：Service LB 功能应**单独部署一套独立的 kube-vip DaemonSet**（仅传 `--services`，不加 `--controlplane`），职责更清晰、升级也更方便。
>
> 两者互不依赖：只传 `--controlplane` 就只做控制面高可用（如本例）；只传 `--services` 就只做 Service LB；两个都传则两者兼顾。本文 HA 示例仅使用 `--controlplane`（生成的 YAML 中 `svc_enable` 即为 `"false"`）。

#### `--services` 与 `--controlplane` 的准确语义（避免误解）

> 常见误解是把 `--services` 直接理解成「管业务入口」。更准确的说法是：**`--services` 管的是「`LoadBalancer` 类型的 Service」，而「业务入口」只是它的结果之一**。两者的根本区别在于「谁在被高可用」。

| 维度 | `--controlplane` | `--services` |
| --- | --- | --- |
| 直接作用对象 | **Kube-apiserver**（控制面本身） | **`type: LoadBalancer` 的 Service**（通用，不特定于业务） |
| 服务端口 | `6443`（apiserver 固定端口） | Service 自己声明的端口（80/443 等） |
| 谁在使用 | kubelet、`kubectl`、节点 join | 任何 `LoadBalancer` Service（Traefik、DB 等都可能） |
| 本质 | 给「集群控制面」一个统一可漂移的固定访问地址 | 充当「Service LoadBalancer 提供者」，给 LB 型 Service 分配外部 VIP |

**为什么 `--services` 不等于字面上的「业务入口」？**

- `--services` 的职责是**通用的 LB 提供者**：凡是声明 `type: LoadBalancer` 的 Service，都会被它分配一个外部可达 VIP。
- 在你的集群里，**恰好 Traefik 是那个 `LoadBalancer` Service**，于是它拿到 VIP 变成了业务入口——这是「结果」，不是 `--services` 的直接语义。
- 如果以后又部署了一个 `type: LoadBalancer` 的数据库 Service，`--services` 同样会给它分配 VIP。它不是「业务专属」，而是「LB 型 Service 专属」。

**为什么需要 `--controlplane`？**

- 没有它时，多 Master 集群的 apiserver 没有「统一、固定的访问地址」，某台 Master 挂了，连它的人就得手动换 IP。
- `--controlplane` 通过 Leader Election 把 VIP 挂到当前 leader 上，让 `kubectl`/kubelet/节点 join 都连 `https://VIP:6443`，对单点故障无感。

**一句话比喻**：

- `--controlplane` = 给「公司管理层」配一个永不换号的固定总机（员工永远拨这个号）；
- `--services` = 给「各个业务部门」分配对外热线（客户拨号进对应部门）。

> 一个管「集群自己怎么被访问」，一个管「集群里的 Service 怎么被访问」，层次不同，不可混为一谈。

### 2.2 VIP 基础概念答疑

刚开始接触 VIP 时最容易产生的几个疑问，提前在这里集中解答。

#### VIP 是某个 Master 节点的真实 IP 吗？

**不是**，`192.168.1.200` **不能**是任何一个 Master 节点的真实 IP，它必须是一个**独立、未被使用的空闲 IP**。

它在架构中扮演的角色是 **VIP（Virtual IP，虚拟 IP）**：

| 角色 | IP 示例 |
|------|---------|
| Master 1 真实 IP | `192.168.1.10` |
| Master 2 真实 IP | `192.168.1.11` |
| Master 3 真实 IP | `192.168.1.12` |
| **VIP（虚拟 IP）** | **`192.168.1.200`** |

> 在选定 VIP 前，请在局域网内 `ping 192.168.1.200` 确认**无法 ping 通**（确保当前没有被路由器或其他设备占用）。

#### 它的工作原理是怎样的？

1. **自动漂移**：Kube-vip 在三个 Master 之间进行"选主（Leader Election）"。假设选中 Master 1，就把 `192.168.1.200` 动态**挂载**到 Master 1 的网卡上。
2. **故障转移**：如果 Master 1 突然宕机，另外两个节点立刻感知，几秒钟内自动把 `192.168.1.200` **抢过来**挂载到 Master 2 的网卡上。

#### 在安装 K3s 时该怎么用这个 VIP？

有了 VIP 之后，Worker 节点和 `kubectl` **不需要**绑定某一台具体 Master 的 IP，统一连接 VIP：

- **初始化 Master 1**：指定 `--tls-san=192.168.1.200`（告诉 K3s 生成证书时允许用这个 VIP 访问）。
- **加入 Master 2 / Master 3 / Worker 节点**：连接地址直接填 `https://192.168.1.200:6443`。

## 3. 部署 DaemonSet

DaemonSet 是 Kubernetes 原生的控制器资源，会确保**每个匹配节点上恰好运行一个 Pod**：一次部署自动覆盖所有 Control Plane 节点，新 Master 加入自动纳管，升级回滚也方便。

### 3.1 关键参数：`--inCluster` 与 `--taint`

与旧的 `manifest pod` 不同，DaemonSet 方式有两个必须关注的额外参数：

| 参数 | 必要性 | 作用 |
|:-----|:------|:-----|
| **`--inCluster`** | **必须添加** | 让 kube-vip 使用 Pod 内置的 ServiceAccount Token 与 API Server 通信（`InClusterConfig`）。不加会导致容器因找不到外部 kubeconfig 文件而 **CrashLoopBackOff**。 |
| **`--taint`** | 视环境而定 | 让生成器自动添加针对 Control Plane 污点的 `tolerations`，确保 kube-vip 能调度到 Master 节点上。 |

> **为什么 DaemonSet 必须加 `--inCluster`？** 裸 Pod 方式生成的 YAML 默认挂载宿主机路径读取 kubeconfig，但 DaemonSet 运行在集群**内部**，依赖 InCluster 认证来执行 Leader Election 和监听节点变化。不加 `--inCluster`，容器启动后会因找不到 kubeconfig 文件直接报错退出。
>
> **关于 `--taint`**：K3s 默认 Master 节点**不带污点**，此时不加也没事。但如果你初始化时传了 `--node-taint`，或者希望确保 kube-vip 只在 Control Plane 节点上运行，就必须加 `--taint` 让生成的 YAML 包含对应的 `tolerations`。**建议一律加上，生成的 YAML 更健壮。**

### 3.2 生成 DaemonSet YAML

完整推荐命令如下（比旧裸 Pod 方式多了 `--inCluster` 和 `--taint`）：

```bash
export VIP=192.168.1.200
export INTERFACE=eth0

docker run --network host --rm ghcr.io/kube-vip/kube-vip:v1.2.2 manifest daemonset \
    --interface $INTERFACE \
    --address $VIP \
    --controlplane \
    --inCluster \
    --taint \
    --arp \
    --leaderElection | sudo tee /tmp/kube-vip-daemonset.yaml
```

#### 机器上没有 Docker：用 `k3s ctr` 代替

K3s 内置 containerd 的命令行 `ctr`，可直接拉取并运行临时镜像，效果与 `docker run` 一致：

```bash
export VIP=192.168.1.200
export INTERFACE=eth0

sudo k3s ctr run --rm --net-host ghcr.io/kube-vip/kube-vip:v1.2.2 kube-vip-gen \
    manifest daemonset \
    --interface $INTERFACE \
    --address $VIP \
    --controlplane \
    --inCluster \
    --taint \
    --arp \
    --leaderElection | sudo tee /tmp/kube-vip-daemonset.yaml
```

> 注：`ctr run` 的语法要求给容器指定一个临时名称（例如上面的 `kube-vip-gen`）。也可以在另一台有 Docker 的机器上生成后把 YAML 复制过来。

### 3.3 应用到集群：两种投递通道（任选其一）

**通道一：`kubectl apply`（本文示例，集群已就绪时最直接）**

```bash
sudo k3s kubectl apply -f /tmp/kube-vip-daemonset.yaml
```

**通道二：预置进 Auto-Manifests 目录（官方 K3s 路径，适合全新安装引导）**

先把 RBAC 清单与 DaemonSet 清单放进目录，再安装（或重启）K3s，K3s 启动时会自动按文件名顺序 apply：

```bash
# 1. RBAC（DaemonSet 做选主必须有 ServiceAccount / ClusterRole / ClusterRoleBinding）
curl -s https://kube-vip.io/manifests/rbac.yaml | sudo tee /var/lib/rancher/k3s/server/manifests/kube-vip-rbac.yaml

# 2. 把第 3.2 节生成的 DaemonSet YAML 也放进该目录（可与 RBAC 合并为一个文件，注意用 --- 分隔）
sudo cp /tmp/kube-vip-daemonset.yaml /var/lib/rancher/k3s/server/manifests/kube-vip.yaml
```

> 两种通道对**资源形态**没有任何影响——跑起来的都是同一个 DaemonSet，区别只是"谁、在什么时机执行 apply"。

> **RBAC 权限前置条件**：通过 `--inCluster` + `--leaderElection` 运行时，kube-vip 需要读写 Lease 资源来做选主。`manifest daemonset` 命令默认**会**在生成的 YAML 中附带 `ServiceAccount`、`ClusterRole` 和 `ClusterRoleBinding`，走通道一时无需额外操作；若生成时没带或被裁剪，按第 5 节排查修复。

### 3.4 多节点部署与网卡一致性

DaemonSet 方式**不需要手动 `scp` 文件到每个节点**：

- **新节点加入**：新的 Master 加入集群后，DaemonSet Controller 自动在该节点创建 Kube-vip Pod，无需人工干预。
- **节点下线**：Master 被移除后，对应 Pod 自动清理。

但**网卡名一致性问题依然存在**：DaemonSet 对所有节点下发同一份 env，如果各 Master 网卡名不同（如 `eth0` / `ens33` / `enp1s0` 混用），需要让 Kube-vip 自动探测——生成时**去掉 `--interface`**，或在 env 中把 `vip_interface` 设为 `""`（留空），Kube-vip 会自动选择带有**默认网关（Default Gateway）**的主网卡：

```bash
# 不指定 --interface，一份 YAML 通吃所有 Master（单网卡环境推荐）
docker run --network host --rm ghcr.io/kube-vip/kube-vip:v1.2.2 manifest daemonset \
    --address $VIP \
    --controlplane \
    --inCluster \
    --taint \
    --arp \
    --leaderElection | sudo tee /tmp/kube-vip-daemonset.yaml
```

> **自动探测的风险**：它依赖"默认网关所在网卡"这一假设。**多网卡环境**（业务网卡与管理网卡分离）、拓扑复杂或重启后默认路由变化时，可能绑定到错误网卡甚至失败。生产环境、多网卡节点建议统一网卡命名（如 grub 固定 `net.ifnames=0`）后显式指定 `--interface`，最稳妥。

### 3.5 手动编写 DaemonSet YAML（参考）

不方便用命令生成时，可直接编写如下清单：

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: kube-vip
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kube-vip-ds
  template:
    metadata:
      labels:
        app.kubernetes.io/name: kube-vip-ds
    spec:
      hostNetwork: true
      containers:
      - args:
        - manager
        name: kube-vip
        image: ghcr.io/kube-vip/kube-vip:v1.2.2
        imagePullPolicy: Always
        securityContext:
          capabilities:
            add:
            - NET_ADMIN
            - NET_RAW
        env:
        - name: vip_arp
          value: "true"
        - name: port
          value: "6443"
        - name: vip_interface
          value: eth0              # 修改为你的网卡名；多节点网卡名不一致时设为 ""
        - name: vip_cidr
          value: "32"
        - name: cp_enable
          value: "true"
        - name: svc_enable
          value: "false"
        - name: cp_namespace
          value: kube-system
        - name: vip_leaderelection
          value: "true"
        - name: vip_address
          value: 192.168.1.200     # 修改为你的 VIP
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      - key: node-role.kubernetes.io/master
        operator: Exists
        effect: NoSchedule
      nodeSelector:
        node-role.kubernetes.io/control-plane: "true"
```

> **关于 `nodeSelector` 与 `tolerations`**：DaemonSet 默认会在所有节点上运行，这里通过 `nodeSelector` 限制仅运行在 Control Plane 节点上，并通过 `tolerations` 允许调度到有污点的 Master 节点。旧版 K3s 使用 `node-role.kubernetes.io/master` 标签，请相应调整。
>
> **手动编写时注意**：上方只展示了 DaemonSet 资源本身。实际运行还需要配套 RBAC（`ServiceAccount`、`ClusterRole`、`ClusterRoleBinding`），否则 `--leaderElection` 会因权限不足失败。**建议直接用 `manifest daemonset` 命令生成**，它会自动附带完整 RBAC。

### 3.6 升级镜像版本

修改 DaemonSet 的镜像即可触发滚动更新：

```bash
sudo k3s kubectl set image daemonset/kube-vip -n kube-system \
    kube-vip=ghcr.io/kube-vip/kube-vip:v1.2.2
```

## 4. 验证与测试

### 4.1 查看 Pod 运行状态

```bash
# DaemonSet 整体状态（DESIRED / CURRENT / READY 应一致，数量等于 Master 数）
sudo k3s kubectl get daemonset -n kube-system kube-vip

# 按标签查看各节点上的 Pod（-o wide 可看调度到了哪个节点）
sudo k3s kubectl get pods -n kube-system -l app.kubernetes.io/name=kube-vip-ds -o wide
```

> 若是旧裸 Pod 方式，没有 DaemonSet 标签，用 `sudo k3s kubectl get pods -n kube-system | grep kube-vip` 按名称查看，详见归档文档。

#### 诊断技巧：Pod 异常时按这个顺序排查

不要先看日志，按以下顺序：

**1）查看 Pod 事件（定位确切原因）**，`describe` 是诊断第一入口，重点看输出最底部的 **`Events:`**：

```bash
sudo k3s kubectl describe pod -n kube-system -l app.kubernetes.io/name=kube-vip-ds
```

- 看到 `Pulling image "ghcr.io/..."` 且长时间卡住 → **镜像下载不下来**
- 看到 `Failed to pull image... i/o timeout` → **网络连接超时**
- CNI 或挂载问题也会在这里抛出明确报错

**2）实时观察状态变化**，`-w`（`--watch`）持续监听，适合观察 `Pending` → `Running` 的全过程：

```bash
sudo k3s kubectl get pods -n kube-system -l app.kubernetes.io/name=kube-vip-ds -w
```

**3）查看 Pod 日志**，Events 不够时再看运行时日志：

```bash
sudo k3s kubectl logs -n kube-system -l app.kubernetes.io/name=kube-vip-ds --tail=100
```

> 完整排查顺序：`get pods` 确认状态 → `describe` 看 Events → `logs` 查运行时日志。

### 4.2 检查 VIP 绑定

在获得 Leader 身份的 Master 节点上运行 `ip a`，应能看到 VIP 已绑定到对应网卡：

```bash
ip a show dev eth0
# 输出中应该包含：inet 192.168.1.200/32 scope global eth0
```

### 4.3 连通性测试

在局域网内任意一台机器上 ping 该 VIP：

```bash
ping 192.168.1.200
```

能 ping 通，说明 Control Plane 的高可用 VIP 已生效。后续其他 Node 节点加入集群或 `kubectl` 都可以直接使用 `https://192.168.1.200:6443` 作为 Master 地址。

## 5. 故障排查：DaemonSet 报 `FailedCreate`（缺少 RBAC）

应用 DaemonSet 后 Pod 一直无法创建，先 describe DaemonSet 看事件：

```bash
sudo k3s kubectl describe daemonset kube-vip-ds -n kube-system
```

事件中出现如下报错，说明问题出在 **RBAC 权限缺失**：

```text
Events:
  Type     Reason        Age                  From                 Message
  ----     ------        ----                 ------              -------
  Warning  FailedCreate  12m (x22 over 117m)  daemonset-controller  Error creating: pods "kube-vip-ds-" is forbidden: error looking up service account kube-system/kube-vip: serviceaccount "kube-vip" not found
```

### 根本原因

`kube-system` 命名空间缺少名为 **`kube-vip`** 的 **ServiceAccount** 及其 RBAC 绑定，DaemonSet 无权创建 Pod。

> 这通常发生在：**手动编写的 YAML 漏掉了 RBAC 资源**，或 `serviceAccountName` 引用了不存在的 ServiceAccount。正常 `manifest daemonset` 生成的 YAML 自带 RBAC，不会出现此问题。

### 修复步骤

**1）应用 kube-vip RBAC 配置**

```bash
sudo k3s kubectl apply -f https://kube-vip.io/manifests/rbac.yaml
```

（也可把清单保存到本地后 `kubectl apply -f` 离线应用；走 Auto-Manifests 通道时直接放进 `server/manifests/` 目录即可）

**2）验证 ServiceAccount**

```bash
sudo k3s kubectl get serviceaccount kube-vip -n kube-system
```

**3）检查 Pod 创建状态**

```bash
sudo k3s kubectl get pods -n kube-system -l app.kubernetes.io/name=kube-vip-ds
```

> 注意：官方 RBAC 清单配套的标签可能是 `name=kube-vip-ds`，而 `manifest daemonset` 生成的是 `app.kubernetes.io/name=kube-vip-ds`。查询时以你实际 YAML 的 `matchLabels` 为准（二选一，或都试）。

## 6. 两种 VIP 并存时的区分（cp_enable vs Service LB）

> **本节是实践中踩坑后的补充**。当集群**同时**运行「Control Plane 高可用」和「Service LoadBalancer」两种 Kube-vip 能力时，会出现**两个不同用途的 VIP 并存**，排查网络时极易混淆，务必区分清楚。

### 6.1 现象：为什么 `.200` 能访问业务接口，但 Traefik 的 EXTERNAL-IP 却是 `.201`/`.202`？

实际排查中遇到这样的困惑：

- `kube-vip-ds` 的 DaemonSet 配置里 `address: 192.168.1.200`，用户认为「我的 VIP 就是 `.200`」。
- 但 `kubectl get svc -n kube-system traefik` 显示 `EXTERNAL-IP` 是 `192.168.1.201,192.168.1.202`，且 `status.loadBalancer.ingress` 里 `ipMode: VIP`。
- 然而 `curl http://192.168.1.200/...` 又能正常返回业务响应。

三个 IP 都能访问，让人搞不清到底哪个才是「真正的入口」。

### 6.2 真相：两个 VIP 各司其职

关键在 DaemonSet 配置里的这几个环境变量：

```yaml
env:
  - name: cp_enable
    value: "true"        # 开启 Control Plane 模式
  - name: port
    value: "6443"        # 监听 kube-apiserver 端口
  - name: address
    value: 192.168.1.200 # 这个 VIP 是给 apiserver 用的
```

- **`cp_enable: true`** 的 Kube-vip，其 `address`（`.200`）定位是**控制平面 VIP**，服务 `kube-apiserver:6443`，用于多 Master 的 API Server 高可用（`kubectl` 连 `https://VIP:6443`）。
- 而 **Traefik Service 的 `type: LoadBalancer`**，其 `EXTERNAL-IP`（`.201`/`.202`）是 Kube-vip 的 **Service LB 能力**（`--services`）另行分配的 VIP，用于**业务流量入口**。

| VIP | 提供方 / 模式 | 用途 |
| --- | --- | --- |
| `192.168.1.200` | Kube-vip `cp_enable=true`（控制平面模式） | kube-apiserver 高可用（`6443` 端口） |
| `192.168.1.201` / `.202` | 当时初步判断为 Kube-vip Service LB（**第 7 章修正：实为 K3s 内置 ServiceLB 暴露的节点物理 IP，不漂移**） | Traefik 业务入口（`80`/`443` 端口） |

### 6.3 为什么 `.200`（控制平面 VIP）也能访问业务接口？

因为 **VIP 是漂移的**，且 K3s 的 Traefik 通过 ServiceLB 在每个节点都监听了 `80`/`443`（NodePort）：

1. 控制平面 VIP `.200` 由 Kube-vip 通过 ARP 通告，**当前承载在某个 leader 节点上**（会随 leader 漂移）。
2. 该 leader 节点上有 `svclb-traefik` Pod 监听 `80` 端口（ServiceLB 机制）。
3. 所以 `curl http://192.168.1.200/...`（80 端口）命中的是「VIP 漂到的那个节点」上的 Traefik，从而能访问业务。

这本质上是「**借用了控制平面 VIP 的漂移机制，间接承载了业务流量**」，并非官方推荐的业务入口做法。

### 6.4 如何验证 VIP 当前漂在哪个节点？

```bash
# 1. 看 leader 身份（Kube-vip 选主用的 Lease）
kubectl get lease -n kube-system plndr-cp-lock -o yaml | grep -E 'holderIdentity|leaseTransitions'

# 2. 在 leader 节点上确认 VIP 已绑定到网卡
ip -4 addr show dev enp0s3
# 应能看到 inet 192.168.1.200/32 scope global enp0s3
```

其中 `holderIdentity` 就是当前持有 VIP 的节点名，`leaseTransitions` 表示已发生过多少次选主漂移（大于 0 说明曾发生过故障切换）。

### 6.5 实践建议

- **对外业务入口**：优先使用 Traefik 的 Service LB VIP（`.201`/`.202`），或给该 VIP 配域名，语义清晰、符合官方「Control Plane HA 与 Service LB 分开」的推荐。
- **`.200` 的定位**：它是控制平面 VIP，本意是给 `kube-apiserver:6443` 用的（`kubectl`/节点 join 的地址）。虽然在单网卡 + ServiceLB 环境下「顺带」能承载业务流量，但属于搭便车，不建议作为正式业务入口。
- **如果确实想统一用 `.200` 做业务入口**：技术上可行（因为它是漂移 VIP，节点挂了也能切），但需清楚它同时承担了 apiserver 与业务两个职责，排查问题时要先分清「这次请求走的是哪条路径」。

## 7. `.201`/`.202` 不会漂移：业务入口的真实高可用现状

> 本节是在第 6 章基础上**进一步深入排查后**的重要修正：`.201`/`.202` 其实**并不是会漂移的 VIP**，而是各节点的物理 IP。如果只看 Traefik Service 的 `EXTERNAL-IP`，很容易误以为它们具备和 `.200` 一样的漂移能力。

### 7.1 现象：Traefik 的 EXTERNAL-IP 是「两个节点各自的物理 IP」

排查时发现：

```yaml
# k3s-01 网卡 enp0s3
inet 192.168.1.201/24 brd 192.168.1.255 scope global enp0s3

# Traefik Service status
status:
  loadBalancer:
    ingress:
    - ip: 192.168.1.201
      ipMode: VIP
    - ip: 192.168.1.202
      ipMode: VIP
```

关键证据：

- `.201` 是 k3s-01 网卡上的**物理 IP**（`/24`，不是 `/32` 的 VIP 绑定形式）；
- `.202` 同理是 k3s-02 的物理 IP；
- Traefik Service 的 `EXTERNAL-IP` 恰好就是这两个节点物理 IP，`ipMode: VIP` 只是标记「被 Kube-vip 管理」，**不代表它会漂移**。

### 7.2 本质：ServiceLB 暴露，不是 VIP 漂移

- K3s 的 Traefik 默认走 **ServiceLB**（`svclb-traefik` 在每个节点各一个 Pod），在每个节点上监听 `80`/`443`（NodePort `32407`/`31238`）。
- 因此 `192.168.1.201:80`、`192.168.1.202:80` 都能访问 Traefik，但这本质是「**每个节点物理 IP 都能访问**」，靠的是**两个 IP 并存**，而非「单 IP 漂移」。

### 7.3 所以「`.201` 挂了怎么办」的正确答案

`.201` 是 k3s-01 的物理 IP，**不会漂移**：

| IP | 本质 | 节点挂了会怎样 |
| --- | --- | --- |
| `.200` | Kube-vip `cp_enable` 漂移 VIP | 漂移到存活节点 |
| `.201` | k3s-01 物理 IP（ServiceLB 暴露） | **直接不可用**（节点物理 IP 不漂移） |
| `.202` | k3s-02 物理 IP（ServiceLB 暴露） | **直接不可用** |

> 所以「业务入口走 `.201`，`.201` 挂了」的真实后果是：**走 `.201` 的流量会断**，除非上层（客户端/DNS/LB）能自动切到 `.202`。`.201`/`.202` 本身**没有单 IP 漂移的高可用能力**。

### 7.4 要真正实现业务入口高可用，需部署独立 Service LB

如果你希望业务入口也像 `.200` 一样「节点挂了自动漂移」，需要**额外部署一套独立 Kube-vip DaemonSet**，只开 `--services`（不开 `--controlplane`），让它给 Traefik 分配一个**独立、可漂移**的业务 VIP。

> 关联补充：关于「Traefik 是 K3s 内置、为什么项目 k8s 目录里看不到它」「Ingress 与 Service 的分工」「Ingress 不分配 IP、高可用靠 Traefik 入口」「ServiceLB vs Kube-vip --services」「Traefik Service 能否删」等知识点，详见 👉 [Ingress / Service / Traefik 入口的关系](./Ingress与Service与Traefik入口的关系.md)。

官方明确推荐「Control Plane HA 与 Service LB 分开部署」（见本文 2.1 节 `--controlplane` 与 `--services` 的说明）。第二套 DaemonSet 的**完整部署步骤**——生成清单、避免与控制平面套重名、关闭 K3s 内置 ServiceLB（`--disable servicelb`）、用 kube-vip-cloud-provider 配置地址池自动分配、暴露与验证 Service、per-service 选主——见 👉 **第 9 章「部署 Service LB DaemonSet（`--services`）」**。

### 7.5 业务入口高可用的三种层次（选型参考）

| 方案 | 高可用能力 | 复杂度 | 适用 |
| --- | --- | --- | --- |
| 直接走节点物理 IP（`.201`/`.202`） | 单 IP 不漂移，靠上层切换 | 最低 | 临时/开发调试 |
| 部署独立 Service LB（`--services`） | 单 VIP 漂移 | 中 | 生产（推荐） |
| 域名 + DNS 轮询指向多个 VIP/IP | 客户端天然分散 | 中 | 生产（配合上者更稳） |

> **最佳实践**：独立 Service LB 提供可漂移的业务 VIP + 域名指向该 VIP + 客户端重试（扛漂移秒级窗口），三层叠加最稳。

## 8. Service LB 前置知识：IP 分配与 VIP 生命周期

> 本章内容与第 9 章的 Service LB 部署直接相关。如果只部署控制平面 HA（`--controlplane`），可跳过本章；如果要给业务 Service 提供可漂移 VIP，建议先读本章再操作。

### 8.1 `--services` 的 VIP 从哪来？（地址池 / DHCP / 单地址）

理解 `--services` 可漂移，关键是搞清楚「Service 的外部 IP 由谁分配」。这里其实是**两个组件分工**（完整部署见第 9 章）：

- **kube-vip 本体（`--services` DaemonSet）**：只负责「拿到一个已经确定的 IP → 在 leader 节点绑定并 ARP 广播 → 故障时漂移」。它本身**不会凭空分配 IP**，只有当 Service 已被写入外部 IP（`spec.loadBalancerIP` 或注解 `kube-vip.io/loadbalancerIPs`）后才会动作。
- **kube-vip-cloud-provider（独立的 Cloud Controller，可选）**：负责「自动分配 IP」——从 ConfigMap 地址池里挑一个空闲 IP 回填给 Service，模拟公有云 CCM 的行为。

| 方式 | 谁分配 IP | 典型配置 |
| --- | --- | --- |
| **手动指定固定 IP** | kube-vip 本体 | Service 写 `spec.loadBalancerIP: 192.168.1.210`（或注解 `kube-vip.io/loadbalancerIPs`） |
| **指定承载节点（`vipHost`）** | kube-vip 本体 | Service 加注解 `kube-vip.io/vipHost: <节点名>` 指定 VIP **承载节点**；**仅当同时没给 `loadbalancerIPs`/池分配时**，kube-vip 才 fallback 把该节点物理 IP 当 VIP（⚠️ 见下方警告） |
| **地址池自动分配** | kube-vip-cloud-provider（CCM，需单独安装） | ConfigMap `kube-system/kubevip` 配 `range-global=192.168.1.210-192.168.1.220` 或 `cidr-global=192.168.1.216/29` |
| **命名空间级地址池** | kube-vip-cloud-provider | ConfigMap key 用 `range-<namespace>` / `cidr-<namespace>` |
| **DHCP（实验性）** | kube-vip 本体 | `spec.loadBalancerIP: 0.0.0.0`，由 kube-vip 建 macvlan 接口向 DHCP 租约 |

> ⚠️ **VIP 取值的真正规则（官方 + 实测）**：core kube-vip **不分配 IP**，只把「已确定的 IP」绑到 leader 节点并通告。VIP 数值的确定顺序：
> 1. 注解 `kube-vip.io/loadbalancerIPs: <IP>` → 用指定 IP（最高优先级）；
> 2. `spec.loadBalancerIP`；
> 3. `status.loadBalancer.ingress`（由 kube-vip-cloud-provider 等控制器回填）；
> 4. **都没有 → fallback 用 leader 节点的物理 IP 当 VIP**（危险，见下）。
>
> ⚠️ **自动分配需要 CCM**：`range-global` 地址池的「自动分配」是 **kube-vip-cloud-provider（CCM）** 的职责，core kube-vip 不会读这个 ConfigMap 分配 IP。**没装 CCM 时，池子形同虚设**，每个 LoadBalancer Service 都必须手动写 `loadbalancerIPs`，否则就走第 4 条 fallback 到节点 IP。
>
> ⚠️ **致命坑**：**没装 CCM 又不写 `loadbalancerIPs`** → kube-vip fallback 用节点物理 IP 当 VIP；节点宕机漂移时二层抢 ARP，把节点挤成 `NotReady`（本环境 traefik 最早即此：无 CCM、无 `loadbalancerIPs`，VIP fallback 成 `172.16.0.211/212`，漂到 u1 后把 u2 挤掉）。
> 关于 `vipHost`：它是 kube-vip 运行期写回的「VIP 当前承载节点」记录（删了会重现、无需删），**不决定 VIP 数值**。完整排障见《Kube-vip 排障（Service VIP 与节点 IP 冲突）》。**正确做法：VIP 一律取自 `range-global` 池里、且不与任何节点 IP 重叠的空闲地址（无 CCM 时用 `loadbalancerIPs` 手动指定）。**

> 关键点：`--services` 不是「在启动参数里写死一个全局业务入口 IP」，而是「**每个 `LoadBalancer` Service 各拿一个外部 VIP，各自独立选主、独立漂移**」。你有 N 个 `LoadBalancer` Service，就有 N 个 VIP。

**完整链路（以 Traefik 业务入口为例）**：

```text
部署独立 --services Kube-vip + kube-vip-cloud-provider（ConfigMap 配地址池 .210-.220）
        ↓
Traefik Service (type: LoadBalancer) 被 cloud-provider 自动回填一个 VIP（如 .210）
        ↓
Kube-vip 在 leader 节点把 .210 挂到网卡，ARP 通告
        ↓
前端/客户端访问 http://192.168.1.210/ → Traefik → 后端 Pod
        ↓
leader 节点挂了 → VIP .210 漂到存活节点 → 访问继续（秒级切换窗口）
```

> 注意：**漂移的是「VIP」本身**（同一个 IP 从坏节点切到好节点），不是「换一个 IP」。对外始终是同一个 IP，客户端无感，只是漂移那几秒可能有请求失败，因此建议客户端带重试。

### 8.2 VIP 是「一次性绑定」，不会变来变去

> 高频误解：看到「自动分配」就担心「VIP 会变来变去、不方便」。实际上**分配是一次性绑定，之后永久固定**。

**「自动」的真正含义**：指的是「创建 Service 时，kube-vip-cloud-provider 从地址池挑一个**当前空闲**的 IP 分给它，**无需你手动指定**」，而不是「每次访问都重新分配」。

- 第一次分配后，VIP 会写进 Service 的 `status.loadBalancer.ingress`；
- 只要 Service 不删，**VIP 永久不变**——Pod 重启、节点重启、VIP 漂移、滚动更新都不影响。

**什么时候才会变？** 只有一种情况：`kubectl delete service` 删掉再重建，它会重新从池里拿 IP（可能相同也可能不同）。

**VIP 生命周期一览表**：

| 操作 | VIP 会变吗 |
| --- | --- |
| 改 `deployment.yaml` 并滚动更新 | 不变 |
| Pod 崩溃 / 重建 | 不变 |
| 节点 / 服务器重启 | 不变 |
| VIP 漂移（节点挂了切到别的节点） | 不变（同一个 IP 漂移） |
| `kubectl delete service` 再重建 | **会变**（重新分配） |

> **「Service 不删」指的是 `kind: Service` 这个资源**（即 `service.yaml`），**不是 Ingress**。Ingress 只是「路由规则」（把外部请求转发到 Service），与 VIP 分配无关；VIP 绑定在 `LoadBalancer` 类型的 Service 上。
>
> 类比：像 DHCP 给电脑分 IP——第一次连上分到一个 IP，之后不掉线就一直固定；或像停车场分配固定车位，退了（删 Service）再重新登记才可能换。

**为什么「自动分配」反而更方便？** 它帮你**自动规避 IP 冲突**：池里的 IP 由 kube-vip-cloud-provider 统一管理，不会出现两个 Service 抢同一个 IP 的问题，比手动指定单个 IP 更省心、更稳定。

### 8.3 手动指定固定 VIP（示例）

**前提**：只有在**装了 kube-vip-cloud-provider（CCM）** 时，不写注解的 Service 才会从 `range-global` 池自动分配。**没装 CCM**（如本环境）时，每个 LoadBalancer Service 都**必须手动指定** VIP（否则 kube-vip 会 fallback 用节点 IP，危险）。如果某些业务需要一个固定、好记的入口 VIP，直接写注解即可——kube-vip 读到后就绑定你给的 IP。

**方式 1：注解 `kube-vip.io/loadbalancerIPs`（推荐，新版本）**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
  annotations:
    kube-vip.io/loadbalancerIPs: "192.168.1.215"   # 想固定成哪个 VIP
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 8080
  selector:
    app: my-app
```

**方式 2：注解 `kube-vip.io/requestedIP`（老版本 / 经典 k3s 教程常用，与新版本 `loadbalancerIPs` 等价）**

```yaml
  annotations:
    kube-vip.io/requestedIP: "192.168.1.215"
```

**方式 3：`spec.loadBalancerIP`（旧 API 字段，K8s 1.24+ 已废弃但仍可被 kube-vip 识别，不如注解稳妥）**

```yaml
spec:
  type: LoadBalancer
  loadBalancerIP: 192.168.1.215
```

> **指定 IP 的两铁律**：
> 1. 必须落在集群**同一二层网段**，否则其他节点/客户端 ARP 不到它，访问不通；
> 2. **绝对不能是任何节点的物理 IP**（如本环境的 `172.16.0.211` / `172.16.0.212`），否则节点宕机漂移时会二层抢 ARP，把原节点挤成 `NotReady`（见 8.1 致命坑）。
> 推荐直接取你 `range-global` 池里的某个空闲地址（本环境即 `172.16.0.180-185` 中未占用者）。
> 补充：地址池只是「自动分配时的管理范围」，kube-vip **不会校验**手动指定的 IP 是否落在池内——你可以指定池外的任意地址，前提是满足上面两铁律且网络中确实空闲。但池外 IP 跳过了 IPAM 的冲突保护，需你自行保证全网唯一，因此仍建议优先用池内地址。

**优先级回顾**：装了 CCM 时，Service 没写任何 IP → 从 `range-global` 池自动分配；没装 CCM 时，必须写 `loadbalancerIPs`（否则 fallback 节点 IP）。写了 `loadbalancerIPs` 就用你给的值。`vipHost` 只是 kube-vip 写回的承载节点记录，不用管。

**验证**：

```bash
kubectl get svc my-app -n <命名空间>        # 看 EXTERNAL-IP 是否为指定值
kubectl describe svc my-app -n <命名空间>    # Events 里看 kube-vip 分配日志
```

## 9. 部署 Service LB DaemonSet（`--services`：业务入口高可用）

第 3 章部署的是「控制平面高可用」DaemonSet（`--controlplane`，守护 `6443`）。本章部署**第二套独立 DaemonSet**（`--services`），给 `type: LoadBalancer` 的业务 Service（如 Traefik）提供**会漂移的外部 VIP**，解决第 7 章说的「节点物理 IP 不漂移」问题。

### 9.1 先理清分工：kube-vip 本体 vs kube-vip-cloud-provider

| 组件 | 形态 | 职责 |
| --- | --- | --- |
| **kube-vip 本体** | DaemonSet（`--services`） | 监听 LoadBalancer Service，在 leader 节点绑定 VIP、ARP 广播、故障漂移 |
| **kube-vip-cloud-provider** | Deployment（Cloud Controller，可选） | 从 ConfigMap 地址池自动挑空闲 IP，回填到 Service（模拟公有云 CCM 的分配行为） |

- **只装本体**：每个 Service 必须自己写 `spec.loadBalancerIP`（或注解 `kube-vip.io/loadbalancerIPs`）指定 IP，kube-vip 才会广播；
- **本体 + cloud-provider（推荐）**：Service 不用写 IP，cloud-provider 从地址池自动分配。

> 与第 3 章那套的关系：**两套 DaemonSet 共存、互不干扰**——一套 `cp_enable=true / svc_enable=false` 守 6443，一套 `cp_enable=false / svc_enable=true` 守业务 Service，关键 env 对照见 9.7。

### 9.2 第一步：关闭 K3s 内置 ServiceLB（避免两个 LB 打架）

K3s 默认自带 ServiceLB（`svclb-traefik`，即第 7 章把节点物理 IP 塞进 EXTERNAL-IP 的组件）。要用 kube-vip 统一接管 LoadBalancer，必须先关掉它，否则两个控制器会同时给 Service 分配地址。

**全新安装**时用环境变量传递参数（K3s 官方推荐的标准写法）：

```bash
curl -sfL https://get.k3s.io | \
  INSTALL_K3S_EXEC="server --tls-san 192.168.1.200 --disable servicelb" \
  sh -
```

**已安装的集群**：写配置文件后重启 K3s：

```yaml
# /etc/rancher/k3s/config.yaml
disable:
  - servicelb
```

```bash
sudo systemctl restart k3s
# 1. 查看系统命名空间下所有 svclb 资源
kubectl get ds -n kube-system | grep svclb
# 2. 清理所有遗留的 servicelb 相关 DaemonSet（系统会自动清理对应 Pod，Traefik 的 EXTERNAL-IP 会先变 <pending>，稍后由 CCM 自动分配或手动 loadbalancerIPs 指定）
kubectl get ds -n kube-system -o name | grep svclb | xargs -r kubectl delete -n kube-system
```

### 9.3 第二步：生成并部署 `--services` DaemonSet

```bash
export INTERFACE=enp0s3

# 只开 --services：不传 --controlplane，也不需要 --address（IP 由 Service 手动 loadbalancerIPs 指定，或由 cloud-provider 从地址池分配）
docker run --network host --rm ghcr.io/kube-vip/kube-vip:v1.2.2 manifest daemonset \
    --interface $INTERFACE \
    --services \
    --inCluster \
    --arp \
    --leaderElection | sudo tee /tmp/kube-vip-services.yaml
```

没有 Docker 时同样可用 `k3s ctr` 代替（语法见 3.2 节）；多节点网卡名不一致时去掉 `--interface` 自动探测（见 3.4 节）。

**apply 前必须改两处，避免与控制平面那套冲突**：

1. **改名字**：打开 `/tmp/kube-vip-services.yaml`，把 DaemonSet 的 `metadata.name`（以及配套 `ServiceAccount` / `ClusterRoleBinding` 中引用的名字，如有）改成与第 3 章不同的名字，例如 `kube-vip-services`，否则两套同名 DaemonSet 会互相覆盖。
2. **（推荐）开启 per-service 选主**：在容器 `env` 中加上下面这段，让每个 Service 各自选主、流量分散到不同节点，而不是全部压在同一个全局 leader 上：

```yaml
- name: svc_election
  value: "true"
```

> **`svc_election` 还有一个硬性使用场景**：Service 若设置 `externalTrafficPolicy: Local`（保留客户端源 IP），必须开启它——kube-vip 只会让「本地运行着该 Service Pod」的节点参与这个 Service 的选主。

应用并确认两套 DaemonSet 并存：

```bash
sudo k3s kubectl apply -f /tmp/kube-vip-services.yaml

# 应能同时看到控制面套与业务套两个 DaemonSet
sudo k3s kubectl get ds -n kube-system | grep kube-vip
```

### 9.4 第三步（推荐）：部署 cloud-provider 并配置地址池

**1）安装 kube-vip-cloud-provider**

```bash
sudo k3s kubectl apply -f https://raw.githubusercontent.com/kube-vip/kube-vip-cloud-provider/main/manifest/kube-vip-cloud-controller.yaml
```

**2）创建地址池 ConfigMap**（固定在 `kube-system` 命名空间、名为 `kubevip`）

```bash
# 方式一：IP 范围（range），.210~.220
sudo k3s kubectl create configmap -n kube-system kubevip \
  --from-literal=range-global=192.168.1.210-192.168.1.220

# 方式二：CIDR 网段（/29 即 .216~.223 共 8 个地址，二选一即可）
sudo k3s kubectl create configmap -n kube-system kubevip \
  --from-literal=cidr-global=192.168.1.216/29
```

或用 YAML 声明（全局池 + 命名空间池示例）：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kubevip
  namespace: kube-system
data:
  range-global: 192.168.1.210-192.168.1.220   # 任意命名空间的 Service 都可用
  cidr-default: 192.168.1.224/29              # 仅 default 命名空间可用
```

> 地址池规则：`*-global` 全集群可用；`range-<namespace>` / `cidr-<namespace>` 只对指定命名空间生效；池内 IP 必须与节点同网段且未被占用（先 `ping` 确认）。

### 9.5 第四步：暴露 Service 并验证

**方式 A：自动分配（依赖 9.4 的 cloud-provider）**

```bash
# 普通业务 Service 示例
sudo k3s kubectl expose deployment nginx-deploy --port=80 --type=LoadBalancer --name=nginx

# -w 持续观察，EXTERNAL-IP 会从 <pending> 变成池子里的某个 IP
sudo k3s kubectl get svc nginx -w
```

对于 Traefik：它本身就是 `type: LoadBalancer`，`--disable servicelb` 并装好 kube-vip 后，其 EXTERNAL-IP 会自动从地址池获得一个可漂移 VIP，无需手工 expose。

**方式 B：手动指定 IP（不装 cloud-provider 也行）**

```bash
# 命令行：--load-balancer-ip 指定固定 VIP
sudo k3s kubectl expose deployment nginx-deploy --port=80 --type=LoadBalancer \
  --name=nginx --load-balancer-ip=192.168.1.210
```

```yaml
# 或在 Service YAML 中二选一指定
spec:
  type: LoadBalancer
  loadBalancerIP: "192.168.1.210"
  # kube-vip 0.5.12+ 更推荐用注解（支持多个 IP，逗号分隔）
  # annotations:
  #   kube-vip.io/loadbalancerIPs: "192.168.1.210"
```

**验证 VIP 绑定与连通性**：

```bash
# 1. EXTERNAL-IP 已分配（不再是 <pending>）
sudo k3s kubectl get svc -A | grep -i loadbalancer

# 2. 在该 Service 的 leader 节点上，能看到 /32 的 VIP 绑到了网卡
ip -4 addr show dev enp0s3
# inet 192.168.1.210/32 scope global enp0s3

# 3. 局域网内访问验证
curl -I http://192.168.1.210
```

### 9.6 常用注解与进阶用法

| 注解 / 字段 | 作用 |
| --- | --- |
| `kube-vip.io/loadbalancerIPs: "x.x.x.x"` | 显式指定外部 IP（可多个，逗号分隔），优先级高于地址池 |
| `kube-vip.io/ignore: "true"` | 让 kube-vip 忽略该 Service（不绑定、不广播） |
| `spec.loadBalancerClass: kube-vip.io/kube-vip-class` | K8s 1.24+：多 LB 共存时声明只由 kube-vip 处理 |
| `spec.loadBalancerIP: 0.0.0.0` | 实验性 DHCP 模式：kube-vip 建 macvlan 接口向局域网 DHCP 租地址 |

- **多个 Service 共享同一个 VIP**：只要暴露端口不冲突即可（如同一 IP 上 80、81 各一个 Service），都用 `--load-balancer-ip` 指向同一 IP。
- **保留客户端源 IP**：Service 设 `externalTrafficPolicy: Local`，同时业务 DaemonSet 的 env 必须有 `svc_election: "true"`（见 9.3）。

### 9.7 两套 DaemonSet 关键 env 对照

| env | 控制平面套（第 3 章） | 业务 Service 套（本章） |
| --- | --- | --- |
| `cp_enable` | `"true"` | `"false"` |
| `svc_enable` | `"false"` | `"true"` |
| `svc_election` | 不需要 | 建议 `"true"`（per-service 选主；Local 流量策略必需） |
| `vip_address` / `--address` | 写死控制面 VIP（如 `.200`） | 不写，IP 由 Service 或地址池决定 |
| `port` | `6443` | 不适用（跟随每个 Service 自己的端口） |
| 守护对象 | kube-apiserver | 所有 `type: LoadBalancer` 的 Service |

> 部署完成后，集群里同时存在三个层次的地址：**控制平面 VIP**（`.200`，漂移）、**业务 Service VIP**（`.210` 等，漂移）、**节点物理 IP**（`.201`/`.202`，不漂移）——对照第 6、7 章理解，排查网络问题时先判断自己访问的是哪一层。
