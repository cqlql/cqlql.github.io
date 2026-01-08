# SQL 术语与概念

## SQL 语言分类（DDL、DML、DQL、DCL、TCL）

**SQL 被人为分成了几大“子语言”**，方便区分“你在干什么”：

| 分类    | 全称                         | 干什么                     |
| ------- | ---------------------------- | -------------------------- |
| **DDL** | Data Definition Language     | 定义结构（表、字段、索引） |
| **DML** | Data Manipulation Language   | 操作数据（增删改）         |
| **DQL** | Data Query Language          | 查询数据                   |
| **DCL** | Data Control Language        | 权限控制                   |
| **TCL** | Transaction Control Language | 事务控制                   |

## 多对多（Many-to-Many）

> 表 A 的一条记录，可以关联表 B 的多条记录
> 表 B 的一条记录，也可以关联表 A 的多条记录

**典型例子**

- 用户 ↔ 权限
- 用户 ↔ 角色
- 学生 ↔ 课程
- 文章 ↔ 标签

以 **用户-权限** 为例：

- 一个用户：可以有多个权限
- 一个权限：可以分配给多个用户