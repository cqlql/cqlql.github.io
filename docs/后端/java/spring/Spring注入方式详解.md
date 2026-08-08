
---
title: Spring 注入方式详解
icon: mdi:injection
---

# Spring 注入方式详解

> 本文侧重于注入方式的代码示例和对比，Bean 注册相关概念见 [Bean管理与注入](./Bean管理与注入.md)，配置注入见 [配置注入](./配置注入.md)。

## 构造器注入（推荐）

```java
@Component
public class JwtUtil {

    private final String secret;
    private final SecretKey key;

    public JwtUtil(@Value("${jwt.secret}") String secret) {
        this.secret = secret;
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
}
```

- 字段可以 `final`，保证不可变
- 测试方便，可直接 `new JwtUtil("mysecret")`
- Spring 官方推荐方式

## @PostConstruct 方式

```java
@Component
public class JwtUtil {

   @Value("${jwt.secret}")
   private String secret;

   private SecretKey key;

   @PostConstruct
   public void init() {
       this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
   }
}
```

- 简单但测试不友好
- 字段注入不推荐

## 注入静态变量

```java
@Component
public class Config {

    public static String API_APP_ID;

    @Value("${doubao.realtime.api-app-id}")
    public void setApiAppId(String value) {
        API_APP_ID = value;
    }
}
```

> ⚠️ 能跑但属于反模式，不推荐。

