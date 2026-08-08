---
title: JOIN 查询
---

JOIN 就是把两张表"按某个条件拼成一张临时大表"。

## 基本语法

```sql
FROM 表A
JOIN 表B ON 表A.字段 = 表B.字段
```

> 只有当 ON 条件成立时，A 和 B 的这两行才会被拼在一起。

## JOIN 类型

### INNER JOIN（内连接）

只返回两表中**匹配的行**，不匹配的不返回。

```sql
SELECT u.name, o.order_no
FROM user u
INNER JOIN `order` o ON u.id = o.user_id;
```

### LEFT JOIN（左连接）

**左表所有行都返回**，右表无匹配时填 `NULL`。

```sql
SELECT u.name, o.order_no
FROM user u
LEFT JOIN `order` o ON u.id = o.user_id;
-- 没有订单的用户也会出现，order_no 为 NULL
```

### RIGHT JOIN（右连接）

**右表所有行都返回**，左表无匹配时填 `NULL`。实际开发中用得较少，通常用 LEFT JOIN 互换表顺序替代。

### CROSS JOIN（交叉连接）

两表的**笛卡尔积**，不加 ON 条件时返回所有组合。

```sql
SELECT *
FROM user
CROSS JOIN `order`;
-- user 10 行 × order 20 行 = 200 行结果
```

## 对比总结

| JOIN 类型  | 特点                                |
| ---------- | ----------------------------------- |
| INNER JOIN | 只返回两表匹配的行                  |
| LEFT JOIN  | 左表所有行都返回，右表无匹配填 NULL |
| RIGHT JOIN | 右表所有行都返回，左表无匹配填 NULL |
| CROSS JOIN | 笛卡尔积，不常用                    |

## 多表 JOIN

```sql
SELECT u.name, o.order_no, p.product_name
FROM user u
JOIN `order` o ON u.id = o.user_id
JOIN product p ON o.product_id = p.id;
```

执行逻辑：先 JOIN 前两张表得到临时结果，再拿临时结果 JOIN 第三张表。

## 实战：权限查询

一个典型的权限系统查询，用 UNION 合并角色权限和用户级权限：

```sql
-- 角色权限
SELECT DISTINCT p.*, 'ALLOW' AS effect, 'role' AS source
FROM permission p
JOIN role_permission rp ON p.id = rp.permission_id
JOIN user_role ur ON rp.role_id = ur.role_id
WHERE ur.user_id = 2

UNION

-- 用户级权限
SELECT DISTINCT p.*, up.effect, 'user' AS source
FROM permission p
JOIN user_permission up ON p.id = up.permission_id
WHERE up.user_id = 2;
```

使用 LEFT JOIN + COALESCE 的另一种写法（优先级：用户级 > 角色级）：

```sql
SELECT p.id, COALESCE(up.effect, 1) AS final_effect
FROM permission p
JOIN role_permission rp ON rp.permission_id = p.id
JOIN user_role ur ON rp.role_id = ur.role_id
LEFT JOIN user_permission up ON up.permission_id = p.id AND up.user_id = :userId
WHERE ur.user_id = :userId;
```

对应的 Java 端合并逻辑：

```java
Map<Long, PermissionEffect> result = new HashMap<>();

for (PermissionRow row : rows) {
    result.merge(
        row.getPermissionId(),
        row.getEffect(),
        (a, b) -> a == PermissionEffect.DENY || b == PermissionEffect.DENY
                ? PermissionEffect.DENY
                : PermissionEffect.ALLOW
    );
}
```

```java
List<Permission> finalPermissions = effectMap.entrySet().stream()
    .filter(e -> permissionMap.containsKey(e.getKey()))
    .filter(e -> e.getValue() == PermissionEffect.ALLOW)
    .map(e -> permissionMap.get(e.getKey()))
    .toList();
```
