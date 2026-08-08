---
title: Optional 容器
icon: mdi:shield-half-full
---

# Optional 容器

`Optional` 是在 Java 8 中引入的一个容器对象，它的核心目的是为了**更优雅地处理 `null` 值**，减少代码中随处可见的 `if (obj != null)` 判断，从而避免恼人的 `NullPointerException` (NPE)。

## 传统 vs Optional

假设我们要获取一个用户的街道名称，路径是：`User -> Address -> Street`。

**传统写法（深层嵌套）：**

```java
String street = "Unknown";
if (user != null) {
    Address addr = user.getAddress();
    if (addr != null) {
        street = addr.getStreet();
    }
}
```

**Optional 写法（线性流式）：**

```java
String street = Optional.ofNullable(user)
    .map(User::getAddress)
    .map(Address::getStreet)
    .orElse("Unknown");
```

## Optional 的创建方式

### 1 `Optional.of()`

值 **必须不为 null**

```
Optional<String> opt = Optional.of("hello");
```

如果是 `null`：

```
Optional.of(null); // 抛异常
```

抛出 `NullPointerException`

------

### 2 `Optional.ofNullable()`（最常用）

允许 `null`

```
Optional<String> opt = Optional.ofNullable(value);
```

如果 `value == null`

返回

```
Optional.empty()
```

------

### 3 `Optional.empty()`

创建一个空 Optional

```
Optional<String> opt = Optional.empty();
```

## 常用 API

### 判断是否存在

```
optional.isPresent()
```

但 **不推荐**，因为又回到了 `if != null` 的写法。

------

### ifPresent

存在才执行

```
optional.ifPresent(v -> {
    System.out.println(v);
});
```

------

### orElse

为空则返回默认值

```
String name = optional.orElse("default");
```

注意：**默认值会提前计算**

------

### orElseGet（推荐）

```
String name = optional.orElseGet(() -> getDefaultName());
```

只有为空才执行函数。

------

### orElseThrow

为空则抛异常

```
User user = optional.orElseThrow(() -> new RuntimeException("用户不存在"));
```

在 **业务代码里非常常见**。

------

### map（最核心）

对值进行转换

```
Optional<String> name =
    optional.map(User::getName);
```

相当于：

```
如果存在 -> 转换
如果为空 -> 继续为空
```

------

### flatMap 避免无限套娃

核心逻辑：Map vs. FlatMap

- **`map`**：对集合中的每个元素进行转换，返回的是**转换后的值**。
- **`flatMap`**：对每个元素进行转换，要求转换后的结果**本身就是一个容器**（比如另一个 Stream、Optional 或 Mono），然后它会把这些内部容器“拆开”，将里面的元素取出来合并成一个新的流。

```java
var Optional<User> = userAuthRepository
  .findByAuthTypeAndIdentifier(UserAuthType.WECHAT_MINIAPP, openId)
  .map(UserAuth::getUserId).flatMap(userRepository::findById);
```

为什么这里必须用 flatMap？

因为 `userRepository.findById` 的返回值类型通常是 `Optional<User>` 或 `Mono<User>`。

- 如果用 `map`：结果是 `Optional<Optional<User>>`
- 如果用 `flatMap`：结果是 `Optional<User>`

------

### filter

条件过滤

```
optional
    .filter(user -> user.getAge() > 18)
```

不满足条件 → 变为空。

## Optional 的设计思想

`Optional` 本质是 **函数式编程思想在 Java 的体现**。

类似：

- **Scala 的 `Option`**
- **Kotlin 的 `?` 可空类型**

例如 Kotlin：

```
user?.address?.city
```

Java Optional 就是模拟这个能力。

## 一个 Spring Boot 项目最佳实践

典型 Service 写法：

```
public User getUser(Long id) {
    return userRepository.findById(id)
            .orElseThrow(() -> new BusinessException("用户不存在"));
}
```

## 避免副作用操作

### ✔ Optional / Stream 适合：

- map（转换）
- filter（筛选）
- collect（聚合）

👉 **纯数据流**

```
订单 → 过滤 → 转换 → 统计
```

👉 像流水线

------

### ❌ 不适合：

- delete（删 Redis）
- save（写 DB）
- send（发消息）
- log（打日志）

👉 **有副作用的操作**

```
订单 → 过滤 → 🚨顺便扣库存 → 转换
```

👉 这就很危险了

### 🚨 为什么不推荐这样做？

#### 1️⃣ 可读性差（最核心）

函数式链本来是干嘛的？

👉 **描述数据如何“流动和转换”**

但你现在变成：

👉 “顺便删个 Redis”

读代码的人会懵：

> ❓ 这是在做数据处理，还是在删数据？

#### 2️⃣ 容易写出 bug

- 链太长
- 没有明显的控制流（if）

#### 3️⃣ Debug 困难

如果 delete 没执行：

- 是 null？
- 是 filter 没过？
- 是 map 出错？

👉 你得一段一段打断点

而 if 写法：

```
if (accessJti != null) {
    ...
}
```

👉 一眼就知道问题在哪

#### 4️⃣ 副作用不应该“隐藏”

好的代码原则：

> 👉 “副作用要显式表达”

也就是说：

```
if (...) {
    redisTemplate.delete(...); // ✅ 一眼看出：这里有副作用
}
```

而不是：

```
.ifPresent(redisTemplate::delete); // ❌ 藏起来了
```

### ✅ 一句话总结

> 👉 “有副作用的逻辑 = 会改变外部状态的操作，这种逻辑应该用明确的控制流（if/try），而不是藏在函数式链里。”