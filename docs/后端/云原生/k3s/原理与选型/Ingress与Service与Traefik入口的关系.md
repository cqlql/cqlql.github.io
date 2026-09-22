---
title: Ingress / Service / Traefik 入口的关系
icon: mdi:routes
sort: 8
---

> 排查「业务入口高可用」时，最容易混淆的就是 Ingress、Service、Traefik 三者的分工。本文厘清它们「各管一层」，并回答几个高频认知盲区。

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

## 七、排查口诀

> 遇到「入口 404 / 连不上」：先确认**直连 Pod/ClusterIP 是否通**（判断后端是否健康）→ 看 **Traefik 日志**（判断是路由失效还是入口问题）→ 检查 **Ingress 注解**（尤其 middleware 引用）→ 确认**入口 IP 是 ServiceLB 物理 IP 还是可漂移 VIP**。
