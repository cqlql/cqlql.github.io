---
title: 常用工具
icon: mdi:tools
sort: 99
---

# 常用工具

## 容器与集群管理

### Portainer
- Docker / Swarm / K8s 的 Web UI 管理工具
- 功能：管理容器、镜像、网络、Volume、Stack
- 适合小团队和本地运维
- 优点：上手快、界面直观
- 注意：大规模 K8s 或复杂集群功能有限

### Rancher
- Kubernetes 集群管理平台
- 功能：集群创建、管理、访问控制、多集群监控
- 优点：适合生产环境和大型团队
- 注意：部署成本比 Portainer 高

### Harbor 

目前最受欢迎的企业级开源仓库，由 VMware 开源并捐赠给 CNCF。

- **优点：** 提供易用的中文 UI、基于角色的权限控制 (RBAC)、镜像复制（跨机房同步）、漏洞扫描（集成 Trivy）以及操作审计。

## 监控与可视化

### Grafana
- 开源数据可视化与仪表盘工具
- 功能：连接 Prometheus、InfluxDB、MySQL 等数据源，制作图表和报警
- 优点：灵活、插件丰富
- 使用场景：实时监控、性能分析、业务指标展示

### Prometheus
- 开源指标采集与告警系统
- 功能：收集系统/应用指标，支持时间序列数据
- 与 Grafana 配合使用效果最佳
- 优点：强大的查询语言（PromQL）、生态丰富
- 使用场景：监控 Docker / K8s / 系统性能

### Node Exporter

服务器运行状况监控，比如cpu、内存、硬盘、网络、进程数等，主要用在宿主机监控。

如果要监控每个容器。使用**cAdvisor**

### cAdvisor

每个容器容器状况

### Grafana Tempo

分布式追踪（Tracing）后端系统，核心定位是：**用极低成本存储海量 Trace 数据，并与日志、指标打通**。

什么时候**必须上 Tempo**？

- 微服务越来越多
- 接口偶尔慢但日志看不出来
- 链路复杂（RPC / MQ / DB）
- 想定位“哪一步慢”

整体架构：

```
应用（OpenTelemetry SDK）
        ↓
   Tempo Distributor
        ↓
     Ingester
        ↓
 Object Storage（S3 / MinIO）
        ↓
     Querier
        ↓
     Grafana UI
```

### 标准云原生方案

三件套：

    Metrics → Prometheus
    
    Logs → Loki
    
    Tracing → Tempo

场景

1️⃣ 在 Grafana 看慢请求（Prometheus）
 2️⃣ 点击 → 跳到 trace（Tempo）
 3️⃣ 再点击 → 查看日志（Loki）

👉 完整链路：

```
Metrics → Trace → Logs
```

这就是所谓： **Correlation（关联分析）**

## 分布式应用的开发编排

### Aspire

开发阶段的服务编排 + 云原生开发体验

相当于java世界的 Docker Compose + OpenTelemetry + Service Discovery

## 日志系统

### 方案一（推荐）

**中小团队 / 成本敏感**

```
Prometheus  +  Loki  +  Grafana
```

特点：

- 简单
- 成本低
- 一体化体验

------

### 方案二（进阶）

**需要日志分析能力**

```
Loki（运行日志）
+
Elasticsearch（审计 / 分析）
```

| 场景       | 最优          |
| ---------- | ------------- |
| 查错误日志 | Loki          |
| 查用户行为 | Elasticsearch |
| 两个都用   | 👍 混合        |

------

### 方案三（传统）

```
ELK（Elasticsearch + Logstash + Kibana）
```

问题：

- 重
- 运维复杂
- 成本高

结论：
 👉 如果你日志量大（>100GB/day），ELK 会很痛苦

### 架构选择判断口诀

🔹 “要查日志内容 → ES”
 🔹 “要看运行情况 → Loki”
 🔹 “要省钱 → Loki”
 🔹 “要分析数据 → ES”

## 构建 / 任务工具

> 本质都是「任务运行器」：把一堆常用命令收敛成简短的入口（`make build`、`just deploy`），避免记忆和重复敲长命令。常用于本地开发和 CI。

### Make
- 最经典的构建 / 任务工具，几乎所有 Linux 环境自带
- 通过 `Makefile` 定义 target（目标）和依赖关系
- 优点：无处不在、生态成熟、适合 C/C++ 等编译型项目的依赖构建
- 缺点：语法古怪（Tab 缩进敏感、变量与转义规则复杂），当纯任务运行器用时体验一般

```makefile
build:
	go build -o app .

run: build
	./app
```

### Just
- 现代的命令运行器（command runner），定位就是「更好用的 Make」
- 项目地址：<https://github.com/casey/just>
- 通过 `justfile` 定义 recipe（配方），语法简洁、无 Tab 陷阱
- 优点：语法直观、支持参数 / 默认值 / 跨平台、报错友好
- 缺点：需要额外安装，不像 make 那样默认存在
- 安装：`cargo install just` / `brew install just` / `scoop install just`

```just
build:
    go build -o app .

run: build
    ./app

# 带参数的 recipe
deploy env="dev":
    echo "deploy to {{env}}"
```

### 如何选择
- 只是想「收敛命令、别记那么多长指令」→ 用 **just**，更省心
- 项目有真正的编译依赖构建（如 C/C++），或要求零依赖、开箱即用 → 用 **make**
