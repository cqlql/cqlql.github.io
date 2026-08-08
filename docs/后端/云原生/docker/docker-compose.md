## restart

用于定义容器退出后的自动重启策略

- `no`：不重启
- `always`：永远重启
- `unless-stopped`：除非手动 stop，否则重启（推荐用于数据库）
- `on-failure`：仅失败时重启，适合任务型容器
  - `on-failure:N` 最多重试 N 次

## 多个 docker-compose 组合

实现不同环境下组合出不同的 docker-compose

### 典型结构

```
docker-compose.yml            # 基础（通用配置）
docker-compose.dev.yml        # 开发环境
docker-compose.prod.yml       # 生产环境
```

### **启动方式**

开发环境：

```
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

生产环境：

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 叠加规则（重点）

同一个 service：

| 字段          | 行为 |
| ------------- | ---- |
| `image`       | 覆盖 |
| `environment` | 合并 |
| `ports`       | 覆盖 |
| `volumes`     | 合并 |
| `command`     | 覆盖 |

👉 本质是：**后者 override 前者**

### 当前架构建议（结合现在做的 Python + AI + Java）

你可以这样分：

```
compose/
  docker-compose.base.yml      # mysql redis elastic
  docker-compose.backend.yml   # java
  docker-compose.ai.yml        # python + pydantic_ai
  docker-compose.dev.yml
  docker-compose.prod.yml
```

启动：

```
docker compose \
  -f compose/docker-compose.base.yml \
  -f compose/docker-compose.backend.yml \
  -f compose/docker-compose.ai.yml \
  -f compose/docker-compose.dev.yml \
  up
```

👉 这就是“模块化 compose”

## 快捷启动 docker-compose 

### 使用 Makefile（最主流，强烈推荐）

需要安装make，通过命名 `make -v` 查看是否以及安装

```
# Makefile

up-dev:
	docker compose -f compose/base.yml -f compose/dev.yml up -d

up-prod:
	docker compose -f compose/base.yml -f compose/prod.yml up -d

down:
	docker compose down

logs:
	docker compose logs -f
```

使用

```
make up-dev
```

###  Shell 脚本（最通用）

```
# scripts/dev.sh
docker compose \
  -f compose/base.yml \
  -f compose/dev.yml \
  up -d
```

```
sh scripts/dev.sh
```

### 使用 Profile（官方推荐新方式）

```
services:
  app:
    image: myapp
    profiles: ["dev"]

  app-prod:
    image: myapp:prod
    profiles: ["prod"]
```

启动：

```
docker compose --profile dev up
```

### VS Code DevContainer(随vscode自动起动，开发环境推荐)

 `.devcontainer/devcontainer.json`：

```
{
  "dockerComposeFile": [
    "../compose/base.yml",
    "../compose/dev.yml"
  ],
  "service": "app"
}
```

### 最优组合（结合当前架构）

#### ✔ 开发环境

- 用 **DevContainer 自动起**
- 或 `make up-dev`

#### ✔ CI/CD

- 用 shell / make

#### ✔ 本地快速操作

- `make` 或 `.env`

## 目录结构（生产级）

```
project-root/
├── compose/                    # ⭐ 专门放 compose
│   ├── base.yml               # 基础设施（mysql / redis / es）
│   ├── backend.yml            # Java 服务
│   ├── ai.yml                 # Python + pydantic_ai
│   ├── dev.yml                # 开发环境覆盖
│   ├── prod.yml               # 生产环境覆盖
│
├── scripts/
│   ├── dev.sh
│   ├── prod.sh
│
├── Makefile
├── .env
├── .devcontainer/
│   └── devcontainer.json
```

### 好处

👉 一眼就知道：**这里是容器编排**

👉 配合命令非常清晰：

```
docker compose \
  -f compose/base.yml \
  -f compose/backend.yml \
  -f compose/ai.yml \
  -f compose/dev.yml \
  up
```

### 进阶（更专业）

如果你后面拆服务，可以这样：

```
compose/
├── infra/
│   ├── mysql.yml
│   ├── redis.yml
│   └── elasticsearch.yml
│
├── services/
│   ├── backend.yml
│   └── ai.yml
│
├── env/
│   ├── dev.yml
│   └── prod.yml
```

启动：

```
docker compose \
  -f compose/infra/mysql.yml \
  -f compose/infra/redis.yml \
  -f compose/services/backend.yml \
  -f compose/services/ai.yml \
  -f compose/env/dev.yml \
  up
```

👉 这是**微服务 / 中大型项目常见结构**

### 根目录可以留一个“入口文件”（可选）

比如：

```
docker-compose.yml
```

内容：

```
# 只是提示或基础，不一定真正用
```

或者干脆不放，全部走 Makefile / scripts

### 和 DevContainer 配合

```
{
  "dockerComposeFile": [
    "../compose/base.yml",
    "../compose/backend.yml",
    "../compose/ai.yml",
    "../compose/dev.yml"
  ],
  "service": "backend"
}
```

### 结合 Dockerfile (Monorepo 方案)

```
pass-up/
├── docker/
│   ├── backend/
│   │   ├── Dockerfile
│   │   └── Dockerfile.dev
│   ├── frontend/
│   │   ├── Dockerfile
│   │   └── Dockerfile.dev
│   ├── ai/
│   │   ├── Dockerfile
│   │   └── Dockerfile.dev
│   └── compose/
│       ├── docker-compose.yml
│       ├── docker-compose.dev.yml
│       └── docker-compose.prod.yml
│
├── backend/                 # Java
├── frontend/                # Vue
├── backend-ai/              # Python
│   └── .devcontainer/
│       ├── devcontainer.json
│       └── Dockerfile.dev   # ⭐（仅 devcontainer 用）
```

# 进阶结构（更专业一点）

```
pass-up/
├── apps/
│   ├── backend/
│   ├── frontend/
│   └── ai/
│
├── infra/
│   ├── docker/
│   └── compose/
│
├── packages/   # （未来可扩展）
│   └── shared-schema/
```