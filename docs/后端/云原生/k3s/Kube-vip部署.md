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
