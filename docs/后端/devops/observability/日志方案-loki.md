---
title: 日志方案 - Loki
icon: mdi:text-box-search-outline
sort: 4
---

# 日志方案 - Loki

Grafana Loki 是云原生日志聚合系统，采用**仅索引标签**的策略，相比 ELK 更轻量高效。

## 方案对比

### 推荐方案（云原生）

**Grafana + Loki + Promtail**

- 轻量、低成本、与 Prometheus / Grafana 无缝集成
- 使用 LogQL 查询语法，类 PromQL 风格

### 传统方案

**ELK（Elasticsearch + Logstash + Kibana）**

- 重、资源消耗大、运维复杂
- 适用于已有 ES 基础设施的场景

## 数据流

```
Spring Boot stdout
        ↓
Docker json-file driver
        ↓
/var/lib/docker/containers/*/*.log
        ↓
Promtail 采集（tail + 标签注入）
        ↓
Loki 存储（仅索引标签，日志正文按时间分块）
        ↓
Grafana 查询与展示
```

## LogQL 常用查询

LogQL 的查询语法与 PromQL 风格一致：

### 基础查询

```logql
# 按容器筛选日志
{container="my-app"}

# 模糊匹配（行过滤）
{container="my-app"} |= "error"

# 不包含某关键词
{container="my-app"} != "debug"

# 正则匹配
{container="my-app"} |~ "(?i)err.*"

# 不匹配正则
{container="my-app"} !~ "(?i)debug.*"
```

### JSON 日志解析

```logql
# 解析 JSON 并过滤字段
{container="my-app"} | json | level = "error"

# 模糊匹配 + JSON 解析
{container="my-app"} |= "timeout" | json | level = "error"

# 按日志级别聚合统计
sum by(level) (count_over_time({container="my-app"} | json | level != "" [5m]))
```

### 高级查询

```logql
# 统计错误日志速率
rate({container="my-app"} | json | level = "error" [5m])

# 按状态码统计
sum by(status) (
  count_over_time({container="my-app"} | json | status =~ "[45].." [5m])
)

# 慢请求分析
{container="my-app"} | json | duration > 3s
```

## Promtail 配置

`promtail-config.yml`：

```yaml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker

    docker_sd_configs:
      - host: unix:///var/run/docker.sock

    relabel_configs:
      # 容器名
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'

      # compose image
      - source_labels: ['__meta_docker_container_label_com_docker_compose_image']
        target_label: 'image'

      # 日志路径
      - source_labels: ['__meta_docker_container_id']
        target_label: '__path__'
        replacement: '/var/lib/docker/containers/$1/*-json.log'

    pipeline_stages:
      - json:
          expressions:
            level: log.level
            ts: '"@timestamp"'
      - timestamp:
          source: ts
          format: RFC3339Nano
      - labels:
          level:
```

## Loki 配置

`loki-config.yml`：

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
  chunk_idle_period: 30m
  max_chunk_age: 1h
  chunk_target_size: 1536000

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

storage_config:
  tsdb_shipper:
    active_index_directory: /loki/tsdb-index
    cache_location: /loki/tsdb-cache
  filesystem:
    directory: /loki/chunks

limits_config:
  retention_period: 30d
  max_entries_limit_per_query: 5000
```

## Docker Compose 补充

```yaml
services:
  loki:
    image: grafana/loki:latest
    container_name: loki
    volumes:
      - loki_data:/loki
      - ./loki/loki-config.yml:/etc/loki/local-config.yaml
    command: -config.file=/etc/loki/local-config.yaml
    ports:
      - "3100:3100"
    networks:
      - observability

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    volumes:
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock
      - ./promtail/promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
    networks:
      - observability

volumes:
  loki_data:

networks:
  observability:
    driver: bridge
```

## LogQL 调试技巧

```logql
# 查看某标签所有可能的值
{container="my-app"} | json | unwrap level

# 查看某时间范围内日志数量趋势
count_over_time({container="my-app"}[5m])

# 限制返回行数
{container="my-app"} |= "error" | line_format "{{.timestamp}} {{.message}}" | limit 10
```
