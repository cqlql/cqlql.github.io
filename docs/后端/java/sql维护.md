# sql 维护

> [!WARNING]
>
> **生产环境：用 SQL 建表**
> **开发 / 本地环境：可以让 JPA 生成表**

目前 **Java 后端最主流、最安全**的做法

> **数据库结构 = SQL 文件**
>  **版本演进 = Flyway / Liquibase**
>  **JPA = 只做映射 + 校验**

### 方式一（推荐）：Flyway

#### 目录结构（Spring Boot）

```
src/main/resources/db/migration/
├── V1__init_schema.sql
├── V2__create_user_role_permission.sql
├── V3__add_indexes.sql
└── V4__alter_user_add_status.sql
```

#### 命名规则

```
V{版本号}__{描述}.sql
```

Flyway 会：

- 按版本顺序执行
- 自动记录执行历史
- 防止重复执行

### 方式二：Liquibase（偏企业）

- 支持 XML / YAML / SQL
- 规则更严格
- 学习成本略高

👉 **中小团队优先 Flyway**