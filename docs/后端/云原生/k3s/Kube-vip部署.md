---
title: Kube-vip 部署 (ARP 模式)
icon: mdi:lan
sort: 4
---

在 K3s 中部署 Kube-vip，有两种主流方式：**K3s Auto-Manifests**（简单快速，适合初始化）和 **DaemonSet**（有控制器管理，适合生产环境长期运行）。

以下是针对 **ARP 模式（最常用、最简单的局域网 VIP 漂移模式）** 的完整部署流程。

## 部署方式选型

### 三种方式对比：谁在管理这个 Pod？

| 方式 | 管理主体 | 典型路径 / 方式 |
|------|---------|----------------|
| **K3s Auto-Manifests** | K3s Server 进程（内置 apply 逻辑） | `/var/lib/rancher/k3s/server/manifests/` |
| **DaemonSet** | Kubernetes DaemonSet Controller | `kubectl apply -f` |
| **Static Pod** | 节点上的 kubelet | `/etc/kubernetes/manifests/`（需 kubelet 开启） |

### 为什么不用 Static Pod？

K3s 为了轻量化，其 kubelet 默认**没有**配置 `--pod-manifest-path` 参数。直接往 `/var/lib/rancher/k3s/agent/podmanifests/` 放文件，kubelet 根本不会理睬。K3s 推荐使用 `/var/lib/rancher/k3s/server/manifests/`（注意是 `server` 不是 `agent`），这是 K3s 内置的 AddOn 自动部署路径。

### 核心对比一览

| 特性 | Static Pod | K3s Auto-Manifests | DaemonSet |
|:------|:-----------|:-------------------|:----------|
| **管理主体** | kubelet（节点级守护进程） | K3s Server（文件同步器） | DaemonSet Controller（集群级控制器） |
| **Pod 挂了会怎样？** | **立即重启**（kubelet 强制拉起） | **不会重启**（除非你改文件） | **立即重建**（控制器检测到副本数不足） |
| **节点重启后** | **自动重建**（kubelet 启动后读取目录） | **不会重建**（文件没变，不会触发 apply） | **自动重建**（调度到重启后的节点） |
| **依赖 API Server 吗？** | **不依赖**（即使集群挂了，kubelet 依然守护它） | **依赖**（必须通过 API Server 创建） | **依赖**（需要 API Server 协调） |
| **升级方式** | 登录服务器改文件 | 登录服务器改文件 | `kubectl edit` / `kubectl set image` 滚动升级 |
| **多节点部署** | 手动复制文件到每个节点 | 手动复制文件到每个节点 | `kubectl apply` 一次，自动调度 |
| **典型用途** | 集群引导（启动 etcd、apiserver） | 集群初始化时一次性安装插件 | 生产环境长驻服务（如网络插件、kube-vip） |

> **一句话总结**：Static Pod 有自愈（靠 kubelet），K3s Auto-Manifests 无自愈（靠文件触发），DaemonSet 有自愈且更强大（靠控制器）。

### 对部署 kube-vip 的建议

1. **测试环境 / K3s 快速初始化**：用 Auto-Manifests 丢文件即可，够简单。但注意节点重启后 Pod 不会自动恢复，需要手动 `touch` 一下文件触发重新 apply。
2. **生产环境（推荐）**：**强烈建议用 DaemonSet**。由集群控制器管理，具备完整的自愈和滚动更新能力，节点重启后自动恢复，无需人工干预。
3. **标准 K8s（如 kubeadm）**：Static Pod 是控制面引导的标配，但部署 kube-vip 这类附加组件，仍然推荐 **DaemonSet**，因为 Static Pod 无法通过 `kubectl rollout` 平滑升级。

> 💡 两种方式的生成命令几乎一样，只需把 `manifest pod` 改成 `manifest daemonset` 即可。

---

## 1. 准备工作与参数确认

在开始前，请先确认以下信息：

- **VIP（虚拟 IP）**：准备一个未被分配的局域网 IP（例如 `192.168.1.200`）。
- **网卡名称**：主节点的网卡名（例如 `eth0` 或 `ens33`），可通过 `ip a` 查看。
- **K3s Manifests 目录**（仅 Auto-Manifests 方式需要）：K3s 的自动部署清单存放路径是 `/var/lib/rancher/k3s/server/manifests/`。

---

## 方式 A：K3s Auto-Manifests（快速部署）

### A-1. 部署步骤（在第一个 Master 节点上）

#### A-1-1. 创建 Manifests 目录

```bash
sudo mkdir -p /var/lib/rancher/k3s/server/manifests/
```

#### A-1-2. 生成 Kube-vip 配置文件

我们可以直接使用 Kube-vip 官方的 Docker 镜像来自动生成 Pod 的 YAML 文件。请将命令中的 `192.168.1.200` 替换为你实际的 **VIP**，`eth0` 替换为你的**网卡名**。

> 💡 **关于版本号**：建议先到 [kube-vip Releases](https://github.com/kube-vip/kube-vip/releases) 页面查看最新版本号（最新的 Release 标签即为版本号），然后将下方命令中的 `v1.2.2` 替换为最新版本。

```bash
# 设置环境变量（按需修改）
export VIP=192.168.1.200
export INTERFACE=eth0

# 自动生成 YAML 并保存至 K3s Manifests 目录
docker run --network host --rm ghcr.io/kube-vip/kube-vip:v1.2.2 manifest pod \
    --interface $INTERFACE \
    --address $VIP \
    --controlplane \
    --arp \
    --leaderElection | sudo tee /var/lib/rancher/k3s/server/manifests/kube-vip.yaml
```

> ⚠️ **K3s 专属坑：kubeconfig 路径不同！** 原生 K8s 的 kubeconfig 路径是 `/etc/kubernetes/admin.conf`，但 **K3s 的配置文件路径是 `/etc/rancher/k3s/k3s.yaml`**。如果生成后的 YAML 中硬编码了原生 K8s 的路径，Pause 容器启动后 `kube-vip` 会因找不到文件而报错 `CrashLoopBackOff`。用 `k3s kubectl describe pod -n kube-system kube-vip-<node-name>` 可查看具体日志。

> **参数语义变化（v1.x 重要）**：旧版本中的 `--active` 是 v0.8 之前旧架构遗留的 Flag，在 **v1.x** 中已被彻底重构，拆分为两个职责明确的开关：
>
> - **`--controlplane`**：让 Kube-vip 接管 **Kubernetes 控制面（Control Plane）** 的 VIP。它会监听 API Server 的 **6443 端口**，在你多个 Master 节点间做 ARP 广播与选主（Leader Election），对外提供一个统一、可漂移的 `https://VIP:6443` 访问入口。这也是**本文档多 Master 高可用（HA）场景所必须的参数**。
> - **`--services`**：让 Kube-vip 同时充当 **Service LoadBalancer（负载均衡器）**，给 `type: LoadBalancer` 的 Service 自动分配并绑定一个外部 VIP。开启后，访问这些 Service 不再需要云厂商的 LB，也能在局域网内被直接路由。
>
>   ⚠️ **不建议在这里开启 `--services`！** 官方推荐 Control Plane HA 与 Service LB 分开部署：Service LB 功能应**单独通过 DaemonSet 或 Helm Chart** 部署一套独立的 kube-vip（仅传 `--services`，不加 `--controlplane`），不要和 Manifests 里部署的 Control Plane HA 混在一起，职责更清晰、升级也更方便。
>
> 两者互不依赖：只传 `--controlplane` 就只做 Control Plane 高可用（如本例）；只传 `--services` 就只做 Service LB；两个都传则两者兼顾。本文档的 HA 示例仅使用 `--controlplane`，不传 `--services`（生成的 YAML 中 `svc_enable` 即为 `"false"`）。

#### `--services` 与 `--controlplane` 的准确语义（避免误解）

> ⚠️ 常见误解是把 `--services` 直接理解成「管业务入口」。更准确的说法是：**`--services` 管的是「`LoadBalancer` 类型的 Service」，而「业务入口」只是它的结果之一**。两者的根本区别在于「谁在被高可用」。

| 维度 | `--controlplane` | `--services` |
| --- | --- | --- |
| 直接作用对象 | **Kube-apiserver**（控制面本身） | **`type: LoadBalancer` 的 Service**（通用，不特定于业务） |
| 服务端口 | `6443`（apiserver 固定端口） | Service 自己声明的端口（80/443 等） |
| 谁在使用 | kubelet、`kubectl`、节点 join | 任何 `LoadBalancer` Service（Traefik、DB 等都可能） |
| 本质 | 给「集群控制面」一个统一可漂移的固定访问地址 | 充当「Service LoadBalancer 提供者」，给 LB 型 Service 分配外部 VIP |

**为什么 `--services` ≠ 字面上的「业务入口」？**

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

#### `--services` 的 VIP 从哪来？（地址池 / DHCP / 单地址）

理解 `--services` 可漂移，关键是要搞清楚「它分配的 VIP 从哪来」。与 `--controlplane` 直接写死 `--address` 不同，`--services` 的 VIP 通常是**从地址池自动分配**的：

| 方式 | 说明 | 典型配置 |
| --- | --- | --- |
| **静态地址池** | 从一段 IP 范围里按需分配 | `--address 192.168.1.210-192.168.1.220`（或 ConfigMap 的 `range-global`） |
| **DHCP** | 从局域网 DHCP 服务器租用 IP | `--services` + DHCP 相关配置 |
| **单地址** | 直接指定某个固定 IP | `--address 192.168.1.210`（单个） |

> ⚠️ 关键点：`--services` 不是「手动指定一个全局业务入口 IP」，而是「**声明一段地址池，由 Kube-vip 给每个 `LoadBalancer` Service 自动分配一个 VIP**」。你有 N 个 `LoadBalancer` Service，就分 N 个 VIP，各自独立漂移。

**完整链路（以 Traefik 业务入口为例）**：

```text
部署独立 --services Kube-vip（配地址池，如 192.168.1.210-192.168.1.220）
        ↓
Traefik Service (type: LoadBalancer) 被自动分配一个 VIP（如 .210）
        ↓
Kube-vip 在 leader 节点把 .210 挂到网卡，ARP 通告
        ↓
前端/客户端访问 http://192.168.1.210/ → Traefik → 后端 Pod
        ↓
leader 节点挂了 → VIP .210 漂到存活节点 → 访问继续（秒级切换窗口）
```

> 注意：**漂移的是「VIP」本身**（同一个 IP 从坏节点切到好节点），不是「换一个 IP」。对外始终是同一个 IP，客户端无感，只是漂移那几秒可能有请求失败，因此建议客户端带重试。

#### VIP 是「一次性绑定」，不会变来变去

> ⚠️ 高频误解：看到「自动分配」就担心「VIP 会变来变去、不方便」。实际上**分配是一次性绑定，之后永久固定**。

**「自动」的真正含义**：指的是「创建 Service 时，Kube-vip 从地址池挑一个**当前空闲**的 IP 分给它，**无需你手动指定**」，而不是「每次访问都重新分配」。

- 第一次分配后，VIP 会写进 Service 的 `status.loadBalancer.ingress`；
- 只要 Service 不删，**VIP 永久不变**——Pod 重启、节点重启、VIP 漂移、滚动更新都不影响。

**什么时候才会变？** 只有一种情况：`kubectl delete service` 删掉再重建，它会重新从池里拿 IP（可能相同也可能不同）。

**VIP 生命周期一览表**：

| 操作 | VIP 会变吗 |
| --- | --- |
| 改 `deployment.yaml` 并滚动更新 | ❌ 不变 |
| Pod 崩溃 / 重建 | ❌ 不变 |
| 节点 / 服务器重启 | ❌ 不变 |
| VIP 漂移（节点挂了切到别的节点） | ❌ 不变（同一个 IP 漂移） |
| `kubectl delete service` 再重建 | ✅ **会变**（重新分配） |

> **「Service 不删」指的是 `kind: Service` 这个资源**（即 `service.yaml`），**不是 Ingress**。Ingress 只是「路由规则」（把外部请求转发到 Service），与 VIP 分配无关；VIP 绑定在 `LoadBalancer` 类型的 Service 上。
>
> 类比：像 DHCP 给电脑分 IP——第一次连上分到一个 IP，之后不掉线就一直固定；或像停车场分配固定车位，退了（删 Service）再重新登记才可能换。

**为什么「自动分配」反而更方便？** 它帮你**自动规避 IP 冲突**：池里的 IP 由 Kube-vip 统一管理，不会出现两个 Service 抢同一个 IP 的问题，比手动指定单个 IP 更省心、更稳定。

#### 机器上没有 Docker 怎么办？

由于 K3s 默认使用的是容器运行时 **containerd**，生产环境的 K3s 节点上通常**没有安装原生的 `docker` 命令**，这完全正常。下面提供几种简单的解决办法，任选其一即可。

##### 方法一：直接用 `k3s ctr` 代替 `docker`

K3s 内置了 `ctr`（containerd 的命令行工具），可以直接拉取并运行临时镜像，效果和 `docker run` 完全一样：

```bash
export VIP=172.16.0.210
export INTERFACE=enp0s3

# 用 k3s 内置的 ctr 拉取并运行镜像生成配置文件
sudo k3s ctr run --rm --net-host ghcr.io/kube-vip/kube-vip:v1.2.2 kube-vip-gen \
    manifest pod \
    --interface $INTERFACE \
    --address $VIP \
    --controlplane \
    --arp \
    --leaderElection | sudo tee /var/lib/rancher/k3s/server/manifests/kube-vip.yaml
```

> 注：`ctr run` 的语法要求给容器指定一个临时名称（例如上面的 `kube-vip-gen`）。

##### 方法二：在其他有 Docker 的电脑上生成

如果你本地电脑（比如 Mac/Windows 安装了 Docker）或者另一台测试机上有 `docker`，可以在那台机器上运行原始 `docker run ... manifest pod` 命令，把控制台输出的 YAML 内容**复制粘贴**到 K3s 服务器的 `/var/lib/rancher/k3s/server/manifests/kube-vip.yaml` 文件中即可（注意记得把里面的 `vip_address`、`vip_interface` 改成服务器实际的值）。

##### 方法三：手动编写 YAML

直接参考下方生成的 YAML 结构，手动创建 `/var/lib/rancher/k3s/server/manifests/kube-vip.yaml` 文件，把 `vip_interface` 和 `vip_address` 改成你的实际网络参数即可：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: kube-vip
  namespace: kube-system
spec:
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
      value: eth0              # 修改为你的网卡名
    - name: vip_cidr
      value: "32"
    - name: cp_enable
      value: "true"           # 代表开启了 Control Plane 高可用
    - name: svc_enable
      value: "false"          # 未传 --services，默认不开启 Service 代理
    - name: cp_namespace
      value: kube-system
    - name: vip_leaderelection
      value: "true"
    - name: vip_address
      value: 192.168.1.200     # 修改为你的 VIP
  hostNetwork: true
```

> 💡 **推荐做法**：生产环境、多网卡或对稳定性要求高的场景，**强烈建议显式指定 `--interface`**（如上方示例），明确写死 `vip_interface`，避免因自动探测出错导致 VIP 漂移失败。下面的「自动探测」仅作为多节点便捷方案，需自行评估风险。

##### 验证部署

文件保存完成后，K3s 的 Manifests 自动部署机制会检测到该文件并拉取镜像运行：

```bash
# 查看 pod 状态（可能需要等待几十秒拉取镜像）
sudo k3s kubectl get pods -n kube-system -l app.kubernetes.io/name=kube-vip-ds
# 或者直接看 pod 状态
sudo k3s kubectl get pods -n kube-system | grep kube-vip
```

#### A-1-3. 进阶：生成时自动探测网卡（便捷方案，有风险）

如果你希望生成的 YAML 一份通吃所有 Master 节点，可以在**生成命令里直接去掉 `--interface` 参数**。Kube-vip 的命令行生成器（`manifest pod`）支持不传 `--interface`，这样生成的 YAML 中**完全不会包含 `vip_interface` 这个环境变量**，Kube-vip 启动时会自动触发网卡检测，找到有默认路由（Default Gateway）的主网卡：

```bash
export VIP=192.168.1.200

# 直接去掉 --interface 参数
docker run --network host --rm ghcr.io/kube-vip/kube-vip:v1.2.2 manifest pod \
    --address $VIP \
    --controlplane \
    --arp \
    --leaderElection | sudo tee /var/lib/rancher/k3s/server/manifests/kube-vip.yaml
```

> ⚠️ **风险提示**：自动探测依赖"默认网关所在网卡"这一假设。**多网卡环境**（如业务网卡与管理网卡分离）、网络拓扑复杂或重启后默认路由变化的生产环境，探测结果可能与预期不符，导致 VIP 绑定到错误网卡甚至绑定失败。这类场景请务必显式指定 `vip_interface`。
>
> 这个不带 `vip_interface` 的 YAML 可以直接复制给所有 Master 节点，效果与在 YAML 里把 `vip_interface` 显式设为 `""` 完全一致（详见下一节）。

---

## A-2. 部署到其他 Control Plane 节点

如果你有多个 Master 节点（如 3 节点 HA 架构）：

只需要将第一步生成的 `/var/lib/rancher/k3s/server/manifests/kube-vip.yaml` 配置文件，**原封不动地复制到其他每一个 Master 节点的对应目录下**即可：

```bash
# 示例：复制到 master2 和 master3
scp /var/lib/rancher/k3s/server/manifests/kube-vip.yaml root@master2:/var/lib/rancher/k3s/server/manifests/
scp /var/lib/rancher/k3s/server/manifests/kube-vip.yaml root@master3:/var/lib/rancher/k3s/server/manifests/
```

K3s 的 Manifests 自动部署机制会检测到该文件并启动 Kube-vip Pod。

> ⚠️ **关于「原封不动复制」的关键前提**：之所以前面说"原封不动复制"，前提是**所有 Master 节点的网卡名称一致**。Kube-vip 绑定 VIP 时需要知道宿主机的网卡名称（ARP 广播要指定从哪张网卡发出去），因此 `vip_interface` 的值必须与实际节点的网卡名匹配。下面分两种情况说明。

### 情况一：所有节点网卡名【一致】（最常见）

在绝大多数 Linux 部署（尤其是统一安装的同型号虚拟机或物理机）中，所有节点的网卡名都是相同的（例如都是 `eth0` 或都是 `ens33`）。

- **结果**：在第一个节点生成的 `kube-vip.yaml` 可以直接复制给 Master 2、Master 3，**完全不需要修改**。

### 情况二：不同 Master 节点网卡名【不一致】（重点！）

如果各 Master 节点的网卡名不统一（例如 Master 1 是 `eth0`、Master 2 是 `ens33`、Master 3 是 `enp1s0`）：

- **必须修改**：复制 `kube-vip.yaml` 到 Master 2、Master 3 后，**必须打开该文件，把 `vip_interface` 改为对应节点自己的实际网卡名**。否则 Kube-vip 漂移到该节点时会因找不到网卡而无法绑定 VIP。

```yaml
# 在 Master 2 上修改 /var/lib/rancher/k3s/server/manifests/kube-vip.yaml
- name: vip_interface
  value: ens33              # <-- 改成 Master 2 自己的网卡名
```

### 极简避坑技巧：让 Kube-vip 自动探测网卡

如果不想为每个节点单独改网卡名（尤其节点很多、且确认单网卡环境时），可以参考上方「进阶」中的做法：去掉 `--interface` 参数生成 YAML，或者手动把 `vip_interface` 设为 `""`（留空），Kube-vip 会自动寻找当前节点上带有**默认网关（Default Gateway）**的那张主网卡。

这样生成的 YAML 就可以直接复制到所有 Master 节点上，省去逐节点改网卡名的麻烦。但注意上文中提到的**自动探测风险**同样适用。

---

## 方式 B：DaemonSet（推荐生产环境）

DaemonSet 是 Kubernetes 原生的控制器资源，会确保**每个匹配节点上恰好运行一个 Pod**。与 Auto-Manifests 方式相比，DaemonSet 部署一次即可自动覆盖所有节点，升级和回滚也更方便。

### B-1. DaemonSet 的关键参数：`--inCluster` 与 `--taint`

与 Auto-Manifests 的 `manifest pod` 不同，DaemonSet 方式有两个必须关注的额外参数：

| 参数 | 必要性 | 作用 |
|:-----|:------|:-----|
| **`--inCluster`** | ✅ **必须添加** | 让 kube-vip 使用 Pod 内置的 ServiceAccount Token 与 API Server 通信（`InClusterConfig`）。不加会导致容器因找不到外部 kubeconfig 文件而 **CrashLoopBackOff**。 |
| **`--taint`** | ⚠️ 视环境而定 | 让生成器自动添加针对 Control Plane 污点的 `tolerations`，确保 kube-vip 能调度到 Master 节点上。 |

> **为什么 DaemonSet 必须加 `--inCluster`？** Auto-Manifests 生成的 `kind: Pod` 默认挂载宿主机路径读取 kubeconfig，但 DaemonSet 是运行在集群**内部**的，依赖 InCluster 认证来执行 Leader Election 和监听节点变化。不加 `--inCluster`，容器启动后会因找不到 kubeconfig 文件直接报错退出。
>
> **关于 `--taint`**：K3s 默认 Master 节点**不带污点**，此时不加也没事。但如果你初始化时传了 `--node-taint`，或者希望确保 kube-vip 只在 Control Plane 节点上运行，就必须加 `--taint` 让生成的 YAML 包含对应的 `tolerations`。**建议一律加上，生成的 YAML 更健壮。**

### B-2. 生成 DaemonSet YAML

完整的推荐命令如下（比 Auto-Manifests 多了 `--inCluster` 和 `--taint`）：

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

> 如果机器上没有 Docker，同样可以用 `k3s ctr` 替代（参考上文 A-1-2 中的方法）。

### B-3. 应用 DaemonSet

生成完成后，用 `kubectl` 提交到集群：

```bash
sudo k3s kubectl apply -f /tmp/kube-vip-daemonset.yaml
```

DaemonSet Controller 会自动在所有 Control Plane 节点上创建 Kube-vip Pod。

> ⚠️ **RBAC 权限前置条件**：通过 `--inCluster` + `--leaderElection` 运行时，kube-vip 需要读写 Lease 资源来做选主。如果应用 YAML 后 Pod 报 `403 Forbidden` 错误，说明缺少 RBAC 权限。`manifest daemonset` 命令默认**会**在生成的 YAML 中附带 `ServiceAccount`、`ClusterRole` 和 `ClusterRoleBinding`，无需手动创建。如果使用手动编写的 YAML（下方 B-4），请确保包含了这些 RBAC 资源。

### B-4. 手动编写 DaemonSet YAML（参考）

如果不方便使用命令行生成，可以直接编写如下 DaemonSet 清单：

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
          value: eth0              # 修改为你的网卡名
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

> **关于 `nodeSelector` 与 `tolerations`**：DaemonSet 默认会在所有节点上运行，这里通过 `nodeSelector` 限制仅运行在 Control Plane 节点上，并通过 `tolerations` 允许调度到有污点的 Master 节点。如果你使用的是旧版 K3s（使用 `node-role.kubernetes.io/master` 标签），请相应调整 `nodeSelector`。
>
> ⚠️ **手动编写时注意**：上方 YAML 只展示了 DaemonSet 资源本身。实际运行时还需要配套的 RBAC 资源（`ServiceAccount`、`ClusterRole`、`ClusterRoleBinding`），否则 `--leaderElection` 会因权限不足而失败。**建议直接用 `manifest daemonset` 命令生成**，它会自动附带完整的 RBAC 配置，省去手动编写的麻烦。

### B-5. 验证 DaemonSet 状态

```bash
# 查看 DaemonSet 整体状态（DESIRED / CURRENT / READY 应该一致）
sudo k3s kubectl get daemonset -n kube-system kube-vip

# 查看各节点上的 Pod
sudo k3s kubectl get pods -n kube-system -l app.kubernetes.io/name=kube-vip-ds -o wide
```

### B-6. DaemonSet 方式的多节点优势

DaemonSet 方式不需要手动 `scp` 文件到每个节点：

- **新节点加入**：新的 Master 节点加入集群后，DaemonSet Controller 会自动在该节点上创建 Kube-vip Pod，无需人工干预。
- **节点下线**：Master 节点被移除后，对应的 Pod 自动清理。
- **升级**：修改 DaemonSet 的镜像版本即可触发滚动更新：

```bash
sudo k3s kubectl set image daemonset/kube-vip -n kube-system \
    kube-vip=ghcr.io/kube-vip/kube-vip:v1.2.2
```

> ⚠️ **注意**：DaemonSet 方式**同样需要关注网卡名一致性问题**。如果各节点网卡名不同，需要在 `env` 中将 `vip_interface` 设为 `""`（留空），让 Kube-vip 自动探测网卡，否则生成的 YAML 对所有节点使用同一个 `vip_interface` 值。

### B-7. 故障排查：DaemonSet 报 `FailedCreate`（缺少 RBAC）

如果在应用 DaemonSet 后，Pod 一直无法创建，可用 `describe` 查看 DaemonSet 事件：

```bash
sudo k3s kubectl describe daemonset kube-vip-ds -n kube-system
```

如果事件中出现如下报错，说明问题出在 **RBAC 权限缺失**：

```text
Events:
  Type     Reason        Age                  From                 Message
  ----     ------        ----                 ----                 -------
  Warning  FailedCreate  12m (x22 over 117m)  daemonset-controller  Error creating: pods "kube-vip-ds-" is forbidden: error looking up service account kube-system/kube-vip: serviceaccount "kube-vip" not found
```

#### 根本原因

报错核心原因是 `kube-system` 命名空间中缺少名为 **`kube-vip`** 的**服务账号（ServiceAccount）**及其对应的 RBAC 权限配置，导致 DaemonSet 无法创建 Pod。

> 💡 这通常发生在：使用了**手动编写的 DaemonSet YAML（B-4）但漏掉了 RBAC 资源**，或者生成的 YAML 中 `serviceAccountName` 引用了不存在的 ServiceAccount。正常通过 `manifest daemonset` 命令生成的 YAML 会自带 RBAC，不会出现此问题。

#### 修复步骤

**1）应用 kube-vip RBAC 配置文件**

确保清单中包含 `ServiceAccount`、`ClusterRole` 及 `ClusterRoleBinding`。可以直接应用官方 RBAC 资源：

```bash
sudo k3s kubectl apply -f https://kube-vip.io/manifests/rbac.yaml
```

（也可以将官方清单保存到本地后 `kubectl apply -f` 离线应用）

**2）验证 ServiceAccount 是否建立**

确认 `kube-vip` ServiceAccount 已成功生成：

```bash
sudo k3s kubectl get serviceaccount kube-vip -n kube-system
```

**3）检查 DaemonSet Pod 创建状态**

查看 `kube-vip-ds` 的 Pod 是否已成功调度并运行：

```bash
sudo k3s kubectl get pods -n kube-system -l name=kube-vip-ds
```

> ⚠️ 注意：官方 RBAC 清单中 DaemonSet 的标签可能是 `name=kube-vip-ds`，而本文档 B-2/B-5 通过 `manifest daemonset` 生成的标签为 `app.kubernetes.io/name=kube-vip-ds`。查询时请以你实际 YAML 中的 `matchLabels` 为准（二选一即可，或两者都试）。

---

## 4. 验证与测试（两种方式通用）

### 1) 查看 Pod 运行状态

在集群中运行命令检查 Pod：

```bash
# DaemonSet 方式：按标签查看
sudo k3s kubectl get pods -n kube-system -l app.kubernetes.io/name=kube-vip-ds -o wide

# Auto-Manifests 方式：直接按名称查看
sudo k3s kubectl get pods -n kube-system kube-vip
```

#### 1.1) 诊断技巧：定位 Pod 异常原因

如果 Pod 状态不是 `Running`，不要先看日志，按以下顺序排查：

#### 查看 Pod 事件（定位确切原因）

`describe` 命令是诊断 Pod 问题的第一入口，重点关注输出的 **`Events:`** 部分：

```bash
sudo k3s kubectl describe pod kube-vip -n kube-system
```

在输出最底部，Events 会直接告诉你问题所在：

- 如果看到 `Pulling image "ghcr.io/..."` 且长时间卡住 → **镜像下载不下来**
- 如果看到 `Failed to pull image... i/o timeout` → **网络连接超时**
- 如果是 CNI 或挂载问题，也会在这里抛出明确报错

#### 实时观察 Pod 状态变化

`-w`（`--watch`）会持续监听 Pod 状态变化并实时输出，适合观察 Pod 从 `Pending` → `Running` 的整个过程：

```bash
sudo k3s kubectl get pod kube-vip -n kube-system -w
```

配合使用技巧：先 `-w` 看状态变化节奏，再 `describe` 查 Events 定位原因。

#### 查看 Pod 日志

当 Events 不够详细或需要进一步排查运行时错误时，查看容器日志：

```bash
sudo k3s kubectl logs -n kube-system kube-vip --tail=100
```

`--tail=100` 只拉取最近 100 行日志，避免输出过多。如果 Pod 中有多个容器，还需要用 `-c <容器名>` 指定容器。

> 完整排查顺序：`get pods` 确认状态 → `describe` 看 Events → `logs` 查运行时日志。

### 2) 检查 VIP 绑定

在获得了 Leader 身份的 Master 节点上运行 `ip a`，你应该能看到 VIP 已经绑定到了对应网卡上：

```bash
ip a show dev eth0
# 输出中应该包含：inet 192.168.1.200/32 scope global eth0
```

### 3) 连通性测试

在局域网内任意一台机器上 ping 该 VIP：

```bash
ping 192.168.1.200
```

如果能 ping 通，说明 Control Plane 的高可用 VIP 已经生效！后续其他 Node 节点加入集群或 `kubectl` 命令行工具都可以直接使用 `https://192.168.1.200:6443` 作为 Master 地址。

---

## 5. 关于 VIP 的常见疑问

### VIP 是某个 Master 节点的真实 IP 吗？

**不是**，`192.168.1.200` **不能**是任何一个 Master 节点的真实 IP，它必须是一个**独立、未被使用的空闲 IP**。

它在架构中扮演的角色是 **VIP（Virtual IP，虚拟 IP）**：

| 角色 | IP 示例 |
|------|---------|
| Master 1 真实 IP | `192.168.1.10` |
| Master 2 真实 IP | `192.168.1.11` |
| Master 3 真实 IP | `192.168.1.12` |
| **VIP（虚拟 IP）** | **`192.168.1.200`** |

> 在选定 VIP 前，请在局域网内 `ping 192.168.1.200` 确认**无法 ping 通**（确保当前没有被路由器或其他设备占用）。

### 它的工作原理是怎样的？

1. **自动漂移**：Kube-vip 会在三个 Master 节点之间进行"选主（Leader Election）"。假设选中了 Master 1，Kube-vip 就会动态地把 `192.168.1.200` 这个 IP **挂载**到 Master 1 的网卡上。
2. **故障转移**：如果 Master 1 突然宕机，另外两个节点上的 Kube-vip 会立刻感知到，并在几秒钟内自动把 `192.168.1.200` **抢过来**挂载到 Master 2 的网卡上。

### 在安装 K3s 时该怎么用这个 VIP？

有了这个 VIP 之后，你所有的 Worker 节点和 `kubectl` 工具就**不需要**绑定某一台具体的 Master 节点 IP 了，直接统一连接 VIP 即可：

- **初始化 Master 1**：指定 `--tls-san=192.168.1.200`（告诉 K3s 生成证书时允许用这个 VIP 访问）。
- **加入 Master 2 / Master 3 / Worker 节点**：连接地址直接填 `https://192.168.1.200:6443`。

---

## 6. 两种 VIP 并存时的区分（cp_enable vs Service LB）

> ⚠️ **本节是实践中踩坑后的补充**。当集群**同时**运行「Control Plane 高可用」和「Service LoadBalancer」两种 Kube-vip 能力时，会出现**两个不同用途的 VIP 并存**，排查网络时极易混淆，务必区分清楚。

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
| `192.168.1.201` / `.202` | Kube-vip Service LB（`--services`） | Traefik 业务入口（`80`/`443` 端口） |

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

---

## 7. `.201`/`.202` 不会漂移：业务入口的真实高可用现状

> ⚠️ 本节是在 6 节基础上**进一步深入排查后**的重要修正：`.201`/`.202` 其实**并不是会漂移的 VIP**，而是各节点的物理 IP。如果只看 Traefik Service 的 `EXTERNAL-IP`，很容易误以为它们具备和 `.200` 一样的漂移能力。

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
| `.200` | Kube-vip `cp_enable` 漂移 VIP | ✅ 漂移到存活节点 |
| `.201` | k3s-01 物理 IP（ServiceLB 暴露） | ❌ **直接不可用**（节点物理 IP 不漂移） |
| `.202` | k3s-02 物理 IP（ServiceLB 暴露） | ❌ **直接不可用** |

> 所以「业务入口走 `.201`，`.201` 挂了」的真实后果是：**走 `.201` 的流量会断**，除非上层（客户端/DNS/LB）能自动切到 `.202`。`.201`/`.202` 本身**没有单 IP 漂移的高可用能力**。

### 7.4 要真正实现业务入口高可用，需部署独立 Service LB

如果你希望业务入口也像 `.200` 一样「节点挂了自动漂移」，需要**额外部署一套独立 Kube-vip**，只开 `--services`（不开 `--controlplane`），让它给 Traefik 分配一个**独立、可漂移**的业务 VIP。

> 🔗 补充：关于「Traefik 是 K3s 内置、为什么项目 k8s 目录里看不到它」「Ingress 与 Service 的分工」「Ingress 不分配 IP、高可用靠 Traefik 入口」「ServiceLB vs Kube-vip --services」「Traefik Service 能否删」等关联知识点，详见《Ingress与Service与Traefik入口的关系》。

官方明确推荐「Control Plane HA 与 Service LB 分开部署」（见本文档 5.x 节 `--controlplane` 与 `--services` 的说明）。

生成独立 Service LB 的 DaemonSet：

```bash
export INTERFACE=enp0s3

# 仅 --services，不传 --controlplane
docker run --network host --rm ghcr.io/kube-vip/kube-vip:v1.2.2 manifest daemonset \
    --interface $INTERFACE \
    --services \
    --inCluster \
    --arp \
    --leaderElection | sudo tee /tmp/kube-vip-services.yaml
```

> 部署后，`type: LoadBalancer` 的 Service（如 Traefik）会被分配一个**独立的、会漂移的 VIP**（来自 Kube-vip 的地址池或配置），前端统一指向这个 VIP 即可实现单入口高可用。

### 7.5 业务入口高可用的三种层次（选型参考）

| 方案 | 高可用能力 | 复杂度 | 适用 |
| --- | --- | --- | --- |
| 直接走节点物理 IP（`.201`/`.202`） | ❌ 单 IP 不漂移，靠上层切换 | 最低 | 临时/开发调试 |
| 部署独立 Service LB（`--services`） | ✅ 单 VIP 漂移 | 中 | 生产（推荐） |
| 域名 + DNS 轮询指向多个 VIP/IP | ✅ 客户端天然分散 | 中 | 生产（配合上者更稳） |

> **最佳实践**：独立 Service LB 提供可漂移的业务 VIP + 域名指向该 VIP + 客户端重试（扛漂移秒级窗口），三层叠加最稳。
