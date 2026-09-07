---
title: Kube-vip 部署：Auto-Manifests 裸 Pod 方式（旧）
icon: mdi:lan
sort: 4.5
---

> ⚠️ **本文记录的是旧部署方式**：用 `manifest pod` 生成一个**裸 Pod**（`kind: Pod`，无控制器管理），丢进 K3s 的 `/var/lib/rancher/k3s/server/manifests/` 自动部署目录。这是 kube-vip **v0.x 时代**教程（及大量早期中文博客）的常见做法。
>
> kube-vip 官方现行 [K3s 安装文档](https://kube-vip.io/docs/usage/k3s/) 已改为在该目录放置 **DaemonSet**（官方原话："kube-vip runs as a DaemonSet under K3s and **not a static Pod**"）。**新集群请直接走 DaemonSet 主线**：👉 [Kube-vip 部署 (ARP 模式)](./Kube-vip部署.md)。
>
> 本文保留的意义：看懂老教程、维护按旧方式部署的历史集群。

## 1. 方式定位：裸 Pod + Auto-Manifests

部署 kube-vip 有两个正交维度：

- **资源形态**：裸 Pod（本文，`manifest pod`）还是 DaemonSet（`manifest daemonset`）；
- **投递通道**：丢进 K3s `server/manifests/` 自动 apply，还是集群就绪后 `kubectl apply -f`。

本文 = **裸 Pod × Auto-Manifests 目录**。官方现行 K3s 路径 = **DaemonSet × Auto-Manifests 目录**（目录机制照用，只是资源换成了 DaemonSet）；主文档示例 = **DaemonSet × `kubectl apply`**。

### 裸 Pod 的自愈行为（准确版，勿与 Static Pod 混淆）

| 场景 | 裸 Pod（Auto-Manifests）的实际行为 |
|:-----|:-----------------------------------|
| **容器进程崩溃** | kubelet 仍会按 `restartPolicy: Always` **重启容器**（裸 Pod 也一样，并非完全没人管） |
| **Pod 被 `kubectl delete`** | **不会自动重建**——没有控制器兜底；需要 `touch` 一下 manifests 文件触发 K3s 重新 apply，或重启 K3s |
| **节点重启** | K3s server 启动时会对 manifests 目录**重新 apply 一遍，Pod 会回来**（并非"节点重启后就丢了"） |
| **升级镜像 / 改配置** | 登录每台服务器改文件 |
| **新增 Master 节点** | 必须提前把文件 scp 到新节点对应目录 |

> 与 Static Pod 的区别：Static Pod 由 kubelet 直接根据宿主机清单文件守护，**不依赖 API Server**；本方式的裸 Pod 是 K3s 通过 API Server apply 出来的普通 Pod，只是"恰好没有控制器"。

## 2. 部署步骤（在第一个 Master 节点上）

### 2.1 创建 Manifests 目录

```bash
sudo mkdir -p /var/lib/rancher/k3s/server/manifests/
```

### 2.2 生成 Kube-vip 配置文件

使用 kube-vip 官方镜像自动生成 **Pod** 形态的 YAML。请将 `192.168.1.200` 替换为实际 **VIP**，`eth0` 替换为实际**网卡名**。

> 💡 **关于版本号**：建议先到 [kube-vip Releases](https://github.com/kube-vip/kube-vip/releases) 页面查看最新版本号（最新的 Release 标签即为版本号），然后将下方命令中的 `v1.2.2` 替换为最新版本。

```bash
# 设置环境变量（按需修改）
export VIP=192.168.1.200
export INTERFACE=eth0

# 自动生成 裸Pod YAML 并保存至 K3s Manifests 目录
docker run --network host --rm ghcr.io/kube-vip/kube-vip:v1.2.2 manifest pod \
    --interface $INTERFACE \
    --address $VIP \
    --controlplane \
    --arp \
    --leaderElection | sudo tee /var/lib/rancher/k3s/server/manifests/kube-vip.yaml
```

> `--controlplane`、`--services`、`--arp`、`--leaderElection` 等参数的语义与 DaemonSet 方式**完全一致**，不再重复，见主文档「准备工作与参数确认」章节。

> ⚠️ **K3s 专属坑：kubeconfig 路径不同！** 原生 K8s 的 kubeconfig 路径是 `/etc/kubernetes/admin.conf`，但 **K3s 的配置文件路径是 `/etc/rancher/k3s/k3s.yaml`**。`manifest pod` 生成的裸 Pod 默认挂载宿主机 kubeconfig，如果路径硬编码成原生 K8s 的，Pause 容器启动后 `kube-vip` 会因找不到文件而报错 `CrashLoopBackOff`。用 `k3s kubectl describe pod -n kube-system kube-vip-<node-name>` 可查看具体日志。（DaemonSet 方式走 `--inCluster` 的 ServiceAccount Token，没有这个坑。）

### 2.3 机器上没有 Docker 怎么办？

K3s 默认容器运行时是 **containerd**，节点上通常没有 `docker` 命令，任选其一：

#### 方法一：直接用 `k3s ctr` 代替 `docker`

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

#### 方法二：在其他有 Docker 的电脑上生成

在本地电脑（Mac/Windows 装了 Docker）或另一台测试机上运行原始 `docker run ... manifest pod` 命令，把控制台输出的 YAML **复制粘贴**到 K3s 服务器的 `/var/lib/rancher/k3s/server/manifests/kube-vip.yaml`（注意把 `vip_address`、`vip_interface` 改成服务器实际值）。

#### 方法三：手动编写裸 Pod YAML

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

> 💡 **推荐做法**：生产环境、多网卡场景**显式指定 `--interface`**（写死 `vip_interface`），避免自动探测出错导致 VIP 漂移失败。

### 2.4 进阶：生成时自动探测网卡（便捷方案，有风险）

生成命令里**去掉 `--interface`**，生成的 YAML 中就不会包含 `vip_interface`，Kube-vip 启动时会自动选择带有默认路由（Default Gateway）的主网卡：

```bash
export VIP=192.168.1.200

docker run --network host --rm ghcr.io/kube-vip/kube-vip:v1.2.2 manifest pod \
    --address $VIP \
    --controlplane \
    --arp \
    --leaderElection | sudo tee /var/lib/rancher/k3s/server/manifests/kube-vip.yaml
```

> ⚠️ **风险提示**：自动探测依赖"默认网关所在网卡"这一假设。**多网卡环境**（业务网卡与管理网卡分离）、拓扑复杂或重启后默认路由变化时，可能绑定到错误网卡甚至绑定失败。这类场景务必显式指定 `vip_interface`。

### 2.5 验证部署

文件保存后，K3s 的 Manifests 自动部署机制会检测到该文件并拉取镜像运行：

```bash
# 裸 Pod 没有 DaemonSet 标签，直接按名称查看
sudo k3s kubectl get pods -n kube-system | grep kube-vip
```

完整的状态诊断、VIP 绑定检查、连通性测试与常见疑问，见主文档：👉 [Kube-vip 部署 (ARP 模式)](./Kube-vip部署.md)。

## 3. 部署到其他 Control Plane 节点

多 Master（如 3 节点 HA）时，把第一个节点生成的文件**复制到其他每个 Master 节点**的对应目录：

```bash
# 示例：复制到 master2 和 master3
scp /var/lib/rancher/k3s/server/manifests/kube-vip.yaml root@master2:/var/lib/rancher/k3s/server/manifests/
scp /var/lib/rancher/k3s/server/manifests/kube-vip.yaml root@master3:/var/lib/rancher/k3s/server/manifests/
```

### 情况一：所有节点网卡名【一致】（最常见）

统一安装的同型号虚拟机 / 物理机网卡名通常相同（如都是 `eth0` 或都是 `ens33`），可直接复制，**无需修改**。

### 情况二：不同 Master 节点网卡名【不一致】

若 Master 1 是 `eth0`、Master 2 是 `ens33`、Master 3 是 `enp1s0`，复制后**必须逐台打开文件，把 `vip_interface` 改为该节点自己的实际网卡名**，否则 VIP 漂移到该节点时无法绑定：

```yaml
# 在 Master 2 上修改 /var/lib/rancher/k3s/server/manifests/kube-vip.yaml
- name: vip_interface
  value: ens33              # <-- 改成 Master 2 自己的网卡名
```

不想逐台改，可按 2.4 节去掉 `--interface`（或把 `vip_interface` 显式设为 `""`）交给 Kube-vip 自动探测，单网卡环境可行，风险同上。

## 4. 为什么现在不推荐？如何迁移到 DaemonSet？

裸 Pod 方式的核心短板：

1. **Pod 被删后不会自动重建**（只能 `touch` 文件或重启 K3s 触发重新 apply）；
2. **多节点要逐台 scp**，新增 Master 时容易漏放文件；
3. **无法 `kubectl rollout` / `set image` 平滑升级**，只能登服务器改文件。

迁移很简单：生成命令由 `manifest pod` 改为 `manifest daemonset`，并补上 `--inCluster`（必须）与 `--taint`（建议），删掉各节点 manifests 目录下的旧文件后 `kubectl apply` 新清单即可。完整步骤见主文档 👉 [Kube-vip 部署 (ARP 模式)](./Kube-vip部署.md)。
