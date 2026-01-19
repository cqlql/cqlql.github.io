## 关系映射注解

### @ManyToOne

多对一关系：**多条当前表记录**对应**一条目标表记录**

如果数据库已有外键关系，但实体中没有加 `@ManyToOne` 注解，则该字段只能作为普通属性处理：

- 无法通过 `up.getUser()` 直接获取关联对象
- JPQL 的 join 查询无法使用
- 级联操作（Cascade）不会生效

## 数据流与对象类型

### 数据流示意

Entity → Repository → Projection → BO / DTO → VO

### 分层职责说明

| 对象             | 层            | 作用     | 特点                       | 示例                         |
| -------------- | ------------ | ------ | ------------------------ | -------------------------- |
| **Entity**     | 持久层          | 表映射    | 全字段、JPA 注解               | `User`                     |
| **Projection** | Repository 层 | 精简查询结果 | 接口/类、无逻辑、字段子集            | `UserPermissionProjection` |
| **BO**         | 业务层          | 业务语义封装 | 聚合多个 Projection / Entity | `UserPermissionBO`         |
| **DTO**        | 接口层          | 接口返回   | 控制字段、序列化友好               | `UserPermissionDTO`        |
| **VO**         | 展示层          | 前端展示   | 格式化、组合                   | `UserPermissionVO`         |

### 数据流说明（文字版）

1. **Entity → Repository**
   - Entity 用于基础 CRUD、关系映射。
2. **Repository → Projection**
   - 对于 JOIN / 聚合 / 部分字段查询，Repository 返回 Projection 而不是 Entity。
3. **Projection → BO**
   - BO 负责业务规则（如：DENY 覆盖 ALLOW）。
4. **BO → DTO**
   - DTO 控制接口暴露字段。
5. **DTO → VO**
   - VO 面向前端显示或页面渲染。

### Projection 的典型使用场景

- 原生 SQL（`nativeQuery = true`）
- 多表 JOIN
- `SELECT` 字段 ≠ Entity 字段
- 临时拼装的数据视图

### Projection vs BO 对照表

| 维度        | Projection   | BO         |
| ----------- | ------------ | ---------- |
| 所在层      | Repository   | Service    |
| 角色        | 查询结果映射 | 业务模型   |
| 是否可变    | 否（只读）   | 视设计而定 |
| 是否含逻辑  | ❌            | ✅          |
| 与 SQL 绑定 | 强           | 弱         |
| 生命周期    | 短           | 长         |

### 推荐结构

```
permission
├─ entity （表结构）
├─ projection （查询结果）
├─ bo （业务模型）
├─ repository
├─ service
```

