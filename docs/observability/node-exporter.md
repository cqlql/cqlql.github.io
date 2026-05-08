# 宿主机监控

需要配合使用： node-exporter + Prometheus + grafana

- `node-exporter` 负责暴露宿主机磁盘指标
- `Prometheus` 负责采集
- `Grafana` 负责展示与告警



prometheus 配置：prometheus.yml

```yaml
global:
  scrape_interval: 15s # 抓取间隔

scrape_configs:
  - job_name: 'node-exporter' # 采集宿主机
    static_configs:
      - targets: ['172.16.0.222:9002']
  - job_name: "prometheus" # 监控自身
    static_configs:
      - targets: ["prometheus:9090"]

```

grafana 配置：observability\grafana\provisioning\datasources\datasource.yml

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

docker-compose.yml

```yaml
services:
  prometheus:
    image: prom/prometheus:v3.11.3
    container_name: prometheus
    volumes:
      - prometheus_data:/prometheus
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml   
    command:
      - '--storage.tsdb.retention.time=30d'
    ports:
      - "9003:9090"
    networks:
      - observability
  grafana:
    image: grafana/grafana:13.1.0-25469333600
    container_name: grafana
    restart: unless-stopped
    ports:
      - "9000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin123
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - prometheus
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
  grafana_data:

networks:
  observability:
    driver: bridge

```



## 导入 Grafana Dashboard ID 

**1860** (Node Exporter Full)：最经典的英文版面板。

**8919** (Node Exporter for Prometheus Dashboard En/Cn)：支持中英文切换，视觉效果好。