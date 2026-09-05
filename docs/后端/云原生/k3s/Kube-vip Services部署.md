---
title: Kube-vip --services 部署（Service LoadBalancer）
icon: mdi:lan
sort: 5
---

> 本文是 [Kube-vip 部署 (ARP 模式)](./Kube-vip部署.md) 的姊妹篇。上一篇讲的是 `--controlplane`（控制面高可用，`cp_enable`），本文讲 **`--services`（Service LoadBalancer，`svc_enable`）**——给 `type: LoadBalancer` 的 Service 分配可漂移的业务 VIP。两者职责不同，官方推荐分开部署。

## 一、推荐方案概览

业务入口的推荐架构是「**kube-vip LoadBalancer + Ingress(Traefik) + Service(ClusterIP)**」，三层各管一段：

```text
客户端
  ↓ 访问可漂移的业务 VIP
kube-vip（--services，svc_enable=true）   ← 给 LoadBalancer 型 Service 分配/绑定 VIP
  ↓
Traefik Service（type: LoadBalancer，拿到 VIP）← 入口层
  ↓
Ingress 规则（Host/Path 七层路由）
  ↓
业务 Service（type: ClusterIP）            ← 集群内稳定访问
  ↓
业务 Pod
```

| 层 | 类型 | 职责 | 高可用手段 |
| --- | --- | --- | --- |
| 入口 VIP | kube-vip `--services` | 给 LB 型 Service 分配**可漂移的 VIP** | 多副本 + 选主（`svc_election`） |
| Traefik Service | `LoadBalancer` | 对外入口，拿到 VIP | VIP 漂移 |
| 业务 Service | `ClusterIP` | 集群内稳定访问后端 | 多副本 + Service 负载均衡 |

> 关键点：**只有 `LoadBalancer` 类型的 Service 才会被 kube-vip 分配 VIP**。Traefik 恰好是 K3s 内置的那个 `LoadBalancer` Service，所以它拿到 VIP 成为业务入口；而你的业务应用 Service 保持 `ClusterIP` 即可，**不需要**改成 LoadBalancer——业务流量走 `Ingress → ClusterIP Service → Pod`。

## 二、两个关键配置（缺一不可）

这套方案能稳定落地，靠的是下面**两个配套开关**，务必都设置正确：

| 配置 | 属于谁 | 作用 |
| --- | --- | --- |
| `svc_election: "true"` | kube-vip（DaemonSet） | 多副本间**选主**，只有 leader 持有并通告 Service VIP，避免多实例抢同一个 VIP |
| `externalTrafficPolicy: Local` | Traefik Service | 保留客户端**真实源 IP**，且让 kube-vip 只在「有后端 Pod 的节点」上通告 VIP |

### 为什么这两个要搭配？

1. **`svc_election` 解决「谁来持有 VIP」**：`--services` 模式下 kube-vip 通常以 DaemonSet 跑在每个节点，若不选主，多个实例会同时绑定同一个 VIP，导致 ARP 冲突。开启选主后，同一时刻只有一个 leader 持有该 VIP。

   - **更深一层的收益：跨节点流量负载均衡**。选主是**按 Service 维度独立进行**的——不同的 `LoadBalancer` Service 各自独立选主，其 VIP 可以**漂移/分散到不同的节点**上，避免所有 LB 服务的 VIP 都挤在同一个 leader 节点。这样多个业务入口的流量天然被分摊到多台机器，而不是都压在一台上。

2. **`externalTrafficPolicy: Local` 解决「源 IP 失真 + 丢流量」**：
   - Service 默认 `Cluster` 策略会做 SNAT，把客户端源 IP 替换成节点 IP，后端拿不到真实 IP；
   - 改成 `Local` 后保留真实源 IP，但代价是「只有运行了后端 Pod 的节点」才会接收流量。
   - 这时 kube-vip 会 watch Service 的 endpoints，**只在本节点存在对应后端 Pod 时才在该节点通告该 VIP**，从而避免把流量导到没有 Pod 的节点上导致丢包——两者配合才能既保留源 IP 又不丢流量。
   - **额外收益：避免二次 Hop 转发**。`Local` 模式下，若本节点就有 Traefik Pod，流量直接在本节点命中并响应，**不会跨节点再绕一圈**，降低了网络延迟、提升了吞吐量。

## 三、部署 kube-vip `--services`

### 前置：禁用 k3s 内置的 servicelb（Klipper LB）

k3s 默认自带一个轻量 LoadBalancer 实现 **servicelb（Klipper LoadBalancer，对应 `svclb` Pod）**。如果它与 kube-vip 同时运行，会**抢占 `LoadBalancer` Service 的 EXTERNAL-IP 分配**，导致 kube-vip 拿不到 IP 或分配冲突。因此部署 kube-vip `--services` 前，**必须先禁用它**。

**新装集群**：安装时带上禁用参数。

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable servicelb" sh -
```

**已运行集群**：编辑 k3s 的 systemd 服务文件，在 `ExecStart` 末尾追加 `--disable servicelb`，再重启。

```bash
sudo systemctl edit k3s   # 或直接编辑 /etc/systemd/system/k3s.service
# 在 ExecStart 末尾追加：--disable servicelb
sudo systemctl daemon-reload && sudo systemctl restart k3s
```

> ⚠️ **禁用后遗留的 `svclb` 资源不会自动删除**：`--disable servicelb` 只是停止 servicelb controller 的运行（不再新建 `svclb`），但**已经创建的 `svclb-*` DaemonSet 和 Pod 会残留**，继续占用端口、也可能抢占 IP。必须手动清理：

```bash
# 1. 查看系统命名空间下遗留的 servicelb DaemonSet
sudo k3s kubectl get ds -n kube-system | grep svclb

# 2. 删除遗留的 svclb DaemonSet（DaemonSet 删除后，其 Pod 会随之级联删除）
sudo k3s kubectl get ds -n kube-system -o name | grep svclb | xargs -r sudo k3s kubectl delete -n kube-system
```

> 清理后，原有的 `LoadBalancer` Service（如 Traefik）会暂时失去 `EXTERNAL-IP`，直到 kube-vip 接管并为其分配新的 VIP。

### 3.1 生成 DaemonSet 清单

生成独立的 Service LB DaemonSet（**只传 `--services`，不传 `--controlplane`**）：

```bash
export INTERFACE=enp0s3

docker run --network host --rm ghcr.io/kube-vip/kube-vip:v1.2.2 manifest daemonset \
    --interface $INTERFACE \
    --services \
    --inCluster \
    --arp \
    --leaderElection | sudo tee /tmp/kube-vip-services.yaml

sudo k3s kubectl apply -f /tmp/kube-vip-services.yaml
```

> 机器上没有 Docker 时，用 `sudo k3s ctr run --rm --net-host ...` 替代（参考《Kube-vip 部署》中的「机器上没有 Docker 怎么办」）。

生成的关键环境变量（`--services` + `--leaderElection` 产生）：

```yaml
env:
  - name: svc_enable
    value: "true"        # --services：开启 Service LoadBalancer
  - name: svc_election
    value: "true"        # --leaderElection：Service VIP 选主（本文核心配置）
  - name: vip_arp
    value: "true"        # ARP 模式，局域网通告
```

> 与 `--controlplane` 的区分：上一篇的 `cp_enable: "true"` 管 `6443` 端口的 apiserver 高可用，本文的 `svc_enable: "true"` 管 `LoadBalancer` Service 的 VIP。二者独立，这里只开 `svc_enable`。

### 3.2 完整 YAML（RBAC + DaemonSet）

`manifest daemonset` 生成时会自动附带 RBAC（`ServiceAccount` / `ClusterRole` / `ClusterRoleBinding`）。若需手动编写或离线部署，参考以下完整清单（env 已按 v1.x 语义，使用 `svc_enable` / `svc_election`）：

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kube-vip
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: system:kube-vip-role
rules:
  - apiGroups: [""]
    resources: ["services", "services/status", "nodes", "endpoints"]
    verbs: ["list", "get", "watch", "update"]
  - apiGroups: ["coordination.k8s.io"]
    resources: ["leases"]
    verbs: ["list", "get", "watch", "create", "update"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: system:kube-vip-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: system:kube-vip-role
subjects:
  - kind: ServiceAccount
    name: kube-vip
    namespace: kube-system
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: kube-vip-ds
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
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: node-role.kubernetes.io/control-plane
                    operator: Exists
              - matchExpressions:
                  - key: node-role.kubernetes.io/master
                    operator: Exists
      hostNetwork: true                 # 必须开启，否则无法在节点网卡上绑定/通告 VIP
      serviceAccountName: kube-vip
      containers:
        - name: kube-vip
          image: ghcr.io/kube-vip/kube-vip:v1.2.2
          imagePullPolicy: Always
          args:
            - manager
          securityContext:
            capabilities:
              add:
                - NET_ADMIN
                - NET_RAW
          env:
            - name: vip_arp
              value: "true"
            - name: svc_enable
              value: "true"            # --services：开启 Service LoadBalancer
            - name: svc_election
              value: "true"            # --leaderElection：Service VIP 选主
            - name: vip_interface
              value: "eth0"            # 替换为宿主机实际网卡名（ip a 查看）
      tolerations:
        - effect: NoSchedule
          operator: Exists
        - effect: NoExecute
          operator: Exists
```

> ⚠️ 注意：
> 1. `vip_interface` 必须改成宿主机实际网卡名（`ip a` 查看，如 `eth0` / `ens33`）。
> 2. 上面的 `nodeAffinity` 把 kube-vip 限制在 control-plane 节点；若希望 Worker 节点也能承载 LB 流量，删掉整段 `affinity` 即可。
> 3. `hostNetwork: true` 不可省略，否则 VIP 无法绑定到节点网卡。

### 3.3 配置 IP 地址池（IPAM）

仅启动 kube-vip 还不够，还需要一个 **IP 地址池** 供 `type: LoadBalancer` 的 Service 分配 VIP。最简单的方式是用 ConfigMap 指定一段连续、未被占用的局域网 IP：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kubevip
  namespace: kube-system
data:
  range-global: 192.168.1.200-192.168.1.210   # 替换为你的局域网空闲 IP 段
```

```bash
sudo k3s kubectl apply -f kubevip-configmap.yaml
```

> 💡 **进阶 IPAM：kube-vip-cloud-provider（官方推荐）**。上面的 ConfigMap 是 kube-vip 内置的简单 IPAM，适合起步。若需要更细粒度的控制（例如通过注解给某个 Service 指定固定 IP、namespace 级地址池、标准 `LoadBalancer` status 同步），官方推荐部署 **kube-vip-cloud-provider**——一个实现标准 cloud-provider 接口的 Cloud Controller Manager（CCM），专门负责 IP 分配与 Service status 更新，而 kube-vip 本体只负责把 VIP 绑定到网卡并通告：

```bash
sudo k3s kubectl apply -f https://raw.githubusercontent.com/kube-vip/kube-vip-cloud-provider/main/manifest/kube-vip-cloud-controller.yaml
```

> 部署后可在 Service 上用注解指定固定 IP（如 `kube-vip.io/requestedIP: "192.168.1.205"`）。两者区别：ConfigMap 是 kube-vip 自己读地址池分配；cloud-provider 由独立的 CCM 组件接管 IPAM，职责更清晰、功能更完整，生产环境更推荐后者。

### Service VIP 从哪来？

`--services` 模式下，VIP 从上面的**地址池（`range-global`）自动分配**，也可以在 Service 上用注解 `kube-vip.io/loadbalancerIPs` 指定某个固定 IP。分配是**一次性绑定**，只要不删 Service 就永久不变。详见《Kube-vip 部署》5.x 节「`--services` 的 VIP 从哪来」。

## 四、修改 Traefik Service（设置 `externalTrafficPolicy: Local`）

Traefik 是 K3s 内置的，它的 Service **也是 K3s 默认生成的**（`kubectl get svc -n kube-system traefik`），我们可以**修改它**，改完 K3s 会**自动热加载**。

直接编辑 K3s 的 manifests 目录下的 Traefik 配置文件：

```bash
sudo vim /var/lib/rancher/k3s/server/manifests/traefik-config.yaml
```

用 `HelmChartConfig` 覆盖内置 Traefik chart 的 values，给它的 Service 加 `externalTrafficPolicy: Local`：

```yaml
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    service:
      enabled: true
      type: LoadBalancer
      externalTrafficPolicy: Local   # 保留源 IP 并减少网络 Hop
```

> 保存后，K3s 的 Helm 控制器会检测到变化并自动重新部署 Traefik，无需手动 `kubectl apply`。观察：`sudo k3s kubectl get svc -n kube-system traefik` 的 Service 配置会更新。

## 五、验证

### 1. 确认 kube-vip Service LB 已运行

```bash
sudo k3s kubectl get pods -n kube-system -l app.kubernetes.io/name=kube-vip-ds -o wide
```

### 2. 确认 Traefik Service 拿到可漂移的 VIP

```bash
sudo k3s kubectl get svc -n kube-system traefik
# EXTERNAL-IP 应是地址池分配的 VIP（网卡上 /32 形式），而非各节点物理 IP
```

> ⚠️ 判断要点：如果 EXTERNAL-IP 是各节点的**物理 IP**（`/24`），说明仍走 K3s 内置 ServiceLB（不漂移）；真正的 `--services` VIP 在网卡上是 `/32` 且会漂移。详见《Ingress与Service与Traefik入口的关系》。

### 3. 确认 `externalTrafficPolicy` 已生效

```bash
sudo k3s kubectl get svc -n kube-system traefik -o jsonpath='{.spec.externalTrafficPolicy}'
# 输出应为 Local
```

### 4. 验证业务入口与源 IP

```bash
# 访问业务 VIP（替换为实际 VIP）
curl -i http://192.168.1.210/api/...

# 后端日志应能拿到真实客户端源 IP（而非节点 IP）
```

### 5. 端到端验证：任意 `LoadBalancer` Service 都能拿到 VIP

为了独立验证「kube-vip 会给**任何** `LoadBalancer` Service 分配 VIP」这一核心能力（不依赖 Traefik），可部署一个临时 nginx 测试：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx-demo
  template:
    metadata:
      labels:
        app: nginx-demo
    spec:
      containers:
        - name: nginx
          image: nginx:alpine
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 80
  selector:
    app: nginx-demo
```

```bash
sudo k3s kubectl apply -f nginx-demo.yaml
sudo k3s kubectl get svc nginx-service
# NAME            TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)        AGE
# nginx-service   LoadBalancer   10.43.123.45    192.168.1.200   80:31234/TCP   10s
```

`EXTERNAL-IP` 会自动从 `range-global` 地址池分一个 IP（如上例 `192.168.1.200`），局域网内直接访问 `http://192.168.1.200` 即可连通。测试完清理：

```bash
sudo k3s kubectl delete -f nginx-demo.yaml
```

## 六、小结

- **推荐方案**：kube-vip `--services`（LoadBalancer）+ Ingress(Traefik) + 业务 Service(ClusterIP)。
- **两个开关**：kube-vip 侧 `svc_election: "true"`（选主），Traefik Service 侧 `externalTrafficPolicy: Local`（保源 IP），二者配套。
- **部署前置**：先禁用 k3s 内置 servicelb（`--disable servicelb`），再配 IP 地址池（ConfigMap `range-global`），否则 kube-vip 拿不到/抢不到 VIP。
- **Traefik Service 可改**：它是 K3s 默认生成的，改 `/var/lib/rancher/k3s/server/manifests/traefik-config.yaml` 后自动热加载。
- **关联阅读**：[Kube-vip 部署 (ARP 模式)](./Kube-vip部署.md) · [Ingress与Service与Traefik入口的关系](./Ingress与Service与Traefik入口的关系.md) · [VIP 方案选型](./VIP方案选型.md)
