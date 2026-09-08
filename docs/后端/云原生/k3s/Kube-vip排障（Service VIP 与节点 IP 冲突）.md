---
title: Kube-vip 排障（Service VIP 与节点 IP 冲突）
icon: mdi:alert-circle
sort: 13
---

本文记录一次真实排障：由于**没装 kube-vip-cloud-provider（CCM）自动分配、也没手动写 `loadbalancerIPs`**，kube-vip fallback 把 Traefik 的 **Service VIP 变成了某个节点的物理 IP**，VIP 漂移后在二层网络与节点「抢 IP」，最终导致该节点 `NotReady`、SSH 主机密钥乱跳、一堆 Pod 卡在 `Terminating`。这是 kube-vip `--services` 最容易踩、也最隐蔽的一类坑。

> 环境背景：3 节点 K3s 高可用（`u1` 172.16.0.211、`u2` 172.16.0.212、`u3` 172.16.0.213，均 `control-plane+etcd`）；kube-vip 控制面 VIP `172.16.0.210`（在 `u3`）；kube-vip `--services` 给 `LoadBalancer` 型 Service 分配业务 VIP，地址池 `range-global: 172.16.0.180-185`。Traefik 是 K3s 内置的 `LoadBalancer` Service。

---

## 0. 一句话结论

**根因是「没装 cloud-provider（CCM）自动分配 + 没手动写 `loadbalancerIPs`」，kube-vip 才 fallback 用节点物理 IP 当 VIP。** 一旦 VIP 与某节点 IP 重合，VIP 漂移到别的节点时就会 ARP 抢答，把那个节点「挤掉」→ `NotReady`。本环境 Traefik 因此 fallback 到了 `172.16.0.211/212`（= u1/u2 的物理 IP）。

---

## 1. 现象：一堆看似不相关的怪事同时出现

排查初期看到几个零散现象，当时并不知道彼此关联：

| 现象 | 表面看 | 实际关联 |
| --- | --- | --- |
| `u1` 的 `ip a` 里出现 `172.16.0.212/32` | 「u1 怎么会有 u2 的 IP？」 | 那是 Traefik 的 Service VIP，被 kube-vip 漂移到了 u1 |
| `u2` 变成 `NotReady` | 「u2 宕机了？」 | 其实是它的 IP 被 u1 抢答，节点自己收不到流量 |
| 连 `ssh 172.16.0.212` 主机密钥忽变（`1q8tlve…` ↔ `IEcejb4…`） | 疑似中间人攻击 | 该 IP 既是 u2 真机、又是漂移中的 VIP，连到不同主机 |
| `kubectl logs` 代理 `172.16.0.212:10250` 报 `502` | 网络问题 | 代理连到的是 u1（VIP 持有者），不是 u2 |
| `u2` 上一堆 Pod 卡 `Terminating` | 「Pod 起不来」 | 节点失联，kubelet 无法确认删除 |

---

## 2. 诊断：逐层拆开

### 2.1 u1 为什么有 `172.16.0.212`

`u1` 的 `enp0s3` 上其实有三类地址：

```text
inet 172.16.0.211/24  scope global enp0s3          ← u1 的真实节点 IP
inet 172.16.0.212/32  scope global deprecated enp0s3   ← kube-vip 的 Traefik VIP（漂来的）
inet 172.16.0.211/32  scope global deprecated enp0s3   ← kube-vip 的 Traefik VIP（u1 自己的）
```

`/32` + `deprecated` 是 kube-vip 绑 VIP 的特征（`preferred_lft 0`，避免被当源地址、也不触发 DAD）。所以 `172.16.0.212` 不是 u1 的配置，而是 **Traefik 这个 `LoadBalancer` Service 的 VIP 漂移到了 u1**。

### 2.2 为什么 `range-global` 池没生效：没装 CCM

明明配了地址池 `172.16.0.180-185`，Traefik 却拿到 `211/212`。根因是：**`range-global` 的自动分配是 kube-vip-cloud-provider（CCM）的职责，而本集群没装 CCM**——core kube-vip 不读这个 ConfigMap 分配 IP。于是 Traefik 既没有 CCM 自动分配、也没写 `loadbalancerIPs`，kube-vip 就 **fallback 用节点 IP 当 VIP**。看 Traefik Service 注解：

```bash
sudo k3s kubectl get svc traefik -n kube-system -o yaml
# metadata.annotations:
#   kube-vip.io/vipHost: u1        ← kube-vip 写回的「承载节点」记录（当时 leader 是 u1）
```

`spec.loadBalancerIP` / `spec.externalIPs` 都为空，也没有 `loadbalancerIPs` 注解 → 没有可用的显式 IP → kube-vip fallback 到节点 IP（u1=`172.16.0.211`）。`vipHost` 只是 kube-vip 运行期写回的承载节点记录，**不是根因**；根因是「无 CCM 自动分配 + 无手动 `loadbalancerIPs`」。（若写了 `loadbalancerIPs`，VIP 取后者、`vipHost` 仅记录承载节点、不会 fallback——这正是 §3 的修复思路。）

> 那 `212` 是哪来的？leader 在 u1/u2 之间切换时，kube-vip 分别 fallback 到 u1（`211`）和 u2（`212`）的节点 IP，于是出现两个「节点 IP 当 VIP」。`u2` 后来失联，`212` 这个 VIP 便漂到了 `u1`，抢了 u2 的 IP。

### 2.3 `kube-vip-services` 有 3 个 Pod Running，不代表 u2 健康

`kube-vip-ds` 和 `kube-vip-services` 都是 **DaemonSet（每节点一个）**，所以「有 3 个」是正常数量，与节点死活无关。而且 `u2` 上那几个 kube-vip Pod 显示 `Running` 只是**最后一次上报的残留状态**——`u2` 失联后 API Server 收不到新状态就一直挂着。铁证：取 `u2` 上的 `kube-vip-services` Pod 日志时，API 代理去连 `172.16.0.212:10250` 直接 `502`，说明 `u2` 的 kubelet 根本不可达。

### 2.4 根因：VIP 与节点 IP 冲突，u2 被「挤掉」

逐条取证：

```bash
# u2 的 Ready 条件
sudo k3s kubectl get node u2 -o jsonpath='{.status.conditions}'
# Ready=Unknown, message="Kubelet stopped posting node status"
```

```bash
# u2 的节点 IP —— 正是 172.16.0.212
sudo k3s kubectl get node u2 -o wide
# INTERNAL-IP = 172.16.0.212   EXTERNAL-IP = 172.16.0.212
```

```bash
# 从 u3 看 172.16.0.212 的 ARP 归属
ping -c1 -W2 172.16.0.212 >/dev/null 2>&1; ip neigh show 172.16.0.212
# 172.16.0.212 dev enp0s3 lladdr 08:00:27:62:ea:39 REACHABLE
#                            ^^^^^^^^^^^^^^^ 这是 u1 的 MAC（u3 自己是 08:00:27:b8:21:c3）
```

结论链：Traefik 的 VIP `172.16.0.212` 恰好等于 **u2 的物理 IP** → `u2` 出状况时 kube-vip 把这个 VIP **故障转移到 u1** → u1 把 `172.16.0.212/32` 绑到网卡并 gratuitous-ARP 宣告 → 二层里 `172.16.0.212` 全指向 u1 → **u2 对自己的 IP 失去控制权** → 收不到控制面/节点通信 → kubelet 心跳断 → `NotReady`。`u2` 事件里反复 `RegisteredNode → NodeNotReady` 正是 ARP 拉锯的痕迹。

> 这也解释了 2.1 的 SSH 密钥乱跳：连 `172.16.0.212`（u2 真机）时，ARP 有时被 u1 抢答、有时回到 u2，于是拿到不同主机密钥。**这是 VIP 漂移的副产品，不是中间人攻击。** 控制面 VIP `172.16.0.210` 没踩任何节点 IP，是干净的。

---

## 3. 修复：让 Traefik 的 VIP 取自「池内/指定地址」（而非节点 IP fallback）

核心结论（实测校正）：`vipHost` 只是 kube-vip 记录的「VIP 承载节点」，**会被反复写回、删不掉、也无需删**；真正决定 VIP 数值的是 `kube-vip.io/loadbalancerIPs`（或装了 CCM 时的池自动分配）。本环境最早 traefik **既没 CCM 自动分配、也没 `loadbalancerIPs`**，kube-vip 才 fallback 把节点 IP（211/212）当 VIP → 漂移抢 ARP → u2 NotReady。所以修复 = 给 VIP 一个明确的地址，不用跟 `vipHost` 较劲。

### 方案 A（推荐，确定）：显式指定池内固定 VIP

```bash
# 给 VIP 一个池内地址（本例 172.16.0.180，落在 180-185 池、非任何节点 IP）
sudo k3s kubectl annotate svc traefik -n kube-system kube-vip.io/loadbalancerIPs=172.16.0.180

# 重启 kube-vip-services，让新 VIP 确定性绑定
sudo k3s kubectl delete pod -n kube-system -l app.kubernetes.io/name=kube-vip-services
```

> 不必（也无法）删 `vipHost`：kube-vip 重选主后会把它写回成当前承载节点（如 `u2`），这只是记录、不影响 VIP 数值。只要 `EXTERNAL-IP` 是 `172.16.0.180` 而非节点 IP 即安全。本环境当前即此状态，已验证 VIP=180。

### 方案 B（纯池自动分配）：前提是装了 cloud-provider（CCM）

`range-global` 池的自动分配**只有装了 kube-vip-cloud-provider（CCM）才生效**。装了 CCM 时，把 `loadbalancerIPs` 也去掉，CCM 会从池挑空闲 IP 回填（一次性、永久固定）：

```bash
sudo k3s kubectl annotate svc traefik -n kube-system kube-vip.io/loadbalancerIPs-
# 有 CCM 时 → CCM 从 range-global 池挑空闲 IP 回填
sudo k3s kubectl delete pod -n kube-system -l app.kubernetes.io/name=kube-vip-services
```

> ⚠️ **本环境没装 CCM，方案 B 不可用**（core kube-vip 不读池，去掉 `loadbalancerIPs` 只会 fallback 成节点 IP）。所以本环境请用**方案 A**。

> 两种方案都**不能**让 VIP 变成节点 IP（如 `211`/`212`）。方案 A 最确定（IP 你定、已在本环境验证 VIP=180）；方案 B 依赖 CCM 的池分配。详见《Kube-vip 部署》8.1 节「VIP 取值的真正规则」。

> ⚠️ 注意 label：kube-vip-services 的 Pod label 是 `app.kubernetes.io/name=kube-vip-services`（**不是** `app=kube-vip-services`），删错 selector 会匹配不到。

等约 20 秒让 VIP 重新绑定、u2 心跳恢复，验证：

```bash
sudo k3s kubectl get svc traefik -n kube-system -o jsonpath='{.status.loadBalancer.ingress}'
# [{"ip":"172.16.0.180","ipMode":"VIP",...}]   ← 来自 loadbalancerIPs/地址池，不再是节点 IP

sudo k3s kubectl get node u2 -o wide
# STATUS=Ready   ← 已恢复

# ARP 应回到 u2 自己的 MAC（不再是 u1 的 62:ea:39）
ping -c2 -W2 172.16.0.212 >/dev/null 2>&1; ip neigh show 172.16.0.212
# lladdr 08:00:27:8f:50:eb   ← u2 的 MAC，冲突解除

# u1 上 211/212 的 /32 应已摘除
ssh u1 'ip -br addr show enp0s3'
# enp0s3  UP  172.16.0.211/24   ← 只剩真实 /24

# 之前卡在 u2 的僵尸 Pod 随节点恢复被正常回收
sudo k3s kubectl get pods -A -o wide | grep -iE "terminating|notready"   # 无输出
```

全部恢复：Traefik VIP 改为池内/指定地址（如 `172.16.0.180`）、三节点全 `Ready`、无 `Terminating` Pod。

---

## 4. 经验教训

1. **VIP 绝不能踩节点 IP**。选 `range-global` 池时要确保整段与所有节点 IP 不重叠（本环境池 `180-185`、节点 `211/212/213`、控制面 VIP `210`，彼此独立才正确）。踩中节点 IP 会在 VIP 漂移时引发 ARP 冲突、把节点挤成 `NotReady`。
2. **别把「没装 CCM 又没手动 IP」当成默认可用**：core kube-vip 不分配 IP，一旦无 CCM 又无 `loadbalancerIPs`，就会 fallback 用节点 IP——这才是冲突源头。业务入口要么装 CCM 走池，要么手动 `loadbalancerIPs` 指定非节点 IP；`vipHost` 只是 kube-vip 写回的承载节点记录，不是根因。
3. **想给某个 Service 固定 VIP，用 `kube-vip.io/loadbalancerIPs` 指定「池内」地址**，不要指定节点 IP。
4. **DaemonSet「有 N 个 Pod」≠ 节点都健康**：失联节点的 Pod 状态会停留在最后一次上报值，要看 `kubectl get nodes` 与节点 kubelet 可达性。
5. **SSH 主机密钥在一个 IP 上乱跳**：若这个 IP 同时是某节点真机又是 kube-vip VIP，基本是 VIP 漂移撞车，先查 ARP 归属（`ip neigh`），别急着当 MITM。
6. **诊断 IP 冲突最快的一招**：从另一台健康节点 `ping <冲突IP>; ip neigh show <冲突IP>`，看 MAC 到底属于谁。

---

## 5. 诊断命令速查

```bash
# 节点是否 Ready、为何 NotReady
kubectl get node <节点> -o wide
kubectl get node <节点> -o jsonpath='{.status.conditions}'
kubectl describe node <节点> | tail -20        # 看 RegisteredNode / NodeNotReady 事件

# Service VIP 从哪来（是否钉了节点 IP）
kubectl get svc <svc> -n kube-system -o yaml | grep -E 'vipHost|loadbalancerIPs|loadBalancerIP'
kubectl get svc <svc> -n kube-system -o jsonpath='{.status.loadBalancer.ingress}'

# 某 IP 在二层到底指向谁（判断是否被 VIP 抢答）
ping -c1 -W2 <IP> >/dev/null 2>&1; ip neigh show <IP>

# kube-vip-services 真实 label / 重启
kubectl get pod <kube-vip-services-pod> -n kube-system -o jsonpath='{.metadata.labels}'
kubectl delete pod -n kube-system -l app.kubernetes.io/name=kube-vip-services

# 地址池配置
kubectl get cm kubevip -n kube-system -o yaml
```

> 非 root 用户若 kubeconfig（`/etc/rancher/k3s/k3s.yaml`，默认 `600`）不可读，用 `echo <密码> | sudo -S k3s kubectl ...`；容器日志也可在节点上直接读 `/var/log/containers/kube-vip-services-*.log`（需 root）。

---

## 6. 关联阅读

- [Kube-vip Services 部署](./Kube-vip Services部署.md) —— `range-global` 地址池、`vipHost` / `loadbalancerIPs` 注解的正确用法
- [Kube-vip 排障（VIP 不生效）](./Kube-vip排障（VIP不生效）.md) —— 控制面 VIP 的另三类根因（证书 SAN / follower 不可见 / Pod 重启）
- [Kube-vip 部署](./Kube-vip部署.md) · [VIP 方案选型](./VIP方案选型.md) · [Ubuntu 高可用部署](./Ubuntu高可用部署.md)
