## refresh token 的作用

主要是**长期会话体验优化**，不用让用户频繁登录

## RefreshToken存储

Refresh Token 的安全性提升关键在于 **存储安全 + 生命周期管理 + 可撤销性**，而不是单纯存在。

### 存储策略

#### (1) 浏览器端

- **最安全**：HttpOnly Cookie
  - JS 无法访问，浏览器自动随请求发送
  - 注意 SameSite / CSRF 风险
- **不安全**：localStorage / sessionStorage / IndexedDB
  - 可被 XSS 攻击读取
  - 可通过加密 + 短期 Access Token 降低风险，但不能完全替代 Cookie

#### (2) 客户端 App（移动 / 桌面）

- **存储位置**：
  - iOS → Keychain
  - Android → EncryptedSharedPreferences / Keystore
  - 桌面 App → 系统 Keychain / Credential Manager / 加密文件
- **刷新请求**：必须显式从安全存储中读取 Refresh Token 并发送给刷新接口。

---

### 刷新流程

#### 浏览器（HttpOnly Cookie）

```
[Access Token 过期]
      ↓
浏览器发请求 /auth/refresh （Cookie 自动发送 Refresh Token）
      ↓
服务器验证 Refresh Token
      ↓
返回新 Access Token
```

#### 客户端 App

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

### Refresh Token vs Access Token 可撤销性对比

| 类型                                   | 存储方式 | 是否可撤销   | 方法                    |
| -------------------------------------- | -------- | ------------ | ----------------------- |
| Access Token（JWT）                    | 无状态   | ❌天然无撤销 | 黑名单 / 缩短 TTL       |
| Refresh Token（JWT）                   | 无状态   | ❌天然无撤销 | 黑名单 / TTL / 绑定设备 |
| Access Token / Refresh Token（Redis）  | 状态化   | ✅天然可撤销 | 删除 Redis key          |
| Refresh Token（Cookie / App 安全存储） | 状态化   | ✅天然可撤销 | 删除服务器存储 token    |

> 核心区别：**撤销依赖服务器是否能查 token 状态**

## 刷新时让旧 access token 失效（高安全）

### ❌ 错误思路

```
refresh token → 找 access token → delete
```

### 两种方案

两种模型本质区别一句话版：

> **jti：管“这一张 token”**
>  **sessionId / sid：管“这一整个登录会话”**

### 方案一：用 **jti**（最小成本、最常见）

- ### ✔ jti 模型优点

  - 实现简单
  - 不侵入现有结构
  - 想管的时候才用 Redis

  ### ❌ 局限

  - 一个用户可能同时存在多个 access token
  - 不天然支持“单会话”

### 方案二：用 sessionId / sid

👉 适合：

- 单点登录
- 刷新即失效旧 token
- 多端 / 多设备控制



#### 1️⃣ token 结构（核心）

Access Token

```
{
  "sub": "10001",
  "sid": "SESSION_abc123",
  "exp": 1700001800
}
```

Refresh Token

```
{
  "sub": "10001",
  "sid": "SESSION_abc123",
  "exp": 1700600000
}
```

👉 **access + refresh 共用同一个 sid**

------

#### 2️⃣ Redis 只存“当前 sessionId”

```
user_session:{userId} -> SESSION_abc123
```

#### 3️⃣ 登录时

```
String sessionId = UUID.randomUUID().toString();

redisTemplate.opsForValue().set(
    "user_session:" + userId,
    sessionId,
    7,
    TimeUnit.DAYS
);

String accessToken  = jwtUtil.generateAccessToken(userId, sessionId);
String refreshToken = jwtUtil.generateRefreshToken(userId, sessionId);
```

####  4️⃣ 请求时校验（非常关键）

```
String jwtSid = claims.get("sid", String.class);
String redisSid = redisTemplate.opsForValue()
    .get("user_session:" + userId);

if (!jwtSid.equals(redisSid)) {
    throw new UnauthorizedException("Session expired");
}
```

#### 5️⃣ 刷新 token（重点）

```
public TokenResponse refresh(String refreshToken) {

    Claims claims = jwtUtil.parse(refreshToken);
    String userId = claims.getSubject();

    // 1️⃣ 生成新的 sessionId
    String newSessionId = UUID.randomUUID().toString();

    // 2️⃣ 覆盖 Redis（旧 session 自动失效）
    redisTemplate.opsForValue().set(
        "user_session:" + userId,
        newSessionId,
        7,
        TimeUnit.DAYS
    );

    // 3️⃣ 生成新 token
    String newAccess  = jwtUtil.generateAccessToken(userId, newSessionId);
    String newRefresh = jwtUtil.generateRefreshToken(userId, newSessionId);

    return new TokenResponse(newAccess, newRefresh);
}
```

🎯 **旧 access token 不用删、不用找、不用黑名单**
 🎯 下次请求时 sid 对不上 → 自动 401

### jti vs sessionId：你该怎么选？
> **jti 是“补丁”，sessionId 是“体系”**
>  如果你已经在设计 refresh token，那直接上 sessionId，后面会省很多事。

| 你的需求                | 推荐              |
| ----------------------- | ----------------- |
| 只想能踢人              | jti               |
| 刷新即失效旧 token      | sessionId         |
| 单点登录                | sessionId         |
| 不想 Redis 每次请求都查 | jti               |
| 后台管理系统            | sessionId（更爽） |

### jwtUtil.generateAccessToken 与 jwtUtil.generateRefreshToken 实现

> 下面示例基于 **jjwt（io.jsonwebtoken）**

```
@Component
public class JwtUtil {

    // 建议放配置文件
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
                .setSubject(userId)                 // sub
                .setIssuedAt(now)                   // iat
                .setExpiration(expireAt)            // exp
                .setId(UUID.randomUUID().toString())// jti（可选，但强烈建议）
                .claim("sid", sessionId)             // 👈 sessionId
                .claim("type", "access")             // 可选：标识类型
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
                .setId(UUID.randomUUID().toString()) // refresh 自己的 jti
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

Filter 里
```
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

## Web 端如何解决 CSRF？

### 一、方案一：全局开启 CSRF（推荐度 ⭐⭐⭐⭐）

```
http.csrf(csrf -> csrf
    .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
    .ignoringRequestMatchers(
        "/api/auth/login",
        "/api/auth/register"
    )
);
```

#### ✅ 特点

- 所有非忽略接口都需要 CSRF Token
- 自动生成 XSRF-TOKEN Cookie
- 前端必须带 `X-XSRF-TOKEN` header

#### 优点

- 安全边界清晰
- 不容易漏接口
- 符合 Spring Security 默认设计
- 团队成员不容易误操作

#### 缺点

- 所有 POST/PUT/DELETE 都要带 CSRF
- 对纯 REST API 有点“多余”
- 前端改动多

### 二、方案二：只对 refresh 开启（推荐度 ⭐⭐⭐⭐⭐）

```
http.csrf(csrf -> csrf
    // 1. 只有 refresh 接口需要检查
    .requireCsrfProtectionMatcher(request ->
        request.getRequestURI().equals("/api/auth/refresh")
    )
    // 2. 将 Token 写入 Cookie，以便前端 JS 可以读取 (withHttpOnlyFalse 是关键)
    .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
    // 3. 处理 CSRF Token 的加载逻辑 (Spring Security 6+ 的优化项)
    .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler()) 
);
```

#### ✅ 特点

- 只有 refresh 需要 CSRF
- 其他接口完全不校验
- 非常轻量
- 前端必须带 `X-XSRF-TOKEN` header

#### 优点

- 更符合 JWT 架构
- 只保护真正需要 Cookie 的接口
- API 设计更干净
- 前端改动最小

#### 缺点

- 需要你自己确保以后没有新增 Cookie 场景
- 团队新人可能误加 Cookie 接口却忘记加 CSRF

### app不需要CSRF，如何区分？

如果你想架构更干净，可以直接分接口：

```
/api/auth/web/refresh
/api/auth/app/refresh
```

然后：

```
.requireCsrfProtectionMatcher(request ->
    request.getRequestURI().equals("/api/auth/web/refresh")
)
```

这是企业里更清晰的做法。
