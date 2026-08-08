---
title: Spring Boot 核心概念速查
icon: devicon:spring
---

# Spring Boot 核心概念速查

## Starter 依赖关系

一般来说只需要引入 `spring-boot-starter-web`、`spring-boot-starter-data-jpa`，它们已包含 `spring-boot-starter`：

```
spring-boot-starter-web
 ├── spring-boot-starter
 │    ├── spring-boot
 │    ├── spring-boot-autoconfigure
 │    └── spring-boot-starter-logging (logback)
 ├── spring-web
 ├── spring-webmvc
 ├── jackson-databind (JSON)
 ├── spring-boot-starter-tomcat (默认内嵌容器)
 └── spring-boot-starter-validation (校验)
```

## Lombok 简化实体模型

常见用法：

- `@Getter` / `@Setter`：生成 getter/setter
- `@Data`：包含 `@Getter`、`@Setter`、`@ToString`、`@EqualsAndHashCode`
- `@Builder`：生成构造器链式写法
- `@NoArgsConstructor` / `@AllArgsConstructor`：生成构造器
- `@Value`：不可变对象（字段 final）

```java
@MappedSuperclass
@Getter
@Setter
public abstract class AbstractEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
```

## 生命周期钩子

### CommandLineRunner

Spring Boot 启动完成后执行：

```java
@Component
public class MyCommandLineRunner implements CommandLineRunner {
    @Override
    public void run(String... args) {
        System.out.println("CommandLineRunner 启动完成！");
    }
}
```

### ApplicationRunner

```java
@Component
public class MyApplicationRunner implements ApplicationRunner {
    @Override
    public void run(ApplicationArguments args) {
        System.out.println("ApplicationRunner 启动完成！");
    }
}
```

## application.yml 多 Profile

### 同时指定多个 profile

```yaml
spring:
  profiles:
    active: dev,test
```

会依次加载 `application-dev.yml` 和 `application-test.yml`，后者覆盖前者。

### 优先级

`SPRING_PROFILES_ACTIVE` 环境变量 > `application.yml` 中的 `spring.profiles.active`

命令行参数 `--spring.profiles.active=xxx` 优先级最高。

### 生产环境实践

- 开发环境：`application.yml`
- 生产环境：`application-prod.yml`（不提交 git）
