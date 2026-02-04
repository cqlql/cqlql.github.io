





## 1️⃣ 核心思路（一句话版）

> **Access Token = 凭证
> Redis = 凭证的“状态中心”**

Redis 负责：

- token 是否存在
- token 是否过期
- token 是否被踢下线
- 多端登录 / 单点登录控制

------

## 2️⃣ Redis 存什么？Key 怎么设计

### ✅ 最常见 & 推荐的结构

```
key:  access:token:{accessToken}
value: {
  userId: 1001,
  username: "jack",
  roles: ["ADMIN"],
  jti: "uuid-xxx",
  loginTime: 1700000000000
}
ttl: 30 minutes
```

👉 **Redis 过期 = access token 自动失效**

------

### 🔥 为什么 key 用 access:token:{token}？

- 校验快（O(1)）
- 不需要解析 JWT 也能判断登录态
- 方便踢人 / 强制下线

------

## 3️⃣ 整体流程（非常关键）

### ① 登录

```
用户登录成功
   ↓
生成 accessToken
   ↓
存 Redis（带 TTL）
   ↓
返回给前端
```

------

### ② 请求接口（校验）

```
请求 → Header: Authorization: Bearer xxx
   ↓
从 Redis 查询 access:token:xxx
   ↓
存在 ✔ → 放行
不存在 ✘ → 401
```

✔ **不依赖 JWT 是否过期，Redis 才是最终裁判**

------

### ③ 退出登录

```
DELETE access:token:{accessToken}
```

立刻生效，**不需要等 JWT 过期**

------

## 4️⃣ Spring Boot 示例（实战）

### ① 登录时写 Redis

```
public String login(User user) {
    String accessToken = UUID.randomUUID().toString().replace("-", "");

    String key = "access:token:" + accessToken;

    redisTemplate.opsForValue().set(
        key,
        user,
        30,
        TimeUnit.MINUTES
    );

    return accessToken;
}
```

------

### ② 校验 access token（Filter / Interceptor）

```
public User checkAccessToken(String token) {
    String key = "access:token:" + token;

    Object value = redisTemplate.opsForValue().get(key);
    if (value == null) {
        throw new UnauthorizedException("token 已失效");
    }

    return (User) value;
}
```

------

### ③ 退出登录

```
public void logout(String token) {
    redisTemplate.delete("access:token:" + token);
}
```

------

## 5️⃣ 升级版：引入 jti / sessionId（强烈推荐）

### 🔥 为什么要 jti？

- 一个用户多端登录
- 单点登录（挤下线）
- Refresh Token 精准控制

------

### Redis 结构升级

```
access:token:{token} -> sessionId
session:{sessionId} -> userInfo
```

示例：

```
access:token:abc -> sid-123
session:sid-123 -> { userId: 1 }
```

好处：

- 删除 session = 所有 token 同时失效
- refresh token 能精确定位 session

------

## 6️⃣ Redis access token vs JWT（你现在这套）

| 方案           | 是否可踢人 | 是否可控 | 复杂度 |
| -------------- | ---------- | -------- | ------ |
| 纯 JWT         | ❌          | ❌        | ⭐      |
| JWT + Redis    | ✅          | ✅        | ⭐⭐⭐    |
| 纯 Redis Token | ✅          | ✅        | ⭐⭐     |

👉 **企业项目 90%：JWT + Redis**

------

## 7️⃣ 常见坑（一定要避）

❌ token 只靠 JWT 过期，不进 Redis
❌ Redis 不设 TTL
❌ key 不加业务前缀
❌ refresh token 不绑定 access token / session
❌ access token 过期时间太长（>1h）

------

## 8️⃣ 一句话总结

> **Access Token 本质不是 JWT，而是“是否还能在 Redis 找到你”**

如果你愿意，下一步我可以直接帮你把：

- ✅ **Access + Refresh Token + Redis + jti**
- ✅ **单点登录**
- ✅ **多端登录策略**
- ✅ **SecurityFilterChain + Filter 完整代码**

## ==========「企业级标准实现」=========

------

# 🎯 目标方案（先给结论）

> **JWT 负责“携带信息”
> Redis 负责“控制生死”
> sid/jti 负责“会话级管理”**

支持：

- ✅ Access Token + Refresh Token
- ✅ Redis 控制登录态
- ✅ 单点登录 / 多端登录
- ✅ 立刻踢人 / 立刻失效
- ✅ Refresh Token 精准续期

------

## 一、整体结构设计（核心）

### 1️⃣ Token 角色划分

| Token            | 作用           | 生命周期       |
| ---------------- | -------------- | -------------- |
| accessToken      | 接口访问凭证   | 15~30 分钟     |
| refreshToken     | 换 accessToken | 7~30 天        |
| sid（sessionId） | 会话唯一标识   | = refreshToken |

------

## 二、Redis Key 设计（重点）

```
# access token → sid
auth:access:{accessToken} -> sid
TTL: 30 min

# refresh token → sid
auth:refresh:{refreshToken} -> sid
TTL: 7 days

# session 信息
auth:session:{sid} -> {
  userId,
  username,
  roles,
  loginTime
}
TTL: 7 days
```

🔥 **只要 session 被删，所有 token 全部失效**

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

- `sid`：定位 Redis session
- `jti`：区分 token（可选，但推荐）
- **是否过期只是“参考”，Redis 才是最终裁判**

------

## 四、完整流程拆解

------

### ① 登录流程（Login）

```
账号密码正确
   ↓
生成 sid
   ↓
生成 accessToken（15min）
生成 refreshToken（7d）
   ↓
写 Redis
   ↓
返回前端
```

### 登录代码示例

```
public TokenResponse login(User user) {

    String sid = UUID.randomUUID().toString();
    String accessToken = jwtUtil.generateAccessToken(user.getId(), sid);
    String refreshToken = jwtUtil.generateRefreshToken(user.getId(), sid);

    redisTemplate.opsForValue().set(
        "auth:access:" + accessToken,
        sid,
        30,
        TimeUnit.MINUTES
    );

    redisTemplate.opsForValue().set(
        "auth:refresh:" + refreshToken,
        sid,
        7,
        TimeUnit.DAYS
    );

    redisTemplate.opsForValue().set(
        "auth:session:" + sid,
        user,
        7,
        TimeUnit.DAYS
    );

    return new TokenResponse(accessToken, refreshToken);
}
```

------

## 五、接口访问校验（最关键）

### 校验逻辑（标准做法）

```
Header 带 accessToken
   ↓
解析 JWT 拿 sid
   ↓
Redis 查 auth:access:{token}
   ↓
存在 & sid 匹配 → 放行
```

### Filter 示例

```
public User checkAccessToken(String token) {

    Claims claims = jwtUtil.parse(token);
    String sid = claims.get("sid", String.class);

    String redisSid = (String) redisTemplate.opsForValue()
        .get("auth:access:" + token);

    if (redisSid == null || !redisSid.equals(sid)) {
        throw new UnauthorizedException("token 已失效");
    }

    return (User) redisTemplate.opsForValue()
        .get("auth:session:" + sid);
}
```

🔥 **JWT 过期 ≠ 真正失效，Redis 才算**

------

## 六、Refresh Token 流程（你之前重点问的）

### 刷新逻辑（正确姿势）

```
refreshToken → sid
   ↓
session 是否存在
   ↓
删除旧 accessToken
   ↓
生成新 accessToken
```

### 要不要删旧 accessToken？

> **要，而且必须要 ❗**

### 示例代码

```
public String refreshAccessToken(String refreshToken) {

    String sid = (String) redisTemplate.opsForValue()
        .get("auth:refresh:" + refreshToken);

    if (sid == null) {
        throw new UnauthorizedException("refresh token 失效");
    }

    User user = (User) redisTemplate.opsForValue()
        .get("auth:session:" + sid);

    if (user == null) {
        throw new UnauthorizedException("会话失效");
    }

    String newAccessToken = jwtUtil.generateAccessToken(user.getId(), sid);

    redisTemplate.opsForValue().set(
        "auth:access:" + newAccessToken,
        sid,
        30,
        TimeUnit.MINUTES
    );

    return newAccessToken;
}
```

------

## 七、退出登录 / 踢人

### 退出当前设备

```
public void logout(String accessToken) {
    redisTemplate.delete("auth:access:" + accessToken);
}
```

### 踢掉整个账号（所有端）

```
public void kickUser(String sid) {
    redisTemplate.delete("auth:session:" + sid);
}
```

💥 立刻全端失效，无需等过期

------

## 八、单点登录（只允许一端）

### 登录时处理

```
String oldSid = redisTemplate.opsForValue()
    .get("auth:user:" + user.getId());

if (oldSid != null) {
    redisTemplate.delete("auth:session:" + oldSid);
}

redisTemplate.opsForValue()
    .set("auth:user:" + user.getId(), sid);
```

------

## 九、你现在这套的“标准结论”

> **Access Token 是“短命钥匙”
> Refresh Token 是“续命钥匙”
> Redis 是“生死簿”
> sid 是“人”**

