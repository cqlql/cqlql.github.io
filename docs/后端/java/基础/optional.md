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

### 1 判断是否存在

```
optional.isPresent()
```

但 **不推荐**，因为又回到了 `if != null` 的写法。

------

### 2 ifPresent

存在才执行

```
optional.ifPresent(v -> {
    System.out.println(v);
});
```

------

### 3 orElse

为空则返回默认值

```
String name = optional.orElse("default");
```

注意：**默认值会提前计算**

------

### 4 orElseGet（推荐）

```
String name = optional.orElseGet(() -> getDefaultName());
```

只有为空才执行函数。

------

### 5 orElseThrow

为空则抛异常

```
User user = optional.orElseThrow(() -> new RuntimeException("用户不存在"));
```

在 **业务代码里非常常见**。

------

### 6 map（最核心）

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

### 7 filter

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