---
title: Kube-vip 部署 (ARP 模式)
icon: network-wired
sort: 4
---

在 K3s 中部署 Kube-vip，推荐利用 K3s 的 **Manifest AddOn 自动部署机制**，将 Pod 清单放入 Server 节点的 Manifests 目录，K3s 启动时会自动加载并部署。

这样即使 Kubernetes 集群的 API Server 暂时不可用，Kube-vip 也能由 K3s 自动拉起并维持 VIP。

> **为什么不用 Kubelet 的 Static Pod？** K3s 的 kubelet 默认**没有**配置 `--pod-manifest-path` 参数，直接往 `/var/lib/rancher/k3s/agent/podmanifests/` 放文件不会被加载。K3s 推荐使用 `/var/lib/rancher/k3s/server/manifests/`（注意是 `server` 不是 `agent`），这是 K3s 内置的 AddOn 自动部署路径，效果类似于 `kubectl apply`，目录中的 YAML 文件在启动时和文件变更时都会被自动应用。

以下是针对 **ARP 模式（最常用、最简单的局域网 VIP 漂移模式）** 的完整部署流程。

---

## 1. 准备工作与参数确认

在开始前，请先确认以下信息：

- **VIP（虚拟 IP）**：准备一个未被分配的局域网 IP（例如 `192.168.1.200`）。
- **网卡名称**：主节点的网卡名（例如 `eth0` 或 `ens33`），可通过 `ip a` 查看。
- **K3s Manifests 目录**：K3s 的自动部署清单存放路径是 `/var/lib/rancher/k3s/server/manifests/`。

---

## 2. 部署步骤（在第一个 Master 节点上）

### 第一步：创建 Manifests 目录

```bash
sudo mkdir -p /var/lib/rancher/k3s/server/manifests/
```

### 第二步：生成 Kube-vip 配置文件

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

### 进阶：生成时自动探测网卡（便捷方案，有风险）

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

> ⚠️ **风险提示**：自动探测依赖“默认网关所在网卡”这一假设。**多网卡环境**（如业务网卡与管理网卡分离）、网络拓扑复杂或重启后默认路由变化的生产环境，探测结果可能与预期不符，导致 VIP 绑定到错误网卡甚至绑定失败。这类场景请务必显式指定 `vip_interface`。
>
> 这个不带 `vip_interface` 的 YAML 可以直接复制给所有 Master 节点，效果与在 YAML 里把 `vip_interface` 显式设为 `""` 完全一致（详见下一节）。

---

## 3. 部署到其他 Control Plane 节点

如果你有多个 Master 节点（如 3 节点 HA 架构）：

只需要将第一步生成的 `/var/lib/rancher/k3s/server/manifests/kube-vip.yaml` 配置文件，**原封不动地复制到其他每一个 Master 节点的对应目录下**即可：

```bash
# 示例：复制到 master2 和 master3
scp /var/lib/rancher/k3s/server/manifests/kube-vip.yaml root@master2:/var/lib/rancher/k3s/server/manifests/
scp /var/lib/rancher/k3s/server/manifests/kube-vip.yaml root@master3:/var/lib/rancher/k3s/server/manifests/
```

K3s 的 Manifests 自动部署机制会检测到该文件并启动 Kube-vip Pod。

> ⚠️ **关于「原封不动复制」的关键前提**：之所以前面说“原封不动复制”，前提是**所有 Master 节点的网卡名称一致**。Kube-vip 绑定 VIP 时需要知道宿主机的网卡名称（ARP 广播要指定从哪张网卡发出去），因此 `vip_interface` 的值必须与实际节点的网卡名匹配。下面分两种情况说明。

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

## 4. 验证与测试

### 1) 查看 Pod 运行状态

在集群中运行命令检查 Pod：

```bash
sudo k3s kubectl get pods -n kube-system -l app.kubernetes.io/name=kube-vip-ds
# 或者直接按名称查看：
sudo k3s kubectl get pods -n kube-system kube-vip
```

### 1.1) 诊断技巧：定位 Pod 异常原因

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

1. **自动漂移**：Kube-vip 会在三个 Master 节点之间进行“选主（Leader Election）”。假设选中了 Master 1，Kube-vip 就会动态地把 `192.168.1.200` 这个 IP **挂载**到 Master 1 的网卡上。
2. **故障转移**：如果 Master 1 突然宕机，另外两个节点上的 Kube-vip 会立刻感知到，并在几秒钟内自动把 `192.168.1.200` **抢过来**挂载到 Master 2 的网卡上。

### 在安装 K3s 时该怎么用这个 VIP？

有了这个 VIP 之后，你所有的 Worker 节点和 `kubectl` 工具就**不需要**绑定某一台具体的 Master 节点 IP 了，直接统一连接 VIP 即可：

- **初始化 Master 1**：指定 `--tls-san=192.168.1.200`（告诉 K3s 生成证书时允许用这个 VIP 访问）。
- **加入 Master 2 / Master 3 / Worker 节点**：连接地址直接填 `https://192.168.1.200:6443`。
