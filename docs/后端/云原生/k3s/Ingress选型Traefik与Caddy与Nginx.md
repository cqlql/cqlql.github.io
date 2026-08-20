---
title: K3s 下 Ingress 选型（Traefik vs Caddy vs Nginx）
icon: mdi:routes
sort: 7
---

> K3s 默认内置 **Traefik** 作为 Ingress Controller，但这并不代表其它方案不可行。本文梳理 Traefik、Caddy、Nginx Ingress 三者在 K3s 环境下的选型思路。

## 一、结论先行

「K3s 推荐 Traefik」本质是**默认内置、零配置可用**，而不是 Traefik 在技术上一定优于 Caddy / Nginx。选型取决于团队经验、是否需要自动 HTTPS、以及是否愿意为更广生态放弃内置便利。

| 场景 | 推荐 |
| --- | --- |
| 纯 K3s、图省事、中小项目 | **Traefik**（默认内置，零安装） |
| 团队已有 Nginx 经验 / 需要海量注解与资料 | **Nginx Ingress Controller** |
| 特别看重自动 HTTPS、想配置极简 | **Caddy**（但 Ingress Controller 生态相对小众） |

## 二、K3s 为什么默认 Traefik

K3s 官方把 Traefik 作为**内置组件**打包，理由：

1. **开箱即用**：装完 K3s，Traefik 已部署（以 DaemonSet 运行），`Ingress` 资源直接生效，无需额外安装 Controller，对边缘计算和 Homelab 极其友好。
2. **跨架构支持好**：这是 K3s 选 Traefik 的**核心考量之一**——Traefik 对 **ARM32 / ARM64**（如树莓派）和 x86 都有原生多架构支持，契合 K3s 面向边缘/IoT/ARM 设备的定位。
3. **轻量、单二进制**：契合 K3s「轻量」定位，Traefik 用 Go 写成、单二进制、资源占用小。
4. **云原生与动态配置**：专为容器环境设计，原生从 K8s 的 Ingress / CRD 自动发现路由；不仅支持标准 `Ingress`，还提供更强大的 `IngressRoute`（CRD），并原生集成 Let's Encrypt 自动证书申请。
5. **功能全**：原生支持 WebSocket、中间件（Middleware CRD）、gRPC 等。

## 三、Caddy / Nginx 也完全可以，各有优势

K3s **允许禁用内置 Traefik**，换成其它 Ingress Controller，这是官方支持的做法：

```bash
# 安装 K3s 时禁用内置 Traefik
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik" sh -
```

### 三者对比

| 维度 | Traefik (K3s 默认) | Nginx Ingress | Caddy Ingress |
| --- | --- | --- | --- |
| 安装成本 | **零配置**（K3s 自动部署） | 需禁用自带 Traefik 后配置安装 | 需手动部署控制器 |
| 性能/吞吐量 | 中等偏上 | **极高**，高并发/大流量首选 | 中等 |
| 配置复杂度 | 简单，支持自定义 CRD（`IngressRoute`） | 极为丰富，但 Annotations 较复杂 | 极简，Caddyfile 语法直观 |
| 自动 TLS | 原生支持 ACME / Let's Encrypt | 通常配合 cert-manager | **原生自动化 TLS 最出色** |
| 最佳场景 | 开发测试、边缘设备、轻量微服务 | 传统企业生产、超高并发 | 追求极致极简配置的轻量场景 |

### 该如何选择

- **选 Traefik**：直接使用默认设置即可。中小型应用、个人项目、边缘节点或多架构环境，动态配置 + 自动 TLS 能省大量运维精力。
- **选 Nginx Ingress**：需要高性能大流量压测、复杂的 Rewrite 规则、特殊 Nginx 模块支持，或团队对传统 Nginx 配置非常熟悉。
  > 切换方式：安装 K3s 时加 `--disable traefik`，再手动安装 `ingress-nginx`。
- **选 Caddy**：希望用极简逻辑处理证书和 HTTP/3 协议的特殊环境；但在 K8s 控制器生态中属于较少数派的选择。

### 补充说明

- **Caddy 的强项是「自动 HTTPS」**：几乎零配置自动申请/续期证书，配置简洁，且对 HTTP/3 支持好。这也是 `pass-up.backend` 之前原生用 Caddy 做反向代理的原因（见其 `ingress.yaml` 注释「对应原 Caddy 配置」）。
  > 注意：Caddy 作为 **K8s Ingress Controller** 时，要发挥自动 HTTPS 通常还是走它自己的 `Caddyfile` 或 `IngressRoute` 之类，与 K8s 标准 `Ingress` 的贴合度不如 Traefik / Nginx。
- **Nginx Ingress 生态最成熟**：资料最多、社区最大、注解丰富，很多团队已有 Nginx 使用经验，迁移成本低。

## 四、一句话总结

> 对 K3s 而言，**顺应官方默认使用 Traefik 是最省心、也是官方最推荐的路径**；只有当 Traefik 无法满足的特殊性能或特定网络插件需求时，才考虑 `--disable traefik` 并替换为 Nginx。选型本质取决于团队经验、是否需要自动 HTTPS、以及是否愿意为更广生态放弃内置便利。
