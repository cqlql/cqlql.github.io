---
title: Kubernetes imagePullSecrets 详解
icon: mdi:docker
sort: 8
---

> 本文梳理 `imagePullSecrets` 的定位、作用机制、作用范围与常见误区，结合 `pass-up.backend` 的 `k8s/base/deployment.yaml` 实例讲解「为什么仓库里找不到 Secret 的定义文件」。

## 一、它是什么

`imagePullSecrets` 是 Pod 模板（`spec.template.spec`）层级的一个字段，用来告诉 Kubernetes：**拉取容器镜像时，用哪个 Secret 去登录私有镜像仓库**。

```yaml
spec:
  template:
    spec:
      imagePullSecrets:
        - name: passup-registry-secret
      containers:
        - name: backend
          image: 172.16.0.222:5000/passup/backend-java:latest
          imagePullPolicy: Always
```

- `imagePullSecrets`：声明「拉镜像时带上这个认证凭据」。
- `name` 列表：可写多个，按顺序尝试这些 Secret 去认证。
- `passup-registry-secret`：一个 `Secret` 资源名，内容通常是 `.dockerconfigjson`（仓库地址 + 用户名 + 密码/Token）。

## 二、它解决什么问题

如果镜像存放在**私有仓库**（Harbor、阿里云、自建 Docker Registry 等），节点上的容器运行时默认没有权限拉取，Pod 会卡在：

- `ImagePullBackOff` / `ErrImagePull`（拉取失败）

挂上 `imagePullSecrets` 后，拉取时自动带上凭证，问题解决。

## 三、关键机制

### 1. 作用范围是「Pod 级」，不是「镜像级」

`imagePullSecrets` 定义在 Pod 模板层级，因此它作用于**这个 Deployment 创建出来的所有 Pod 里的所有容器**（含 `initContainers` 和 `containers`），而不是只针对某一个 `containers[].image`。

### 2. 按仓库主机名自动匹配

K8s 会根据镜像地址的 **registry 主机名**，去 Secret 里的 `.dockerconfigjson` 找对应的认证条目：

- 镜像 `172.16.0.222:5000/...` → 自动匹配到 Secret 里 `172.16.0.222:5000` 的账号密码。
- 镜像 `nginx:latest`（Docker Hub）→ Secret 里没有对应条目，**不会误用**，走默认匿名拉取。

### 3. 只补认证，不改镜像

它只解决「有没有权限拉取」，与镜像路径、tag 完全无关。

## 四、它不负责什么

- 不负责容器**内部**应用的任何认证逻辑（那是业务代码的事）。
- 只作用于 `imagePullSecrets` 所在的那个 Pod 模板，对同 namespace 下**其他** Deployment 无效（不会自动继承）。

## 五、常见误区

### 误区一：定义了 imagePullSecrets 就等于有了 Secret

`imagePullSecrets` 只是「声明我要用这个名字的 Secret」，**Secret 本身必须真实存在于集群里**。如果没创建，Pod 拉取依然会失败。

> 这也是「为什么在源码仓库里找不到 Secret 定义文件」的原因：它通常靠 `kubectl create secret` 命令**运行时现建**，而不是源码文件。真实凭证不应提交进 Git。

### 误区二：不需要认证就必须删掉 imagePullSecrets

**不是必须删**。分情况：

| 情况 | 结论 |
| --- | --- |
| 仓库需要认证 | 不能删，且必须先创建 Secret |
| 仓库免密，且 Secret 存在 | 删不删都能跑，删了更干净 |
| 仓库免密，但 Secret 不存在 | 能跑，但配置引用了不存在的 Secret，建议删 |

如果仓库免密，K8s 尝试认证时没有匹配凭据就按匿名拉取，**不会因为带了凭据就报错**。但引用一个不存在的 Secret 语义不干净，容易误导他人，通常建议删掉。

### 误区三：imagePullSecrets 会全局生效

它只在**当前 Pod 模板**生效。同一个 namespace 下多个 Deployment 需要各自声明，没有全局配置。

## 六、实践：私有仓库的完整配置

### 1. 创建 Secret（运行时现建，不写进 Git）

```bash
kubectl create secret docker-registry passup-registry-secret \
  --namespace passup \
  --docker-server=172.16.0.222:5000 \
  --docker-username=<用户名> \
  --docker-password=<密码>
```

- `kubectl create secret docker-registry` 创建的是标准的 `kubernetes.io/dockerconfigjson` 类型。
- 建议配合 `imagePullPolicy: Always`（每次调度都重拉），此时 Secret 更不可或缺——一旦缺失或凭证失效，Pod 直接拉取失败，而非复用本地缓存。

### 2. 在 Deployment 中引用

```yaml
spec:
  template:
    spec:
      imagePullSecrets:
        - name: passup-registry-secret
      containers:
        - name: backend
          image: 172.16.0.222:5000/passup/backend-java:latest
```

### 3. 验证 Secret 是否存在

```bash
kubectl get secret passup-registry-secret -n passup
```

- 返回条目 → 已创建，可正常引用。
- 报 `NotFound` → 未创建，需先执行第 1 步。

## 总结归纳

| 问题 | 结论 |
| --- | --- |
| 它是什么 | Pod 模板里声明「拉镜像时用哪个 Secret 认证」 |
| 作用范围 | 当前 Pod 内所有容器，且按仓库主机名自动匹配 |
| 是否必须删 | 否，免密仓库删不删都能跑，但删了更干净 |
| 前提条件 | 被引用的 Secret 必须真实存在于集群（通常命令现建，不入 Git） |
