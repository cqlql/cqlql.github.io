## 依赖相关
+ Spring Boot 提供了各种 `starter`，例如：
+ `spring-boot-starter`：基础依赖（Spring 核心、日志等）
+ `spring-boot-starter-data-jpa`：JPA + Hibernate + HikariCP
+ `spring-boot-starter-web`：Spring MVC + 内嵌 Tomcat
+ 这些 starter 会自动帮你引入兼容的版本，避免版本冲突。

一般来说只需要引入 spring-boot-starter-web、spring-boot-starter-data-jpa，这两个已经对 spring-boot-starter 进行依赖了

```plain
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

## 配置自动建表
```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: update
```

`ddl-auto` 常用值：

+ `create`：每次启动都重新建表（会清空数据）
+ `create-drop`：启动时建表，关闭时删表
+ `update`：根据实体类更新表结构
+ `validate`：只校验表结构是否匹配，不建表
+ `none`：不做任何 DDL 操作（推荐你这种情况）

## 表名区分大小写
```yaml
spring:
  jpa:
      naming: 
        # 禁用 Spring 的物理命名策略，使用 JPA 原生行为
        physical-strategy: org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl
        # 完全禁用 Spring 命名策略自动转换
        # physical-strategy: false
```

## 生命周期钩子
### 启动钩子： CommandLineRunner 或 ApplicationRunner  
 Spring Boot 应用启动完成后执行  

**CommandLineRunner 示例：**

```java
@Component
public class MyCommandLineRunner implements CommandLineRunner {
    @Override
    public void run(String... args) {
        System.out.println("CommandLineRunner 启动完成！");
        System.out.println("参数：" + Arrays.toString(args));
    }
}
```

**ApplicationRunner 示例：**

```java
@Component
public class MyApplicationRunner implements ApplicationRunner {
    @Override
    public void run(ApplicationArguments args) {
        System.out.println("ApplicationRunner 启动完成！");
        System.out.println("选项参数：" + args.getOptionNames());
    }
}
```

## application.yml
### 同时指定多个 profile，将合并
```yaml
spring:
  profiles:
    active: dev,test
```

 这样会依次加载 `application-dev.yml` 和 `application-test.yml`，后者覆盖前者的同名配置。  

### SPRING_PROFILES_ACTIVE 优先级更高
`SPRING_PROFILES_ACTIVE` 环境变量将覆盖`application.yml`** **中的 `spring.profiles.active`  设置

```bash
export SPRING_PROFILES_ACTIVE=prod
```

命令行参数（`--spring.profiles.active=xxx` ）优先级最高

### 生产环境
开发环境就用 application.yml 即可，生产环境再建一个 application-prod.yml 进行覆盖，这个 prod 文件不提交 git

## Lombok  简化实体模型
减少样板代码（boilerplate）  

常见用法：

+ `@Getter` / `@Setter`：生成 getter/setter。
+ `@Data`：包含 `@Getter`、`@Setter`、`@ToString`、`@EqualsAndHashCode`。
+ `@Builder`：生成构造器链式写法。
+ `@NoArgsConstructor` / `@AllArgsConstructor`：生成构造器。
+ `@Value`：不可变对象（字段 final）。

```java
package com.cql.javademo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

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



