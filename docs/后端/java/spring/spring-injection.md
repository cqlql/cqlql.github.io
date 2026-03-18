

# Spring 注入

## 字段注入 (@Value / @Autowired)
- 简单，但不可变字段不支持 final
- 单元测试需要手动注入

## 构造器注入
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

**特点：**

1. 使用构造器注入，`secret` 在对象创建时就有值。
2. `key` 可以直接在构造器里初始化。
3. 字段可以 `final`，保证不可变，线程安全性更好。
4. 测试更方便，可以直接 `new JwtUtil("mysecret")`。

**优点：**

- 推荐的现代 Spring 写法（构造器注入 > 字段注入）。
- 可测试性好，不依赖 Spring 容器。
- 字段可以声明为 `final`，更安全。

**缺点：**

- 如果 bean 很多，构造器参数会略显繁琐，但只注入一个 `String` 很轻量。

## @PostConstruct 
```java
import jakarta.annotation.PostConstruct;

@Component
public class JwtUtil {

   @Value("${jwt.secret}")
   private String secret;

   private SecretKey key;

   @PostConstruct
   public void init() {
       this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
   }

   public String generateAccessToken(String userId) { ... }
}
```

**特点：**

1. `@Value` 字段注入 → Spring 会先创建实例，然后注入 `secret`。
2. `@PostConstruct` 在依赖注入完成后调用，保证 `secret` 不为 `null`。
3. 可以使用默认无参构造（Spring 容器创建更方便）。
4. 稍微依赖容器的生命周期，测试时如果直接 new `JwtUtil()`，`secret` 会为 `null`，必须手动调用 `init()` 或用反射/Setter 注入。

**优点：**

- 简单，Spring 容器里工作正常。
- 容器管理 bean 的生命周期时不会报 `null`。

**缺点：**

- 对于单元测试不太友好，需要额外注入或调用 `init()`。
- 字段注入被认为是 **不太推荐的做法**（Spring 官方文档推荐构造器注入）。

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

