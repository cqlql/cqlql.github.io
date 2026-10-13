---
title: WSL2 局域网 SSH 访问
icon: mdi:lan-connect
sort: 5
---

# WSL2 局域网 SSH 访问：NAT + 端口转发的落地与踩坑

> **文档定位：这是一篇 Linux/网络运维笔记，含本次完整落地记录。**
> 目标：让局域网内其他设备直接 `ssh cql@172.16.0.222` 登录 WSL 中的 Ubuntu 24.04。
> 本文记录三种网络方案的实测取舍、镜像网络为何失败、最终 `netsh portproxy` 配置，
> 以及一个极易误判成功的「转发环路」陷阱。
>
> 配套文档：
> - 《防火墙与端口》（同目录）—— 防火墙规则的通用写法，本文只写针对 WSL 的那部分
> - 《Ubuntu 静态IP配置》（同目录）—— 静态 IP 思路，本文不涉及
>
> **环境**：Windows 11 + WSL `2.6.3.0`，发行版 `Ubuntu-24.04`，
> 主机 LAN IP `172.16.0.222`，WSL 用户 `cql`。

**当前状态（2026-10-12，以本机实测为准）**：

| 部分 | 状态 |
| :--- | :--- |
| WSL 内 openssh-server 安装与自启 | ✅ 已完成 |
| `netsh portproxy` 转发（LAN IP → WSL） | ✅ 已完成，局域网可用 |
| 镜像网络（mirrored）方案 | ❌ 已废弃，实测 LAN 入站不通 |
| 主机 LAN IP 变化后自动更新规则 | ⚠️ 未做，需手动重跑脚本 |
| 开机自动拉起 WSL 与 sshd | ⚠️ 未做，目前依赖手动启动 |

## 1. 背景与目标

### 1.1 要解决的问题

WSL 里的 Ubuntu 想被局域网中其他设备 SSH 登录（比如从另一台开发机连过来）。
默认 NAT 模式下 WSL 只有一个 `172.30.x.x` 的私有地址，**仅 Windows 主机可见**，
局域网其余设备完全访问不到。

### 1.2 目标

- 局域网任意设备可 `ssh cql@<主机 LAN IP>` 登录 WSL
- 配置一劳永逸：WSL 重启后不需要手动改来改去
- 不破坏现有的 Docker Desktop、Clash 等网络组件

## 2. 结论先行

| 决策 | 结论 | 理由 |
| :--- | :--- | :--- |
| 网络模式 | 回退到**默认 NAT**，放弃镜像模式 | 镜像模式实测 LAN 入站不通，见 §5 |
| 暴露方式 | `netsh portproxy` 端口转发 | 微软官方推荐做法，不依赖 WSL IP |
| 转发监听地址 | **只绑主机 LAN IP**（`172.16.0.222`） | 绑 `0.0.0.0` 会挤掉 WSL 的 localhost relay，形成转发环路，见 §7 |
| 转发目标 | `127.0.0.1:22`（WSL relay） | 不依赖 WSL IP，WSL 重启后规则仍有效 |
| sshd 端口 | 保持 `22`，不改 | 无需改动 `ssh.socket`，WSL 内部使用习惯不变 |
| 验证手段 | 读 **SSH banner** | 只测 TCP connect 会被环路骗过，见 §8 |

## 3. 环境信息

排查时确认的关键事实：

| 项 | 值 |
| :--- | :--- |
| WSL 版本 | `2.6.3.0` |
| 发行版 | `Ubuntu-24.04`（WSL2），另有 `docker-desktop` |
| WSL 用户 | `cql`，已设置密码 |
| systemd | 已启用（`systemctl is-system-running` = `running`） |
| 主机真实网卡 | `以太网` = `172.16.0.222`，网关 `172.16.0.1` |
| 其他网卡 | `Meta` `198.18.0.1`（Clash Verge TUN）、`以太网 3` `192.168.56.1`（VirtualBox）、`vEthernet (WSL)` `172.30.144.1` |
| 22 端口（Windows 侧） | 原本空闲 |

## 4. 三种网络方案的取舍

| 方案 | WSL 的 IP | 局域网直连 | 代价 |
| :--- | :--- | :--- | :--- |
| NAT（默认） | `172.30.x.x` 私有 | ❌ 不行 | 需额外端口转发 |
| 镜像 `mirrored` | 与主机同一 IP | ⚠️ 理论支持，**本机实测不通** | 需重启 WSL；多网卡环境下易出问题 |
| 桥接 `bridged` | 路由器 DHCP 分配，真独立 | ✅ 可以 | 需 Hyper-V 外部虚拟交换机（家庭版无此功能） |

**为什么不选桥接**：需要用 `New-VMSwitch` 建外部虚拟交换机，而本机还装着
VirtualBox，二者在虚拟网卡驱动上容易打架，且家庭版 Windows 没有该功能模块。

**为什么放弃镜像**：配置全部正确但 LAN 入站依然不通，详见 §5。

最终拓扑：

```text
  局域网设备（如 ssh k1）
        │  ssh cql@172.16.0.222:22
        ▼
  ┌──────────────────────────────┐
  │ Windows 主机                 │
  │   172.16.0.222:22            │  ← netsh portproxy 只绑这个地址
  │   （转发）                    │
  │   127.0.0.1:22               │  ← WSL localhost relay
  └──────────────────────────────┘
        │
        ▼
  ┌──────────────────────────────┐
  │ WSL Ubuntu-24.04             │
  │   sshd 0.0.0.0:22            │
  └──────────────────────────────┘

## 5. 镜像网络为什么失败

镜像模式（`networkingMode=mirrored`）下，**所有配置项都是对的**，但 LAN 入站依然不通——
这一点值得单独记，因为它很容易让人反复检查配置却找不到根因。

已确认无误的配置：

| 检查项 | 结果 |
| :--- | :--- |
| 镜像是否生效 | ✅ WSL 内出现 `eth1 = 172.16.0.222/24`，确实镜像了主机网卡 |
| sshd 监听 | ✅ `0.0.0.0:22` + `[::]:22` |
| WSL 内 iptables | ✅ `INPUT` policy `ACCEPT`，无任何规则 |
| Windows 防火墙 | ✅ 规则已启用 / 入站 / TCP 22 / 允许 |
| Hyper-V 防火墙 | ✅ `WSL-SSH-Inbound` 已启用 / 入站 / TCP 22 / 允许 |
| VM Creator | ✅ `{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}` 与 WSL 匹配 |

实测结果：

| 测试路径 | 结果 |
| :--- | :--- |
| Windows → `127.0.0.1:22` | ✅ OPEN（sshd 日志可见 `Connection closed by 127.0.0.1`） |
| Windows → `172.16.0.222:22` | ❌ TIMEOUT |
| 对照：Windows → `172.16.0.222:445 / 135 / 5040` | ✅ 全部 OPEN |
| 另一台机器 → `ssh cql@172.16.0.222` | ❌ 超时 |

**对照测试是关键**：主机自身服务（445 / 135 / 5040）走同一个 LAN IP 全都通，
说明路由、防火墙、代理都没问题，唯独 WSL 的 22 端口没暴露出去。

**怀疑根因**：镜像模式会把主机的**全部**网络接口镜像进 WSL。这台机器同时存在
Clash Verge 的 TUN 网卡（`198.18.0.1/30`）和 VirtualBox 的 Host-Only 网卡，
这类「非标准」接口混进来后入站转发链路被破坏。
结论：**网卡环境复杂的机器上，不要指望镜像模式能用于 LAN 入站。**

## 6. 最终方案：NAT + netsh portproxy

### 6.1 配置步骤

1. 回退 `C:\Users\cql13\.wslconfig`，注释掉 `networkingMode=mirrored`，回到默认 NAT
2. WSL 内安装并启用 `openssh-server`
3. 重启 WSL，让 NAT 模式与 sshd 生效
4. 添加 portproxy 规则（只绑 LAN IP）
5. Windows 防火墙放行 TCP 22 入站

### 6.2 关键命令

WSL 侧安装 sshd：

```bash
# 免密以 root 执行：WSL 支持 -u root 直接提权，不需要 sudo 密码
wsl.exe -d Ubuntu-24.04 -u root -- apt-get update -qq
wsl.exe -d Ubuntu-24.04 -u root -- apt-get install -y openssh-server
wsl.exe -d Ubuntu-24.04 -u root -- systemctl enable --now ssh.socket
```

Windows 侧（管理员 PowerShell）：

```powershell
netsh interface portproxy add v4tov4 `
    listenaddress=172.16.0.222 listenport=22 `
    connectaddress=127.0.0.1 connectport=22

New-NetFirewallRule -DisplayName "WSL SSH (LAN)" `
    -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow -Profile Any
```

**为什么连接目标是 `127.0.0.1` 而不是 WSL 的 IP**：NAT 模式下 WSL 会自动把监听端口
relay 到主机的 `127.0.0.1`，转发到 `127.0.0.1:22` 就**不依赖 WSL 的 IP**，
WSL 重启后规则依然有效。若直接转发到 `172.30.x.x`，每次 WSL 重启 IP 都可能变。

## 7. 关键坑：`0.0.0.0` 转发到 `127.0.0.1` 会形成环路

这是本次最值得记的一条。第一版规则写成：

```powershell
# 错误写法
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=22 `
    connectaddress=127.0.0.1 connectport=22
```

**为什么会环路**：绑定 `0.0.0.0:22` 会**连带占用 `127.0.0.1:22`**，
于是 WSL 的 localhost relay 绑不上这个地址；而转发目标正是 `127.0.0.1:22`——
它指回 portproxy 自己，变成「自己转给自己」的无限循环。

**现象**：TCP 连得上，但 SSH 握手在密钥交换阶段被掐断：

```text
kex_exchange_identification: Connection closed by remote host
```

`netstat` 里能看到特征残骸——一堆指向自己的 `FIN_WAIT_2`：

```text
TCP  0.0.0.0:22     0.0.0.0:0        LISTENING   4136
TCP  127.0.0.1:22   127.0.0.1:49152  FIN_WAIT_2  4136
TCP  127.0.0.1:22   127.0.0.1:49155  FIN_WAIT_2  4136
...
```

**修正**：portproxy 只绑主机 LAN IP，把 `127.0.0.1:22` 留给 WSL relay。

```powershell
# 正确写法
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=22
netsh interface portproxy add v4tov4 `
    listenaddress=172.16.0.222 listenport=22 `
    connectaddress=127.0.0.1 connectport=22
```

⚠️ 删除 `0.0.0.0` 规则后，relay 通常不会自动重绑，
需要**重启一次 WSL**（`wsl --shutdown`）才能恢复。

## 8. 验证方式

**不要用「TCP 能不能连上」判断成功**——环路照样能连上，会误判。
必须读到真正的 SSH banner。

1. 读 banner（推荐，最难被欺骗）：

```powershell
$c = New-Object System.Net.Sockets.TcpClient
$c.Connect('172.16.0.222', 22)
$s = $c.GetStream(); $s.ReadTimeout = 4000
$buf = New-Object byte[] 128
$n = $s.Read($buf, 0, 128)
[System.Text.Encoding]::ASCII.GetString($buf, 0, $n).Trim()
```

   期望输出 `SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.19`。

2. 用 ssh 客户端试连（本机即可）：

```bash
ssh -o ConnectTimeout=6 -o StrictHostKeyChecking=no -o NumberOfPasswordPrompts=0 \
    -p 22 cql@172.16.0.222 exit
```

   期望输出 `cql@172.16.0.222: Permission denied (publickey,password).`
   出现 `Permission denied` 说明**握手已成功**，只是没给密码。

3. 从局域网另一台设备实连：`ssh cql@172.16.0.222`

⚠️ 排查时注意两个干扰源：

- 环境变量 `http_proxy` 会让 `curl` 返回假的 `502`，测端口要加 `--noproxy '*'`
- Git Bash 的 `/dev/tcp` 在这台机器上会误报 `Connection refused`，不可靠

## 9. 文件清单

新增：

```text
/etc/ssh/sshd_config.d/99-wsl-lan.conf    # PasswordAuthentication yes / PermitRootLogin no
```

修改：

```text
C:\Users\cql13\.wslconfig                 # networkingMode=mirrored 已注释，回退 NAT
Windows 防火墙                             # 新增入站规则 WSL SSH (LAN)，TCP 22 允许
netsh portproxy                           # 172.16.0.222:22 -> 127.0.0.1:22
```

## 10. 待确认问题 / 后续

| 优先级 | 事项 | 当前状态 | 建议 |
| :--- | :--- | :--- | :--- |
| P1 | 主机 LAN IP 变化后规则失效 | 未处理 | 规则绑的是具体 IP；IP 变了需重跑脚本。可考虑开机脚本自动读 LAN IP 重建规则 |
| P1 | 开机后 WSL 与 sshd 不会自动拉起 | 未处理 | 需配置开机启动 WSL，否则主机重启后局域网 SSH 不可用 |
| P2 | WSL 重启会中断 Docker 容器 | 已知 | `wsl --shutdown` 后容器不自动恢复，需手动 `docker compose up -d` |
| P2 | 当前为密码登录 | 可提升 | 改用 SSH 公钥登录更安全 |

## 11. 落地记录

- **2026-10-12** 首次配置：先装 `openssh-server`（发现原本只装了 `openssh-client`）；
  尝试镜像模式，配置全对但 LAN 不通，经第二台机器确认后废弃；改用 NAT + `netsh portproxy`。
- **2026-10-12** 修正环路：portproxy 第一版用 `0.0.0.0 -> 127.0.0.1` 产生转发环路；
  第二版改为只绑 LAN IP，并**把验证手段从「TCP 连通」改成「读 SSH banner」**，
  这才暴露了前一版的误判。
- 备注：Ubuntu 24.04 的 `sshd` 走 **systemd socket 激活**（`ssh.socket`），
  监听地址由 socket 单元决定，**改 `sshd_config` 里的 `Port` 不生效**；
  若要改端口，需要给 `ssh.socket` 加 override 配置。
