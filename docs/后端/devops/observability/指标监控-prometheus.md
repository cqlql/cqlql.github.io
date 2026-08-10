---
title: 指标监控 - Prometheus
icon: mdi:chart-line
sort: 2
---

# 指标监控 - Prometheus

Prometheus 是云原生时代的指标监控标准，采用**拉取（Pull）模式**从目标采集指标数据。

## 组件职责

| 组件 | 职责 |
|---|---|
| `node-exporter` | 暴露宿主机指标（CPU、内存、磁盘、网络等） |
| `Prometheus` | 采集、存储指标数据，提供 PromQL 查询 |
| `Grafana` | 可视化面板与告警 |

## Prometheus 配置

`prometheus.yml`：

```yaml
global:
  scrape_interval: 15s # 抓取间隔

scrape_configs:
  - job_name: 'node-exporter' # 采集宿主机指标
    static_configs:
      - targets: ['172.16.0.222:9002']

  - job_name: "prometheus" # 监控自身
    static_configs:
      - targets: ["prometheus:9090"]
```

## PromQL 常用查询

```sql
# CPU 使用率（5 分钟平均）
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# 内存使用率
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# 磁盘使用率
(1 - (node_filesystem_avail_bytes{fstype!~"tmpfs|fuse.*"} / node_filesystem_size_bytes{fstype!~"tmpfs|fuse.*"})) * 100

# 网络流量（入站）
rate(node_network_receive_bytes_total[5m])

# 磁盘 IO 利用率
rate(node_disk_io_time_seconds_total[5m])
```

## 告警规则示例

`alert.rules.yml`：

```yaml
groups:
  - name: node-alerts
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CPU 使用率超过 80%"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "内存使用率超过 90%"

      - alert: DiskSpaceLow
        expr: (1 - (node_filesystem_avail_bytes{fstype!~"tmpfs|fuse.*"} / node_filesystem_size_bytes{fstype!~"tmpfs|fuse.*"})) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "磁盘使用率超过 85%"
```

## Docker Compose 部署

```yaml
services:
  prometheus:
    image: prom/prometheus:v3.11.3
    container_name: prometheus
    volumes:
      - prometheus_data:/prometheus
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./prometheus/alert.rules.yml:/etc/prometheus/alert.rules.yml
    command:
      - '--storage.tsdb.retention.time=30d'
      - '--config.file=/etc/prometheus/prometheus.yml'
    ports:
      - "9003:9090"
    networks:
      - observability

  node-exporter:
    image: prom/node-exporter:v1
    container_name: node-exporter
    restart: unless-stopped
    network_mode: host
    pid: host
    volumes:
      - /:/host:ro,rslave
    command:
      - '--path.rootfs=/host'
      - '--web.listen-address=:9002'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc|var/lib/docker/.+)($|/)'
      - '--collector.filesystem.fs-types-exclude=^(autofs|binfmt_misc|bpf|cgroup2?|configfs|debugfs|devpts|devtmpfs|fusectl|hugetlbfs|mqueue|nsfs|overlay|proc|procfs|pstore|rpc_pipefs|securityfs|selinuxfs|squashfs|sysfs|tracefs|tmpfs)$'

volumes:
  prometheus_data:

networks:
  observability:
    driver: bridge
```

## Grafana Dashboard 推荐

| Dashboard ID | 名称 | 说明 |
|---|---|---|
| **1860** | Node Exporter Full | 最经典的英文版面板 |
| **8919** | Node Exporter En/Cn | 支持中英文切换，视觉效果更好 |
| **11074** | Node Exporter for Prometheus Dashboard | 新版面板 |

导入方式：Grafana → Dashboards → Import → 输入 ID → Load。
