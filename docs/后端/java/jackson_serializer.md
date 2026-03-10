# Jackson2JsonRedisSerializer 对比 GenericJackson2JsonRedisSerializer

## 1️⃣ Jackson2JsonRedisSerializer

> [!WARNING]
>
> Jackson2JsonRedisSerializer 已经不建议使用，推荐 [JacksonJsonRedisSerializer（Spring Data Redis 4.0.2 API） --- JacksonJsonRedisSerializer (Spring Data Redis 4.0.2 API)](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/serializer/JacksonJsonRedisSerializer.html)

```
Jackson2JsonRedisSerializer<UserBO> serializer = new Jackson2JsonRedisSerializer<>(UserBO.class);
```

**特点：**

| 属性          | 描述                                                         |
| ------------- | ------------------------------------------------------------ |
| JSON 内容干净 | 默认不会加 `@class`，除非你启用了 `DefaultTyping`。          |
| 灵活性低      | 如果你存入不同类型的对象（Object 类型），序列化或反序列化就需要额外处理。 |

**适用场景：**

- 你希望 JSON 干净，不想看到 `@class`。

------

## 2️⃣ GenericJackson2JsonRedisSerializer

```
GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer();
```

**特点：**

| 属性            | 描述                                                         |
| --------------- | ------------------------------------------------------------ |
| 类型通用        | 可以序列化任意对象类型，value 可以是 Object。                |
| 自动加 `@class` | 序列化时会在 JSON 里加 `@class`，记录全限定类名，用于反序列化。 |
| 反序列化自动    | 读取 JSON 时会根据 `@class` 自动还原原始对象类型，无需手动指定。 |
| 灵活性高        | 适合存储多种类型的对象。                                     |
| JSON 较冗长     | 因为每个对象都带 `@class` 元信息。                           |

**适用场景：**

- Redis 存储对象类型不固定，比如一个缓存既可能存 `UserBO`，又可能存 `OrderBO`。
- 希望 **反序列化时自动回到原类型**，不用手动转换。

------

## 3️⃣ 总结对比

| 特性        | Jackson2JsonRedisSerializer | GenericJackson2JsonRedisSerializer      |
| ----------- | --------------------------- | --------------------------------------- |
| 支持类型    | 固定类型                    | 任意类型                                |
| `@class`    | 默认不生成                  | 默认生成                                |
| 反序列化    | 需要指定类型                | 自动根据 `@class`                       |
| 灵活性      | 低                          | 高                                      |
| JSON 可读性 | 高                          | 较低（多了 `@class`）                   |
| 使用场景    | 类型固定的对象              | 多类型对象，Object 类型的 RedisTemplate |

## 哪种更主流

### 1️⃣ 单一类型对象缓存（Jackson2JsonRedisSerializer）

- **大部分成熟 Spring Boot 项目** 在 **业务对象固定、缓存明确类型** 时都会用 `Jackson2JsonRedisSerializer<T>`。
- 原因：
  1. JSON 干净，没有 `@class`，可读性好。
  2. 反序列化简单，类型明确，无需手动转换。
  3. 对运维和日志友好，JSON 直观。

✅ 典型场景：用户信息缓存、商品信息缓存、配置对象缓存。

------

### 2️⃣ 多类型 / 通用缓存（GenericJackson2JsonRedisSerializer）

- **少数项目** 在 **通用缓存**、Object 类型 RedisTemplate 场景才用它。
- 原因：
  1. 自动记录 `@class`，反序列化回原类型非常方便。
  2. 适合工具库或通用缓存框架（比如缓存系统、分布式 session、通用对象存储）。
- 缺点：JSON 会带 `@class`，不够干净，可读性差。

✅ 典型场景：通用缓存框架、存任意对象、分布式 session 缓存。

### 🔹 总结主流趋势

| 场景               | 序列化器                           | 主流程度          |
| ------------------ | ---------------------------------- | ----------------- |
| 类型固定、业务缓存 | Jackson2JsonRedisSerializer        | 🌟🌟🌟🌟🌟（非常主流） |
| 通用 Object 缓存   | GenericJackson2JsonRedisSerializer | 🌟🌟（偶尔使用）    |

**结论**：

> **大多数成熟 Spring Boot 项目默认使用 Jackson2JsonRedisSerializer 来缓存业务对象**，尤其是 RedisTemplate 绑定具体类型时，这是最主流做法。
>  GenericJackson2JsonRedisSerializer 更多用于工具库或者多类型通用缓存场景。