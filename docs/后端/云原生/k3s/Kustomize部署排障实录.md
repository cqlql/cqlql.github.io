---
title: Kustomize 部署排障实录
icon: mdi:bug-check-outline
sort: 6.5
---

> 本文记录 `pass-up.backend` 项目在 k3s 环境用 `kubectl apply -k k8s/overlays/prod` 部署时，从「apiVersion 报错」到「Pod 反复重启」一路排查的完整过程与根因，可作为同类 Kustomize 部署排障的实战参考。按报错出现的先后顺序梳理，每个问题给出「现象 → 根因 → 修复 → 排查命令」。

## 一、问题一：Kustomization apiVersion 报错

### 现象

```bash
$ kubectl apply -k k8s/overlays/prod
error: Failed to read kustomization file under /home/cql/k8s/overlays/prod:
apiVersion for Kustomization should be kustomize.config.k8s.io/v1beta1
```

### 根因

`kustomization.yaml` 首行写的是：

```yaml
apiVersion: kustomize.config.k8s.io/v1
```

而 `v1` 版本的 Kustomization API 只有较新的 kustomize（v5+）才支持。服务器上的 kubectl 内置 kustomize 版本较旧，只识别 `v1beta1`。

### 修复

把 `kustomization.yaml` 的 apiVersion 从 `v1` 改为 `v1beta1`：

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
```

> 注意：涉及**所有** `kustomization.yaml`（base 和 overlay 都要改），不是只改报错的那一个。

### 经验

- `v1beta1` 与 `v1` 在 `namespace` / `resources` / `images` / `replicas` / `labels` 等常用字段上完全兼容，降级无功能损失。
- 若后续报错提示 `replicas`、`labels` 等字段不支持，说明内置 kustomize 过旧，届时需改用独立 kustomize CLI 或升级 kubectl。

## 二、问题二：Secret 的 stringData 数字值反序列化失败

### 现象

```text
Error from server (BadRequest): error when creating "k8s/overlays/prod":
Secret in version "v1" cannot be handled as a Secret:
json: cannot unmarshal number into Go struct field Secret.stringData of type string
```

### 根因

`secret.yaml` 里 `stringData` 的某些值写成了**不带引号的纯数字**，YAML 解析器会当成整数（number）类型：

```yaml
stringData:
  SPRING_DATASOURCE_PASSWORD: 123456      # 被解析成整数
  ADMIN_DEFAULT_PASSWORD: 123456          # 被解析成整数
  MINIO_SECRET_KEY: 12345678              # 被解析成整数
```

而 Kubernetes `Secret` 的 `stringData` 字段要求值必须是 **string**，反序列化时类型不匹配直接报错。

### 修复

给这些纯数字的值加上引号，强制为字符串：

```yaml
stringData:
  SPRING_DATASOURCE_PASSWORD: "123456"
  ADMIN_DEFAULT_PASSWORD: "123456"
  MINIO_SECRET_KEY: "12345678"
```

### 经验

- `stringData` 里凡是**纯数字**的密码、密钥、端口号，都要加引号，否则 YAML 会按 number 解析。
- 报错信息 `cannot unmarshal number into ... of type string` 是这类问题的典型特征，直接定位到某个字段值。
- 关联背景见 👉 [Kubernetes Secret stringData 与 data 选型](../Kubernetes%20Secret%20stringData与data选型.md)。

## 三、问题三：Pod 调度失败（内存不足 + 污点）

### 现象

```text
Warning  FailedScheduling  ...  0/2 nodes are available: 2 Insufficient memory.
Warning  FailedScheduling  ...  0/2 nodes are available: 2 node(s) had untolerated taint(s).
```

### 根因

两条独立的调度失败原因同时出现：

1. **内存不足**：每个 Pod 请求 `memory: 2Gi`，prod overlay 副本数为 2，即需要 `2 × 2Gi = 4Gi` 预留内存，节点可分配内存不够。
2. **污点（taint）**：节点打了污点（如控制平面节点的 `node-role.kubernetes.io/control-plane:NoSchedule`），Pod 没有对应的容忍（toleration）。

### 修复

1. **降低内存请求**（`deployment.yaml`）：`requests.memory` 从 `2Gi` 降到 `1Gi`，`requests.cpu` 从 `500m` 降到 `250m`。

   ```yaml
   resources:
     requests:
       cpu: "250m"
       memory: "1Gi"
     limits:
       cpu: "2"
       memory: "8Gi"
   ```

2. **降低副本数**（`overlays/prod/kustomization.yaml`）：`count` 从 2 降到 1。

   ```yaml
   replicas:
     - name: passup-backend
       count: 1
   ```

### 排查命令

```bash
# 看节点污点
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints
# 看节点可分配内存
kubectl describe nodes | grep -E "^Name:|Allocatable:|  memory"
```

### 经验

- `Insufficient memory` 与 `untolerated taint` 是两类不同的问题，要分别处理：前者调资源请求或副本数，后者补 `tolerations` 或换可调度节点。
- 污点场景下，若确认要在控制平面节点上跑，需在 Deployment 的 `spec.template.spec` 下补 `tolerations`。

## 四、问题四：删除 Pod 后自动“复活”

### 现象

```bash
$ kubectl delete -n passup pod passup-backend-b5f9fdb-dftjl
pod "passup-backend-b5f9fdb-dftjl" deleted from passup namespace
$ kubectl get pods -n passup
# 又出现一个名字不同、hash 前缀不同的新 Pod
```

### 根因

这是 Deployment 的**自我修复机制（reconcile loop）**，不是 bug：Deployment 控制器发现「实际运行 Pod 数」少于「期望副本数（replicas）」，立即重建新 Pod 补齐。

### 经验

- 想真正减少 Pod，只有两种方式：**降低 Deployment 的 `replicas`**，或**删除整个 Deployment**。单纯 `kubectl delete pod` 只会触发重建。
- Pod 名称里的 hash（如 `8cd9784b`、`b5f9fdb`、`5567bfbd9c`）是 **ReplicaSet 的标识**，hash 不同意味着来自不同的 ReplicaSet，可用于判断是否存在多个版本的 Deployment 在滚动更新。

## 五、问题五：滚动更新卡住（新旧 ReplicaSet 并存）

### 现象

```text
NAME             READY   UP-TO-DATE   AVAILABLE   AGE
passup-backend   0/2     1            0           59m
```

同时存在多个 ReplicaSet，旧 Pod `CrashLoopBackOff`、新 Pod 反复重启。

### 根因

Deployment 配置了 `maxUnavailable: 0`，滚动更新时**旧 Pod 不允许下线**，必须等新 Pod 就绪才能替换。当新 ReplicaSet 的 Pod 因「镜像拉取失败 / 调度失败 / 启动崩溃」起不来时，新旧 Pod 并存、更新卡在中间状态。

### 经验

- `maxUnavailable: 0` 是「先起后停」策略：新 Pod 未就绪前旧 Pod 一直保留，从而保证可用性，但代价是更新被卡住时会出现新旧并存。
- 排查时应先看**新 Pod 为什么起不来**（Events / 日志），而不是纠结旧 Pod。

## 六、问题六：CrashLoopBackOff（容器启动后崩溃）

### 现象

```text
passup-backend-5567bfbd9c-t9m9k   0/1   CrashLoopBackOff   5 (2m6s ago)   48m
```

`STATUS` 显示 `Running` 但 `READY 0/1`、`RESTARTS` 不断增加 —— 这是典型的**容器能启动、镜像能拉，但进程启动后马上退出/探针失败**的表现，与 `ImagePullBackOff`（镜像拉取失败）是两回事。

### 排查命令

```bash
# 看上一次崩溃的日志（崩溃信息通常在最后一次退出前）
kubectl logs -n passup <pod> --previous
# 看当前日志
kubectl logs -n passup <pod>
# 看 Events（区分是崩溃还是探针失败）
kubectl describe pod -n passup <pod> | grep -A20 Events
```

### 常见根因（Spring Boot 类应用）

1. **数据库连接失败**：连接串、host、端口、账号密码是否对得上，PostgreSQL 是否可达。
2. **Redis 连接失败**：空密码等配置与实际不一致。
3. **MinIO 连接失败**。
4. **配置项缺失**：`CHANGE_ME` 占位符未替换，必填项（JWT secret 长度、豆包 key）启动校验失败。
5. **探针路径/端口不对**：startupProbe 访问 `/actuator/health`（管理端口），actuator 未暴露或路径错误会被判定失败并重启。

### 经验

- `CrashLoopBackOff` 几乎都能从 `kubectl logs --previous` 里看到确切的异常堆栈，日志是定位的第一手段。
- `Running + RESTARTS 递增 + READY 0/1` 组合，优先怀疑「启动崩溃」而非「镜像问题」。

## 七、状态速查

| 状态 | 含义 | 排查方向 |
| :--- | :--- | :--- |
| `Pending` | 等待调度 | 资源不足 / 污点 / 卷绑定 |
| `ContainerCreating` | 正在创建容器 | 拉镜像、挂卷中，稍等或看 Events |
| `ImagePullBackOff` | 镜像拉取失败 | 镜像地址、imagePullSecret、仓库可达性 |
| `CrashLoopBackOff` | 启动后崩溃 | 看 `logs --previous` 的异常堆栈 |
| `Running` + `RESTARTS` 递增 + `READY 0/1` | 反复重启 | 启动崩溃或探针失败 |

## 八、排障通用思路

1. **按报错先后顺序逐层推进**：apiVersion → YAML 类型 → 调度 → 拉镜像 → 启动，不要跳步。
2. **`kubectl describe pod` 看 Events**：调度失败、拉镜像失败、探针失败都能在这里看到直接原因。
3. **`kubectl logs --previous` 看崩溃堆栈**：`CrashLoopBackOff` 的根因基本都在这里。
4. **`kubectl get rs` 看 ReplicaSet**：Pod 名 hash 不同 → 多个 ReplicaSet → 判断是否在滚动更新。
5. **`kubectl get deploy -o jsonpath` 精确读字段**：确认副本数、resources 等改动是否真正生效。
