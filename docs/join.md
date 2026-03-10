

JOIN 就是把两张表“按某个条件拼成一张临时大表”



## JOIN 的基本语法

```
FROM 表A
JOIN 表B ON 表A.字段 = 表B.字段
```

这句话的含义是：

> **只有当 ON 条件成立时，A 和 B 的这两行才会被拼在一起**


联合查询

```sql
SELECT DISTINCT p.*, 'ALLOW' AS effect, 'role' AS source
FROM permission p
JOIN role_permission rp ON p.id = rp.permission_id
JOIN user_role ur ON rp.role_id = ur.role_id
WHERE ur.user_id = 2

UNION

SELECT DISTINCT p.* ,up.effect, 'user' AS source
FROM permission p
JOIN user_permission up ON p.id = up.permission_id
WHERE up.user_id = 2
```





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
    .filter(e -> permissionMap.containsKey(e.getKey())) // 保证 permission 存在
    .filter(e -> e.getValue() == PermissionEffect.ALLOW)
    .map(e -> permissionMap.get(e.getKey()))
    .toList();
```

```sql
SELECT p.id, COALESCE(up.effect, 1) AS final_effect
FROM permission p
JOIN role_permission rp ON rp.permission_id = p.id
JOIN user_role ur ON rp.role_id = ur.role_id
LEFT JOIN user_permission up ON up.permission_id = p.id AND up.user_id = :userId
WHERE ur.user_id = :userId

```



## 3️⃣ LEFT JOIN vs INNER JOIN

| JOIN 类型  | 特点                                |
| ---------- | ----------------------------------- |
| INNER JOIN | 只返回两表匹配的行                  |
| LEFT JOIN  | 左表所有行都返回，右表无匹配填 NULL |