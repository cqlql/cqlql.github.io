---
title: Dockerfile 文件
icon: devicon:docker
sort: 5
---

Dockerfile 是用于构建 Docker 镜像的文本文件，包含一系列指令和参数。

## 基本指令

| 指令       | 说明                                                         |
| ---------- | ------------------------------------------------------------ |
| `FROM`     | 指定基础镜像                                                 |
| `RUN`      | 在镜像构建时执行命令                                         |
| `COPY`     | 从构建上下文复制文件到镜像                                   |
| `ADD`      | 类似 COPY，支持 URL 和 tar 自动解压                          |
| `CMD`      | 容器启动时的默认命令（可被覆盖）                             |
| `ENTRYPOINT` | 容器入口点（不可被 `docker run` 参数覆盖，需 `--entrypoint`） |
| `ENV`      | 设置环境变量                                                 |
| `WORKDIR`  | 设置工作目录                                                 |
| `EXPOSE`   | 声明容器监听的端口（仅文档用途）                             |
| `VOLUME`   | 创建挂载点                                                   |
| `ARG`      | 构建时变量                                                   |
| `USER`     | 指定运行用户                                                 |

## 基础示例

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

## 多阶段构建

减少最终镜像体积，分离构建环境和运行环境：

```dockerfile
# 阶段 1：构建
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 阶段 2：运行
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

## 最佳实践

- 使用 `.dockerignore` 排除不需要的文件
- 优先使用 `COPY` 而非 `ADD`
- 合并 `RUN` 指令减少镜像层
- 使用特定版本标签而非 `latest`
- 以非 root 用户运行（`USER` 指令）
