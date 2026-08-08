---
title: 面板 - Grafana
icon: mdi:chart-box-outline
sort: 3
---

# 面板 - Grafana

Grafana 是统一的可视化与告警平台，支持 Prometheus、Loki、Tempo 等多数据源。

## 数据源配置

`grafana/provisioning/datasources/datasource.yml`：

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100

  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
```

## Docker Compose 配置

```yaml
services:
  grafana:
    image: grafana/grafana:13.1.0-25469333600
    container_name: grafana
    restart: unless-stopped
    ports:
      - "9000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin123
      - GF_SERVER_ROOT_URL=http://localhost:9000
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    networks:
      - observability

volumes:
  grafana_data:

networks:
  observability:
    driver: bridge
```

## 常用 Dashboard 变量

在 Dashboard 设置中使用变量实现动态过滤：

```promql
# 查询所有 job
label_values(job)

# 查询所有实例
label_values(node_exporter_build_info, instance)

# 查询所有 CPU 模式
label_values(node_cpu_seconds_total, mode)
```

## 告警通道

Grafana 支持多种告警通知通道：

| 通道 | 适用场景 |
|---|---|
| **Email** | 常规告警，需配置 SMTP |
| **Webhook** | 对接企业微信、钉钉、飞书等 |
| **Discord / Slack** | 团队协作平台 |
| **Telegram** | 个人通知 |

### Webhook 对接企业微信

```ini
# grafana.ini
[alerting]
enabled = true

[unified_alerting.contact_points]
# 在 Grafana UI 中配置 Contact Point：
# Alerting → Contact points → New contact point
# Type: Webhook
# URL: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
```

## 常用操作

### 导出/导入 Dashboard

```sh
# 导出 Dashboard JSON
# Grafana UI → Dashboard Settings → JSON Model → 复制

# 通过 API 导出
curl -H "Authorization: Bearer <api_key>" \
  http://localhost:9000/api/dashboards/uid/<dashboard_uid>

# 通过 provisioning 自动导入
# 将 JSON 放入 grafana/provisioning/dashboards/ 目录
```

### 备份与恢复

```sh
# 备份 Grafana 数据
docker exec grafana tar -czf /tmp/grafana-backup.tar.gz /var/lib/grafana
docker cp grafana:/tmp/grafana-backup.tar.gz ./grafana-backup.tar.gz

# 恢复
docker cp ./grafana-backup.tar.gz grafana:/tmp/
docker exec grafana tar -xzf /tmp/grafana-backup.tar.gz -C /
```
