---
title: Registry 镜像迁移
icon: devicon:docker
sort: 8
---

# Registry 镜像迁移

## 一、完整流程：外网镜像迁移到本地私有 Registry

### 前置条件

1. 本地私有仓库已正常启动，地址：`localhost:5000`
2. 本地 Docker 已配置私有仓库非 HTTPS 信任（关键！否则 push 会报错）
3. 网络能访问外网 Docker Hub / 阿里云镜像源 + 本地 5000 端口

### 步骤 1：配置 Docker 信任本地私有仓库（必做）

Docker 默认只允许 HTTPS 仓库，`localhost:5000` 是 HTTP，需要修改 `daemon.json`：

```bash
# 创建/编辑 Docker 配置
vim /etc/docker/daemon.json
```

写入内容：

```json
{
  "insecure-registries": ["localhost:5000"]
}
```

重启 Docker 生效：

```bash
systemctl daemon-reload
systemctl restart docker
```

### 步骤 2：迁移镜像完整流程

拉取外网 → 打本地标签 → Push 本地仓库 → 可选清理

#### 示例：把官方 nginx 迁移到本地 Registry

**1）拉取线上镜像**

```bash
docker pull nginx:1.25
```

**2）重新打标签，格式：`本地仓库地址/镜像名:版本`**

规则：`localhost:5000/原镜像名:tag`

```bash
docker tag nginx:1.25 localhost:5000/nginx:1.25
```

**3）推送到本地私有仓库**

```bash
docker push localhost:5000/nginx:1.25
```

**4）验证是否上传成功**

访问仓库接口查看镜像列表：

```bash
curl http://localhost:5000/v2/_catalog

# 查看该镜像的所有 tag
curl http://localhost:5000/v2/nginx/tags/list
```

## 二、批量迁移脚本

如果有一堆镜像需要迁移，可以写简单 Shell 批量处理：

```bash
#!/bin/bash
# 需要迁移的镜像列表
images=(
  "nginx:1.25"
  "redis:7-alpine"
  "mysql:8.0"
  "registry:3.1"
)
REG=localhost:5000

for img in "${images[@]}"; do
  echo "==== 处理 $img ===="
  docker pull $img
  docker tag $img $REG/$img
  docker push $REG/$img
  echo "$img 迁移完成"
done
```

## 三、其他机器拉取本地仓库镜像

假设宿主机 IP：`192.168.1.100`，其他机器操作：

1. 同样配置 `daemon.json` 信任 `192.168.1.100:5000`
2. 拉取命令：

```bash
docker pull 192.168.1.100/nginx:1.25
```

## 四、常见报错解决

### 报错 1：http: server gave HTTP response to HTTPS client

- 原因：未配置 `insecure-registries`
- 解决：按步骤 1 修改 `daemon.json` 并重启 Docker

### 报错 2：denied: requested access to the resource is denied

- 若仓库开启账号密码：需要先 `docker login localhost:5000`
- 若未配置鉴权，匿名可 push/pull，排除账号问题

### 报错 3：推送失败 403 无删除权限

推拉镜像不受删除权限影响。如需删除权限，需在 Registry 配置中开启：

```yaml
REGISTRY_STORAGE_DELETE_ENABLED: "true"
```

## 五、补充：仓库镜像删除

**1）先获取镜像 Digest**

```bash
curl -v -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
  http://localhost:5000/v2/nginx/manifests/1.25
```

**2）通过 Digest 删除镜像**

```bash
curl -X DELETE http://localhost:5000/v2/nginx/manifests/sha256:xxxxxxx
```

**3）执行垃圾回收释放磁盘**

```bash
# 进入 Registry 容器执行
docker exec -it registry registry garbage-collect /etc/docker/registry/config.yml
```

## 六、进阶：离线环境迁移（机器无法联网）

**1）联网机器：save 镜像为 tar 包**

```bash
docker pull nginx:1.25
docker save -o nginx-1.25.tar nginx:1.25
```

**2）拷贝 tar 包到离线部署 Registry 机器**

**3）离线机器导入并 Push 本地仓库**

```bash
docker load -i nginx-1.25.tar
docker tag nginx:1.25 localhost:5000/nginx:1.25
docker push localhost:5000/nginx:1.25
```
