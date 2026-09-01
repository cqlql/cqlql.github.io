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

## 6. 进阶坑：`@Transactional` 自调用失效

> 这是「明明加了 `@Transactional` 却还是报 `TransactionRequiredException`」最常见、也最隐蔽的原因。

### 6.1 问题现象

```java
@Service
public class RechargeOrderService {

    // 定时任务入口：没有事务
    public void confirmPendingOrders() {
        for (Order order : orders) {
            if (paid(order)) {
                // ❌ 自调用，事务失效
                handlePaymentSuccess(order.getOrderNo(), ...);
            }
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void handlePaymentSuccess(String orderNo, ...) {
        orderRepository.updateStatusToSuccess(orderNo, ...); // @Modifying 更新
    }
}
```

运行时 `updateStatusToSuccess` 抛出 `TransactionRequiredException: No active transaction for update or delete query`。

### 6.2 根本原因：AOP 代理

`@Transactional` 本质是通过 **Spring AOP 动态代理**生效的，不是直接作用于方法体本身：

```text
调用方
  └─> 代理对象（Proxy）
        └─> 事务拦截器 TransactionInterceptor 开启/提交事务
              └─> 真实目标对象（this）执行方法体
```

关键点：**只有从外部拿到的是「代理对象」时，调用才会经过事务拦截器**。

而 `this.handlePaymentSuccess(...)` 里的 `this` 是**真实目标对象本身**，调用直接进入方法体，完全绕过了代理和事务拦截器，所以 `@Transactional` 形同虚设。

### 6.3 判断口诀

> 只要在**同一个类内部**用 `this.xxx()` 调用另一个带 `@Transactional` 的方法，事务一定失效。

- 外部调用（Controller → Service、Service → Service）→ 走代理 → 事务生效 ✅
- 同类内部自调用（`this.method()`）→ 绕过代理 → 事务失效 ❌

### 6.4 补充：事务传播行为（不会重复开事务）

即使通过代理调用，事务也不是「每次都新开一个」。默认传播行为是 `REQUIRED`：

```text
外部调用方
  └─> 代理对象 A
        └─> TransactionInterceptor：当前无事务 → 新开事务 T
              └─> 方法体 A 执行
                    └─> 代理对象 B（另一个 @Transactional 方法）
                          └─> TransactionInterceptor：已有事务 T → 不新开，加入 T
```

关键结论：

- **没有事务时**：代理入口开启一个新事务；
- **已有事务时**：后续经过代理的 `@Transactional` 调用**加入（复用）当前事务**，不会重复开启。

因此更精确的表述是：

> **只有经过代理入口的调用才会触发事务管理；触发后按传播行为（默认 `REQUIRED`）决定是「新开事务」还是「加入现有事务」。**

常见传播行为对照：

| 传播行为 | 当前无事务 | 当前有事务 |
| --- | --- | --- |
| `REQUIRED`（默认） | 新开事务 | 加入当前事务 |
| `REQUIRES_NEW` | 新开事务 | 挂起当前事务，新开独立事务 |
| `SUPPORTS` | 不开启，非事务执行 | 加入当前事务 |
| `NOT_SUPPORTED` | 不开启，非事务执行 | 挂起当前事务，非事务执行 |
| `MANDATORY` | 抛异常 | 加入当前事务 |
| `NEVER` | 不开启，非事务执行 | 抛异常 |

> 对应到上面的自调用问题：`self.confirmAndGrant()` 内部再调 `this.handlePaymentSuccess()`（`handlePaymentSuccess` 也标了 `@Transactional`），因为已在 `confirmAndGrant` 开启的事务内，所以按 `REQUIRED` 加入同一事务，`@Modifying` 能正常执行——这解释了为什么「内层自调用」在这种情况下反而没问题。

### 6.5 解决方案

#### 方案 A：自引用代理（推荐，Spring 官方推荐做法）

在类中注入自身代理，通过代理调用，重新走事务拦截器：

```java
@Service
public class RechargeOrderService {

    /** 自引用代理：突破 @Transactional 自调用失效 */
    @Lazy          // @Lazy 避免循环依赖（Bean 创建时先注入代理）
    @Autowired
    private RechargeOrderService self;

    public void confirmPendingOrders() {
        for (Order order : orders) {
            if (paid(order)) {
                self.handlePaymentSuccess(order.getOrderNo(), ...); // ✅ 走代理，事务生效
            }
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void handlePaymentSuccess(String orderNo, ...) {
        orderRepository.updateStatusToSuccess(orderNo, ...);
    }
}
```

要点：

- 字段注入（配合 `@Lazy`）是自引用场景的标准做法，避免构造器注入产生循环依赖；
- `@Lazy` 让 Spring 在 Bean 实例化阶段先注入代理，而不是真实对象，打破循环依赖。

#### 方案 B：拆到独立的 Service

把需要事务的方法拆到**另一个 Service**，通过依赖注入调用（天然走代理）：

```java
@Service
public class PaymentConfirmService {

    @Transactional(rollbackFor = Exception.class)
    public void confirmAndGrant(String orderNo, String thirdTradeNo) { ... }
}

@Service
public class RechargeOrderService {

    private final PaymentConfirmService paymentConfirmService; // 外部代理调用，事务生效

    public void confirmPendingOrders() {
        paymentConfirmService.confirmAndGrant(orderNo, ...); // ✅
    }
}
```

#### 方案 C：编程式事务（`TransactionTemplate`）

不适合依赖声明式注解、需要精细控制边界的场景：

```java
private final TransactionTemplate transactionTemplate;

public void confirmPendingOrders() {
    transactionTemplate.execute(status -> {
        orderRepository.updateStatusToSuccess(orderNo, ...);
        return null;
    });
}
```

### 6.6 容易踩的「假修复」

**把逻辑拆到同类里的另一个方法，但调用时仍用 `this.` 自调用**——依然失效：

```java
public void confirmPendingOrders() {
    this.confirmAndGrant(orderNo, ...); // ❌ 还是自调用，@Transactional 依然不生效
}

@Transactional
public void confirmAndGrant(String orderNo, ...) { ... }
```

只有「换个类」或「换成 `self.` 代理」才能真正让事务生效。

### 6.7 小结

| 调用方式 | 是否走代理 | 事务是否生效 |
| --- | --- | --- |
| 外部（Controller/其它 Service）调用 | 是 | ✅ |
| 同类 `this.method()` 自调用 | 否 | ❌ |
| 同类 `self.method()`（`@Lazy` 自注入） | 是 | ✅ |
| 拆到独立 Service 后注入调用 | 是 | ✅ |
