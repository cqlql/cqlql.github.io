---
title: Spring 中要不要自己 new
icon: mdi:help-circle
---

# Spring 中「要不要自己 `new`」

## 一、核心结论

> **Spring 项目里：只要一个类“需要依赖别人”，就不要自己 `new`。**

## 二、为什么不能随便 `new`（本质原因）

### 1️⃣ `new` = 把对象踢出 Spring 容器

```
new Xxx()
```

意味着：

- ❌ Spring 不知道它的存在
- ❌ 不会给它注入依赖
- ❌ 不参与生命周期管理
- ❌ AOP / 事务 / 条件装配全部失效

👉 这是一个 **“容器外对象”**

------

### 2️⃣ 依赖一旦存在，就必须交给容器

```
public class A {
    private final B b;
}
```

这里的 **`B`** 说明了一件事：

> **A 的存在依赖 B 的正确创建**

而 Spring 的职责正是：

- 保证 B 先创建
- 保证 B 是正确版本
- 保证 B 可替换、可 mock、可增强

👉 自己 `new` = 你在抢 Spring 的工作

------

## 三、判断是否可以 `new`（最实用部分）

### ✅ 可以自己 `new` 的对象（放心用）

满足以下 **全部特征**：

- 无依赖（不需要 Service / Repository / Bean）
- 无状态（不持有资源）
- 生命周期短
- 不需要 AOP / 事务 / 注入

#### 常见例子：

```
new ArrayList<>();
new HashMap<>();
new UserDTO();
new BigDecimal("100");
new JwtPayload(...);
```

👉 **工具型 / 数据型 / 临时对象**

------

### ❌ 不该自己 `new` 的对象（高危区）

只要命中 **任意一条**：

- 需要注入别的类
- 需要被 Spring 管理
- 需要配置 / Profile / 条件
- 是“业务角色”

#### 高危清单（重点）：

- Controller
- Service
- Repository
- Filter / Interceptor
- Listener
- Scheduler
- Manager / Handler

👉 **统统交给 Spring**

------

## 四、Spring 中的三种“正确出生方式”

### ✅ 方式一：`@Component`（最常用）

```
@Component
public class JwtAuthenticationFilter {

    private final TokenService tokenService;

    public JwtAuthenticationFilter(TokenService tokenService) {
        this.tokenService = tokenService;
    }
}
```

特点：

- 自动扫描
- 构造器注入
- 强烈推荐 ⭐⭐⭐⭐⭐

------

### ✅ 方式二：`@Bean`（配置型）

```
@Configuration
public class SecurityConfig {

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter(TokenService tokenService) {
        return new JwtAuthenticationFilter(tokenService);
    }
}
```

特点：

- 创建逻辑集中
- 适合第三方类 / 不想加注解的类

------

### ❌ 方式三：`new Xxx()`（仅限无依赖）

```
new JwtAuthenticationFilter(); // ❌ 只适合完全无依赖的情况
```

------

## 五、一个非常好用的自检问题 🧠

在写 `new Xxx()` 之前，问自己一句：

> **“如果我明天要给这个类加一个 Service 依赖，会不会后悔？”**

- 会 → **现在就别 new**
- 不会 → 可以 new

------

## 六、和 Spring Security 强相关的特别提醒 🔐

### ❌ 错误写法

```
.addFilterBefore(new JwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);
```

问题：

- Filter 不在容器
- 无法注入 TokenService / Redis / UserService

------

### ✅ 正确写法

```
.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
```

Filter 本身是 Bean，由 Spring 管理。

------

## 七、终极记忆口诀（强烈推荐）

> **“谁依赖别人，谁就没资格自己出生。”**