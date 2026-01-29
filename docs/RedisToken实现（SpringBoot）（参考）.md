# 二、依赖改造（第一步）

### 1️⃣ 移除 Hutool JWT

```
<!-- 删掉 -->
<dependency>
  <groupId>cn.hutool</groupId>
  <artifactId>hutool-jwt</artifactId>
</dependency>
```

### 2️⃣ 保留 Security + Redis

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-security</artifactId>
</dependency>

<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

------

# 三、Redis Key 规范（强烈建议）

```java
public interface LoginRedisKey {

    String TOKEN = "login:token:";      // token -> userId
    String USER  = "login:user:";       // userId -> Set(token)

    static String token(String token) {
        return TOKEN + token;
    }

    static String user(Long userId) {
        return USER + userId;
    }
}
```

------

# 四、登录接口改造（最关键）

### 1️⃣ 登录成功后：生成 Token

```
String accessToken = UUID.randomUUID().toString().replace("-", "");
```

### 2️⃣ 写入 Redis

```
redisTemplate.opsForValue().set(
    LoginRedisKey.token(accessToken),
    userId,
    30,
    TimeUnit.MINUTES
);

redisTemplate.opsForSet().add(
    LoginRedisKey.user(userId),
    accessToken
);
```

### 3️⃣ 返回前端

```
{
  "accessToken": "xxxxx",
  "expireIn": 1800
}
```

👉 到这一步，**JWT 已经彻底不需要了**

------

# 五、核心：TokenAuthenticationFilter（替换 JwtFilter）

### 1️⃣ Filter 结构

```java
@Component
public class TokenAuthenticationFilter extends OncePerRequestFilter {

    @Resource
    private RedisTemplate<String, Object> redisTemplate;

    @Resource
    private UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String token = resolveToken(request);

        if (StrUtil.isBlank(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        Long userId = (Long) redisTemplate.opsForValue()
                .get(LoginRedisKey.token(token));

        if (userId == null) {
            filterChain.doFilter(request, response);
            return;
        }

        UserDetails userDetails =
                userDetailsService.loadUserByUsername(String.valueOf(userId));

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );

        SecurityContextHolder.getContext().setAuthentication(authentication);

        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");
        if (StrUtil.isBlank(bearer) || !bearer.startsWith("Bearer ")) {
            return null;
        }
        return bearer.substring(7);
    }
}
```

📌 注意：

- **不抛异常**
- token 不存在 = 未登录
- 是否 401 交给 Security 统一处理

------

# 六、SecurityConfig 精简版（非常重要）

```
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Resource
    private TokenAuthenticationFilter tokenAuthenticationFilter;

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s ->
                s.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/login").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(
                tokenAuthenticationFilter,
                UsernamePasswordAuthenticationFilter.class
            );

        return http.build();
    }
}
```

👉 重点：

- `STATELESS`
- **你自己的 Filter 在 UsernamePasswordAuthenticationFilter 之前**

------

# 七、UserDetailsService 改造要点

你原来 JWT 里可能是：

```
loadByUsername(username)
```

现在建议直接：

```
loadByUsername(userId)
@Override
public UserDetails loadUserByUsername(String userId) {
    User user = userRepository.findById(Long.valueOf(userId))
        .orElseThrow(() -> new UsernameNotFoundException("user not found"));

    return new LoginUser(user);
}
```

------

# ===============================

## 二、整体架构（先把脑图立住）

```
┌──────────┐        Authorization: Bearer token
│  Client  │ ──────────────────────────────────▶
└──────────┘
        │
        ▼
┌─────────────────────┐
│ Spring Security     │
│  Token Filter       │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Redis               │
│  token -> userInfo  │
└─────────────────────┘
```

------

## 三、Redis 中存什么？（重点）

### 推荐结构（强烈建议）

```
key: auth:token:{token}
value: {
  userId: 1001,
  username: "admin",
  roles: ["ROLE_ADMIN"]
}
TTL: 30 min
```

**不建议：**

- ❌ token 里塞 JWT
- ❌ 只存 userId（权限会失效）

------

## 四、登录接口（生成 Token）

### 1️⃣ 登录成功后生成 token

```
String token = UUID.randomUUID().toString().replace("-", "");
```

------

### 2️⃣ 存入 Redis

```
String redisKey = "auth:token:" + token;

UserSession session = new UserSession(
    user.getId(),
    user.getUsername(),
    user.getRoles()
);

redisTemplate.opsForValue().set(
    redisKey,
    session,
    30,
    TimeUnit.MINUTES
);
```

------

### 3️⃣ 返回给客户端

```
{
  "accessToken": "abc123...",
  "expiresIn": 1800
}
```

📌 **浏览器端建议**

- HttpOnly Cookie（最安全）
- 或 Authorization Header

------

## 五、核心：Token 校验过滤器（OncePerRequestFilter）

### 1️⃣ 过滤器骨架

```
@Component
public class RedisTokenFilter extends OncePerRequestFilter {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String token = resolveToken(request);
        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = "auth:token:" + token;
        UserSession session = getSession(key);

        if (session == null) {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            return;
        }

        Authentication auth = buildAuthentication(session);
        SecurityContextHolder.getContext().setAuthentication(auth);

        // ✅ 滑动过期
        redisTemplate.expire(key, 30, TimeUnit.MINUTES);

        filterChain.doFilter(request, response);
    }
}
```

------

### 2️⃣ 解析 Token

```
private String resolveToken(HttpServletRequest request) {
    String header = request.getHeader("Authorization");
    if (StrUtil.isBlank(header) || !header.startsWith("Bearer ")) {
        return null;
    }
    return header.substring(7);
}
```

------

### 3️⃣ 构建 Authentication

```
private Authentication buildAuthentication(UserSession session) {
    List<GrantedAuthority> authorities =
        session.getRoles().stream()
            .map(SimpleGrantedAuthority::new)
            .toList();

    return new UsernamePasswordAuthenticationToken(
        session,
        null,
        authorities
    );
}
```

------

## 六、Spring Security 配置

```
@Bean
SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .csrf(csrf -> csrf.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/auth/**").permitAll()
            .anyRequest().authenticated()
        )
        .addFilterBefore(redisTokenFilter, UsernamePasswordAuthenticationFilter.class);

    return http.build();
}
```

📌 **注意**

- `STATELESS` 是必须的
- 不用 HttpSession 了

------

## 七、登出 & 强制下线（Redis Token 的杀手锏）

### 登出接口

```
@DeleteMapping("/logout")
public void logout(HttpServletRequest request) {
    String token = resolveToken(request);
    if (token != null) {
        redisTemplate.delete("auth:token:" + token);
    }
}
```

### 管理员踢人

```
redisTemplate.delete("auth:token:" + token);
```

JWT **做不到这一点** 😏

------

## 八、进阶（你之前问过的，全对得上）

### ✔ 滑动过期

- 每次请求 `expire`

### ✔ 刷新 Token

- refreshToken 单独 key
- 主 token 15min / refresh 7天

### ✔ 登录风控

- 失败次数、IP 次数 → Redis 天然适合
