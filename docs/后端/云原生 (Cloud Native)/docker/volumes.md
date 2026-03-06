相比于 bing mount，volumes 通常是持久化数据的首选机制，更好的性能、可移植性和管理能力



复制文件到 volume

```bash
docker cp ./some_file CONTAINER:/work
```



Docker Compose 中使用

```yaml
volumes:
  myapp:
    ## 强制使用存在的 volume，如果目标不存在将报错。
    ## 如果不使用此选项，不存在则创建，存在也会复用。
    ## 主要好处是：跨项目共享、volume 的生命周期是在别处管理的、明确的依赖关系、避免意外修改。
    ## 好处总结：提供了更严格的控制和更明确的意图表达。它在需要精确控制 volume 生命周期、确保关键数据安全性，以及在复杂的多项目环境中特别有用。
    # external: true 
services:
  node:
    image: "node:22"
    container_name: node
    restart: always
    working_dir: /home/node/app
    volumes:
      - myapp:/home/node/app
    # 否则立即终止
    tty: true
```

## 备份

```bash
docker run --rm -v elasticsearch:/app/data -v ${pwd}:/backup ubuntu tar czvf /backup/elasticsearch.tar.gz -C /app/data .
```

## 恢复

```plain
docker run --rm -v elasticsearch:/app/data -v $(pwd):/backup ubuntu tar xzvf /backup/elasticsearch.tar.gz -C /app/data
```