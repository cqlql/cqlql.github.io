# JWT + sid + jti + Redis Key

------

## 一、核心思路

1. **结合 JWT + sid + jti + Redis key** 的方式来管理 token。
2. **核心理念**：JWT 本身只存储必要信息，**实际权限和状态由 Redis 管控**。
3. **🔥 关键点**：只要 `session` 被删，所有 token 都失效。

------

## 二、Redis Key 设计（重点）

```
# access token（可选）
auth:access:{jti} -> sid
TTL: 30 min

# refresh token（hash）
auth:refresh:{hash} -> sid
TTL: 7 days

# session 信息
auth:session:{sid} -> {
  userId,
  roles,
  jti,
  version,
  loginTime
}
TTL: 7 days

# sid -> refreshToken
auth:session:refresh:{sid} -> hash
TTL: 7 days

# 用户会话（多端控制，即限制客户端数量）（需要登录时清理，防止“幽灵 session（已过期但还占坑）”）
auth:user:sessions:{userId}:{clientType} -> ZSET(sid)
TTL: 7 days
```

- **解释**：
  - 
  - `sid`：会话 ID（本次登录唯一标识）
  - `jti`：token ID，用于找到具体 token
  - `auth:access:{jti}`：用 `jti` 找到对应的 `sid`。
  - `auth:refresh:{refreshToken}`：用 refreshToken 找到 `sid`。
  - `auth:session:{sid}`：存储完整 session 信息。
  - 为什么要`hash(refreshToken)`: 令牌脱敏存储，避免令牌泄露后能被“直接用”
  - `accessToken` 为什么可选：删除 `auth:session:{sid}`也能实现踢人
  
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

### 4. 前端存哪里？

✅ `access_token` → **放内存 / 前端变量（或少数情况下 localStorage）**

✅ `refresh_token` → **放 HttpOnly + Secure Cookie（强烈推荐）**

- 只在刷新接口带上

## hash refreshToken 方案

可以直接用 jwtSecret，但不能直接用，否则违反安全原则：**Key Separation（密钥隔离）**，未来扩展也会被限制

```
// 1. 派生 key
refreshSecret = HMAC_SHA256(jwtSecret, "refresh-token");

// 2. 计算 hash
hash = hmacSha256Hex(refreshToken, refreshSecret);

// 3. 存储
auth:refresh:{hash} -> sid
```

更推荐单独给 refresh 设置 secret

```
security:
  jwt:
    secret: xxx
  refresh:
    hash-secret: yyy   # 单独一份
```

hash 工具类

```java
public class SecurityUtil {
    public static String hmacSha256Hex(String value, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(key);
            byte[] raw = mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(raw);
        } catch (Exception e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }
}
```




## 多端控制清理方案

### 方案一：登录时清理（推荐 ⭐⭐⭐）

👉 **在每次登录时做一次“懒清理”**

------

🔧 步骤：

1. 拿到当前 ZSET：

```
auth:user:sessions:{userId}:{clientType}
```

1. 遍历（或分页）检查：

```
auth:session:{sid} 是否存在
```

1. 不存在的：

```
ZREM 掉
```

------

✔ 示例逻辑：

```
for (sid in zset) {
    if (!exists("auth:session:" + sid)) {
        ZREM(sid);
    }
}
```
✔ 优点

- 实现简单
- 不需要额外机制
- 非常常见（大厂也这么干）


### 方案二：用 score 表示过期时间（推荐 ⭐⭐⭐⭐）

👉 **最优雅方案**

------

🔧 改造 ZSET：

```
ZADD key score=sidExpireTime member=sid
```

比如：

```
score = now + 7days
```

------

✔ 登录时先清理：

```
ZREMRANGEBYSCORE key 0 now
```

👉 一行搞定所有过期 session 🚀

------

✔ 再判断数量：

```
ZCARD key
```

✔ 优点

- 不需要逐个 exists
- O(logN) 性能很好
- 非常优雅

#### 一个隐藏坑

❗session TTL 被刷新，但 ZSET 没更新

比如：

- refresh token → 延长 session TTL（7天 → 再7天）
- 但 ZSET 里的 score 还是旧时间

👉 ❌ 会被误删！

------

✅ 解决办法

✔ refresh 时同步更新：

```
ZADD key newExpireTime sid
```
