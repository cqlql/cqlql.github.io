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

## 分布式应用的开发编排

### Aspire

开发阶段的服务编排 + 云原生开发体验

相当于java世界的 Docker Compose + OpenTelemetry + Service Discovery
