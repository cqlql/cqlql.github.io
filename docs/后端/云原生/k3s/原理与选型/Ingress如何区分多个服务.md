---
title: Ingress 如何区分多个服务（域名 / 路径 / 端口）
icon: mdi:routes
sort: 7.5
---

> 多个服务共用一个入口对外暴露时，Ingress 需要「决定把请求送到哪个 Service」。区分的维度有三种：**域名（Host）、路径（Path）、端口（Port）**。本文给出结论与取舍。

## 一、结论先行

**有域名走域名，没域名走路径，端口极力避免。**

| 方式 | 定位 | 推荐度 | 一句话说明 |
| --- | --- | --- | --- |
| **域名** | 公网 / 生产环境的标准做法 | ⭐⭐⭐ | 最优雅、扩展性好，天生支持 HTTPS 证书 |
| **路径** | 无域名 / 内网环境的最佳替代方案 | ⭐⭐⭐ | 只需暴露 80/443，架构清爽、运维简单 |
| **端口** | 极力避免（仅用于 MySQL/Redis 等 TCP/UDP） | ⭐ | 链路长、维护成本高，易端口冲突和防火墙拦截 |

> 一句话记忆：**HTTP 服务走域名或路径，四层原生协议（TCP/UDP）才考虑端口。**

## 二、域名区分（公网 / 生产标准做法）

按 `Host` 头把不同域名路由到不同服务，是生产环境最优雅的方案（如 `api.passup.com`、`admin.passup.com`）：

```yaml
spec:
  ingressClassName: traefik
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backend-svc
                port:
                  number: 8005
    - host: admin.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: admin-svc
                port:
                  number: 8080
```

**优点**：语义清晰、服务彼此隔离，扩展性最好，**每个域名天生支持单独配置 HTTPS 证书**。

**缺点**：需要多个域名并配置 DNS 解析（或配泛域名 `*.example.com` + 通配证书）；域名/证书环节没搞好的话反而比路径更麻烦。

## 三、路径区分（无域名 / 内网最佳替代）

没有域名、或纯内网场景下，用不同路径前缀路由到不同后端是最省事的替代方案：

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
spec:
  ingressClassName: traefik
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-svc
                port:
                  number: 8005
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-svc
                port:
                  number: 80
```

**优点**：**只需暴露 80/443 端口**，通过 `/api/service-a`、`/api/service-b` 路由，架构清爽、运维简单；甚至可以不写 `host`，直接用入口 IP 访问，无需额外 DNS。

**注意**：`pathType` 用 `Prefix` 表示前缀匹配（`/api` 会匹配 `/api/...`），顺序上更具体的路径应写在前面；后端应用要能感知 `/api` 前缀（若加了反向代理前缀），否则可能出现资源路径错乱。

## 四、端口区分（极力避免）

想用「不同端口对应不同服务」来实现分流，在 K8s 里会变得**非常复杂**，原因在于：**标准 `Ingress` 是七层（HTTP）路由，只认 Host/Path，不认端口；端口属于四层（TCP）概念**。

要用端口区分 HTTP 服务，通常只能走以下路线，每一步都在「绕」：

1. **改 Traefik 启动参数 / 入口 Service**：给它新增多个端口映射（如 `8080:web2`、`8081:web3`），对应多个 entrypoint，再在 `IngressRoute`（CRD）里按 entrypoint 区分——链路是「改 Traefik 启动参数 → 改 Traefik Service 端口 → 写 Ingress」，还要脱离标准 Ingress 语法。
2. **干脆不用 Ingress，每个服务各用 `NodePort`**：每个服务占一个 `nodePort`（只能在 `30000-32767` 内），脱离统一入口，客户端要记一堆端口、防火墙要开一堆端口，运维负担陡增。

对比：域名/路径方式，新增或调整服务**只改 Ingress 这一个资源**；端口方式则要动 Traefik、入口 Service、entrypoint、防火墙、客户端配置，**链路极长、维护成本高、容易端口冲突和防火墙拦截**。

> 端口唯一的合理场景：**MySQL、Redis 等非 HTTP 的四层 TCP/UDP 协议**，它们本就走不了 HTTP 的 Host/Path 路由，只能按端口暴露。

## 五、怎么选（建议）

| 场景 | 推荐 |
| --- | --- |
| 公网 / 生产环境，有域名 | **域名** |
| 无域名 / 内网环境 | **路径** |
| 各服务需要独立域名、独立证书、强隔离 | **域名** |
| 一个域名/IP 下暴露多个后端（前后端分离、微服务网关） | **路径** |
| MySQL / Redis 等四层 TCP/UDP 协议 | **端口**（仅此例外） |
| 已有成熟网关（如内部网关按端口规划） | 尽量收敛到域名/路径，避免端口 |

> 一句话：**HTTP 服务走域名或路径，四层原生协议（TCP/UDP）才考虑端口。**
