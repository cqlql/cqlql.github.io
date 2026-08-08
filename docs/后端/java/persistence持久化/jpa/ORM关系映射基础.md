---
title: ORM 基础
icon: mdi:relation-many-to-many
---

# ORM 基础

### @ManyToOne

多对一关系：**多条当前表记录**对应**一条目标表记录**

如果数据库已有外键关系，但实体中没有加 `@ManyToOne` 注解，则该字段只能作为普通属性处理：

- 无法通过 `up.getUser()` 直接获取关联对象
- JPQL 的 join 查询无法使用
- 级联操作（Cascade）不会生效

