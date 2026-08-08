---
title: 匿名类与 Lambda
icon: mdi:lambda
---

# 匿名类与 Lambda

## Java 匿名子类（Anonymous Subclass）

### 1️⃣ 定义

**匿名子类**是 **没有名字的类**，在创建实例的同时定义类，通常用于临时继承已有类或实现抽象类/接口。

- 语法：

```
new 父类或抽象类() {
    // 重写方法
};
```

- 匿名子类本质上是 **父类的临时子类**，JVM 会为它生成一个唯一类名（如 `OuterClass$1`）。

------

### 2️⃣ 特征

| 特征               | 描述                                    |
| ------------------ | --------------------------------------- |
| **无类名**         | 类是匿名的，无法在其他地方直接复用      |
| **继承父类**       | 必须有一个现有类或抽象类作为父类        |
| **一次性实例**     | 创建对象时定义类，立即 new 出实例       |
| **可以重写方法**   | 仅对该实例有效，不影响原类              |
| **编译器生成类名** | JVM 会生成 `OuterClass$数字.class` 文件 |
| **不改变原类**     | 父类结构和行为完全保留                  |

------

### 3️⃣ 使用场景

- 一次性回调或临时处理逻辑

  ```
  new Thread() {
      @Override
      public void run() {
          System.out.println("匿名子类线程执行");
      }
  }.start();
  ```

- 临时覆盖方法（override）

- 测试或演示代码，不打算复用

**注意：**
 不适合核心业务组件（如认证 Filter），因为无法注入依赖、难以测试和维护。

------

### 4️⃣ 匿名子类 vs 普通子类 vs Lambda

| 类型     | 是否有名字 | 是否可以有多个方法 | 适用场景             |
| -------- | ---------- | ------------------ | -------------------- |
| 普通子类 | 有         | 可以               | 业务逻辑、可复用组件 |
| 匿名子类 | 无         | 可以               | 临时对象、一次性逻辑 |
| Lambda   | 无         | 只能一个抽象方法   | 函数式接口回调       |

------

### 5️⃣ 示例：Spring Security JWT Filter

```java
http.addFilterBefore(new JwtAuthenticationFilter() {
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/auth/");
    }
}, UsernamePasswordAuthenticationFilter.class);
```

解析：

- `JwtAuthenticationFilter` 是父类
- `new JwtAuthenticationFilter() { ... }` 创建了一个 **匿名子类实例**
- 只重写了 `shouldNotFilter` 方法
- 原来的 `JwtAuthenticationFilter` 类不受影响
- **缺点：** 不是 Spring Bean，不能注入依赖，维护不方便



