---
title: Ingress / Service / Traefik 入口的关系
icon: mdi:routes
sort: 8
---

> 排查「业务入口高可用」时，最容易混淆的就是 Ingress、Service、Traefik 三者的分工。本文厘清它们「各管一层」，并回答几个高频认知盲区。
>
> 第七~十节是几个**高频提问**的实测回答（都带验证命令与输出）：
> 「一个服务除了 VIP 还有哪些 IP 能访问？」「VIP 会漂移吗？」「VIP 在就说明服务好吗？」
> 「为什么 Ingress 的 `host` 不能写 IP，Service 的 `loadBalancerIP` 却可以？」

## 一、Traefik 在哪？为什么项目 k8s 目录里看不到它的配置

**Traefik 是 K3s 内置并自动部署的**（装 K3s 时一起装），跑在 `kube-system` 命名空间，**不在你项目的 `k8s/` 目录里**。

Traefik 有两个实体：

| 实体 | 位置 | 说明 |
| --- | --- | --- |
| **Traefik 控制器**（真正干活的那个） | `kube-system`，Helm/K3s 自动部署 | `kubectl get deploy -n kube-system traefik` |
| **Traefik Service**（对外入口） | `kube-system` | `type: LoadBalancer`，`EXTERNAL-IP` 即入口 IP |

> 项目 `k8s/base/ingress.yaml` 只是**给 Traefik 下达「路由规则」**（"这个 path 转到某个 Service"），**不是在部署 Traefik 本体**。所以「项目里看不到 Traefik 配置文件」是正常的。

## 二、Ingress 与 Service 各管一层，不是替代关系

| | Service（`service.yaml`） | Ingress（`ingress.yaml`） |
| --- | --- | --- |
| 解决的问题 | 「把流量送进某个应用」 | 「按规则把流量分发到不同应用」 |
| 本质 | 给一组 Pod 提供稳定的访问入口（IP/端口） | 基于 Host/Path 的**七层路由规则** |
| 类比 | 房间的「门牌号」 | 大楼的「前台/导航」 |
| 能省吗 | ❌ 不能（Ingress 最终也要指向 Service） | 视场景而定 |
| 填 IP 的字段 | `spec.loadBalancerIP`（**填 IP**） | `spec.rules[].host`（**只能填域名**） |

> 最后一行的差异经常被问「为什么 Grafana 能固定 IP、Ingress 却不能」，原因见第十节。

### 什么时候可以不用 Ingress？

| 场景 | 需要 Ingress 吗 |
| --- | --- |
| **多个服务**共用一个入口（按 host/path 分发） | ✅ 强烈需要 |
| 需要 **TLS/HTTPS 终止**、统一中间件、限流 | ✅ 需要 |
| **只有一个服务**，且已有 LoadBalancer VIP 直达 | ⚠️ 可不用（但 Ingress 仍带来路由/TLS 统一管理的好处） |
| 用 NodePort 裸暴露 | 用 Ingress 更规范 |

## 三、Ingress 不「分到 IP」，高可用靠 Traefik 入口

**Ingress 本身没有 IP、没有 Pod**，它只是「一段路由规则」。真正对外提供入口的是 **Ingress Controller（Traefik）**。

所以「Ingress 分不到 IP，怎么高可用」的正确答案是：**高可用由 Traefik 的入口 VIP 承担，而不是 Ingress 本身**。

完整链路分两层高可用：

```text
客户端
  ↓
Traefik（Ingress Controller，真正的入口）← 入口高可用靠「Traefik 的 VIP 漂移」
  ↓
Ingress 规则（把请求路由到某个 Service）← 规则无状态，天然无单点
  ↓
Service → Pod ← 应用高可用靠「多副本 + Service 负载均衡」
```

| 层 | 高可用靠什么 |
| --- | --- |
| 入口（Traefik） | Traefik 的 `LoadBalancer` Service 拿到**可漂移的 VIP** |
| 路由（Ingress） | 规则无状态，无需管 |
| 应用（Pod） | Deployment 多副本 + Service 负载均衡 |

> 关键：**Ingress 规则完全不用动**——它指向的是 `passup-backend` 这个 Service，Service 通过 selector 找 Pod。Traefik 入口漂移后，流量照样经过 Ingress 规则路由到正确的 Service。

## 四、ServiceLB vs Kube-vip `--services`（易混淆）

Traefik 之所以有 EXTERNAL-IP，可能来自**两种不同机制**，务必区分：

| 机制 | 谁提供 | IP 来源 | 能否漂移 |
| --- | --- | --- | --- |
| **ServiceLB** | K3s 内置（`svclb-traefik` Pod） | 每个节点的**物理 IP** | ❌ 不漂移 |
| **Kube-vip `--services`** | 需额外部署独立 Kube-vip | 从地址池分配的**真正 VIP** | ✅ 可漂移 |

> 如果 Traefik 的 EXTERNAL-IP 是各节点的物理 IP（如 `.201`/`.202`，网卡上是 `/24` 而非 `/32`），说明走的是 **ServiceLB**，**不具备漂移能力**。只有部署独立 `--services` Kube-vip，才能拿到真正可漂移的 VIP。

## 五、Traefik Service 能删吗？

**能删（K8s 资源都能删），但强烈不建议删，删了会出大问题：**

1. **整个集群入口立刻中断**：所有走 Ingress 的业务流量全断。
2. **不会自动重建**：Traefik Service 是 Helm release 的一部分，手动 `delete` 后平时**不会自动恢复**，会一直处于「入口丢失」状态。

> ⚠️ 区分：之前讨论「删 Service 会导致 VIP 变」是**解释 VIP 生命周期规则**，**不是建议删 Traefik Service**。Traefik Service 是集群的「总大门」，删了等于拆门，楼里所有服务都进不去。
>
> 若真需重建 Traefik 入口，正确做法是走 Helm（`helm upgrade` 或重新 apply Traefik chart），而非手动 `delete svc`。

## 六、完整高可用拼图

| 环节 | 高可用手段 | 常见缺口 |
| --- | --- | --- |
| 入口（Traefik） | 可漂移 VIP | ⚠️ 常缺（ServiceLB 给的是节点物理 IP，不漂移） |
| 路由（Ingress） | 规则无状态 | ✅ 天然无单点 |
| 应用（Pod） | 多副本 + Service LB | ✅ 通常已具备 |

> **补缺口的方法**：部署独立 `--services` Kube-vip，给 Traefik Service 分配可漂移的固定 VIP，前端统一指向它，即可打通「入口层高可用」这最后一块。

## 七、一个服务对外到底有几个入口 IP

问「除了入口 VIP，还有哪些 IP 能访问？」——答案不是「只有一个」，而是分三类：

| 地址形式 | 例子（本集群） | 说明 |
| --- | --- | --- |
| **入口 VIP** | `http://172.16.0.180/` | **推荐**。由 Kube-vip 宣告，持有它的节点挂了会自动漂移 |
| **节点 IP + NodePort** | `http://172.16.0.211:32663/` | ⚠️ **只有「本节点有该 Service 后端 Pod」的节点才通**，见第九节 |
| ClusterIP / Pod IP | `http://10.43.x.x/` | 只在集群内可访问 |

```bash
# 一次性看清入口 VIP 与 NodePort
kubectl -n kube-system get svc traefik -o custom-columns=\
'EXTERNAL-IP:.status.loadBalancer.ingress[*].ip,PORT:.spec.ports[*].port,NODEPORT:.spec.ports[*].nodePort'
```

> ⚠️ NodePort 的端口号是**自动分配**的，Service 重建后会变。要长期依赖它，必须显式指定
> `spec.ports[].nodePort` 固定下来。**给外部反向代理（如外层 nginx）配上游时，优先指向 VIP 而不是节点 NodePort** ——
> VIP 会随节点故障漂移，NodePort 绑死在某一台上。

## 八、VIP 会漂移 ≠ 服务可用

**VIP 是二层 ARP 层面的事：它只保证「这个 IP 有人应答」，不保证后面有后端。**

实测（把 Grafana 缩到 0 个副本）：

```bash
kubectl -n monitoring scale deploy grafana --replicas=0
```

```text
Service 的 EXTERNAL-IP  仍是 172.16.0.181     ← 看着一切正常
Service 的 vipHost      仍是 k2
https://172.16.0.181/api/health  ->  000（连不上）   ← 实际已经不可用
```

所以：

- **别用 `ping` 得通 VIP、或 `EXTERNAL-IP` 有值来判断服务是否活着**；
- 要判断就用**真实业务探测**（例如 `/api/health`、首页 HTTP 状态码）。

区分两种「挂」很关键：

| 挂的是谁 | VIP 行为 | 服务是否可用 |
| --- | --- | --- |
| **持有 VIP 的那个节点** | 漂到别的合格节点 | ✅ 可用（漂移就是为了这个） |
| **真正跑 Pod 的那个节点** | VIP 照样能被别的节点宣告 | ❌ **不可用，而且 VIP 看起来还是好的** |

> 后者是「单副本 + 本地存储」类组件的固有问题：Pod 被 `local-path` 的 PV 绑死在某一台节点上，
> **VIP 漂移救不了它**。缓解手段是让组件本身有第二份（换共享存储），或由集群外的探针兜底。

## 九、`externalTrafficPolicy`：决定 VIP 能落在哪些节点

同一个集群里，两个 LoadBalancer Service 的漂移能力可能**完全不同**，根因是这个字段：

| | `.180`（Traefik） | `.181`（Grafana） |
| --- | --- | --- |
| `externalTrafficPolicy` | `Local` | `Cluster`（LoadBalancer 默认值） |
| 有资格持有 VIP 的节点 | 只有**本节点有后端 Pod** 的节点 | **任意节点** |
| 本集群实测落点 | k2（Traefik Pod 在 k1、k2） | **k2（而 Grafana Pod 在 k3）** |

```bash
# 查这两个字段
kubectl get svc -A -o custom-columns=\
'NS:.metadata.namespace,NAME:.metadata.name,POLICY:.spec.externalTrafficPolicy,VIPHOST:.metadata.annotations.kube-vip\.io/vipHost'
```

**`.181` 由 k2 宣告、而 Grafana Pod 在 k3** —— 这本身就证明 `Cluster` 策略下，
没有本地 Pod 的节点也能持有 VIP。

### 由此带来的一个反直觉现象：某些节点的 NodePort 不通

`Local` 策略的语义是「**只把流量转给本节点上的 Pod**」。所以一个节点上如果**没有该 Service 的 Pod**，
打到它的 NodePort 流量会**直接被丢弃**（表现为连接超时/拒绝，**不是 502**）。

本集群实测（各试 3 次）：

```text
172.16.0.211:32663   3/3 成功     ← k1 有 Traefik Pod
172.16.0.212:32663   3/3 成功     ← k2 有 Traefik Pod
172.16.0.213:32663   0/3 成功     ← k3 没有 Traefik Pod
```

> ⚠️ **别把这个误判成「k3 挂了」。** 同一时刻 k3 的 `6443` 正常返回 401、节点状态 `Ready`、
> 上面还跑着别的 Pod —— 只是这个 Service 的 NodePort 在它上面不工作。
> 判断节点是否健康要看节点本身，不要看某个 Service 的 NodePort。

```bash
# 谁有后端 Pod（决定 Local 策略下哪些节点能用）
kubectl -n <ns> get endpoints <svc> -o jsonpath='{range .subsets[*].addresses[*]}{.ip}  node={.nodeName}{"\n"}{end}'
```

## 十、为什么 Ingress 的 `host` 不能写 IP，Service 的 `loadBalancerIP` 却可以

同一个 IP，一个能写、一个不能，实测对比：

```text
Service.spec.loadBalancerIP: 172.16.0.199                -> created (server dry run)   ✅
Service 注解 kube-vip.io/loadbalancerIPs: "172.16.0.199" -> created (server dry run)   ✅
Ingress.spec.rules[].host: 172.16.0.199                  -> must be a DNS name, not an IP address  ❌
```

| | Service 的 `loadBalancerIP` | Ingress 的 `host` |
| --- | --- | --- |
| **语义** | **给这个 Service 分配一个地址** | **匹配 Host 头等于它的请求** |
| 层次 | L4（TCP 转发） | L7（HTTP 路由） |
| 该填什么 | **就是 IP** | **必须是域名** |

- **Service 能写 IP**：`LoadBalancer` 的语义就是「给我一个能从集群外访问的地址」，那**本来就是 IP**；
  Kube-vip 读到注解后用它做 ARP 宣告。
- **Ingress 必须写域名**：`host` **不是地址，是「拿请求的 `Host:` 头去比对的条件」**。
  K8s 认为按 IP 分流没有意义（一个 IP 直接挂 Service 就行，何必再过一层 L7），所以只允许域名 ——
  Ingress 的用途本来就是「按域名分流」。

> 一句话：**Grafana 那个 IP 是「地址」，Ingress 那个 host 是「匹配规则」。**

### 那想固定怎么办

| 做法 | 可行性 |
| --- | --- |
| Ingress 的 `host` 写 IP | ❌ API 层直接拒绝 |
| 换 Traefik 的 `IngressRoute` CRD（`match: Host(...)` 是自由字符串） | ⚠️ 能通过校验，但**不建议**：绑定了外层代理必须发 `Host: <该 IP>`，否则整站 404 而 Traefik 只回 404 不报错；且会让后端看到错误的 Host |
| 给 Service 加 `loadBalancerIP` / Kube-vip 注解 | ✅ 这才是「固定入口 IP」的正解（L4 直达，不需要域名） |

> 走 Service LoadBalancer 的代价是**失去路径分流**（L4 不做路径路由）。
> 多个站点要挂在同一个入口下按 `/a`、`/b` 分流时，还是得用 Ingress，并给它配一个**真实域名**。

## 十一、排查口诀

> **入口 404 / 连不上**：先确认**直连 Pod/ClusterIP 是否通**（判断后端是否健康）→ 看 **Traefik 日志**（判断是路由失效还是入口问题）→ 检查 **Ingress 注解**（尤其 middleware 引用）→ 确认**入口 IP 是 ServiceLB 物理 IP 还是可漂移 VIP**。

几条针对本文新问题的口诀：

> **「VIP 通」不等于「服务好」**：`ping` 得通 VIP、`EXTERNAL-IP` 有值，都只说明「这个 IP 有人应答」。
> 判断服务死活要用**业务探测**（`/api/health`、首页状态码）。

> **某个节点的 NodePort 不通**：先看该 Service 的 `externalTrafficPolicy`。
> 是 `Local` 且这个节点上没有它的 Pod → **流量会被丢弃，这是设计行为**，不是节点故障。
> 用 `kubectl get endpoints` 确认哪些节点有后端。

> **「单实例 + 本地存储」的组件，VIP 漂移救不了它**：Pod 被 PV 绑死在某一台，
> 那台一挂，VIP 还能被别的节点宣告，但后面已经没有后端。要么给组件第二份，要么靠集群外探针兜底。

> **入口要固定 IP**：别在 Ingress 的 `host` 上想办法（只能填域名）。
> 要么给 Service 配 `loadBalancerIP`（L4 直达），要么给 Ingress 配真实域名。
