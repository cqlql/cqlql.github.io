

jwt token 无状态，redis token 有状态



如果需要登录风控，则最好 redis token



redis token+ refresh token 可以兼顾长期会话体验和安全性，尤其适合短期 token TTL 较短的情况。



jwt token 必须加 



## 微服务中的 Redis token 方案

单点登录 + Redis token + 网关，是企业级微服务架构中最安全、最可控、最易风控的登录方案，JWT 在这种架构下几乎可以退休。

### 单点登录 + Redis token 架构（推荐）

```
Client → API Gateway → Auth Server (Redis token)
                    → Service A
                    → Service B
                    → Service C
```

**职责划分：**

- **Auth Server（单点登录中心）**
  - 登录认证
  - Redis token 管理
  - 风控
  - 统一失效控制
- **API Gateway / 网关**
  - 统一鉴权入口
  - token 校验只在这里做一次
- **微服务**
  - 不再关心登录态
  - 只关注业务逻辑



## 安全性对比 JWT

JWT 需要密钥，因为用户信息放到 token 中的，比如 userid，客户端拿到后可以伪造。

而 Redis token 只是标识，用户信息都是放服务端的





