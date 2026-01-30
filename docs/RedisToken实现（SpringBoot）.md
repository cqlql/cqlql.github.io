## 一、设计思路

Redis Token 的核心思想是：**将 Token 与用户信息存储在 Redis 中**，服务端可以随时检查 Token 是否有效，并支持强制注销、刷新等操作。

主要流程：

1. **登录生成 Token**
   - 用户登录成功后生成一个唯一 Token（可用 UUID 或 JWT）。
   - 将 Token 与用户信息（如用户 ID）存入 Redis。
   - 设置过期时间（如 30 分钟）。
2. **前端请求携带 Token**
   - Token 可放在请求头（推荐 `Authorization: Bearer xxx`）。
   - 服务端通过 Redis 校验 Token 是否存在。
   - 存在则认为登录有效，否则返回 401。
3. **Token 续期 / 刷新**
   - 每次请求可以延长 Token 在 Redis 的过期时间（可选）。
   - 也可以设计刷新 Token 接口。
4. **登出 / 强制下线**
   - 从 Redis 删除对应 Token，即可实现登出或强制下线。

------

## 二、依赖

在 `pom.xml` 中引入：

```
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-lang3</artifactId>
</dependency>
```

Redis 建议使用 **单机模式** 或 **集群模式**。

------

## 三、Redis 配置

`application.yml`:

```
spring:
  redis:
    host: localhost
    port: 6379
    password:
    jedis:
      pool:
        max-active: 10
        max-idle: 5
        min-idle: 1
    timeout: 5000
```

------

## 四、Token 工具类

```java
import org.apache.commons.lang3.RandomStringUtils;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
public class RedisTokenManager {

    private final RedisTemplate<String, Object> redisTemplate;
    private final long expireSeconds = 1800; // 30 分钟

    public RedisTokenManager(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * 生成 Token 并存入 Redis
     */
    public String createToken(String userId) {
        String token = RandomStringUtils.randomAlphanumeric(32);
        redisTemplate.opsForValue().set("TOKEN:" + token, userId, expireSeconds, TimeUnit.SECONDS);
        return token;
    }

    /**
     * 校验 Token 是否有效
     */
    public boolean checkToken(String token) {
        if (token == null) return false;
        String key = "TOKEN:" + token;
        boolean exists = redisTemplate.hasKey(key);
        if (exists) {
            // 可选：访问时刷新过期时间
            redisTemplate.expire(key, expireSeconds, TimeUnit.SECONDS);
        }
        return exists;
    }

    /**
     * 根据 Token 获取用户ID
     */
    public String getUserId(String token) {
        return (String) redisTemplate.opsForValue().get("TOKEN:" + token);
    }

    /**
     * 删除 Token
     */
    public void removeToken(String token) {
        redisTemplate.delete("TOKEN:" + token);
    }
}
```

------

## 五、Spring Security 集成

创建一个 **JWT / Redis Token 过滤器**，每次请求拦截：

```java
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class RedisTokenFilter extends OncePerRequestFilter {

    private final RedisTokenManager tokenManager;

    public RedisTokenFilter(RedisTokenManager tokenManager) {
        this.tokenManager = tokenManager;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws IOException, jakarta.servlet.ServletException {

        String authHeader = request.getHeader("Authorization");
        String token = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }

        if (token != null && tokenManager.checkToken(token)) {
            String userId = tokenManager.getUserId(token);

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(userId, null, null);

            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        filterChain.doFilter(request, response);
    }
}
```

在 `SecurityConfig` 中注册过滤器：

```
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SecurityConfig {

    private final RedisTokenFilter tokenFilter;

    public SecurityConfig(RedisTokenFilter tokenFilter) {
        this.tokenFilter = tokenFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf().disable()
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/**").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(tokenFilter, org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
```

------

## 六、登录接口示例

```
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final RedisTokenManager tokenManager;

    public AuthController(RedisTokenManager tokenManager) {
        this.tokenManager = tokenManager;
    }

    @PostMapping("/login")
    public String login(@RequestParam String username, @RequestParam String password) {
        // TODO: 验证用户名密码
        if ("admin".equals(username) && "123456".equals(password)) {
            return tokenManager.createToken(username);
        }
        throw new RuntimeException("用户名或密码错误");
    }

    @PostMapping("/logout")
    public String logout(@RequestHeader("Authorization") String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            tokenManager.removeToken(token);
        }
        return "已登出";
    }
}
```

------

## 七、特点 & 优势

- **服务端可控**：Token 在 Redis 中，随时可删除，实现强制下线。
- **支持刷新**：每次访问可延长过期时间。
- **简单**：无需 JWT 验签或复杂加密，适合微服务或单体项目。

⚠️ **注意**：

- 微服务场景下，需要共享 Redis，或者使用统一认证中心。
- 如果需要前端安全性，可配合 **HttpOnly Cookie**。