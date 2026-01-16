


# flyway-jpa-实体映射

```java
package com.example.javademo.modules.user.entity;

import com.example.javademo.common.entity.BaseEntity;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Schema(description = "用户实体")
@Entity
@Getter
@Setter
@Table(name = "User")
public class User extends BaseEntity {

    @Column(name = "UserName", nullable = false, columnDefinition = "longtext")
    private String userName;

    @Column(name = "Password", nullable = false, columnDefinition = "longtext")
    private String password;

    @Column(name = "Name", columnDefinition = "longtext")
    private String name;

    @Schema(description = "昵称", example = "Tom")
    @Column(name = "Nickname", columnDefinition = "longtext")
    private String nickname;

    @Column(name = "Perm", nullable = false)
    private Integer perm;
}
```

## 1️⃣ `@Column(columnDefinition)`

- **作用**：直接告诉数据库使用什么字段类型（原生 SQL 片段）
- **注意事项**：
  - 不是跨数据库的，写死数据库类型 → 切换方言 / 数据库迁移会报错
  - 只在 Hibernate 自动建表时有意义
- **实践建议**：
  - **一般不设置**
  - 对于 Flyway 项目，由 Flyway SQL 决定类型即可

------

## 2️⃣ `@Column(length)`

- **作用**：
  - Hibernate 生成 DDL 时用来指定字段长度
  - **不会在运行时校验**
- **运行时验证**：
  - 需要用 Bean Validation 注解 `@Size(max=…)`
- **实践建议**：
  - Flyway 管理数据库结构时，**Entity 中不需要写 length**
  - 运行时校验用 `@Size`

------

## 3️⃣ `@Table(name)`

- **作用**：指定实体对应数据库表名

- **默认行为**：

  - Hibernate 默认策略会将大写类名 → 小写
  - 驼峰字段名 → 下划线
  - 例如：`UserName` → `user_name`

- **注意事项**：

  - 如果表名与类名一致 → **可以省略**
  - 如果表名是关键字或大小写敏感 → **建议写**

- **可选配置**：

  ```
  spring:
    jpa:
      hibernate:
        naming:
          physical-strategy: org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl
  ```

  - 设置后 Hibernate 不做任何转换
  - Flyway 严格建表的场景更安全

------

## 4️⃣ 总体实践原则（Flyway + JPA）

1. **数据库结构**：Flyway 负责建表/字段类型/长度
2. **实体映射**：
   - `@Column(nullable = false)` → 表达非空语义
   - `@Size(max=…)` → 运行时校验
   - `length / columnDefinition` → 一般不用
   - `@Table(name=…)` → 仅在关键字、大小写敏感或命名不一致时写
3. **Hibernate ddl-auto**：
   - `validate` → 只校验，不建表
   - 避免 Hibernate 与 Flyway 冲突

------

💡 **核心理念**：

> Flyway 管理数据库结构，JPA 只做对象映射与语义表达；避免重复定义，减少跨数据库兼容问题。

------
