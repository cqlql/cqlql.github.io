---
title: Java 项目目录结构规划
icon: mdi:file-tree
---

# Java 项目目录结构规划

```
javademo
├─ DemoApplication.java
├─ common          # 通用层（与业务无关的工具性代码，复用性极高，通常可直接拷贝到不同项目中使用）
│  ├─ api            # Result / ResultCode
│  ├─ exception
│  ├─ logging
│  ├─ util
│  └─ base
│      └─ BaseEntity.java
├─ infrastructure  # 基础设施层（支撑业务运行的外部适配器代码）
│  ├─ bootstrap
│  │  └─ AdminAccountInitializer.java #与user相关也可放 
│  ├─ integration
│  │  └─ wechat
│  │     ├─ client
│  │     │  └─ WechatClient.java      ← 对外HTTP调用封装
│  │     │
│  │     ├─ service
│  │     │  └─ WechatAuthService.java ← 可选（薄封装）
│  │     │
│  │     ├─ dto
│  │     │  └─ WechatSessionDTO.java
│  │     │
│  │     └─ config
│  │        └─ WechatMiniAppProperties.java
│  ├─ security
│  │  ├─ config
│  │  │  └─ SecurityConfig.java
│  │  ├─ token
│  │  │  ├─ AuthRedisKey.java
│  │  │  ├─ JwtUtils.java
│  │  │  └─ RedisTokenManager.java
│  │  ├─ filter
│  │     ├─ JwtAuthenticationFilter.java
│  │     └─ TokenAuthenticationFilter.java
│  │
│  ├─ redis
│  │  ├─ RedisConfig.java
│  │  └─ RedisTokenManager.java
│  │
│  └─ web
│      ├─ WebConfig.java
│      └─ SwaggerConfig.java
└─ modules              # 业务模块

```

✅ modules 内部：为 admin / app 提前铺路

```
modules
├─ auth                      # 认证流程（登录、token、校验、注册）
│  ├─ controller             # Result / ResultCode
│  │  ├─ admin
│  │  ├─ app
│  │  │  └─ AuthController.java
│  │  ├─ miniapp
│  │  │  └─ MiniAppAuthController.java
│  │  ├─ web
│  │  │  ├─ WebAuthController.java
│  │  │  └─ TokenAuthenticationFilter.java
│  ├─ dto
│  │  ├─ request
│  │  │  ├─ LoginRequest.java
│  │  │  └─ RefreshTokenRequest.java
│  │  ├─ request
│  │  │  ├─ LoginResponse.java
│  │  │  └─ ProfileResponse.java
│  └─ service
│      ├─ AuthService.java
│      └─ WebSocketTicketService.java
└─ user                               # 用户数据
   ├─ bootstrap
   │  └─ AdminAccountInitializer.java #在系统启动时，如果没有 admin 账户，就创建一个默认 admin
   ├─ controller
   │  └─ admin
   │     └─ AdminUserController.java
   │
   ├─ dto
   │  └─ ProfileResponseDTO.java
   │
   ├─ domain                    # 业务，比 bo 更符合 DDD，后期可扩展（Aggregate / ValueObject）
   │  └─ UserSessionBO.java
   │
   ├─ entity
   │  └─ User.java
   │
   ├─ repository
   │  └─ UserRepository.java
   │
   └─ service
      └─ UserService.java

```

## Domain vs BO

### 1. 传统 BO 模式（贫血模型）

在这种模式下，`OrderBO` 只是一个属性容器，所有的业务逻辑都堆积在 `OrderService` 里。

```java
// BO 仅仅是数据的搬运工
public class OrderBO {
    private Long id;
    private List<OrderItemBO> items;
    private String province; // 地址属性散落在外
    private String city;
    private BigDecimal totalAmount;
    private int status; // 0:新建, 1:已支付...
    
    // 只有 Getter 和 Setter
}

// Service 层变成了“上帝类”，处理所有细节
public class OrderService {
    public void applyDiscount(OrderBO order, BigDecimal discount) {
        // 逻辑在外层，OrderBO 无法保护自己的数据一致性
        if (order.getStatus() == 1) { 
            throw new IllegalStateException("已支付订单不能打折");
        }
        BigDecimal newAmount = order.getTotalAmount().subtract(discount);
        order.setTotalAmount(newAmount);
    }
}
```

------

### 2. DDD Domain 模式（充血模型）

在 DDD 中，我们引入 **值对象（Value Object）** 处理地址，并将 **聚合根（Aggregate Root）** 作为业务逻辑的入口。

#### 第一步：定义值对象 (Value Object)

地址不再是散乱的字符串，而是一个不可变的整体。

```java
public final class Address { // 值对象通常是不可变的
    private final String province;
    private final String city;

    public Address(String province, String city) {
        if (province == null) throw new IllegalArgumentException("省份不能为空");
        this.province = province;
        this.city = city;
    }
    // 只有 Getter，没有 Setter。如果地址变了，直接替换整个 Address 对象。
}
```

#### 第二步：定义聚合根 (Aggregate Root)

`Order` 实体负责保护自己的业务规则（不变量）。

```java
public class Order {
    private Long id;
    private List<OrderItem> items;
    private Address shippingAddress; // 使用值对象
    private BigDecimal totalAmount;
    private OrderStatus status; // 使用枚举提高可读性

    // 业务行为：打折
    public void applyDiscount(BigDecimal discount) {
        // 规则自包含：只有 Order 知道自己什么时候能打折
        if (this.status == OrderStatus.PAID) {
            throw new IllegalStateException("已支付订单无法修改金额");
        }
        if (discount.compareTo(this.totalAmount) >= 0) {
            throw new IllegalArgumentException("折扣金额不能超过总额");
        }
        this.totalAmount = this.totalAmount.subtract(discount);
    }
    
    // 业务行为：修改地址
    public void changeAddress(Address newAddress) {
        if (this.status == OrderStatus.SHIPPED) {
            throw new IllegalStateException("已发货无法修改地址");
        }
        this.shippingAddress = newAddress;
    }
}
```

------

### 3. 为什么 Domain 更具可扩展性？

1. **逻辑高内聚：**
   - **BO：** 如果有 10 个 Service 都要修改订单金额，你得在 10 个地方写 `if(status == 1)`。一旦规则改了（比如“待发货”也不能打折），你要改 10 处。
   - **Domain：** 规则只在 `Order.applyDiscount()` 里。改一处，全系统生效。
2. **结构可扩展（聚合的力量）：**
   - 如果未来订单增加了“优惠券”逻辑，你只需要在 `Order` 聚合内部增加 `Coupon` 校验，Service 层的调用代码 `order.applyDiscount(discount)` 甚至不需要动。
3. **消除非法状态：**
   - **BO：** 允许你创建一个只有 `province` 没有 `city` 的订单，因为它是通过 `set` 方法零散赋值的。
   - **Domain：** 通过 `Address` 的构造函数强制校验，保证了对象从诞生那一刻起就是合规的。

------

### 总结

- **BO** 是“**我想让你变成什么样，你就得变成什么样**”（外部操控）。
- **Domain** 是“**我能做什么，我该怎么做**”（自我约束）。


## 一个很重要的架构判断标准

| 问题               | 放哪                     |
| ------------------ | ------------------------ |
| 是纯工具类？       | common                   |
| 是系统能力？       | infrastructure           |
| 是具体业务？       | modules                  |
| 是启动初始化逻辑？ | infrastructure/bootstrap |

## 一个架构层级总结（形成长期判断能力）

| 类型     | 放哪里                   |
| -------- | ------------------------ |
| 业务逻辑 | modules                  |
| 系统能力 | infrastructure           |
| 工具类   | common                   |
| 启动任务 | infrastructure/bootstrap |
| Web 配置 | infrastructure/web       |
| 安全相关 | infrastructure/security  |
## 🎁 一句话原则

| 类型               | 放哪里                  |
| ------------------ | ----------------------- |
| 和安全相关         | infrastructure.security |
| 和 HTTP/Web 相关   | infrastructure.web      |
| 纯 Java 无依赖工具 | common.util             |
| 全局返回模型       | common.api              |

## RedisTokenManager.java 位置讨论

### 它本质是什么？

`RedisTokenManager` 做的事情：

- 生成 AccessToken
- 生成 RefreshToken
- 存储 Session
- 控制最大登录数
- 维护在线用户
- 支持踢人下线
- 设备隔离（web/app/desktop）

这已经是：

> 🔐 认证子系统的核心组件
>  🔐 Session 管理器
>  🔐 Token 生命周期管理器

它属于：

✔ 基础设施层
 ✔ 安全域
 ✔ 认证模块

绝对不属于 util。

### 为什么不能放 common/util？

`common` 应该是：

- 无业务依赖
- 无模块依赖
- 纯工具

但你这个类：

```
import com.cql.javademo.modules.user.bo.UserSessionBO;
import com.cql.javademo.modules.user.constants.AuthRedisKey;
import com.cql.javademo.modules.user.entity.User;
```

❗ 它依赖 user 模块

这意味着：

> common 反向依赖业务模块

这是分层的大忌。

### 正确的层级判断

问自己一个问题：

> 如果将来我要拆认证服务，这个类会跟着谁走？

答案很明显：

👉 它会跟着 security/auth 走
 👉 而不是跟着 user 业务走

## SessionUserDetails.java位置推荐

### SessionUserDetails 本质是什么？

它大概率是：

```
public class SessionUserDetails implements UserDetails {
    ...
}
```

也就是：

✔ Spring Security 适配器
 ✔ 用于把你自己的 Session / User 转成 Security 需要的结构
 ✔ 安全框架内部使用的模型

它不是：

- ❌ 业务模型
- ❌ 通用工具
- ❌ 普通 DTO

它是：

> 🔐 安全域内部模型

### 推荐的最终位置

```
infrastructure
 └─ security
     ├─ config
     ├─ filter
     ├─ handler
     ├─ token
     ├─ model
     │   ├─ UserSession.java
     │   └─ SessionUserDetails.java
     └─ service
         └─ CustomUserDetailsService.java
```

或者如果你想更语义化一点：

```
infrastructure/security/principal/SessionUserDetails.java
```

我个人更推荐：

```
model
```

因为：

- UserSession 是认证模型
- SessionUserDetails 是安全模型
- 都属于 security 内部领域模型



## PasswordUtil.java 位置讨论

### 放到 `password` 目录

```
infrastructure/security/
├─config
├─filter
├─model
├─password   ← 这里就是它该待的地方
└─token
```

### 🔥 更推荐：改名为 PasswordService

既然你已经是分模块结构了，建议升级一下设计：

#### ❌ 不推荐

```
public class PasswordUtil {  // 静态工具类
```

#### ✅ 推荐

```
@Service
public class PasswordService {
    private final PasswordEncoder passwordEncoder;

    public PasswordService(PasswordEncoder passwordEncoder) {
        this.passwordEncoder = passwordEncoder;
    }

    public String hash(String rawPassword) {
        return passwordEncoder.encode(rawPassword);
    }

    public boolean verify(String rawPassword, String encodedPassword) {
        return passwordEncoder.matches(rawPassword, encodedPassword);
    }
}
```

### 🎯 为什么一定要进 password 目录？

因为你现在的 security 已经是 **按职责分包**：

| 目录     | 代表什么   |
| -------- | ---------- |
| config   | 安全配置   |
| filter   | 过滤器     |
| model    | 安全模型   |
| token    | token 管理 |
| password | 密码策略   |

如果 Password 放在 security 根目录，就变成：

```
security/
   PasswordUtil.java   ❌
   config/
   filter/
   model/
```

这会破坏你现在的“领域分组”。