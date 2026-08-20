---
title: Kustomize 介绍
icon: mdi:layers-triple-outline
sort: 8
---

> Kustomize 是 Kubernetes 官方的**配置管理工具**，核心思想是「**声明式 + 无模板**」地复用、定制和组合 K8s 资源清单（YAML）。本文介绍其理念、核心概念、与 Helm 的对比及常用命令。

## 一、它是什么

- 由 Google 开发，后捐给 CNCF，自 Kubernetes 1.14 起**直接内置于 `kubectl`**（`kubectl apply -k` / `kubectl kustomize`）。
- **不引入模板语法**（区别于 Helm），而是用「**叠加（overlay）**」的方式，在**原 YAML 基础上做增量修改**，不修改原始 YAML（Base）。

> 一句话：Helm 是「模板渲染」，Kustomize 是「补丁叠加」。

### 核心优势

- **无模板化**：无需学习 Go Template 或处理 `{{ .Values.xxx }}` 占位符，所有配置均为标准合法 YAML。
- **非侵入式**：原始 Base 保持干净统一，不同环境通过各自 Overlay 增量修改，实现高效复用。
- **原生支持**：集成于 `kubectl`，无需额外安装第三方 CLI。
- **精细化补丁**：支持 Strategic Merge Patch 与 JSON 6902 Patch，可精准修改 YAML 树中任意字段。

## 二、核心理念：base + overlay

经典用法是 **基础（base）+ 覆盖（overlay）** 分层：

```text
k8s/
├── base/                 # 基础清单：所有环境共用
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml   # 声明「我包含哪些资源」
└── overlays/
    ├── dev/              # 开发环境覆盖
    │   └── kustomization.yaml
    └── prod/             # 生产环境覆盖
        └── kustomization.yaml
```

- **base**：写一份通用配置，可被任意环境复用。
- **overlay**：引用 base，只声明「与 base 的差异」（改副本数、换镜像 tag、加环境变量等），不重复写整份清单。

这正是 `pass-up.backend` 项目 `k8s/` 目录的用法（`base/` + `overlays/prod`），详见 👉 [PassUp 后端 K8s 部署清单](./k3s/PassUp后端部署清单.md)。

## 三、核心概念

### 1. kustomization.yaml（入口文件）

每个目录下的 `kustomization.yaml` 是入口，声明要管理的资源与变换规则：

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: passup            # 统一注入命名空间

resources:                   # 引入的资源文件
  - namespace.yaml
  - deployment.yaml
  - service.yaml

images:                      # 替换镜像 tag
  - name: 172.16.0.222:5000/passup/backend-java
    newTag: latest

commonLabels:                # 给所有资源打公共标签
  app.kubernetes.io/part-of: passup
```

### 2. 常用变换（Transformer）

| 字段 | 作用 | 示例 |
| --- | --- | --- |
| `resources` | 引入资源文件/目录/远程 URL | `- ../../base` |
| `namespace` | 统一设置/覆盖命名空间 | `namespace: passup` |
| `images` | 替换镜像名与 tag | `newTag: latest` |
| `replicas` | 直接改副本数 | `count: 3` |
| `commonLabels` | 给所有资源加公共标签 | `app.kubernetes.io/part-of` |
| `namePrefix` / `nameSuffix` | 资源名前缀/后缀 | 区分环境 |
| `patches` / `patchesStrategicMerge` | 精确修改资源某个字段 | 改 env、probe |
| `configMapGenerator` / `secretGenerator` | 从文件/字面量生成 ConfigMap/Secret | 自动加 hash 后缀 |

### 3. 补丁（Patches）

用于**精确修改**资源里的一小块内容，而不是整个文件重写：

```yaml
# overlays/prod/kustomization.yaml
resources:
  - ../../base
replicas:
  - name: passup-backend
    count: 3        # 只改副本数，其余沿用 base
```

补丁支持两种标准格式：

- **Strategic Merge Patch（策略合并补丁）**：K8s 原生、按字段语义智能合并（如列表按 `name` 键合并），写法直观，是 `patchesStrategicMerge` 的默认方式。
- **JSON 6902 Patch（JSON Patch）**：RFC 6902 标准，通过 `op`（add/remove/replace 等）+ `path` 精确定位任意字段，适合结构复杂的精确修改。

### 4. 生成器（Generator）

`configMapGenerator` / `secretGenerator` 从字面量或文件生成 ConfigMap/Secret，且会自动追加内容 hash 后缀，实现「内容变了就触发 Pod 滚动更新」：

```yaml
configMapGenerator:
  - name: app-config
    behavior: merge        # merge / replace / create
    literals:
      - MINIO_PUBLIC_ENDPOINT=https://prod.example.com
```

## 四、配置管理的完整光谱

Kubernetes 的配置管理方案并非只有 Kustomize / Helm 二选一，而是一个从简到繁的光谱：

### 1. 原生静态 YAML（默认方式）

最原生、默认的方式：直接编写 `deployment.yaml`、`service.yaml` 等，用 `kubectl apply -f <file/dir>` 手动或经 CI/CD 部署。

- 特点：最基础、无抽象层，但面对 Dev/Stage/Prod 多环境时容易产生大量冗余 Boilerplate。
- 自 K8s 1.14 起，`kubectl apply -k` 内置的 Kustomize 已成为官方支持的默认命令行扩展。

### 2. Kustomize / Helm（主流方式）

生产环境最主流的交付模式是 **「Helm / Kustomize + GitOps」** 组合拳：

- **第三方基础组件**：首选 **Helm**（官方 Chart 仓库生态丰富，装 Prometheus、Ingress Controller、Redis 等基本一键完成）。
- **自研应用多环境管理**：首选 **Kustomize**（一套 Base + 各环境 Overlay，实现 DRY）。
- **自动化持续交付（CD）**：配合 **Argo CD / Flux CD**，将 YAML/Helm/Kustomize 托管在 Git，由 GitOps 控制器自动监测 Git 变更并同步到集群。

### 3. 高级配置语言 / DSL 与 IaC

| 方案 | 说明 |
| --- | --- |
| **Jsonnet / Grafana Tanka** | JSON 超集语言，支持变量、继承、函数、条件，可编程性强，适合超大规模复杂编排 |
| **CUE** | 强类型声明式配置语言，具备严格数据校验，可防止非法 YAML 提交到集群 |
| **Terraform / OpenTofu** | HCL 语言，既能管 K8s 内部资源，也能创建云厂商底层基础设施（EKS/GKE、RDS） |
| **Pulumi** | 直接用通用编程语言（Python/TS/Go）编写 K8s 声明式配置 |

### 4. 高阶应用交付框架

- **KubeVela**：基于 OAM（开放应用模型），把底层 Deployment/Service 抽象为面向开发者的 Application CRD。
- **Crossplane**：把 K8s API 扩展到集群外，像定义 Pod 一样用 YAML 定义云厂商的数据库、网络等基础设施。

## 五、与 Helm 对比

| 维度 | Kustomize | Helm |
| --- | --- | --- |
| 定位 | 多环境配置差异叠加工具 | K8s 应用包管理器（类似 apt/yum） |
| 核心机制 | 声明式 YAML 叠加（Overlay + Patch） | 模板替换与参数渲染（Go Template） |
| 语法 | 纯 YAML（声明式） | Go 模板（`{{ }}`） |
| 依赖 | 内置于 `kubectl`（可单独下载 CLI） | 需独立安装 `helm` 客户端 + 仓库/Chart |
| 学习成本 | 低（熟悉标准 YAML 即可） | 中（需掌握 Chart 结构与模板语法） |
| 复用方式 | base + overlay | Chart + values.yaml |
| 版本/回滚 | 无内置（依赖 Git） | 有 Chart 版本管理 |
| 适用 | 自研应用多环境配置管理 | 复杂第三方开源软件打包、发布、版本回滚 |

> 简化记忆：**Kustomize 更贴近原生 YAML、更简单；Helm 功能更强（模板、发布管理、生态），但更重。**

## 六、常用命令

```bash
# 本地预览合并后的完整 YAML（不实际部署）
kubectl kustomize k8s/base
# 或使用独立 CLI
kustomize build k8s/base

# 部署
kubectl apply -k k8s/base
kubectl apply -k k8s/overlays/prod

# 删除
kubectl delete -k k8s/base
```

## 七、Kustomize 与 K3s 的关系

二者是**完全不同维度**的产物：

- **Kubernetes / K3s**：底层「操作系统/运行平台」——K3s 是由 Rancher 开源（现归 CNCF）的**轻量级 Kubernetes 发行版**。
- **Kustomize / Helm**：在平台上「安装应用/管理配置」的工具。

虽然维度不同，但 K3s 原生集成了对 YAML、Kustomize、Helm 的自动化支持（见 👉 [K3s 介绍与安装](./k3s/介绍与安装.md)）：

- **内置 Auto-Deploy 机制**：默认监听目录 `/var/lib/rancher/k3s/server/manifests/`，把 YAML 或含 `kustomization.yaml` 的目录丢进去，K3s 会自动 `kubectl apply`。
- **内置 Helm Controller**：默认集成，可编写自定义 `HelmChart` CRD 放进 manifests 目录，K3s 自动下载 Chart 并安装。

## 八、小结

- Kustomize 的卖点是**简单、无模板、纯声明式**，用「base + overlay + 变换」复用配置。
- 已内置 `kubectl`，`kubectl apply -k` 即可用，无额外依赖。
- 适合**自研应用多环境配置管理**；复杂第三方软件打包发布用 Helm；两者常配合 GitOps（Argo CD / Flux CD）落地。
