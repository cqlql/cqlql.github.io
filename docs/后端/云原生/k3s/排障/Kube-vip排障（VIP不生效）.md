---
title: Kube-vip 排障（VIP 不生效）
icon: mdi:alert-circle
sort: 12
---

本文记录一次真实排障：kube-vip 的 Control Plane VIP（如 `172.16.0.210`）在节点上 `ip addr` 看不到、或用 `https://VIP:6443` 连不上 apiserver。结论是「VIP 不生效」通常有三类不同根因，容易混淆，下面逐层拆开。

> 环境背景：K3s 2 节点控制面（`u1` 172.16.0.211、`u2` 172.16.0.212），都带 `etcd`；kube-vip 以 **DaemonSet**（`cp_enable=true`）方式部署，VIP=`172.16.0.210`，网卡 `enp0s3`。

---

## 1. 先别急着下结论：VIP 到底"生不生效"

「VIP 没生效」至少包含两层含义，排查顺序不同：

| 层 | 表现 | 判据 |
| --- | --- | --- |
| **网络层** | VIP 有没有被绑到某张网卡、ARP 通不通、TCP 连不连得上 | `ip addr` / `arp` / `nc -vz VIP 6443` |
| **应用层** | 客户端用 `https://VIP:6443` 访问 apiserver 是否成功 | `kubectl --server=https://VIP:6443 get nodes`（看是否 x509） |

**关键认知**：kube-vip 在 ARP 模式下是 **TCP/TLS 透传**——它把 `VIP:6443` 的流量转发给真实 apiserver，**自己不终止 TLS**。所以客户端最终拿到的是 apiserver 的证书，证书里必须包含这个 VIP，否则就是网络通、应用层报错。

---

## 2. 根因一（最常见最隐蔽）：apiserver 证书没把 VIP 写进 SAN

### 现象

- `ip neigh` / `arp` 能看到 `172.16.0.210` 且可达；`nc -vz 172.16.0.210 6443` 显示可连接。
- 但 `kubectl --server=https://172.16.0.210:6443 get nodes` 直接报错：

```text
x509: certificate is valid for 10.43.0.1, 127.0.0.1, 172.16.0.211, 172.16.0.212, ::1, not 172.16.0.210
```

证书 SAN 里只有两个节点 IP（`.211`/`.212`）和默认地址，**唯独缺 VIP `.210`**。

### 为什么

kube-vip 透传 TLS，客户端连 `https://VIP:6443` 时拿到的就是 apiserver 的证书。该证书由 K3s 在初始化时按 `--tls-san` 生成，**没把 VIP 加进去**，于是客户端校验 SAN 失败。

本环境 K3s 启动参数只配了节点 IP：

```bash
# /etc/systemd/system/k3s.service 的 ExecStart
--tls-san=172.16.0.211
```

`/etc/rancher/k3s/config.yaml` 里也只有 `disable: servicelb`，没有 VIP。

### 修复

把 VIP 加入 K3s 的 TLS SAN，并重启 K3s 让证书**重新生成**（K3s 启动时会检查现有证书是否覆盖全部 SAN，缺则重签）：

```yaml
# /etc/rancher/k3s/config.yaml
tls-san:
  - 172.16.0.210      # ← VIP，必须加
  - 172.16.0.211
disable:
  - servicelb
```

```bash
sudo systemctl restart k3s        # u1
# 在 u2 上也同样执行 sudo systemctl restart k3s（让两个 apiserver 证书都含 VIP）
```

> 重签后，无论 VIP 漂到哪台节点，`https://172.16.0.210:6443` 都能通过证书校验。
> 建议**初始化集群时就带上** `--tls-san=VIP`（见《Ubuntu 高可用部署》《Kube-vip 部署》），避免事后补。

---

## 3. 根因二（正常现象，不是故障）：VIP 在 follower 节点根本看不到

### 现象

在 `u1` 上 `ip addr` 看不到 `172.16.0.210`，于是以为「VIP 没起来」。

### 真相

kube-vip 走 **Leader Election**，同一时刻**只有 leader 节点**把 VIP 绑到网卡上，follower 不绑。这是设计行为，不是故障。

查看当前谁持有 VIP（看选主用的 Lease）：

```bash
kubectl -n kube-system get lease plndr-cp-lock -o yaml | grep -E 'holderIdentity|leaseTransitions'
# holderIdentity: u2   → 当前 VIP 在 u2 上
```

或看 kube-vip 容器日志：

```bash
kubectl -n kube-system logs kube-vip-ds-xxxx
# 末尾出现：New leader leader=u2   → u2 是 leader，VIP 在 u2
```

本环境确认 `u2` 是 leader，VIP 正确挂在 `u2` 的 `enp0s3` 上（ARP 解析到的 MAC 也是 `u2` 的）。`u1` 上看不到 VIP 完全正常。

---

## 4. 根因三（多为误报）：Pod 重启/CrashLoop 常是 apiserver 短暂不可达

### 现象

`kubectl get pods` 看到 kube-vip 有 `RESTARTS 2`（或 1），疑似不稳定。

### 真相

看**上一次**容器日志（`--previous`），常看到：

```text
leaderelection.go ... "Error retrieving lease lock" err="Get \"https://10.43.0.1:443/.../leases/plndr-cp-lock...\": context deadline exceeded"
leaderelection.go ... "Failed to renew lease"
```

`10.43.0.1` 是集群内 apiserver 的 ClusterIP。**这说明当时 K3s 自身在重启/不可用**，kube-vip 连不上 apiserver 续租 → 被迫退出重启。K3s 恢复后，存活节点重新选主、接管 VIP，Pod 回到 `Running`。

这类重启**不是配置错误**，是 K3s 重启的连带后果。只要 `kubectl logs`（当前）里能看到 `New leader leader=xxx` 且 `1/1 Running`，就说明已自愈。

---

## 5. HA 认知纠偏：2 节点控制面 ≠ 高可用

排查中常伴随一个误解：「VIP 能漂移，所以集群是高可用的」。**错**。VIP 漂移只解决「客户端连哪个地址」，前提是**控制面（etcd）还活着**。

etcd 必须拿到**多数派**才能工作，能容忍的故障数 = `⌊n/2⌋`：

| 控制面节点数 | etcd 法定票数 | 能容忍宕机 |
| --- | --- | --- |
| 1 | 1 | 0 |
| **2** | **2** | **0** ← 本环境，挂一台全完 |
| **3** | 2 | **1** ← 最低真正的 HA |
| 4 | 3 | 1 |
| 5 | 3 | 2 |

本环境是 **2 节点 etcd（quorum=2）**，所以**任意一台宕机**（u1 或 u2 都行，不是 u2 特殊）都会只剩 1/2，etcd 失 quorum → apiserver 挂 → 集群控制面整体不可用。它的可用性其实和单节点一样，谈不上 HA。

**真正的高可用 = kube-vip VIP 漂移 + 奇数（≥3）控制面节点**：

- 3 节点时 u2 宕机 → 剩 2/3 仍 quorum，VIP 漂到存活节点，集群照常工作。
- 所以「要谈高可用，先把控制面扩到 3 节点」，证书 SAN 那事（第 2 节）照样要修。

---

## 6. 安全验证 VIP 漂移（千万别停节点）

想验证「leader 挂了 VIP 会漂走」，**不要 `systemctl stop k3s` 或关机**——2 节点下会直接搞崩 etcd quorum。只杀 kube-vip Pod 即可让 leader 释放租约：

```bash
# 假设当前 leader 是 u2，Pod 名 kube-vip-ds-v6t8j
kubectl -n kube-system delete pod kube-vip-ds-v6t8j
# 随后 u1 抢到租约，VIP 漂到 u1；arp 172.16.0.210 的 MAC 会变成 u1 的
```

验证完你会发现：VIP 到了 u1，但第 2 节的**证书 x509 报错依旧**（证书跟节点无关，是集群共享的）。所以漂移机制本身没问题，真正要修的是证书 SAN。

---

## 7. 诊断命令速查

```bash
# 1) VIP 是否被某节点持有（看 leader）
kubectl -n kube-system get lease plndr-cp-lock -o yaml | grep holderIdentity

# 2) 网络层：VIP 是否可达、ARP 指向哪台
nc -vz 172.16.0.210 6443            # 或 timeout 5 bash -c '</dev/tcp/172.16.0.210/6443'
ip neigh show 172.16.0.210

# 3) 应用层：用 VIP 直连 apiserver（看是否 x509）
kubectl --server=https://172.16.0.210:6443 get nodes

# 4) kube-vip 当前 / 上一次 日志
kubectl -n kube-system logs kube-vip-ds-<pod>
kubectl -n kube-system logs kube-vip-ds-<pod> --previous

# 5) 节点角色（确认都是 control-plane+etcd，判断 etcd 容错能力）
kubectl get nodes -o wide

# 6) K3s 启动参数里 tls-san 是否含 VIP
grep -R tls-san /etc/systemd/system/k3s.service /etc/rancher/k3s/config.yaml
```

> 非 root 用户若 kubeconfig（`/etc/rancher/k3s/k3s.yaml`，默认 `600`）不可读，可用 `echo <密码> | sudo -S kubectl ...`；或临时 `sudo chmod 644 /etc/rancher/k3s/k3s.yaml`（排查完改回 `600`）。容器日志也可在节点上直接读 `/var/log/containers/kube-vip-ds-*.log`（需 root）。
