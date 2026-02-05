# JWT + sid + jti + Redis Key 学习笔记

------

## 一、核心思路

1. **结合 JWT + sid + jti + Redis key** 的方式来管理 token。
2. **核心理念**：JWT 本身只存储必要信息，**实际权限和状态由 Redis 管控**。
3. **🔥 关键点**：只要 `session` 被删，所有 token 都失效。

------

## 二、Redis Key 设计（重点）

```
# access token → sid
auth:access:{jti} -> sid
TTL: 30 min

# refresh token → sid
auth:refresh:{refreshToken} -> sid
TTL: 7 days

# session 信息
auth:session:{sid} -> {
  userId,
  username,
  roles,
  jti,
  loginTime
}
TTL: 7 days
```

- **解释**：
  - `auth:access:{jti}`：用 `jti` 找到对应的 `sid`。
  - `auth:refresh:{refreshToken}`：用 refreshToken 找到 `sid`。
  - `auth:session:{sid}`：存储完整 session 信息。
- **🔥 特点**：
  - Session 被删 → 所有 token 失效。

------

## 三、JWT Payload 设计（最简但够用）

```
{
  "sub": "1001",
  "sid": "sid-uuid",
  "jti": "access-jti-uuid",
  "exp": 1700000000
}
```

- `sub`：用户 ID
- `sid`：会话 ID（本次登录唯一标识）
- `jti`：token ID，用于找到具体 token
- `exp`：过期时间（epoch 秒）

------

## 四、登录流程（Login）

```
账号密码正确
   ↓
生成 sid
   ↓
生成 accessToken（15 min）
生成 refreshToken（7 d）
   ↓
写 Redis
   ↓
返回前端
```

- AccessToken 和 refreshToken 都关联到同一个 `sid`。
- Redis 记录 session 和 token 映射关系。

------

## 五、校验逻辑（Access Token 验证）

```
Header 带 accessToken
   ↓
解析 JWT 拿 sid
   ↓
Redis 查 auth:access:{jti}
   ↓
存在 & sid 匹配 → 放行
```

- **说明**：
  - JWT 只是载体，**真实权限通过 Redis 校验**。
  - 可以实现单点登出：删掉 session → token 失效。

------

## 六、刷新逻辑（Refresh Token 使用）

```
refreshToken → sid
   ↓
session 是否存在
   ↓
删除旧 accessToken
   ↓
生成新 accessToken
```

- **要点**：
  - RefreshToken 不需要 JWT，**随机字符串即可**（UUID 或 SecureRandom）。
  - Redis 管控刷新过程，保证安全性。

------

## 七、FAQ / 常见问题

### 1. refreshToken 需要 JWT 吗？

- 不需要。
- **企业级常规做法**：
  - AccessToken：JWT + Redis
  - RefreshToken：随机字符串 + Redis

### 2. 为什么 accessToken 还要放 `jti`？

- 用于在 Redis 中快速找到对应 token。
- 可以单独撤销某个 token，而不是整个 session。

### 3. session 删除 → token 失效？

- ✅ 对。Redis 统一管控 session，删除 session 等于撤销所有 token。

