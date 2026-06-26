# 日志方案

推荐方案：

Grafana + Loki + Promtail (可选 Elasticsearch)

主流、云原生场景



传统方案：

ELK（Elasticsearch + Logstash + Kibana）

不推荐，重，成本高，运维复杂



## LogQL常用查询语法

json 模糊查找

```plain
{container="my-app"} | json | level =~ ".*err.*"
```

 针对整行原始文本  

```plain
{container="my-app"} |= "模糊词" | json | level="error"
```

## Docker + Spring Boot  整体链路

Spring Boot stdout
 ↓
Docker json-file driver
 ↓
/var/lib/docker/containers/*/*.log
 ↓
Promtail 采集
 ↓
Loki 存储
 ↓
Grafana 查询

## promtail-config.yml

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

      # compose service
      # - source_labels: ['__meta_docker_container_label_com_docker_compose_service']
      #   target_label: 'service'

      # 镜像
      - source_labels: ['__meta_docker_container_label_com_docker_compose_image']
        target_label: 'image'

      # 日志路径
      - source_labels: ['__meta_docker_container_id']
        target_label: '__path__'
        replacement: '/var/lib/docker/containers/$1/*-json.log'

    pipeline_stages:
      # json 情况，这步可以省略，否则 ecs 情况某些字段可能抓不到
      # - docker: {}  # 第一步：先解开 Docker 的外壳（提取出真正的日志文本）

      - json:       # 第二步：解析你业务日志中的 JSON 字段
          expressions:
            level: log.level
            ts: '"@timestamp"' # 记得在这里也提取一下时间戳字段，供下一步使用
      - timestamp:  # 第三步：将业务日志里的时间设置为 Loki 中的日志时间
          source: ts
          format: RFC3339Nano
      - labels:     # 可选：如果你想让 level 变成查询标签
          level:

```

