# Bean管理与注入（Dependency Injection）

## @Component（及其派生）

### 作用域（默认单例）

- **单例（默认）：** `@Scope("singleton")`
- **多例（原型）：** `@Scope("prototype")` —— 每次请求都会创建一个新的实例。

```java
@Component
@Scope("prototype")
public class MyService {
    // 每次被注入时都是新对象
}
```

#### 常见的五种作用域

虽然单例是核心，但在 Web 环境中，Spring 还提供了其他几种作用域：

| **作用域**      | **说明**                                      |
| --------------- | --------------------------------------------- |
| **Singleton**   | (默认) 每个容器只有一个实例。                 |
| **Prototype**   | 每次获取都会创建一个新实例。                  |
| **Request**     | 每个 HTTP 请求创建一个实例（仅限 Web 环境）。 |
| **Session**     | 每个 HTTP 会话创建一个实例（仅限 Web 环境）。 |
| **Application** | 每个 ServletContext 创建一个实例。            |

### 其他派生

**派生注解**（本质就是 **语义化的 `@Component`**）

| 注解              | 典型用途                                 |
| ----------------- | ---------------------------------------- |
| `@Service`        | 业务逻辑层                               |
| `@Repository`     | DAO / 持久层（含异常转换）               |
| `@Controller`     | MVC Controller                           |
| `@RestController` | REST 接口（= Controller + ResponseBody） |

📌 **本质完全一样，只是语义不同**







## ==旧，待整理===================

---

## 一、Bean 注册相关（“谁能被注入”）

### @Component（及其派生）

```
@Component
public class TokenAuthenticationFilter {}
```

**作用**：把类注册为 Spring Bean

**派生注解**（本质就是 **语义化的 `@Component`**）

| 注解              | 典型用途                                 |
| ----------------- | ---------------------------------------- |
| `@Service`        | 业务逻辑层                               |
| `@Repository`     | DAO / 持久层（含异常转换）               |
| `@Controller`     | MVC Controller                           |
| `@RestController` | REST 接口（= Controller + ResponseBody） |

📌 **本质完全一样，只是语义不同**

---

### @Bean（方法级）

```
@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate() {
        return new RedisTemplate<>();
    }
}
```

**作用**：把方法返回值注册为 Bean
**Bean 名称**：默认是 **方法名**

📌 常用于：

- 第三方类
- 框架组件（Redis / MQ / SDK）

---

## 二、依赖注入相关（“怎么注入”）

---

### @Autowired ⭐（Spring 推荐）

```
@Autowired
private RedisTemplate<String, Object> redisTemplate;
```

**规则**：

- **先按类型（type）**
- 再按名字（name）

**特点**：

- Spring 注解
- 可选注入：

```
@Autowired(required = false)
private XxxService service;
```

📌 **最常用**

---

### @Resource ⭐（Java 标准）

```
@Resource
private RedisTemplate<String, Object> redisTemplate;
```

**规则（重点记这个）**：
1️⃣ **先按 name（字段名）**
2️⃣ 再按 type

等价于：

```
@Resource(name = "redisTemplate")
```

📌 适合：

- Bean 名称明确
- 老项目 / JSR-250 风格

⚠️ 不支持 `required=false`

---

### @Qualifier（指定 Bean）

```
@Autowired
@Qualifier("redisTemplate")
private RedisTemplate<String, Object> redisTemplate;
```

**作用**：
👉 当 **同类型 Bean 多个** 时，指定注入哪一个

📌 常和 `@Autowired` 搭配使用

---

## 三、构造器注入（⭐ 强烈推荐）

📌 **Spring 官方推荐方式**

### 普通方式

> **单构造器 = 默认 @Autowired**
>  **多构造器 = 必须显式 @Autowired**

```java
@Component
public class SomeConfig {
    private final RedisTokenFilter redisTokenFilter;

    public SomeConfig(RedisTokenFilter redisTokenFilter) {
        this.redisTokenFilter = redisTokenFilter;
    }
}
```

### @RequiredArgsConstructor（Lombok）

只会处理 final 字段，如果有多个，按声明循序

```java
@RequiredArgsConstructor
@Component
public class SomeConfig {
    private final RedisTokenFilter redisTokenFilter;
}
```

### 优点（面试加分）

- 强制依赖（不会注入 null）
- 线程安全

  > - 请求 A 进来 → 设置 `currentUser = A`
  > - 请求 B 同时进来 → 设置 `currentUser = B`
  > - 请求 A 后续代码 → 用的是 B ❌

- 更好测试
- 避免字段注入的隐藏问题
  > 依赖数量无法被 IDE / 编译器强制检查
  >
  > 纵容依赖膨胀：无法看出是不是管太多依赖了
  >
  > 框架绑死：必须依赖 Spring 才能工作

---

## 四、常见组合对照表（速记）

| 场景         | 推荐写法                     |
| ------------ | ---------------------------- |
| 单一 Bean    | 构造器注入                   |
| 多实现类     | `@Autowired + @Qualifier`    |
| 明确 Bean 名 | `@Resource(name="xxx")`      |
| 可选依赖     | `@Autowired(required=false)` |
| 第三方组件   | `@Configuration + @Bean`     |

---

## 五、常见坑 ⚠️

### ❌ 同类型多个 Bean + @Autowired

```
@Autowired
private RedisTemplate redisTemplate;
```

❌ 报错：`NoUniqueBeanDefinitionException`

✅ 解决：

```
@Qualifier("redisTemplate")
```

---

### ❌ @Resource 字段名和 Bean 名不一致

```
@Resource
private RedisTemplate myRedisTemplate;
```

❌ 找不到 Bean
✅ 改成：

```
@Resource(name = "redisTemplate")
```

---

## 六、一句话记忆版（背这个就够）

> - **@Component / @Bean**：谁是 Bean
> - **@Autowired**：Spring 注入，先类型
> - **@Resource**：Java 注入，先名字
> - **@Qualifier**：多 Bean 选一个
> - **构造器注入**：最优解 ⭐

## Spring 三种注入方式对比

| 维度               | 构造器注入      | 字段注入（反射）          | Setter 注入            |
| ------------------ | --------------- | ------------------------- | ---------------------- |
| 示例               | `public A(B b)` | `@Autowired private B b;` | `@Autowired setB(B b)` |
| 是否用反射         | ❌（正常 new）   | ✅ **必须用反射**          | ❌                      |
| 是否支持 `private` | 构造器是 public | ✅ **完全支持**            | setter 必须 public     |
| 是否需要 setter    | ❌               | ❌                         | ✅                      |
| 是否支持 `final`   | ✅ **支持**      | ❌                         | ❌                      |
| 依赖是否集中       | ✅ **一眼看全**  | ❌ 分散在字段              | ❌ 分散                 |
| 单元测试友好度     | ⭐⭐⭐⭐⭐           | ⭐                         | ⭐⭐                     |
| IDE 可分析性       | ⭐⭐⭐⭐⭐           | ⭐                         | ⭐⭐                     |
| 推荐程度           | ✅ **强烈推荐**  | ⚠️ 不推荐                  | ⚠️ 较少用               |
