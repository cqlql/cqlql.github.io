---
title: Java 项目目录结构规范（按领域切包）
icon: devicon:java
---

# Java 项目目录结构规范（按领域切包）

> 状态：**母本 · 现行**（2026-10-30 起草；同日补齐三档判据、`resources` 双根、ArchUnit 约束）
>
> 跨栈通用判据、阈值、各栈指针表在 `docs/工程/目录结构规范.md`，**本文只写 Java 这一栈**。
> 两处冲突时以母本判据为准，本文负责回答「Java 具体怎么落」。

**先说结论：Java 不能照搬前端 `features/` 那套文件清单。**
`pages/ store.ts hooks/ nav.ts` 在 Java 里没有对应物，硬套就是造空壳目录。
能借的只有两条原则——**按能力切**、**目录是长出来的**。差异和落法见下文。

---

## 一、先定档，不是二选一

| 档 | 结构 | 触发条件 | 典型场景 |
| :--- | :--- | :--- | :--- |
| **档 0** 单模块横切 | `controller/ service/ mapper/ entity/ dto/` + `common/` `infrastructure/` | 默认起点 | 领域 <10、接口 <30、单人 |
| **档 1** 包内竖切 | `modules/<domain>/{controller,service,repository,entity,dto}` | 领域 ≥10 或接口 ≥30，**且** ≥2 人 | 中型单体 |
| **档 2** 多模块 | 每领域一个 subproject，或 `api`/`domain`/`app` 三件套 | 要拆服务、聚合边界真实存在、多人并行 | 大型单体 / 微服务前夜 |

阈值和升级触发条件**不在本文重复**，见母本第六节「但先看阈值」。

为什么要有档 0：竖切的成本是**每个业务多建 3–4 个包**，收益是「删一个业务只清一个包」。
收益随领域数线性增长，成本固定 → 领域少时横切反而更好找、更好改。

---

## 二、档 0：单模块横切（默认）

```text
com/example/app
├─ AppApplication.java
├─ common/                 # 无业务耦合，可整包拷到别的项目
│  ├─ api/                 # Result / ResultCode
│  ├─ exception/
│  ├─ util/
│  └─ base/                # BaseEntity
├─ infrastructure/         # 系统能力：安全、缓存、外部集成、Web 配置
│  ├─ security/
│  ├─ redis/
│  ├─ web/
│  └─ integration/
├─ controller/             # ↓ 以下按技术类型横切
├─ service/
├─ mapper/
├─ entity/
└─ dto/
```

**这一档不是「错的起点」，是多数项目该停的地方。** 6 张表的单人项目切四层 DDD，
结果是加一个字段改 5 个文件，而它从来没有过跨聚合事务。

---

## 三、档 1：包内竖切（本仓当前形态）

判据：**「删掉一个业务，能不能只删一个包」**。能，就说明切对了。

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

---

## 四、档 2：多模块（编译期强制）

**为什么档 1 之后还需要档 2**：Java 的包**没有**编译期依赖约束。
`modules.user.service` 直接 `import modules.order.repository.OrderMapper`，`javac` 一句话不说。
包级竖切只能靠 ArchUnit 事后检查，而 artifact 依赖是**显式声明**的——不写 `pom` 里的
`<dependency>` 就编译不过，这才是真正的边界。

两种拆法，选一个：

```text
# A. 按技术层拆（单体内部治理）
parent/
├─ pom.xml            # packaging=pom，只管 dependencyManagement
├─ app-web/           # 启动类 + controller + 全局异常/拦截器
├─ app-domain/        # 领域模型 + service，不许出现 spring-boot-starter-web
└─ app-infra/         # mapper / 外部集成实现，实现 domain 定义的端口

依赖方向：app-web → app-domain ← app-infra（domain 最干净，谁也不依赖）
```

```text
# B. 按领域拆（准备拆服务时）
parent/
├─ common/            # 无业务耦合
├─ order-service/
├─ user-service/
└─ payment-service/

判据：拆完 `mvn -pl order-service dependency:tree` 里看不到别的业务模块。
```

> ⚠️ 别做「按领域拆 + 每个领域再分 api/domain/app」的四层套娃，除非真的在拆服务。
> 一个 12 个领域的中台照抄这套，`mvn install` 会跑 40 个模块，改一行 DTO 要重新构建半个仓。

---

## 五、`resources` 双根：包切了，资源没跟着切

这是 Java 竖切**最容易漏的一环**。前端竖切到 `features/order/` 后，样式、请求、组件都在同一目录，
删一个目录就干净了。Java 不行：`src/main/java` 和 `src/main/resources` 是**两棵独立的树**，
包竖切只切了 java 那棵，`resources/` 下仍然按类型横放。

| 资源 | 能不能跟着领域切 | 做法 |
| :--- | :--- | :--- |
| MyBatis mapper XML | ✅ 能 | 镜像 java 包：`resources/modules/<domain>/mapper/*.xml`，配 `classpath*:modules/**/mapper/*.xml` |
| Flyway / Liquibase 迁移 | 🔴 **不能** | 单一 `db/migration`，全局版本号单调递增 |
| `application-*.yml` | 🔴 **不能** | 按 profile 切（dev/prod），不按领域切 |

**Flyway 这条是硬约束**：版本号全局唯一且递增。按领域各放一份 `V1__init.sql`，
启动时直接 `Found more than one migration with version 1`。见过不止一次。

如果 mapper XML 想和接口同包，需要在 `pom.xml` 里把 java 目录的 xml 一起打包：

```xml
<resources>
  <resource>
    <directory>src/main/java</directory>
    <includes><include>**/*.xml</include></includes>
  </resource>
  <resource><directory>src/main/resources</directory></resource>
</resources>
```

### 包与 XML 的镜像树（完整示例）

「镜像」很字面：`resources/` 下的相对路径 = `java/` 下包路径去掉 `com/example/app/` 前缀。

```text
src/main/
├─ java/com/example/app/
│  ├─ AppApplication.java
│  ├─ common/
│  │  └─ util/DateUtils.java
│  ├─ infrastructure/
│  │  └─ security/JwtUtils.java
│  └─ modules/
│     ├─ order/                              # ← 领域包
│     │  ├─ controller/OrderController.java
│     │  ├─ service/OrderService.java
│     │  ├─ repository/OrderMapper.java      # ← 接口
│     │  ├─ entity/Order.java
│     │  └─ dto/OrderCreateRequest.java
│     └─ user/
│        ├─ controller/UserController.java
│        ├─ service/UserService.java
│        ├─ repository/UserMapper.java
│        ├─ entity/User.java
│        └─ dto/UserProfileResponse.java
└─ resources/
   ├─ application.yml                     # 全局：只放共用配置
   ├─ application-dev.yml                 # 全局：按 profile 切
   ├─ db/migration/                       # 全局：不按领域切
   │  ├─ V1__init.sql
   │  ├─ V2__order_add_index.sql
   │  └─ V3__user_add_phone.sql
   └─ modules/                            # ← 镜像 java 的 modules/
      ├─ order/mapper/OrderMapper.xml     # namespace 写全限定接口名
      └─ user/mapper/UserMapper.xml
```

```yaml
# application.yml
mybatis-plus:
  mapper-locations: classpath*:modules/**/mapper/*.xml
```

`namespace` 必须与接口全限定名严格一致，写错了同样是运行期才炸：

```xml
<mapper namespace="com.example.app.modules.order.repository.OrderMapper">
```

### `mapper-locations` 写错的表现：启动正常，调用才炸

这是竖切后**最高频**的坑。MyBatis-Plus 默认是 `classpath*:/mapper/**/*.xml`，
包搬进 `modules/` 之后没同步改配置，**应用照常启动、接口照常注册**，第一次调 SQL 才抛：

```text
org.apache.ibatis.binding.BindingException:
Invalid bound statement (not found): com.example.app.modules.order.repository.OrderMapper.selectById
```

两个容易写错的点：

| 写法 | 结果 |
| :--- | :--- |
| `classpath:modules/**/mapper/*.xml` | `classpath:` 只匹配**第一个**命中的 classpath 根，打成 jar 后大概率扫不到 → 必须 `classpath*:` |
| `classpath*:modules/*/mapper/*.xml` | `*` 只匹配一层，`modules/order/mapper` 恰好能中，一旦嵌套成 `modules/trade/order/mapper` 就失效 → 用 `**` |

> 排查手段：开 `logging.level.com.example.app=debug`，看日志里有没有 `Parsed mapper file:` 那一行。
> 没有就是文件根本没被扫到，不是 SQL 写错。

### 三种放法怎么选

| 放法 | 适用 | 代价 |
| :--- | :--- | :--- |
| XML 镜像到 `resources/modules/`（推荐） | 有手写动态 SQL、`<foreach>` 拼接 | 同一业务跨两棵树，改 SQL 要切目录 |
| XML 与接口同包放 `java/` 下 | 想让「删一个包」真的删干净 | 要改 `pom.xml` 的 `<resources>`，Maven 默认不拷贝 `src/main/java` 下的 xml，团队得统一约定 |
| 不用 XML，注解 / `BaseMapper` | 单表 CRUD 占绝大多数 | 复杂动态 SQL 会变得难读，最后还是会回到 XML |

---

## 六、用 ArchUnit 把「依赖方向」变成构建失败

包级竖切的边界是**口头约定**，不写测试就等于没有——半年后一定有人从 `common` 反向 import 业务类。
`common` 一旦反向依赖 `modules`，就变成杂物间，删 feature 永远删不干净。

```java
@AnalyzeClasses(packages = "com.example.app", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    // 1. common 必须是最底层，不许碰业务
    @ArchTest
    static final ArchRule common_不得依赖业务 =
        noClasses().that().resideInAPackage("..common..")
            .should().dependOnClassesThat().resideInAnyPackage("..modules..");

    // 2. infrastructure 是系统能力，同样不许反向依赖业务
    @ArchTest
    static final ArchRule infra_不得依赖业务 =
        noClasses().that().resideInAPackage("..infrastructure..")
            .should().dependOnClassesThat().resideInAPackage("..modules..");

    // 3. 跨领域只走对方暴露的接口包，不许直接读 internal
    @ArchTest
    static final ArchRule 跨领域只走出口 =
        noClasses().that().resideOutsideOfPackage("..modules.order..")
            .should().dependOnClassesThat().resideInAPackage("..modules.order.internal..");
}
```

`pom.xml` 加测试依赖即可，`mvn test` 阶段就会挡：

```xml
<dependency>
  <groupId>com.tngtech.archunit</groupId>
  <artifactId>archunit-junit5</artifactId>
  <version>1.3.0</version>
  <scope>test</scope>
</dependency>
```

> 更省事的替代：Spring Modulith，`ApplicationModules.of(App.class).verify()` 一行就能校验
> 模块间是否只通过 API 包交互，还顺带生成模块依赖图。代价是引入一个额外抽象。

---

## 七、Domain vs BO

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


## 八、判据速查

### 8.1 这个职责属于哪一层？

| 问题               | 放哪                     |
| ------------------ | ------------------------ |
| 是纯工具类？       | common                   |
| 是系统能力？       | infrastructure           |
| 是具体业务？       | modules                  |
| 是启动初始化逻辑？ | infrastructure/bootstrap |

### 8.2 按类型速查（形成长期判断能力）

| 类型     | 放哪里                   |
| -------- | ------------------------ |
| 业务逻辑 | modules                  |
| 系统能力 | infrastructure           |
| 工具类   | common                   |
| 启动任务 | infrastructure/bootstrap |
| Web 配置 | infrastructure/web       |
| 安全相关 | infrastructure/security  |
### 8.3 一句话原则

| 类型               | 放哪里                  |
| ------------------ | ----------------------- |
| 和安全相关         | infrastructure.security |
| 和 HTTP/Web 相关   | infrastructure.web      |
| 纯 Java 无依赖工具 | common.util             |
| 全局返回模型       | common.api              |

## 九、实例：这三个类该放哪

> 三个真实争论，用来检验第八节的判据能不能落地。判据本身不产生分歧，
> 分歧都出在「这个类的边界到底在哪」——所以看这三例比背表有用。

### 9.1 RedisTokenManager

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

### 9.2 SessionUserDetails

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



### 9.3 PasswordUtil → 建议改名 PasswordService

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