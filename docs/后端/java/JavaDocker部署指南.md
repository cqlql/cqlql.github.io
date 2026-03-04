# Java Docker 部署指南

Java 项目用 Docker 部署，其实就是三件事：

1. 写 `Dockerfile`
2. 构建镜像
3. 运行容器

## 写 Dockerfile

```
### 第一阶段：构建 ###

# 使用包含 Maven 和 JDK 17 的官方镜像作为基础，AS builder 给这个阶段起个名字，方便后面引用
FROM maven:3.9-eclipse-temurin-17 AS builder
# 设置工作目录（创建并 cd 到 /app）
WORKDIR /app
# 复制当前目录到/app 目录
COPY . .
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
# 设置默认环境变量
ENV JAVA_OPTS="-Xms256m -Xmx256m"
# 启动命令。二选一，Shell 可以解析环境变量，而 Exec 可以优雅停机
ENTRYPOINT ["java","-jar","app.jar"] # Exec 模式
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"] # Exec +  Shell 模式
```

### ⚠️ 一个容易忽视的小细节（优雅停机）

当你使用 `sh -c` 启动时，Java 进程在容器内部的 PID（进程 ID）通常不再是 **1**。这意味着当你执行 `docker stop` 时，Java 程序可能收不到“优雅停机”的信号，而是被强制杀掉。

**进阶方案（如果你在意优雅停机）：** 使用 `exec` 命令： `ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]` 加上 `exec` 后，Java 进程会替换掉 Shell 进程，重新变回 PID 1，完美接收停机信号。

## 构建镜像

```
docker build -t my-java-app .
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

建议用 `docker-compose.yml`

```yml
services:
  app:
    image: my-java-app:1.0
    ports:
      - "8080:8080"
    environment:
      - JAVA_OPTS=-Denv=prod
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

