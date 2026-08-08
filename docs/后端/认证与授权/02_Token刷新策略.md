---
title: Token 刷新策略
icon: mdi:refresh
sort: 2
---

# Token 刷新策略

主要解决**长期会话体验优化**，不用让用户频繁登录。

------

## 一、RefreshToken 存储

Refresh Token 的安全性提升关键在于 **存储安全 + 生命周期管理 + 可撤销性**，而不是单纯存在。

### 浏览器端

- **最安全**：HttpOnly Cookie
  - JS 无法访问，浏览器自动随请求发送
  - 注意 SameSite / CSRF 风险
- **不安全**：localStorage / sessionStorage / IndexedDB
  - 可被 XSS 攻击读取
  - 可通过加密 + 短期 Access Token 降低风险，但不能完全替代 Cookie

### 客户端 App（移动 / 桌面）

- **存储位置**：
  - iOS → Keychain
  - Android → EncryptedSharedPreferences / Keystore
  - 桌面 App → 系统 Keychain / Credential Manager / 加密文件
- **刷新请求**：必须显式从安全存储中读取 Refresh Token 并发送给刷新接口。

------

## 二、刷新流程

### 浏览器（HttpOnly Cookie）

```
[Access Token 过期]
      ↓
浏览器发请求 /auth/refresh （Cookie 自动发送 Refresh Token）
      ↓
服务器验证 Refresh Token
      ↓
返回新 Access Token
```

### 客户端 App

```
[Access Token 过期]
      ↓
从 Keychain/Keystore 读取 Refresh Token
      ↓
调用 /auth/refresh，显式带上 Refresh Token
      ↓
服务器验证 Refresh Token
      ↓
返回新 Access Token
      ↓
更新内存中 Access Token
```

------

## 三、可撤销性对比

| 类型                                 | 存储方式 | 是否可撤销   | 方法                    |
| ------------------------------------ | -------- | ------------ | ----------------------- |
| Access Token（JWT）                  | 无状态   | ❌ 天然无撤销 | 黑名单 / 缩短 TTL       |
| Refresh Token（JWT）                 | 无状态   | ❌ 天然无撤销 | 黑名单 / TTL / 绑定设备 |
| Access Token / Refresh Token（Redis）| 状态化   | ✅ 天然可撤销 | 删除 Redis key          |
| Refresh Token（Cookie / App 安全存储）| 状态化  | ✅ 天然可撤销 | 删除服务器存储 token    |

> 核心区别：**撤销依赖服务器是否能查 token 状态**

------

## 四、刷新时让旧 Access Token 失效（高安全）

### ❌ 错误思路

```
refresh token → 找 access token → delete
```

### 两种模型

> **jti：管"这一张 token"**
> **sessionId / sid：管"这一整个登录会话"**

### 方案一：jti（最小成本、最常见）

✔ 优点：实现简单，不侵入现有结构，想管的时候才用 Redis

❌ 局限：一个用户可能同时存在多个 access token，不天然支持"单会话"

### 方案二：sessionId / sid

适合场景：单点登录、刷新即失效旧 token、多端 / 多设备控制

#### Token 结构

Access Token：

```json
{
  "sub": "10001",
  "sid": "SESSION_abc123",
  "exp": 1700001800
}
```

Refresh Token：

```json
{
  "sub": "10001",
  "sid": "SESSION_abc123",
  "exp": 1700600000
}
```

👉 **access + refresh 共用同一个 sid**

#### Redis 只存"当前 sessionId"

```
user_session:{userId} -> SESSION_abc123
```

#### 登录时

```java
String sessionId = UUID.randomUUID().toString();

redisTemplate.opsForValue().set(
    "user_session:" + userId, sessionId, 7, TimeUnit.DAYS);

String accessToken  = jwtUtil.generateAccessToken(userId, sessionId);
String refreshToken = jwtUtil.generateRefreshToken(userId, sessionId);
```

#### 请求时校验

```java
String jwtSid = claims.get("sid", String.class);
String redisSid = redisTemplate.opsForValue()
    .get("user_session:" + userId);

if (!jwtSid.equals(redisSid)) {
    throw new UnauthorizedException("Session expired");
}
```

#### 刷新时（核心）

```java
public TokenResponse refresh(String refreshToken) {
    Claims claims = jwtUtil.parse(refreshToken);
    String userId = claims.getSubject();

    // 1. 生成新的 sessionId
    String newSessionId = UUID.randomUUID().toString();

    // 2. 覆盖 Redis（旧 session 自动失效）
    redisTemplate.opsForValue().set(
        "user_session:" + userId, newSessionId, 7, TimeUnit.DAYS);

    // 3. 生成新 token
    String newAccess  = jwtUtil.generateAccessToken(userId, newSessionId);
    String newRefresh = jwtUtil.generateRefreshToken(userId, newSessionId);

    return new TokenResponse(newAccess, newRefresh);
}
```

🎯 旧 access token 不用删、不用找、不用黑名单，下次请求时 sid 对不上 → 自动 401。

### jti vs sessionId 选型

| 你的需求            | 推荐              |
| ------------------- | ----------------- |
| 只想能踢人          | jti               |
| 刷新即失效旧 token  | sessionId         |
| 单点登录            | sessionId         |
| 不想 Redis 每次都查 | jti               |
| 后台管理系统        | sessionId（更爽） |

> jti 是"补丁"，sessionId 是"体系"。如果你已经在设计 refresh token，直接上 sessionId，后面会省很多事。

------

## 五、JWT Token 生成工具类

> 基于 **jjwt（io.jsonwebtoken）**

```java
@Component
public class JwtUtil {

    private final String secret = "your-very-secret-key-which-is-long-enough";
    private final long accessTokenExpireMs  = 15 * 60 * 1000;   // 15 分钟
    private final long refreshTokenExpireMs = 7 * 24 * 60 * 60 * 1000; // 7 天

    private final Key key;

    public JwtUtil() {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /* =======================
       Access Token
       ======================= */
    public String generateAccessToken(String userId, String sessionId) {
        Date now = new Date();
        Date expireAt = new Date(now.getTime() + accessTokenExpireMs);

        return Jwts.builder()
                .setSubject(userId)
                .setIssuedAt(now)
                .setExpiration(expireAt)
                .setId(UUID.randomUUID().toString())
                .claim("sid", sessionId)
                .claim("type", "access")
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /* =======================
       Refresh Token
       ======================= */
    public String generateRefreshToken(String userId, String sessionId) {
        Date now = new Date();
        Date expireAt = new Date(now.getTime() + refreshTokenExpireMs);

        return Jwts.builder()
                .setSubject(userId)
                .setIssuedAt(now)
                .setExpiration(expireAt)
                .setId(UUID.randomUUID().toString())
                .claim("sid", sessionId)
                .claim("type", "refresh")
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /* =======================
       解析 & 校验
       ======================= */
    public Claims parse(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
```

Filter 中使用：

```java
Claims claims = jwtUtil.parse(token);

String userId = claims.getSubject();
String sid = claims.get("sid", String.class);
String type = claims.get("type", String.class);

if (!"access".equals(type)) {
    throw new UnauthorizedException("Invalid token type");
}

String redisSid = redisTemplate.opsForValue()
        .get("user_session:" + userId);

if (!sid.equals(redisSid)) {
    throw new UnauthorizedException("Session expired");
}
```

------

## 六、CSRF 防护

当 RefreshToken 使用 HttpOnly Cookie 时，必须处理 CSRF 风险。

### 方案一：全局开启 CSRF（推荐度 ⭐⭐⭐⭐）

```java
http.csrf(csrf -> csrf
    .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
    .ignoringRequestMatchers("/api/auth/login", "/api/auth/register")
);
```

特点：所有非忽略接口都需要 CSRF Token，前端必须带 `X-XSRF-TOKEN` header。

✔ 优点：安全边界清晰，不容易漏接口
✘ 缺点：所有 POST/PUT/DELETE 都要带 CSRF，对纯 REST API 有点"多余"

### 方案二：只对 refresh 开启（推荐度 ⭐⭐⭐⭐⭐）

```java
http.csrf(csrf -> csrf
    .requireCsrfProtectionMatcher(request ->
        request.getRequestURI().equals("/api/auth/refresh"))
    .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
    .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
);
```

特点：只有 refresh 需要 CSRF，其他接口完全不校验，非常轻量。

✔ 优点：更符合 JWT 架构，只保护真正需要 Cookie 的接口，前端改动最小
✘ 缺点：需要确保以后没有新增 Cookie 场景

### App 不需要 CSRF，如何区分？

直接分接口：

```
/api/auth/web/refresh
/api/auth/app/refresh
```

```java
.requireCsrfProtectionMatcher(request ->
    request.getRequestURI().equals("/api/auth/web/refresh"))
```

这是企业里更清晰的做法。
