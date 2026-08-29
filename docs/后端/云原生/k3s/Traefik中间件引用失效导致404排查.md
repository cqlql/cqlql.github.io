---
title: Traefik 中间件引用失效导致 404 排查
icon: mdi:alert-circle-outline
sort: 9
---

> 现象：`curl http://<节点IP>/api/...` 返回 `404 page not found`，但后端 Pod 直接访问却正常。根因是 Ingress 引用的 Middleware 在 Traefik 侧无法解析，导致整条路由失效。

## 一、现象与初步判断

访问 Ingress 暴露的接口，返回的是 Traefik 自己返回的 404（`Content-Type: text/plain` + `404 page not found`），**而不是** Spring 的 JSON 错误体：

```bash
curl -i http://192.168.1.201/api/web/auth/login
# HTTP/1.1 404 Not Found
# Content-Type: text/plain; charset=utf-8
# 404 page not found
```

关键区别：**后端返回的 404 是 Spring 的 JSON 格式**（`{"code":...,"message":...}`），而这里是纯文本 `404 page not found`，说明请求根本没到达后端 Pod，是 Traefik 层面直接拒绝的。

## 二、排查思路：先分层定位

K8s 访问链路是 `Ingress → Traefik → Service → Pod`，排查要**从后往前逐层确认**，先排除后端自身问题，再定位网关层。

### 1. 确认后端 Pod / Service 正常

```bash
kubectl get pods -n <ns> -o wide          # Pod 是否 Running / Ready
kubectl get svc -n <ns>                   # Service 是否就绪
kubectl get endpoints -n <ns>             # 是否有后端 Endpoint IP
```

> Endpoints 为空，说明 Service 的 selector 没匹配到 Pod；有 Endpoint 则 Service 这一层是通的。

### 2. 直连 Pod / ClusterIP，绕过 Traefik

```bash
# 直连 Pod IP（在集群节点上执行）
curl -s -o /dev/null -w '%{http_code}\n' http://10.42.0.20:8005/api/web/auth/login

# 直连 ClusterIP
curl -s -o /dev/null -w '%{http_code}\n' http://10.43.251.135:8005/api/web/auth/login
```

如果直连返回 `200`（或 Spring 的 JSON），说明后端本身健康，问题锁定在 Traefik 路由层。

### 3. 看 Traefik 日志定位根因

```bash
kubectl logs -n kube-system deploy/traefik --tail=50
```

关键报错：

```
ERR error="middleware \"passup-backend-headers@kubernetescrd\" does not exist"
    entryPointName=web routerName=passup-passup-backend@kubernetes
```

## 三、根因

Ingress 通过注解引用了 Middleware：

```yaml
annotations:
  traefik.ingress.kubernetes.io/router.middlewares: passup-backend-headers@kubernetescrd
```

但 Traefik 的 `kubernetescrd` provider **没能 watch 到该 Middleware**，报 `does not exist`，导致整个 Ingress 路由失效，所有匹配该路由的请求统一返回 404。

## 四、解决方案

### 方案一：去掉 Middleware 引用（最快，本次采用）

如果 Middleware 只是加个请求头（如 `X-Forwarded-Proto`），对当前 HTTP 调试无影响，可直接去掉注解：

```yaml
annotations:
  traefik.ingress.kubernetes.io/router.entrypoints: web
  # 移除下面这行
  # traefik.ingress.kubernetes.io/router.middlewares: passup-backend-headers@kubernetescrd
```

去掉后路由立即恢复，请求可正常到达后端。

### 方案二：让 Traefik 支持跨命名空间 Middleware

如果确实需要 Middleware，需要给 Traefik 开启跨命名空间引用：

```bash
# Helm values 或 Traefik 启动参数
--providers.kubernetescrd.allowCrossNamespace=true
```

> 背景：Traefik 40.x（Helm 部署）的 `kubernetescrd` provider 对 Middleware 有命名空间 watch 范围限制。Middleware 虽和 Ingress 同 namespace，但 Traefik 控制器部署在 `kube-system`，可能没把业务 namespace 的 Middleware 纳入 watch，导致引用失败。

## 五、易踩的坑

### 1. 访问错了入口 IP

Traefik（LoadBalancer 型 Service）有**独立的外部 IP**，不一定等于节点 IP：

```bash
kubectl get svc -n kube-system traefik
# traefik   LoadBalancer   10.43.248.98   192.168.1.201,192.168.1.202   80:32407/TCP,443:31238/TCP
```

上例中入口 IP 是 `192.168.1.201` / `192.168.1.202`，而节点另一块网卡的 `192.168.1.200` 并不是 Traefik 入口，curl 它自然连不上或返回 404。

### 2. `ClusterIP` Service 在宿主机上不监听端口

`type: ClusterIP` 只暴露在集群内部，宿主机 `localhost` / 节点 IP 上**没有进程监听**对应端口，直接 `curl localhost:<port>` 会连接被拒：

```bash
curl localhost:8005
# curl: (7) Failed to connect to localhost port 8005
```

临时调试可用 `kubectl port-forward`：

```bash
kubectl port-forward -n <ns> svc/<name> 8005:8005
```

### 3. NodePort 端口范围限制

若改用 `type: NodePort` 让节点 IP 直接暴露服务，`nodePort` 必须在 `30000-32767` 范围内（k3s 默认），不能用 `8005` 这类低位端口：

```yaml
spec:
  type: NodePort
  ports:
    - name: http
      port: 8005
      targetPort: http
      nodePort: 30005   # 只能是 30000-32767
```

## 六、排查口诀

> 遇到「Ingress 访问 404 但后端正常」，按这个顺序：**直连 Pod/ClusterIP 确认后端 → 看 Traefik 日志 → 检查 Ingress 注解（尤其 middleware）→ 确认入口 IP**。
