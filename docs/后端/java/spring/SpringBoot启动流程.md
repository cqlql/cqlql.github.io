---
title: Spring Boot 启动流程
icon: mdi:rocket-launch
---

# Spring Boot 启动流程

## 1️⃣ `@Component`

- **类型**：Spring Bean 的一种
- **语义**：通用组件 Bean，通常用于工具类或初始化逻辑
- **特点**：
  - Spring Boot 启动时会自动创建它的实例（默认是单例）
  - 可以被依赖注入到其他 Bean 中

**示例**：

```java
@Component
public class MyUtil {
    public void doSomething() { ... }
}
```

------

## 2️⃣ `CommandLineRunner`

- **作用**：在 Spring Boot 应用启动完成后执行逻辑
- **使用场景**：
  - 初始化操作
  - 创建默认管理员账户
  - 数据预处理或加载
- **使用方式**：
  1. 创建一个类实现 `CommandLineRunner`
  2. 实现 `run(String... args)` 方法
  3. 将类标记为 `@Component`

**示例**：

```java
@Component
public class AdminAccountInitializer implements CommandLineRunner {
    @Override
    public void run(String... args) {
        // 启动完成后执行的初始化逻辑
        initAdminAccount();
    }
}
```

- **执行顺序**：应用启动完成 → Spring 容器初始化所有 Bean → 调用 `run` 方法