---
title: Kube-vip 部署 (Static Pod + ARP 模式)
icon: network-wired
sort: 4
---

在 K3s 中部署 Kube-vip 非常简单，官方推荐的方式是将它作为 **Static Pod（静态 Pod）** 部署在 Control Plane（Master）节点上。

这样即使 Kubernetes 集群的 API Server 暂时不可用，Kube-vip 也能由 Kubelet 自动拉起并维持 VIP。

以下是针对 **ARP 模式（最常用、最简单的局域网 VIP 漂移模式）** 的完整部署流程。

---

## 1. 准备工作与参数确认

在开始前，请先确认以下信息：

- **VIP（虚拟 IP）**：准备一个未被分配的局域网 IP（例如 `192.168.1.200`）。
- **网卡名称**：主节点的网卡名（例如 `eth0` 或 `ens33`），可通过 `ip a` 查看。
- **K3s 镜像目录**：K3s 的 Static Pod 存放路径默认是 `/var/lib/rancher/k3s/agent/podmanifests/`。

---

## 2. 部署步骤（在第一个 Master 节点上）

### 第一步：创建 Static Pod 清单目录

```bash
sudo mkdir -p /var/lib/rancher/k3s/agent/podmanifests/
```

### 第二步：生成 Kube-vip 配置文件

我们可以直接使用 Kube-vip 官方的 Docker 镜像来自动生成 Static Pod 的 YAML 文件。请将命令中的 `192.168.1.200` 替换为你实际的 **VIP**，`eth0` 替换为你的**网卡名**：

```bash
# 设置环境变量（按需修改）
export VIP=192.168.1.200
export INTERFACE=eth0

# 自动生成 YAML 并保存至 K3s 静态 Pod 目录
docker run --network host --rm ghcr.io/kube-vip/kube-vip:v0.8.0 manifest pod \
    --interface $INTERFACE \
    --address $VIP \
    --active \
    --arp \
    --leaderElection | sudo tee /var/lib/rancher/k3s/agent/podmanifests/kube-vip.yaml
```

> **提示**：如果机器上没有安装 Docker，也可以直接用 `nerdctl` 或 `crictl`，或者手动创建这个 YAML 文件（详见下方 YAML 结构）。

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
    image: ghcr.io/kube-vip/kube-vip:v0.8.0
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
    - name: cp_namespace
      value: kube-system
    - name: vip_leaderelection
      value: "true"
    - name: vip_address
      value: 192.168.1.200     # 修改为你的 VIP
  hostNetwork: true
```

> 💡 **推荐做法**：生产环境、多网卡或对稳定性要求高的场景，**强烈建议显式指定 `--interface`**（如上方示例），明确写死 `vip_interface`，避免因自动探测出错导致 VIP 漂移失败。下面的「自动探测」仅作为多节点便捷方案，需自行评估风险。

### 进阶：生成时自动探测网卡（便捷方案，有风险）

如果你希望生成的 YAML 一份通吃所有 Master 节点，可以在**生成命令里直接去掉 `--interface` 参数**。Kube-vip 的命令行生成器（`manifest pod`）支持不传 `--interface`，这样生成的 YAML 中**完全不会包含 `vip_interface` 这个环境变量**，Kube-vip 启动时会自动触发网卡检测，找到有默认路由（Default Gateway）的主网卡：

```bash
export VIP=192.168.1.200

# 直接去掉 --interface 参数
docker run --network host --rm ghcr.io/kube-vip/kube-vip:v0.8.0 manifest pod \
    --address $VIP \
    --active \
    --arp \
    --leaderElection | sudo tee /var/lib/rancher/k3s/agent/podmanifests/kube-vip.yaml
```

> ⚠️ **风险提示**：自动探测依赖“默认网关所在网卡”这一假设。**多网卡环境**（如业务网卡与管理网卡分离）、网络拓扑复杂或重启后默认路由变化的生产环境，探测结果可能与预期不符，导致 VIP 绑定到错误网卡甚至绑定失败。这类场景请务必显式指定 `vip_interface`。
>
> 这个不带 `vip_interface` 的 YAML 可以直接复制给所有 Master 节点，效果与在 YAML 里把 `vip_interface` 显式设为 `""` 完全一致（详见下一节）。

---

## 3. 部署到其他 Control Plane 节点

如果你有多个 Master 节点（如 3 节点 HA 架构）：

只需要将第一步生成的 `/var/lib/rancher/k3s/agent/podmanifests/kube-vip.yaml` 配置文件，**原封不动地复制到其他每一个 Master 节点的对应目录下**即可：

```bash
# 示例：复制到 master2 和 master3
scp /var/lib/rancher/k3s/agent/podmanifests/kube-vip.yaml root@master2:/var/lib/rancher/k3s/agent/podmanifests/
scp /var/lib/rancher/k3s/agent/podmanifests/kube-vip.yaml root@master3:/var/lib/rancher/k3s/agent/podmanifests/
```

K3s 的 Kubelet 会自动检测到该文件并启动 Kube-vip Pod。

> ⚠️ **关于「原封不动复制」的关键前提**：之所以前面说“原封不动复制”，前提是**所有 Master 节点的网卡名称一致**。Kube-vip 绑定 VIP 时需要知道宿主机的网卡名称（ARP 广播要指定从哪张网卡发出去），因此 `vip_interface` 的值必须与实际节点的网卡名匹配。下面分两种情况说明。

### 情况一：所有节点网卡名【一致】（最常见）

在绝大多数 Linux 部署（尤其是统一安装的同型号虚拟机或物理机）中，所有节点的网卡名都是相同的（例如都是 `eth0` 或都是 `ens33`）。

- **结果**：在第一个节点生成的 `kube-vip.yaml` 可以直接复制给 Master 2、Master 3，**完全不需要修改**。

### 情况二：不同 Master 节点网卡名【不一致】（重点！）

如果各 Master 节点的网卡名不统一（例如 Master 1 是 `eth0`、Master 2 是 `ens33`、Master 3 是 `enp1s0`）：

- **必须修改**：复制 `kube-vip.yaml` 到 Master 2、Master 3 后，**必须打开该文件，把 `vip_interface` 改为对应节点自己的实际网卡名**。否则 Kube-vip 漂移到该节点时会因找不到网卡而无法绑定 VIP。

```yaml
# 在 Master 2 上修改 /var/lib/rancher/k3s/agent/podmanifests/kube-vip.yaml
- name: vip_interface
  value: ens33              # <-- 改成 Master 2 自己的网卡名
```

### 极简避坑技巧（便捷方案，有风险）：让 Kube-vip 自动探测网卡

如果不想为每个节点单独改网卡名（尤其节点很多、且确认单网卡环境时），Kube-vip 支持**自动检测网卡（Auto-detect）**：只需要在配置中把 `vip_interface` 设为 `""`（留空）或删除该环境变量，Kube-vip 会自动寻找当前节点上带有**默认网关（Default Gateway）**的那张主网卡。

```yaml
- name: vip_interface
  value: ""              # 留空即可让 Kube-vip 自动寻找有默认网关的网卡
```

这样生成的 YAML 就可以直接复制到所有 Master 节点上，省去逐节点改网卡名的麻烦。

> ⚠️ **风险提示**：自动探测依赖“默认网关所在网卡”这一假设。**多网卡环境**（如业务网卡与管理网卡分离）、生产环境、或对稳定性要求高的场景，探测结果可能出错，导致 VIP 绑定到错误网卡甚至绑定失败。**这类场景仍推荐显式指定 `vip_interface`**（见上方「情况二」），把风险降到最低。

---

## 4. 验证与测试

### 1) 查看 Pod 运行状态

在集群中运行命令检查 Pod：

```bash
kubectl get pods -n kube-system -l app.kubernetes.io/name=kube-vip-ds
# 或者查看 static pod：
kubectl get pods -n kube-system | grep kube-vip
```

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

- **Master 1 真实 IP**：例如 `192.168.1.10`
- **Master 2 真实 IP**：例如 `192.168.1.11`
- **Master 3 真实 IP**：例如 `192.168.1.12`
- **VIP（虚拟 IP）**：`192.168.1.200`（独立出来的虚拟地址）

### 它的工作原理是怎样的？

1. **自动漂移**：Kube-vip 会在三个 Master 节点之间进行“选主（Leader Election）”。假设选中了 Master 1，Kube-vip 就会动态地把 `192.168.1.200` 这个 IP **挂载**到 Master 1 的网卡上。
2. **故障转移**：如果 Master 1 突然宕机，另外两个节点上的 Kube-vip 会立刻感知到，并在几秒钟内自动把 `192.168.1.200` **抢过来**挂载到 Master 2 的网卡上。

### 在安装 K3s 时该怎么用这个 VIP？

有了这个 VIP 之后，你所有的 Worker 节点和 `kubectl` 工具就**不需要**绑定某一台具体的 Master 节点 IP 了，直接统一连接 VIP 即可：

- **初始化 Master 1**：指定 `--tls-san=192.168.1.200`（告诉 K3s 生成证书时允许用这个 VIP 访问）。
- **加入 Master 2 / Master 3 / Worker 节点**：连接地址直接填 `https://192.168.1.200:6443`。

> ⚠️ **注意**：在选定 VIP 前，请在局域网内 `ping 192.168.1.200` 确认**无法 ping 通**（确保当前没有被路由器或其他设备占用）。
