# flyway-数据库迁移

## 一、依赖配置

在 **Spring Boot 3.5 项目**中使用 MySQL，需要引入以下依赖：

```
<!-- Flyway 核心 -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
    <version>11.20.1</version>
</dependency>

<!-- MySQL 支持模块 -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-mysql</artifactId>
    <version>11.20.1</version>
</dependency>
```

> ⚠️ 注意：Flyway 10+ 版本后，数据库支持被拆成独立模块，**必须引入 `flyway-database-mysql`**，否则会报
>  `Unsupported Database: MySQL 8.x`。

------

## 二、Spring Boot 启动时自动执行迁移

- Spring Boot 启动时，会自动检测 Flyway 依赖并执行迁移：
  1. 读取 `flyway_schema_history`（历史记录）
  2. 执行尚未执行的 SQL 脚本
  3. 记录执行结果

> ✅ 因此大部分开发场景下，**无需手动执行 Flyway 命令**。

------

## 三、常用命令（主要针对 DBA / 运维）

> 在某些环境中（不启动 Spring Boot 或自动迁移被禁用）才需要手动执行。

> 💡 注意：命令在 **项目目录下执行**，通常需要使用 `./mvnw`，且 **必须单独配置数据库连接**，与 `application.yml` 配置无关。

### 1. 执行迁移

```
./mvnw flyway:migrate
```

- 执行所有尚未执行的迁移脚本
- 更新 `flyway_schema_history` 表

------

### 2. 查看状态

```
./mvnw flyway:info
```

- 查看当前数据库版本
- 查看哪些迁移已执行、未执行

------

### 3. 校验迁移

```
./mvnw flyway:validate
```

- 校验 SQL 脚本与历史记录的 checksum 是否一致
- 用于检查迁移是否被修改过

------

## 四、补充说明

1. **Spring Boot + Flyway 的标准实践**：
   - 开发 / 测试环境：自动迁移即可
   - 生产环境：通常使用 Maven 手动执行迁移，确保可控
2. **数据库迁移顺序**：
   - **已有数据库首次接入 Flyway** → 配置 `baseline-on-migrate: true`
   - **迁移历史表**：`flyway_schema_history` 必须随数据库备份/迁移一起迁移
3. **版本兼容**：
   - Flyway 10+ 与 MySQL 8.x 或更高版本兼容
   - 核心模块 + 数据库模块必须保持版本一致

