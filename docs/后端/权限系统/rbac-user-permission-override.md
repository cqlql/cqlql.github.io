# RBAC + 用户权限覆盖设计

## 1. 设计目标
- 避免角色爆炸
- 支持用户级特殊授权
- 权限可审计、可回溯

## 2. 表结构
- user
- role
- permission
- user_role
- role_permission
- user_permission (GRANT / DENY)

## 3. PermissionEffect 设计
- GRANT
- DENY
- EnumType.STRING 原因

## 4. 权限计算规则
DENY > GRANT > ROLE > NONE

## 5. 示例数据
1️⃣ permission（权限表）

| id   | code           | name     |
| ---- | -------------- | -------- |
| 1    | article:read   | 查看文章 |
| 2    | article:edit   | 编辑文章 |
| 3    | article:delete | 删除文章 |
| 4    | user:manage    | 用户管理 |

2️⃣ role（角色表）

| id   | code   | name   |
| ---- | ------ | ------ |
| 1    | editor | 编辑   |
| 2    | admin  | 管理员 |

3️⃣ role_permission（角色默认权限）

| role_id | permission_id |
| ------- | ------------- |
| 1       | 1             |
| 1       | 2             |
| 2       | 1             |
| 2       | 2             |
| 2       | 3             |
| 2       | 4             |

4️⃣ user

| id   | username |
| ---- | -------- |
| 100  | alice    |
| 101  | bob      |
| 102  | carol    |

------

5️⃣ user_role

| user_id | role_id |
| ------- | ------- |
| 100     | 1       |
| 101     | 2       |
| 102     | 1       |

------

6⃣user_permission（用户自定义覆盖）

```
effect 只有两种：GRANT / DENY
```

| user_id | permission_id | effect |
| ------- | ------------- | ------ |
| 100     | 3             | GRANT  |
| 101     | 3             | DENY   |
| 102     | 2             | DENY   |
| 102     | 4             | GRANT  |

## 6. 接口返回结构

👉 返回 Map（前端性能更好）

```json
{
  "permissions": {
    "article:read": {
      "allowed": true,
      "source": "ROLE"
    },
    "article:edit": {
      "allowed": false,
      "source": "USER"
    }
  }
}
```

## 7. 前端使用方式
```js
permissions['article:edit']?.allowed
```

## 8. 常见误区
- 不使用 ORDINAL
- 不在 User 表塞 permission_ids

## 9. 扩展点
- 临时权限
- 多租户