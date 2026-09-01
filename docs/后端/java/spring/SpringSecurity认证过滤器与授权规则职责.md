---
title: Spring Security 认证过滤器与授权规则职责
icon: mdi:shield-lock-outline
---

# Spring Security 认证过滤器与授权规则职责

解决一个常见困惑：**自定义 Token 过滤器没有 `Authorization` 头时，是不是就跳过了认证？**

结论：**不是**。自定义过滤器只负责「认身份」，真正「拦请求」的是后面的授权规则。

------

## 一、核心结论

自定义 Token 认证过滤器（如 `TokenAuthenticationFilter`）是 **尽力认证（best-effort）**：

- 它**只负责**：如果带了合法 Token，就把用户身份塞进 `SecurityContext`。
- 它**从不拒绝任何请求**——无论有没有 Token、Token 是否有效，最终都会 `filterChain.doFilter()` 放行。

真正拦截请求的是 `SecurityConfig` 里的 `authorizeHttpRequests`：

```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/web/auth/**", ...).permitAll()
    .anyRequest().authenticated()   // ← 真正决定「没身份就 401」的关卡
)
```

> 一句话：**认证过滤器 = 有 Token 我就认，没 Token 我不管；`.anyRequest().authenticated()` = 没身份就挡门外。**

------

## 二、完整链路

```
请求进入
   ↓
TokenAuthenticationFilter（尽力认证）
   ├─ 有合法 Token → 写入 SecurityContext（已认证）
   ├─ 无 Token / Token 无效 → 不写 SecurityContext（保持匿名）
   └─ 无论哪种情况都放行 filterChain
   ↓
AuthorizationFilter（Spring Security 内置）
   └─ 执行 .anyRequest().authenticated()
       ├─ SecurityContext 有认证 → 放行
       └─ SecurityContext 为空 → 抛未认证异常
   ↓
ExceptionTranslationFilter 接住
   ↓
JsonAuthenticationEntryPoint → 返回 401 JSON
```

**所以不带 `Authorization` 头访问需要认证的接口，会得到 401，而不是「跳过认证直接通过」。**

------

## 三、代码形态

### 认证过滤器（只认身份，永不拦截）

```java
public void doFilter(...) {
    if (shouldSkip(httpRequest)) {
        filterChain.doFilter(request, response);   // 白名单直接放行
        return;
    }

    String authHeader = httpRequest.getHeader("Authorization");

    if (authHeader != null && authHeader.startsWith("Bearer ")) {
        String token = authHeader.substring(7);
        try {
            // 解析 + 校验 + 组装用户身份
            // 校验通过 → SecurityContextHolder.getContext().setAuthentication(...)
        } catch (Exception ex) {
            log.warn("JWT 解析失败: {}", ex.getMessage());   // 只打日志，不抛异常
        }
    }

    filterChain.doFilter(request, response);       // 无 Token 也照样放行
}
```

关键点：

- 没带 `Authorization` → 直接跳过整个 `if`，`SecurityContext` 里没有认证信息。
- 带了但 Token 无效 → 走 `catch` 只打日志，同样不留认证信息。
- 两种情况最终都 `doFilter` 放行，把「是否拒绝」交给下游。

### 授权规则（真正的关卡）

```java
.anyRequest().authenticated()
```

------

## 四、职责划分总结

| 组件                             | 职责                 | 会拒绝请求吗 |
| -------------------------------- | -------------------- | ------------ |
| `TokenAuthenticationFilter`      | 填身份（best-effort） | ❌ 永不拦截    |
| `AuthorizationFilter`            | 执行授权规则          | ✅ 会拦截      |
| `ExceptionTranslationFilter`     | 异常转 401 / 403     | ✅ 会拦截      |
| `JsonAuthenticationEntryPoint`   | 返回 401 JSON        | ✅ 输出结果    |

------

## 五、身份不填会怎样

**`TokenAuthenticationFilter` 不填身份 → `SecurityContext` 为空 → 下游 `AuthorizationFilter` 判定「未认证」→ 抛异常 → 401。**

具体链路：

1. `TokenAuthenticationFilter` 没解析出身份（无头 / 头格式不对 / Token 无效），`SecurityContextHolder` 里始终为空。
2. 它自己不会拦，照常 `doFilter` 放行。
3. 请求到达 `AuthorizationFilter`，执行 `.anyRequest().authenticated()`。
4. 在 `SecurityContext` 里找不到认证信息 → 判定「未通过 `.authenticated()`」。
5. 抛异常 → `ExceptionTranslationFilter` 接住 → `JsonAuthenticationEntryPoint` → 返回 401 JSON。

关键点：

- 判断「过不过得了」的**不是** `TokenAuthenticationFilter`，而是 `.anyRequest().authenticated()` 这条规则 + 执行它的 `AuthorizationFilter`。
- `TokenAuthenticationFilter` 只是「喂身份」的角色，它不填，后面那个关卡自然卡住请求。
- 唯一能「空身份也通过」的，是 `permitAll()` 列出的路径——那些连授权规则都不检查，跟 Token 头无关。

------

## 六、易混淆点

1. **`permitAll()` 的路径本来就故意放行**，跟是否带 `Authorization` 头无关。
2. **`shouldSkip()` 跳过的是「Token 解析」**，不是「授权检查」——跳过后仍会进入下游授权过滤器。
3. **过滤器顺序**：认证过滤器要在授权过滤器（`AuthorizationFilter`）之前执行，否则身份还没填进去就被判 401。
4. **认证失败建议只打日志、不抛异常**，把「拒绝」统一交给授权规则处理，职责更清晰。
