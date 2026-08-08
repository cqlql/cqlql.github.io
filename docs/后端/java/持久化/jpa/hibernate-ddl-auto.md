---
title: Hibernate ddl-auto 说明
icon: mdi:database-cog
---

# Hibernate ddl-auto 说明

## 作用

控制 Hibernate 是否以及如何自动管理数据库表结构
（spring.jpa.hibernate.ddl-auto）

## 可选值

| 值              | 含义                                         | 是否删除表 | 典型使用场景           |
| --------------- | -------------------------------------------- | ---------- | ---------------------- |
| **none**        | 不做任何事（完全交给你）                     | ❌         | **生产环境（最安全）** |
| **validate**    | 校验表结构是否和实体一致，不一致直接启动失败 | ❌         | 生产 / 测试            |
| **update**      | 根据实体**增量更新**表结构                   | ❌         | 本地开发               |
| **create**      | 启动时删除表再重新创建                       | ✅         | 临时测试               |
| **create-drop** | 启动创建，关闭时删除                         | ✅         | 单元测试               |

## 风险说明

- update 不会删除字段
- create / create-drop 生产禁用

## 与 Flyway 的关系

- Flyway 管 schema
- JPA 只做 validate

## 推荐配置

| 环境     | ddl-auto   | 是否自动建表 | 是否安全 | 说明             |
| -------- | ---------- | ------------ | -------- | ---------------- |
| **dev**  | `update`   | ✅           | ⚠️       | 提高开发效率     |
| **test** | `validate` | ❌           | ✅       | 验证实体与表一致 |
| **prod** | `none`     | ❌           | ✅✅     | 完全交给迁移工具 |

> ⚠️ **生产环境禁止 `update / create / create-drop`**
