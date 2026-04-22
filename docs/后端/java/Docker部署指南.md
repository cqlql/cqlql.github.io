# Java Docker 部署指南

Java 项目用 Docker 部署，其实就是三件事：

1. 写 `Dockerfile`
2. 构建镜像
3. 运行容器

## 写 Dockerfile

```dockerfile
### 第一阶段：构建 ###

# 使用包含 Maven 和 JDK 17 的官方镜像作为基础，AS builder 给这个阶段起个名字，方便后面引用
FROM maven:3.9-eclipse-temurin-17 AS builder
# 设置工作目录（创建并 cd 到 /app）
WORKDIR /app
# 复制 settings.xml 和 pom.xml
# 分两次copy为了缓存maven依赖，避免每次重新下载，settings.xml 中配置了maven源
COPY settings.xml pom.xml ./
# 预下载所有依赖（利用 go-offline 目标）
# 这一层会被 Docker 缓存，直到 pom.xml 发生变化
RUN mvn dependency:go-offline -s settings.xml
# 复制源代码
COPY src ./src
# 打包并跳过测试
RUN mvn clean package -DskipTests

### 第二阶段：运行 ###

# 重新创建一个仅包含运行环境的轻量化镜像（不再需要 JDK 和 Maven。这会让镜像体积缩小好几百 MB。）
# FROM 虽然是全新的开始，但还是可以通过 builder 名字找回，只有真正执行完后，才会删掉，并保留最后一个阶段
FROM eclipse-temurin:21-jre
# 设置工作目录（创建并 cd 到 /app）
WORKDIR /app
# 从名为 builder 的第一阶段镜像中，只把打好的 app.jar 拷贝到当前镜像中。。
COPY --from=builder /app/target/app.jar app.jar
# 暴露端口（没有实质作用，只是给人看的，可通过 docker inspect查看，相当于说明书，告诉他人建议用这个端口）
EXPOSE 8080
# 设置默认环境变量，有环境变量就必须使用 Shell 模式：告诉 JVM：只许用容器限制内存的 70% 作为堆内存
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=70.0"

ARG VERSION
ARG GIT_COMMIT
ARG BUILD_TIME

LABEL org.opencontainers.image.title="pass-up-web-api"
LABEL org.opencontainers.image.description="Pass Up Web API Service"
LABEL org.opencontainers.image.version=$VERSION
LABEL org.opencontainers.image.revision=$GIT_COMMIT
LABEL org.opencontainers.image.authors="cql"
LABEL org.opencontainers.image.created=$BUILD_TIME

# 启动命令。二选一，Shell 可以解析环境变量，而 Exec 可以优雅停机
# Exec 模式
ENTRYPOINT ["java","-jar","app.jar"] 
# Exec +  Shell 模式，$SPRING_OPTS 这是示意多个时的写法
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS $SPRING_OPTS -jar app.jar"]
```

### ⚠️ 一个容易忽视的小细节（优雅停机）

当你使用 `sh -c` 启动时，Java 进程在容器内部的 PID（进程 ID）通常不再是 **1**。这意味着当你执行 `docker stop` 时，Java 程序可能收不到“优雅停机”的信号，而是被强制杀掉。

**进阶方案（如果你在意优雅停机）：** 使用 `exec` 命令： `ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]` 加上 `exec` 后，Java 进程会替换掉 Shell 进程，重新变回 PID 1，完美接收停机信号。

## 构建镜像

```
[xml]$pom = Get-Content .\pom.xml
$version = $pom.project.version
docker build `
  --build-arg VERSION=$version `
  --build-arg GIT_COMMIT=$(git rev-parse HEAD) `
  --build-arg BUILD_TIME=$(Get-Date -uformat "%Y-%m-%dT%H:%M:%SZ") `
  -t pass-up-web-api:$version .
```

构建成功后查看：

```
docker images
```

### 运行时传参数：

```bash
docker run -d \
  -p 8080:8080 \
  -e JAVA_OPTS="-Denv=prod -Xms512m -Xmx1024m" \
  --name java-app \
  my-java-app
```

## 通过 docker-compose 运行：生产环境专业写法

### 只 build 一次，然后 compose 直接用 image

先手动构建：

```
docker build -t my-java-app:1.0 .
```

启动建议用 `docker-compose.yml`

```yml
services:
  app:
    image: my-java-app:1.0
    ports:
      - "8080:8080"
    environment:
      - JAVA_OPTS=-Dspring.profiles.active=prod -Dspring.redis.host=redis_local
	  - SPRING_PROFILES_ACTIVE=prod # 推荐方式，等同上一行的 JAVA_OPTS=-Dspring.profiles.active=prod
    depends_on:
      - redis
    networks:
      - backend

  redis:
    image: redis
    container_name: redis
    networks:
      - backend

networks:
  backend:
```

> **注意：** Spring 会自动把 `SPRING_REDIS_HOST` 映射为 `spring.redis.host`。 所以Dockerfile 启动命令可以简化为： `ENTRYPOINT ["java", "-jar", "app.jar"]`

这样：

✔ compose 不会重复 build
 ✔ 更接近生产模式
 ✔ 可以推送到私有仓库

启动：

```
docker compose up -d
```
------

### 企业真实流程

真实生产环境通常是：

```
代码
 ↓
CI 构建镜像（多阶段）
 ↓
推送镜像仓库
 ↓
服务器 docker-compose 拉镜像启动
```

常见仓库：

- Docker Hub
- GitHub
- GitLab

## 版本信息应该体现在镜像 tag 上

在容器化世界里：

👉 **版本信息应该体现在镜像 tag 上，而不是 jar 名字上**

例如：

```
docker build -t my-java-app:1.0.3 .
```

这里：

```
1.0.3 = 版本
```

jar 只是构建中间产物。

所以，固定  jar 名字是企业级做法

```
<project>
	<build>
		<!-- 打包时，设置最终的 jar 文件名，版本号z -->
		<finalName>app</finalName>		
	</build>
</project>
```

## 导出镜像

这样就可以直接在本地构建，服务器运行。但更推荐内网部署 **Harbor** 

```
docker save -o my_image.tar my_image_name:0.0.1
```
**服务器加载：** 在服务器上还原镜像。

```
docker load -i /path/to/destination/my_image.tar
```

## Dockerfile构建时缓存maven依赖

由于 Maven 默认将依赖下载在容器内的 `~/.m2` 目录中，而容器构建过程是“无状态”的，每次重新运行 `RUN` 指令时，之前的依赖并不会自动留存。

要解决这个问题，有两种主流的高效方案：

------

### 方案一：利用 Docker 层缓存机制（最推荐）

利用 Docker **按行缓存**的特性，我们可以先只拷贝 `pom.xml`，下载完依赖后再拷贝源代码。这样只要 `pom.xml` 没改，依赖层就不会重新下载。

```dockerfile
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app

# 1. 仅复制项目描述文件
COPY pom.xml .

# 2. 预下载所有依赖（利用 go-offline 目标，go-offline 属于 maven 功能）
# 这一层会被 Docker 缓存，直到 pom.xml 发生变化
RUN mvn dependency:go-offline

# 3. 复制源代码并打包
COPY src ./src
RUN mvn clean package -DskipTests
```

------

### 方案二：利用 BuildKit 的挂载缓存（更现代）

如果你使用的是较新版本的 Docker（BuildKit），可以使用 `--mount=type=cache`。这种方式会将 Maven 的本地仓库挂载到一个持久化的缓存位置，即使 `pom.xml` 变了，也只会下载新增的依赖。

```dockerfile
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app

COPY . .

# 使用 BuildKit 挂载缓存目录
RUN --mount=type=cache,target=/root/.m2 \
    mvn clean package -DskipTests
```

------

### 两种方案对比

| **特性** | **方案一：分层缓存**             | **方案二：Mount 缓存**              |
| -------- | -------------------------------- | ----------------------------------- |
| **原理** | 利用 Docker 镜像分层机制         | 利用宿主机的持久化缓存目录          |
| **优点** | 无需特殊配置，CI/CD 环境通用性强 | 即使修改了 `pom.xml` 也不用全量重下 |
| **缺点** | `pom.xml` 变动时仍需重下所有依赖 | 需要开启 BuildKit 且配置略微复杂    |
