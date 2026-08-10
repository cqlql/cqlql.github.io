---
title: Token 刷新策略
icon: mdi:refresh
sort: 2
---

# Token 刷新策略

解决**长期会话体验**问题：让用户无需频繁登录，同时保证 token 可撤销。

> 本文承接 `01_认证方案设计.md`，统一使用 `auth:session:{sid}` 体系。token 的「安全生成方式」见 `03_Token生成方案对比.md`。

------

## 一、RefreshToken 存储

Refresh Token 的安全性关键在于 **存储安全 + 生命周期管理 + 可撤销性**。

### 浏览器端

- **最安全**：HttpOnly Cookie
  - JS 无法读取，浏览器自动随请求发送
  - 注意 SameSite / CSRF 风险（见第六节）
- **不安全**：localStorage / sessionStorage / IndexedDB
  - 可被 XSS 读取
  - 加密 + 短期 Access Token 可降低风险，但不能替代 Cookie

### 客户端 App（移动 / 桌面）

- **存储位置**：
  - iOS → Keychain
  - Android → EncryptedSharedPreferences / Keystore
  - 桌面 App → 系统 Keychain / Credential Manager / 加密文件
- **刷新请求**：显式从安全存储读取 Refresh Token 并发送。

------

## 二、刷新流程

### 浏览器（HttpOnly Cookie）

```
[Access Token 过期]
      ↓
浏览器请求 /auth/refresh（Cookie 自动携带 Refresh Token）
      ↓
服务器校验 Refresh Token
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
服务器校验 Refresh Token
      ↓
返回新 Access Token，更新内存中的 Access Token
```

------

## 三、可撤销性对比

| 类型                                  | 存储方式 | 是否可撤销   | 方法                    |
| ------------------------------------- | -------- | ------------ | ----------------------- |
| Access Token（JWT）                   | 无状态   | ❌ 天然无撤销 | 黑名单 / 缩短 TTL       |
| Refresh Token（JWT）                  | 无状态   | ❌ 天然无撤销 | 黑名单 / TTL / 绑定设备 |
| Access / Refresh Token（Redis）       | 状态化   | ✅ 天然可撤销 | 删除 Redis key          |
| Refresh Token（Cookie / App 安全存储）| 状态化   | ✅ 天然可撤销 | 删除服务器存储 token    |

> 核心区别：**撤销依赖服务器能否查询 token 状态**。

------

## 四、刷新时让旧 Access Token 失效（高安全）

### 两种模型

> **jti**：管「这一张 token」
> **sid**：管「这一整个登录会话」

### 方案一：jti（最小成本）

✔ 优点：实现简单、不侵入现有结构，按需用 Redis 即可
❌ 局限：同一用户可并存多个 access token，不天然支持「单会话」

### 方案二：sid（推荐，体系化）

适合：单点登录、刷新即失效旧 token、多端 / 多设备控制——与 `01_认证方案设计.md` 的 `auth:session:{sid}` 体系一致。

#### 结构约定

- access + refresh **共用同一个 sid**
- Redis 以 `auth:session:{sid}` 为管控核心（见 01 的 Key 设计）

#### 登录时

```java
String sid = UUID.randomUUID().toString();          // 或 SecureRandom，见 03

redisTemplate.opsForValue().set(
    "auth:session:" + sid, sessionValue, 7, TimeUnit.DAYS);

String accessToken  = jwtUtil.generateAccessToken(userId, sid);
String refreshToken = jwtUtil.generateRefreshToken(userId, sid);  // 随机字符串
```

#### 请求校验

```java
String jwtSid = claims.get("sid", String.class);
String redisSid = redisTemplate.opsForValue()
        .get("auth:session:" + jwtSid) != null ? jwtSid : null;

if (redisSid == null) {
    throw new UnauthorizedException("Session expired");
}
```

#### 刷新时（核心）

```java
public TokenResponse refresh(String refreshToken) {
    // 1. 校验 refreshToken 合法性（hash 查 Redis 拿 sid）
    String sid = verifyRefreshToken(refreshToken);

    // 2. 使旧会话失效：直接删旧 session
    redisTemplate.delete("auth:session:" + sid);

    // 3. 生成新 sid 与新 session
    String newSid = UUID.randomUUID().toString();
    redisTemplate.opsForValue()
        .set("auth:session:" + newSid, newSessionValue, 7, TimeUnit.DAYS);

    // 4. 生成新 token（共用 newSid）
    String newAccess  = jwtUtil.generateAccessToken(userId, newSid);
    String newRefresh = jwtUtil.generateRefreshToken(userId, newSid);

    return new TokenResponse(newAccess, newRefresh);
}
```

🎯 旧 access token 不用删、不用找、不用黑名单——下次请求时 sid 对不上 → 自动 401。

### jti vs sid 选型

| 你的需求            | 推荐      |
| ------------------- | --------- |
| 只想能踢人          | jti       |
| 刷新即失效旧 token  | sid       |
| 单点登录            | sid       |
| 不想 Redis 每次都查 | jti       |
| 后台管理系统        | sid（更爽）|

> jti 是「补丁」，sid 是「体系」。已在设计 refresh token，直接上 sid，后面省事。

------

## 五、JWT 工具类

> 基于 **jjwt（io.jsonwebtoken）**；token 生成方式见 `03_Token生成方案对比.md`。

```java
@Component
public class JwtUtil {

    private final String secret = "your-very-secret-key-which-is-long-enough";
    private final long accessTokenExpireMs  = 15 * 60 * 1000;          // 15 分钟
    private final long refreshTokenExpireMs = 7 * 24 * 60 * 60 * 1000;  // 7 天

    private final Key key;

    public JwtUtil() {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /* ===== Access Token ===== */
    public String generateAccessToken(String userId, String sid) {
        Date now = new Date();
        Date expireAt = new Date(now.getTime() + accessTokenExpireMs);
        return Jwts.builder()
                .setSubject(userId)
                .setIssuedAt(now)
                .setExpiration(expireAt)
                .setId(UUID.randomUUID().toString())   // jti
                .claim("sid", sid)
                .claim("type", "access")
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /* ===== Refresh Token（JWT 形式，也可改为纯随机字符串） ===== */
    public String generateRefreshToken(String userId, String sid) {
        Date now = new Date();
        Date expireAt = new Date(now.getTime() + refreshTokenExpireMs);
        return Jwts.builder()
                .setSubject(userId)
                .setIssuedAt(now)
                .setExpiration(expireAt)
                .setId(UUID.randomUUID().toString())
                .claim("sid", sid)
                .claim("type", "refresh")
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /* ===== 解析 & 校验 ===== */
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
if (redisTemplate.opsForValue().get("auth:session:" + sid) == null) {
    throw new UnauthorizedException("Session expired");
}
```

------

## 六、CSRF 防护

当 RefreshToken 使用 HttpOnly Cookie 时，必须处理 CSRF 风险。

### 方案一：全局开启 CSRF（⭐⭐⭐⭐）

```java
http.csrf(csrf -> csrf
    .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
    .ignoringRequestMatchers("/api/auth/login", "/api/auth/register")
);
```

✔ 优点：安全边界清晰，不易漏接口
✘ 缺点：所有 POST/PUT/DELETE 都要带 CSRF，对纯 REST API 偏重

### 方案二：只对 refresh 开启（⭐⭐⭐⭐⭐，推荐）

```java
http.csrf(csrf -> csrf
    .requireCsrfProtectionMatcher(request ->
        request.getRequestURI().equals("/api/auth/refresh"))
    .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
    .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
);
```

✔ 优点：更符合 JWT 架构，只保护真正用 Cookie 的接口，前端改动最小
✘ 缺点：需确保以后无新增 Cookie 场景

### App 不需要 CSRF，如何区分？

按接口拆分，企业里更清晰：

```
/api/auth/web/refresh
/api/auth/app/refresh
```

```java
.requireCsrfProtectionMatcher(request ->
    request.getRequestURI().equals("/api/auth/web/refresh"))
```
