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
| 入口 VIP | kube-vip `--services` | 给 LB 型 Service 提供**可漂移的 VIP**（绑定并通告；分配由 CCM 或手动完成） | 多副本 + 选主（`svc_election`） |
| Traefik Service | `LoadBalancer` | 对外入口，拿到 VIP | VIP 漂移 |
| 业务 Service | `ClusterIP` | 集群内稳定访问后端 | 多副本 + Service 负载均衡 |

> 关键点：**只有 `LoadBalancer` 类型的 Service 才会拿到 VIP**（VIP 由 CCM 自动分配、或你手动 `loadbalancerIPs` 指定，kube-vip 负责绑定并通告）。Traefik 恰好是 K3s 内置的那个 `LoadBalancer` Service，所以它拿到 VIP 成为业务入口；而你的业务应用 Service 保持 `ClusterIP` 即可，**不需要**改成 LoadBalancer——业务流量走 `Ingress → ClusterIP Service → Pod`。

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

**已运行集群**：编辑 k3s 配置文件 `/etc/rancher/k3s/config.yaml`（不存在则新建），加入 `disable: servicelb` 再重启：

```bash
sudo mkdir -p /etc/rancher/k3s
sudo tee -a /etc/rancher/k3s/config.yaml <<'EOF'
disable:
  - servicelb
EOF
sudo systemctl restart k3s
```

> `disable` 就是命令行 `--disable servicelb` 的配置文件写法。已存在该文件则用 `tee -a` 追加、不会覆盖原有配置。

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

> 💡 **关于版本号**：建议先到 [kube-vip Releases](https://github.com/kube-vip/kube-vip/releases) 页面查看最新版本号（最新的 Release 标签即为版本号），然后将下方命令中的 `v1.2.3` 替换为最新版本。

```bash
export INTERFACE=enp0s3

docker run --network host --rm ghcr.io/kube-vip/kube-vip:v1.2.3 manifest daemonset \
    --interface $INTERFACE \
    --services \
    --inCluster \
    --arp \
    --leaderElection | sudo tee /tmp/kube-vip-services.yaml

sudo k3s kubectl apply -f /tmp/kube-vip-services.yaml
```

> ⚠️ **若集群里已部署了 controlplane 那套，apply 前必须先改名字**：两套生成的 DaemonSet 默认名相同（都是 `kube-vip-ds`），后 apply 的会**替换**先前那套（不是并存），导致 controlplane 配置丢失。把 DaemonSet 的 `metadata.name`（及 RBAC 中引用的名字）改成不同名，如 `kube-vip-services`，再 apply。详见《Kube-vip 部署》9.3 节。

> ⚠️ **`INTERFACE` 必须与运行该 DaemonSet 的物理机/虚拟机上的实际网卡名称一致**，否则 VIP 无法正确宣告。

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
          image: ghcr.io/kube-vip/kube-vip:v1.2.3
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

### 3.3 给 Service 指定 VIP（本环境：手动 loadbalancerIPs）

`--services` 模式下 VIP 取值一句话：core kube-vip **不分配 IP**，只负责把「已确定的 IP」绑到网卡并通告。VIP 要么来自 cloud-provider（CCM）从地址池自动分配，要么手动指定；**两者都不给就会 fallback 成节点物理 IP（危险）**。

**本环境推荐「不装 CCM + 每个 LoadBalancer Service 手动写 `loadbalancerIPs`」**（故障面最小）。示例：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
  annotations:
    kube-vip.io/loadbalancerIPs: "172.16.0.181"   # 固定成池里某个空闲 VIP
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 8080
  selector:
    app: my-app
```

指定 IP 的两铁律：① 落在集群同一二层网段；② **绝不能是节点物理 IP**，否则漂移时抢 ARP 把节点挤成 `NotReady`。

> 完整的「CCM 自动分配 / VIP 取值规则 / CCM 选型 / 暴露方式选型 / TCP-UDP 收编」见文末《附录：VIP 分配与暴露方式选型》。

## 四、修改 Traefik Service（指定 VIP + `externalTrafficPolicy`）

Traefik 是 K3s 内置的，它的 Service **也是 K3s 默认生成的**（`kubectl get svc -n kube-system traefik`），我们可以**修改它**，改完 K3s 会**自动热加载**。

直接编辑 K3s 的 manifests 目录下的 Traefik 配置文件：

```bash
sudo vim /var/lib/rancher/k3s/server/manifests/traefik-config.yaml
```

用 `HelmChartConfig` 覆盖内置 Traefik chart 的 values，给 Traefik Service 同时做好两件事：**① 手动 `loadbalancerIPs` 固定网关 VIP**（本环境不装 CCM，必须写，否则 fallback 成节点 IP）；**② `externalTrafficPolicy: Local`** 保留源 IP：

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
      externalTrafficPolicy: Local                 # 保留源 IP 并减少网络 Hop
      annotations:
        kube-vip.io/loadbalancerIPs: "172.16.0.180"   # 固定 Traefik 网关 VIP（不能是节点物理 IP）
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
# EXTERNAL-IP 应是 VIP（网卡上 /32 形式）——装了 CCM 来自地址池、没装 CCM 来自手动 loadbalancerIPs；绝不能是各节点物理 IP
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

`EXTERNAL-IP` 装了 CCM 时会自动从 `range-global` 池分一个 IP；**没装 CCM 时 nginx-service 需手动加注解 `kube-vip.io/loadbalancerIPs` 指定 VIP**（否则 fallback 成节点 IP）。拿到 IP 后局域网直接访问即可连通。测试完清理：

```bash
sudo k3s kubectl delete -f nginx-demo.yaml
```

## 六、小结

- **推荐方案**：kube-vip `--services`（LoadBalancer）+ Ingress(Traefik) + 业务 Service(ClusterIP)。
- **两个开关**：kube-vip 侧 `svc_election: "true"`（选主），Traefik Service 侧 `externalTrafficPolicy: Local`（保源 IP），二者配套。
- **部署前置**：先禁用 k3s 内置 servicelb（`--disable servicelb`）；若要自动分配，需再装 kube-vip-cloud-provider（CCM）并配地址池（ConfigMap `range-global`）；**不装 CCM 则每个 LB Service 手动写 `loadbalancerIPs`**。
- **Traefik Service 可改**：它是 K3s 默认生成的，改 `/var/lib/rancher/k3s/server/manifests/traefik-config.yaml` 后自动热加载。
- **卸载与清理**：删除两套 DaemonSet、RBAC、cloud-provider 与地址池并恢复 servicelb 的完整步骤，见《Kube-vip 部署》「卸载与清理」章节。
- **关联阅读**：[Kube-vip 部署 (ARP 模式)](./Kube-vip部署.md) · [Ingress与Service与Traefik入口的关系](./Ingress与Service与Traefik入口的关系.md) · [VIP 方案选型](./VIP方案选型.md)

---

## 附录：VIP 分配与暴露方式选型

> 第三部分部署步骤之外的展开内容集中放在这里，按需查阅。

### A. 配置 IP 地址池（自动分配，需 cloud-provider）

> ⚠️ **现阶段（本环境）不推荐装 CCM / IPAM**：本附录 A 说的是「装 cloud-provider（CCM）+ `range-global` 池」这条**自动分配**路径。但本环境是自建私有集群、以网关/中间件为主，**不建议走这条路**——直接「不装 CCM + 每个 LoadBalancer Service 手动写 `loadbalancerIPs`」才是故障面最小的做法，结论详见附录 C《CCM / IPAM 要不要装？》。为完整性本附录仍保留 CCM 的配置方法，仅作需要时参考。

> ⚠️ **关键认知（易踩坑）**：`range-global` 地址池的「自动分配」**只有装了 kube-vip-cloud-provider（CCM）才生效**。core kube-vip 只负责把「已确定的 IP」绑到网卡并通告，**不会读这个 ConfigMap 分配 IP**。若只装了 `--services` 的 kube-vip、没装 CCM，这个 ConfigMap 就是「写了没人读」的死配置——此时每个 LoadBalancer Service 都必须手动写 `kube-vip.io/loadbalancerIPs`，否则 kube-vip 会 fallback 用节点 IP（危险，见《Kube-vip 排障（Service VIP 与节点 IP 冲突）》）。

先建地址池 ConfigMap（供 CCM 读取）：

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

再安装 cloud-provider（CCM），它才会读上面的池、给 LoadBalancer Service 自动回填 VIP：

```bash
sudo k3s kubectl apply -f https://raw.githubusercontent.com/kube-vip/kube-vip-cloud-provider/main/manifest/kube-vip-cloud-controller.yaml
```

> 分工总结：**CCM 负责「分配 IP + 回填 status」；core kube-vip 负责「把已分配的 IP 绑定到网卡 + ARP 通告 + 漂移」**，二者是两套组件。
> - 装了 CCM → Service 不用写 IP，自动从池分配（也可用注解 `kube-vip.io/loadbalancerIPs` 指定固定 IP）；
> - **没装 CCM → 必须手动写 `kube-vip.io/loadbalancerIPs`**，否则 fallback 到节点 IP。

### B. Service VIP 从哪来？（完整规则）

`--services` 模式下，VIP 的来源分两种情况：**装了 cloud-provider（CCM）** → 从地址池（`range-global`）自动分配；**没装 CCM** → 必须在 Service 上手动指定（否则 fallback 节点 IP）。可用的注解：

- `kube-vip.io/loadbalancerIPs: <IP>` → **真正决定 VIP 数值**的固定 IP；
- `kube-vip.io/vipHost: <节点名>` → 指定该 VIP 的**承载节点**（kube-vip 也会把它写回 Service 做记录）。**单独写它、又不给 `loadbalancerIPs`** 时，kube-vip 会 fallback 把该节点物理 IP 当 VIP（这才是危险来源）。

> ⚠️ **VIP 取值的真正规则（官方 + 实测）**：core kube-vip **不分配 IP**，只绑定/通告已确定的 IP。VIP 数值确定顺序：`loadbalancerIPs` 注解 → `spec.loadBalancerIP` → `status.loadBalancer.ingress`（由 CCM 回填）→ **都没有则 fallback 用节点物理 IP**（危险）。
> - 有 `loadbalancerIPs`（或 CCM 已从池回填）→ VIP = 该地址，**安全**；`vipHost` 只是 kube-vip 写回的「承载节点」记录，可共存、无害、删了会重现；
> - **没装 CCM 又没 `loadbalancerIPs`** → fallback 成节点物理 IP → 漂移时抢 ARP 把节点挤 `NotReady`（本环境 traefik 最早即此：无 CCM、无 `loadbalancerIPs`，VIP 退化成 `172.16.0.211/212`）。
>
> 所以「配了 `range-global` 池」**不等于**「自动分配生效」——没装 CCM 时池子根本没人读，必须手动 `loadbalancerIPs`。
>
> ⚠️ **致命坑**：危险的是「**没装 CCM 且不写 `loadbalancerIPs`**」（fallback 节点 IP），以及「显式把 `loadbalancerIPs` 写成某个节点 IP」——两者都会让 VIP 与节点 IP 重合，漂移时二层抢 ARP 把节点挤成 `NotReady`。详见《Kube-vip 排障（Service VIP 与节点 IP 冲突）》。正确做法：VIP 取自池中（或 `loadbalancerIPs` 指定的池内地址）、不与节点 IP 重叠。

分配是**一次性绑定**，只要不删 Service 就永久不变。详见《Kube-vip 部署》8.1 节「`--services` 的 VIP 从哪来」。

**如何手动指定（示例）**：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
  annotations:
    kube-vip.io/loadbalancerIPs: "172.16.0.181"   # 固定成池里某个空闲 VIP
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 8080
  selector:
    app: my-app
```

- 注解 `kube-vip.io/loadbalancerIPs`（推荐，新版本）或 `kube-vip.io/requestedIP`（老版本，等价）；也可用旧字段 `spec.loadBalancerIP`（K8s 1.24+ 已废弃，不如注解稳妥）。
- 指定 IP 的**两铁律**：① 落在集群同一二层网段；② **绝不能是节点物理 IP**（如 `172.16.0.211` / `172.16.0.212`），否则漂移时抢 ARP 把节点挤成 `NotReady`。
- 地址池只是自动分配的管理范围，kube-vip 不校验手动指定 IP 是否落在池内：可以指定池外地址，但须自行确保该地址在二层可达、且全网唯一（不被任何主机占用），否则同样会冲突。建议仍优先用池内空闲地址。
- 装了 CCM 时不写注解 → 从 `range-global` 池自动分配；没装 CCM 则**必须写 `loadbalancerIPs`**（建议取池内地址），否则 fallback 成节点物理 IP，危险（见上）。验证：`kubectl get svc my-app` 看 `EXTERNAL-IP`。

### C. CCM / IPAM 到底要不要装？选型指南（避免盲目装 CCM）

前面 A/B 已给出两条路：**装 CCM**（`range-global` 池自动分配）或 **不装 CCM**（每个 LB Service 手动写 `loadbalancerIPs`）。这里必须回答一个关键问题——**到底什么时候才该装 CCM？** 别因为「官方推荐 / 装 CCM 显得专业」就盲目引入一套用不上的 Controller。

**一句话结论**：

- **该装 CCM**：大规模多租户平台、PaaS、需要**频繁创建/销毁 LoadBalancer** 的场景——人工管 IP 成本过高，必须靠 IPAM 自动分配回收；
- **不用装 CCM**（本环境即此）：自建私有集群、边缘节点、中小规模，入口/中间件占主导——**「只留 ARP 宣告 DaemonSet + 手动 `loadbalancerIPs` 固定 VIP」才是故障面最小的黄金实践**。

**为什么「装 CCM」在公有云是标准、在私有云却常被绕开？**

CCM 自动分配契合 K8s「基础设施抽象化 + 自服务」的原生设计：开发者提交 `type: LoadBalancer`，底层像 DHCP 一样自动赋值，不必一个个找运维「批固定 IP」。这在公有云（AWS/阿里云）和大型多租户集群是刚需；但换到局域网/自建环境，这套自动化反而带来痛点：

| 痛点 | CCM 动态分配的问题 | 手动固定 VIP 的优势 |
| --- | --- | --- |
| DNS / 路由 / 防火墙绑定 | Service 重建拿到新 IP 时，局域网 DNS、防火墙、NAT、监控白名单全部失效 | IP 绝对固定，网关永远是 `172.16.0.180`，各处静态映射永不丢 |
| IP 资源有限 | 局域网可分配地址少（如只划了十几个），分配/回收不及时池子就耗尽 | 每块固定 IP 归属明确（网关/DB/存储），精细可控 |
| 运维复杂度 | 多维护一套 CCM Controller + ConfigMap + IPAM 状态 | 只剩一个 ARP 宣告 DaemonSet，故障面最小 |

**按服务类型落地建议**（比「一概而论」更有用）：

| 服务类型 | 主流做法 | 理由 |
| --- | --- | --- |
| 集群入口网关（Traefik / Nginx Ingress / Istio Gateway） | **手动固定 VIP**（`loadbalancerIPs`） | 全集群流量咽喉，必须与外部网络保持长久静态映射，绝不能动态变 |
| 中间件与有状态服务（PostgreSQL / Redis / GitLab） | **手动固定 VIP** | 便于外围监控、安全组放行、数据备份稳定指向 |
| 大规模平台 / PaaS / 临时测试环境 | **装 CCM / IPAM** | 频繁创建销毁 LoadBalancer，人工管 IP 成本过高，必须自动分配 |

> **关联**：本环境是典型「自建私有集群 + 网关/中间件为主」，走**不装 CCM + 手动指定池内 VIP**。这也正是《Kube-vip 排障（Service VIP 与节点 IP 冲突）》里修复用**方案 A**（`annotate ... loadbalancerIPs=172.16.0.180`）而非装 CCM 走池分配的原因——别为了「看起来专业」去装一套根本用不上的 CCM。

### D. 暴露方式选型：直接 LoadBalancer Service vs Ingress（Traefik）

kube-vip `--services` 给**每一个** `type: LoadBalancer` 的 Service 分配一个可漂移的 VIP，所以「业务入口直接访问 LoadBalancer Service 的 VIP」本身就是合法、常见的做法。Traefik 的 VIP 本质也是「Traefik 这个 LoadBalancer Service 的 VIP」——两者是同一套机制，只是暴露的对象不同。区别在于**层级与 VIP 消耗**：

| | 直接暴露 `LoadBalancer` Service | 走 Traefik Ingress（Traefik 本身是 LB Service） |
| --- | --- | --- |
| 对外形态 | 每个要暴露的业务 Service 各拿一个 VIP | 只有 Traefik 拿一个 VIP，业务 Service 用 `ClusterIP`（内部） |
| 转发层级 | **L4**（TCP/UDP），按 IP:端口 直通 | **L7**（HTTP/HTTPS），按域名/路径路由 |
| VIP 消耗 | N 个业务 = N 个 VIP（吃地址池） | 1 个 VIP 多路复用所有 Web 应用 |
| 适合场景 | 数据库、gRPC、任意 TCP/UDP 服务；或简单 HTTP 不想管路由 | 多个网站/域名共享 80/443、要 TLS 终止、按 Host/Path 分流 |
| 客户端访问 | `http://<业务VIP>:port` | `http://<Traefik VIP>/`，Traefik 按规则转到对应后端 |

**结论**：

- 想直接暴露某个业务 `LoadBalancer` Service，完全 OK——每个业务一个独立 VIP，客户端直连，简单直接；
- Traefik 的价值是：一堆 HTTP 服务时不用给每个都申请 VIP、记一堆 IP/端口，只暴露 Traefik 一个 VIP，靠域名/路径分流到不同后端，**省 VIP、好管理、带 TLS/路由**；
- 两者**可共存**：HTTP 类走 Traefik 那个 VIP；裸 TCP/UDP（如数据库 `5432`）直接给对应 Service 配 `LoadBalancer` VIP。

> **主流做法**：对于 HTTP/HTTPS（绝大多数 Web 业务），业界默认走 **Ingress**——只把 Ingress Controller（Traefik/Nginx 等）暴露成一个 `LoadBalancer` Service（占 1 个 VIP），业务 Service 全用 `ClusterIP` + `Ingress` 资源按域名/路径路由；既省 VIP、又集中管 TLS 与路由。直接 `LoadBalancer` Service 更常用于 **Ingress 搞不定的 L4 场景**（裸 TCP/UDP：数据库、MQTT、游戏服等），或极简单服务图省事时。K3s 默认内置 Traefik，正是走这条「Ingress 为主」的主流路径。

> **那 `range-global` 池子是不是可以不用配了？** 分两种情况：**装了 CCM** → 池子要配（自动分配的来源），但即使「所有业务都走 Ingress、只暴露 Traefik 一个 VIP」，也只需 1 个地址（Traefik 用掉），可配得很小（如 `172.16.0.180-180`，或留两三个做余量）；池子大不等于浪费，多出来的只是未被使用的空闲地址。**没装 CCM（本环境）** → 池子其实**没用**（core kube-vip 不读它），真正起作用的是手动 `loadbalancerIPs`；没装 CCM 又不写 `loadbalancerIPs` 时，LB Service 会 fallback 成节点 IP（危险）而非 `<pending>`。结论：要么「装 CCM + 配池」，要么「不装 CCM + 每个 LB Service 手动写 `loadbalancerIPs`」。

> 无论选哪种，VIP 要么来自 `range-global` 池（需 CCM）、要么手动 `loadbalancerIPs`，且都**不能是节点物理 IP**——前面附录 B 里的规则与致命坑对两者同样适用。

### E. Traefik 也能接管 TCP/UDP（L4）流量，进一步收敛 VIP

附录 D 说「裸 TCP/UDP 用直接 LoadBalancer Service」，但 Traefik 不止能做 L7——它同样能用 **IngressRouteTCP / IngressRouteUDP**（Traefik CRD）路由 L4 流量。这样连数据库、Redis、MQTT 这类非 HTTP 服务也能统一从 Traefik 那**一个 VIP** 进出，VIP 数量进一步压到最少。

**关键区别**：HTTP 靠 `Host`/路径分流，一个 `:80/:443` 能挂几十个站点；**TCP/UDP 没有 Host 头**，所以 L4 路由靠 **entrypoint 端口** 区分——每个 L4 服务在 Traefik 上占一个独立入口端口，客户端用 `VIP:端口` 访问。若后端本身走 TLS，Traefik 还能按 **SNI（域名）** 在同一条 TLS 端口上再分流。

**示例：把 PostgreSQL 收编进 Traefik 的 VIP**

1) 先在 Traefik 上开一个 TCP 入口（entrypoint 名 `postgres`，端口 `5432`）。K3s 里改 `/var/lib/rancher/k3s/server/manifests/traefik-config.yaml` 的 `entryPoints` 并给 Traefik 的 `LoadBalancer` Service 增加 `5432` 端口，让 `VIP:5432` 可达。

2) 用 `IngressRouteTCP` 把该入口转到后端 `postgres` Service：

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRouteTCP
metadata:
  name: postgres
  namespace: default
spec:
  entryPoints:
    - postgres            # 对应上面开的 TCP 入口
  routes:
    - services:
        - name: postgres
          port: 5432
```

3) 客户端直连 Traefik 的 VIP 即可，不再需要给 postgres 单独申请 VIP：

```bash
psql -h <Traefik VIP> -p 5432 -U <用户> -d <库>   # 流量经 Traefik L4 转发到 postgres Pod
```

UDP 同理，换成 `IngressRouteUDP`（如把 DNS `53`、游戏/QUIC 端口收编进 Traefik）。

> 取舍：走 Traefik L4 的好处是 VIP 最少、出入口统一；代价是每类 L4 协议要在 Traefik 上占一个端口、且需写 Traefik CRD（K3s 默认已带 IngressRoute 系列 CRD）。如果某 L4 服务就是想「最省事直连」、或端口难协调，仍可用附录 D 的「直接 LoadBalancer Service」——两种不冲突。
