## 1️⃣ JPA 原生 SQL (`nativeQuery = true`) 的特点

```
@Query(value = "SELECT DISTINCT p.* FROM permission p " +
               "JOIN role_permission rp ON p.id = rp.permission_id " +
               "JOIN user_role ur ON rp.role_id = ur.role_id " +
               "WHERE ur.user_id = :userId", nativeQuery = true)
List<Permission> findByUserId(Long userId);
```

- ✅ **可以写原生 SQL**，完全控制查询语句。
- ✅ 可以返回实体对象（`Permission`），JPA 会自动映射列到实体属性。
- ⚠️ **绑定在 JPA 实体上**：即使写 SQL，也必须依赖实体类。
- ⚠️ **跨数据库兼容性弱**：如果换数据库，可能需要改 SQL。
- ⚠️ **功能受限于 JPA**：
  - 无法直接映射复杂的嵌套结果到 DTO（除非用 `@SqlResultSetMapping`）。
  - 对动态 SQL 支持不好，需要用 Spring Data 的 `SpEL` 或 Specification。
- ⚠️ **事务/缓存行为不同**：
  - JPA 会默认参与一级缓存和事务管理，如果你只想做纯查询，有时会有副作用。

------

## 2️⃣ MyBatis 的特点

```
@Mapper
public interface PermissionMapper {
    @Select("""
        SELECT DISTINCT p.*
        FROM permission p
        JOIN role_permission rp ON p.id = rp.permission_id
        JOIN user_role ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = #{userId}
    """)
    List<Permission> findByUserId(@Param("userId") Long userId);
}
```

- ✅ **完全自由控制 SQL**，没有实体限制，可以返回任意对象（DTO、Map、嵌套对象）。
- ✅ **动态 SQL 很灵活**：可以用 `<if>`、`<choose>`、`<foreach>` 生成复杂查询。
- ✅ **SQL 独立于 ORM**：更适合复杂查询和跨数据库。
- ⚠️ **没有自动 CRUD**：插入、更新、删除需要手写 SQL 或 mapper 方法。
- ⚠️ **手动维护映射关系**：列名和属性对应需要注意。

------

## 3️⃣ 核心区别对比

| 特性        | JPA + nativeQuery                | MyBatis                                 |
| ----------- | -------------------------------- | --------------------------------------- |
| SQL 控制    | 有，但绑定实体                   | 完全自由                                |
| 返回对象    | 主要实体，复杂映射麻烦           | 实体、DTO、Map 都行                     |
| 动态 SQL    | 受限，需要 SpEL 或 Specification | 非常灵活                                |
| CRUD 自动化 | 内建 `save`、`delete`            | 需要手写                                |
| 事务/缓存   | JPA 参与一级缓存和事务           | 纯 SQL，不干扰缓存                      |
| 跨数据库    | 受 SQL 语法限制                  | 受 SQL 语法限制，但更容易分库写不同 SQL |

------

💡 **总结**：

- JPA `nativeQuery` 和 MyBatis 都可以写原生 SQL，所以表面上差不多。
- **区别在于生态和管理方式**：
  - JPA 偏向 **实体驱动 + 自动 CRUD + 简单查询**。
  - MyBatis 偏向 **SQL 驱动 + 灵活控制 + 大型复杂查询**。

## Spring Boot + JPA + MyBatis 混合使用

| 特性        | JPA                              | MyBatis                | 混合使用                             |
| ----------- | -------------------------------- | ---------------------- | ------------------------------------ |
| 事务管理    | 自动，支持回滚                   | 参与 Spring 事务       | 统一事务，JPA + MyBatis 都生效       |
| 缓存        | 一级缓存，懒加载                 | 无缓存，直接查询       | JPA 缓存仍生效，MyBatis 绕开缓存     |
| SQL 控制    | JPQL 简单，native SQL 可控但受限 | 完全可控，支持动态 SQL | 复杂查询走 MyBatis → 性能优化灵活    |
| CRUD 自动化 | 自动                             | 需要手写               | 简单 CRUD 用 JPA，复杂查询用 MyBatis |

