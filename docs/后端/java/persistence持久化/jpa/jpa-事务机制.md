---
title: JPA 事务机制
icon: mdi:database-sync
---

# Spring Data JPA 事务管理机制详解

## 1. 核心结论

- **单条 `findById` 默认有事务**：如果不显式声明 `@Transactional`，Spring Data JPA 也会为其自动开启**隐式只读事务（`readOnly = true`）**。
- **修改操作（`@Modifying`）必须手动开事务**：带 `@Modifying` 的自定义写操作必须处于可写事务（`readOnly = false`）中，否则运行时直接抛出 `TransactionRequiredException`。

## 2. 为什么 `findById` 默认会有事务？

### 2.1 源码实现机制

Spring Data JPA 的底层默认实现类 `SimpleJpaRepository` 在**类级别**声明了只读事务：

```java
@Repository
@Transactional(readOnly = true) // 重点：默认所有查询方法继承只读事务
public class SimpleJpaRepository<T, ID> implements JpaRepositoryImplementation<T, ID> {

    // findById 继承类级别的 @Transactional(readOnly = true)
    public Optional<T> findById(ID id) { ... }

    // 变更方法重写为可写事务
    @Transactional
    public <S extends T> S save(S entity) { ... }
}
```

### 2.2 单条查询开启只读事务的必要性

虽然纯数据库角度单条 `SELECT` 不需要事务，但结合 ORM 框架（Hibernate）与数据库连接池时，只读事务具有以下关键作用：

1. **提升性能（禁用脏检查）**：提示 Hibernate 将 Flush 模式设为 `NEVER`/`MANUAL`，事务提交时**跳过内存脏检查（Dirty Checking）**，节省 CPU 和内存。
2. **支持延迟加载（Lazy Loading）**：保持 Persistence Context 开启，避免访问 `@OneToMany` 等延迟加载关联属性时抛出 `LazyInitializationException`。
3. **减少连接池开销**：避免数据库处于 Auto-Commit 状态时频繁进行“开启-提交”的状态切换开销。

## 3. `@Modifying` 注解与写事务

### 3.1 抛错原因

直接调用标注了 `@Modifying @Query(...)` 的自定义 UPDATE/DELETE 方法时，如果未声明写事务：

- `SimpleJpaRepository` 默认的只读事务会拦截并拒绝 DML 语句；
- JPA 规范要求所有的更新/删除必须处于事务上下文，因此抛出：

> `jakarta.persistence.TransactionRequiredException: Executing an update/delete query`

### 3.2 解决方案与最佳实践

#### 方案 A：在 Service 层控制（推荐）

符合业务规范，方便多个 DAO 操作共享同一个事务并支持回滚。

```java
@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Transactional // 开启可写事务（默认 readOnly = false）
    public void updateUserStatus(Long id, Integer status) {
        userRepository.updateStatus(id, status);
    }
}
```

#### 方案 B：在 Repository 接口方法上直接标注

适合孤立的单方法更新。

```java
public interface UserRepository extends JpaRepository<User, Long> {

    @Transactional // 显式覆盖 SimpleJpaRepository 的 readOnly = true
    @Modifying
    @Query("UPDATE User u SET u.status = :status WHERE u.id = :id")
    int updateStatus(Long id, Integer status);
}
```

## 4. 防坑拓展：`@Modifying` 避坑指南

在使用 `@Modifying` 执行自定义更新时，要注意**一级缓存（Persistence Context）脏数据**问题。如果前面通过 `findById` 查询了实体，紧接着执行 `@Modifying` 更新，内存中的实体仍然是旧值。

**优化建议**：加上 `clearAutomatically = true`，更新后自动清空持久化上下文。

```java
@Modifying(clearAutomatically = true) // 执行更新后自动清空一级缓存
@Query("UPDATE User u SET u.status = :status WHERE u.id = :id")
int updateStatus(Long id, Integer status);
```

## 5. 常见场景行为对照表

| 场景 | 默认事务状态 | 实际行为 |
| --- | --- | --- |
| **执行 `findById`（无 `@Transactional`）** | 只读事务 (`readOnly = true`) | 开启只读事务，跳过脏检查，支持懒加载 |
| **外层 Service 有 `@Transactional`** | 遵循外层事务 | 融入外层事务（`REQUIRED` 传播行为） |
| **执行 `@Modifying`（无写事务）** | 无/只读事务 | **抛出 `TransactionRequiredException` 报错** |
| **执行 `@Modifying`（带写事务）** | 可写事务 (`readOnly = false`) | 正常执行修改语句并提交 |
