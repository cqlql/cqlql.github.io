---
title: Kubernetes Secret 文件挂载详解
icon: mdi:key-variant
sort: 9
---

> 本文梳理 Secret 以「文件」方式挂载进 Pod 的完整链路，重点讲清楚「敏感内容到底存哪」「容器里如何找到这个文件」「`items[].path` 到底是不是物理路径」三个高频疑问，结合 `pass-up.backend` 的微信支付 PEM 密钥挂载实例讲解。

## 一、一个典型场景：微信支付 PEM 密钥

`pass-up.backend` 需要向微信支付 API 发起签名请求、校验回调，用到的商户私钥与微信支付公钥是最高敏感级的凭证。下面是它在 `k8s/base/deployment.yaml` 中的挂载配置：

```yaml
spec:
  containers:
    - name: backend
      env:
        # 微信支付密钥 PEM 文件路径（从 Secret 卷挂载）
        - name: WECHAT_PAY_PRIVATE_KEY_PATH
          value: /app/secrets/wechat-pay-private-key.pem
        - name: WECHAT_PAY_PUBLIC_KEY_PATH
          value: /app/secrets/wechat-pay-public-key.pem
      volumeMounts:
        - name: secrets
          mountPath: /app/secrets
          readOnly: true
  volumes:
    - name: secrets
      secret:
        secretName: passup-backend-secret
        items:
          - key: wechat-pay-private-key.pem
            path: wechat-pay-private-key.pem
          - key: wechat-pay-public-key.pem
            path: wechat-pay-public-key.pem
```

这段配置初看很「绕」：又是 `env` 又是 `volumeMounts` 又是 `volumes.items`，还同时出现了 `.pem` 后缀。绕的原因在于它叠了两层东西——**路径本身**（非敏感）+ **PEM 内容**（敏感），二者必须分开放。

## 二、真实文件到底放在哪

结论先行：**宿主机上不存在这两个 `.pem` 文件**。PEM 内容作为字符串存在 Kubernetes 的 `Secret` 对象里（最终落在 etcd），并不落在任何物理路径。

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: passup-backend-secret
  namespace: passup
type: Opaque
stringData:                      # 或 data:（base64 编码）
  wechat-pay-private-key.pem: |
    -----BEGIN PRIVATE KEY-----
    ...
    -----END PRIVATE KEY-----
  wechat-pay-public-key.pem: |
    -----BEGIN PUBLIC KEY-----
    ...
    -----END PUBLIC KEY-----
```

- `stringData`：直接写明文，由集群自动编码后存储。
- `data`：写 base64 编码后的内容。
- 这里把 PEM 内容当作一个「键」塞进 Secret，键名就是 `wechat-pay-private-key.pem`。

## 三、容器里如何找到这两个文件

链路分三段，最终合成一个容器内路径。

### 1. Secret 卷把「键」投影成「文件」

```yaml
volumes:
  - name: secrets
    secret:
      secretName: passup-backend-secret
      items:
        - key: wechat-pay-private-key.pem    # Secret 里的键名
          path: wechat-pay-private-key.pem   # 卷内的文件名
```

### 2. 挂载到容器目录

```yaml
volumeMounts:
  - name: secrets
    mountPath: /app/secrets
    readOnly: true
```

Kubernetes（kubelet）会在容器 `/app/secrets/` 下**虚拟**生成两个文件：

- `/app/secrets/wechat-pay-private-key.pem`
- `/app/secrets/wechat-pay-public-key.pem`

### 3. 告诉应用这些文件的路径

```yaml
env:
  - name: WECHAT_PAY_PRIVATE_KEY_PATH
    value: /app/secrets/wechat-pay-private-key.pem
```

Spring Boot 的 relaxed binding 会把 `WECHAT_PAY_PRIVATE_KEY_PATH` 绑定到 `wechat.pay.private-key-path`，最终由业务代码按此路径读文件。

### 完整链路图

```text
Secret 对象
  data["wechat-pay-private-key.pem"] = <PEM 内容>
        │  (items.key)
        ▼
Secret 卷 /app/secrets（mountPath）
        │  (items.path)
        ▼
文件 /app/secrets/wechat-pay-private-key.pem
        │  (env WECHAT_PAY_PRIVATE_KEY_PATH 的值)
        ▼
WechatPayProperties.privateKeyPath
        │
        ▼
WXPayUtility.loadPrivateKeyFromPath(path) 读文件
```

## 四、`items[].path` 是物理路径吗

**不是。** `path` 是 **Secret 卷内的相对文件名**，不是宿主机/容器根路径的物理路径。

对照 `items` 的两个字段：

| 字段 | 含义 |
| --- | --- |
| `key` | Secret 对象里某个数据项的键（`data:` 下的字段名） |
| `path` | 该数据项被「投影」到 Secret 卷里的**相对文件名**，相对 `volumeMounts.mountPath` |

所以最终文件位置 = `mountPath + path` = `/app/secrets` + `wechat-pay-private-key.pem`。

关键约束：

- `path` **不能**是绝对路径、不能包含 `..`、不能跨越子目录，只能是简单文件名（或单层子目录）。Kubernetes 会校验并拒绝非法 `path`。
- `deployment.yaml` 里 `env` 的 value 必须与 `mountPath + path` 对齐，否则应用读不到文件。

## 五、为什么要写 `items`

`items` 用来**筛选**「Secret 中哪些键要投影成文件」。同一个 Secret 通常还混着其他键（如 `WECHAT_PAY_API_V3_KEY`、`MINIO_*` 等），它们走 `envFrom.secretRef` 注入环境变量。

- **写了 `items`**：只有列出的键被挂载成文件，其余键不受影响。
- **不写 `items`**：Secret 里**所有键**都会被挂载成文件，目录下会多出一堆无用的文件。

## 六、常见误区

### 误区一：PEM 可以塞进 ConfigMap

**不行。** PEM 私钥是最高敏感级密钥，ConfigMap 是明文存储，放进 ConfigMap 等于明文落库到 etcd，还会出现在 `kubectl describe`、审计日志、备份里。敏感凭证必须放 `Secret`。

### 误区二：路径值也必须放 Secret

**不必。** 路径本身（`/app/secrets/xxx.pem`）是**非敏感信息**，完全可以放 ConfigMap 作为普通环境变量；真正需要进 Secret 的是 PEM **内容**。

### 误区三：`path` 是宿主机路径

见第四节——它是卷内相对文件名，不是物理路径。

### 误区四：PEM 应该跳过文件挂载，直接作为环境变量注入

**不推荐。** 对 PEM 私钥/证书这类长文本密钥来说，`envFrom.secretRef` 直接注入是明确的反模式，原因如下：

1. **环境变量有大小限制**：PEM 内容往往几十 KB。Linux 上单个进程的环境变量 + 参数总和受 `execve` 栈限制（通常约 2MB，实际可用更少），容器运行时、JVM 启动脚本还可能再叠一层。虽然一般不会超，但「把几十 KB 塞进一个环境变量」本身就不优雅。
2. **泄漏面更大**：环境变量更容易被无意泄漏——`docker inspect` / `kubectl describe pod` 会打印 env，崩溃转储、`/proc/<pid>/environ`（同用户可读）、`ps e` 都可能暴露。文件方式则可用 `readOnly`、`fsGroup`、容器 `runAsNonRoot` 控制访问，边界更清晰。
3. **违反「凭证以文件形式管理」的生态惯例**：微信支付、各大支付/云平台官方 SDK 几乎都是「加载 PEM 文件路径」的接口。改成环境变量，等于要自己另写一套「从字符串解析 PEM」的逻辑，与生态习惯背道而驰。
4. **注入后不可变**：环境变量在 Pod 启动时就固化，改 Secret 必须重启 Pod；文件挂载在机制上支持随变更同步。

## 七、选型：环境变量 vs 卷挂载

| 密钥类型 | 推荐方式 |
| --- | --- |
| 数据库密码、Redis 密码 | 环境变量（`envFrom.secretRef`） |
| API Key、Access Token、API v3 密钥 | 环境变量 |
| **PEM 私钥 / 公钥 / TLS 证书** | **卷挂载成文件** |
| 大段配置文件 | 卷挂载成文件 |

```text
小段密钥（密码/Token）   →  环境变量
PEM 证书 / 私钥（长文本）  →  卷挂载成文件 + env 存路径
```

> **选型原则**：小配置走环境变量，证书 / 大文件走卷挂载。原因：环境变量存几十 KB 的 PEM 既不优雅，也可能触及环境变量大小限制；文件挂载还支持热更新（ConfigMap 挂载的文件会随变更自动同步）。

## 总结归纳

| 问题 | 结论 |
| --- | --- |
| PEM 内容放哪 | Secret 对象（etcd），宿主机无物理 `.pem` 文件 |
| 容器内文件位置 | `volumeMounts.mountPath` + `items[].path` |
| `items[].path` 是什么 | 卷内相对文件名，非物理路径 |
| 应用如何定位文件 | 环境变量存路径 → Spring 属性 → 业务代码按路径读取 |
| `items` 的作用 | 筛选「哪些键投影成文件」，避免挂载多余文件 |
| PEM 能否放 ConfigMap | 不能，敏感凭证必须放 Secret |
| 路径值能否放 ConfigMap | 能，路径是非敏感信息 |
| PEM 能否直接注入环境变量 | 不推荐，长文本密钥应卷挂载成文件 |
