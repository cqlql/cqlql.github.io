---
title: K3s Service 流量分配机制与异构集群
icon: mdi:swap-horizontal
sort: 9.5
---

> K3s 默认的 Service 并发流量分配，**不看节点实时可用内存、也不看节点当前负载**，默认是**轮询（Round Robin）**，在一组就绪 Pod 之间均分请求。

## 一、先区分两件完全不同的事

| | 调度器（kube-scheduler） | Service 负载均衡（kube-proxy） |
| --- | --- | --- |
| 阶段 | **部署阶段**：把 Pod 放到哪个节点 | **运行时**：流量转发到哪个 Pod（并发流量分配） |
| 依据 | Pod `resources.requests`（申请的资源**账面值**） | 就绪 Pod 列表（Endpoints），不看节点实时负载 |
| 是否看实时内存 | ❌ 不看（哪怕节点内存打满，只要账面 requests 有空位仍会调度；OOM 驱逐是之后 kubelet 的事） | ❌ 不看 |

## 二、K3s Service 默认流量分发（ClusterIP / NodePort）

- K3s 内置 kube-proxy，默认 **iptables 模式**。
- 只读取 Endpoints 里**就绪的 Pod 列表**，不采集节点实时内存 / CPU 利用率。
- 策略：**轮询（round-robin）**，请求依次分给所有就绪 Pod。
- 同节点多个 Pod、跨节点 Pod 一视同仁；**不会根据节点剩余内存动态调整流量权重**。
- 只有 Pod 变为 NotReady，才会被自动从 Endpoints 剔除、不再转发流量。
- IPVS 模式可换策略（rr / wrr / lc 等），但 K3s 默认不是 IPVS，需要手动改。

## 三、K3s 内置 ServiceLB（Klipper）与 Traefik

| 组件 | 角色 | 流量分配行为 |
| --- | --- | --- |
| **ServiceLB（Klipper）** | 外部入口代理：节点上监听 HostPort，把外部流量转发给 ClusterIP | 底层复用 kube-proxy 的 Endpoints 轮询逻辑；选哪些节点监听端口看端口空闲与 node label（`enablelb` / `lbpool`），**不按节点内存做流量权重** |
| **Traefik（默认 Ingress）** | 七层反向代理到后端 Service/Pod | 默认也是轮询，不读取节点内存；可手动配置 **Weighted Service 静态权重**分流，但不是自动感知节点内存的动态负载均衡 |

## 四、异构设备性能不一致时为什么吃亏（木桶效应）

> 节点 A：4 核 8G；节点 B：2 核 4G，两边各跑 1 个业务 Pod。
> 默认轮询 1:1 均分 → 弱节点 B 的 Pod 很快排队、延迟飙升、报错；强节点 A 还有大量空闲。
> **慢节点拖垮整体**。

根因：默认只做均等轮询，**完全不感知后端 Pod 所在机器的快慢、CPU / 内存余量**。

## 五、改善方案（从轻到重）

### 1. 切换 kube-proxy 到 IPVS，使用 `lc`（最少连接）策略
优先把新请求发给当前连接数最少的 Pod。
- ✅ 弱 Pod 堆积连接后，新请求会更多流向空闲 Pod，一定程度缓解性能不均。
- ❗ 只看连接数、不看 CPU/内存；弱机单个连接消耗资源大时依然会堵。

### 2. Traefik 加权后端（静态权重）
手动给高性能 Pod 更高权重、弱节点 Pod 降权。
- ❗ 静态配置，节点负载变化后不会自动调整，需人工改权重。

### 3. 服务网格（Istio）
可基于监控指标（CPU、内存、延迟）动态调整流量权重，最适合异构集群，但很重，小集群不推荐。

### 4. 调度层面兜底（部署阶段，异构集群第二个大坑）
K3s 默认调度器不会自动考虑节点性能差异，只看 `requests`，可能把大量 Pod 调度到弱节点直接打爆。可用：
- `nodeSelector` / `nodeAffinity`：节点打标签，强业务 Pod 只调度到高性能节点，弱节点跑轻量任务；
- `taint` & `toleration`：给弱节点打污点，不让普通业务 Pod 随便调度上去；
- `resources request + limit`：强制设置资源上限，防止单 Pod 吃光弱机资源；
- `topologySpreadConstraints`：拓扑分布约束，避免 Pod 扎堆在弱节点。

## 六、推荐异构 K3s 集群最简实践（低成本，不引入 Istio）

1. 给节点打标签区分性能：`node-type=high` / `node-type=low`；
2. 弱节点打污点，业务 Pod 不调度上去，弱节点只跑监控、日志等轻量组件；
3. kube-proxy 切换 IPVS，策略设 `lc`（最少连接）；
4. 关键业务 Pod 设置合理 requests/limits；
5. 配合监控告警，节点负载异常及时干预。

> 一句话总结：**默认 K3s 不感知硬件差异，异构设备一起跑业务会吃亏；最简单的方案不是动态流量权重，而是直接隔离——弱机不承接业务流量，只跑辅助组件。**
