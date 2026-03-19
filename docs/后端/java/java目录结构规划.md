## 建议结构

```
javademo
├─ DemoApplication.java
├─ common              # 真·基础设施层
│  ├─ api              # Result / ResultCode
│  ├─ exception
│  ├─ logging
│  ├─ util
│  └─ base
│      └─ BaseEntity.java
├─ infrastructure      # 系统能力（推荐新增）
│  ├─ bootstrap
│  │  └─ AdminAccountInitializer.java #与user相关也可放 modules/user/bootstrap/AdminAccountInitializer.java
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
├─ auth
│  ├─ controller              # Result / ResultCode
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
└─ user
   ├─ bootstrap
   │  └─ AdminAccountInitializer.java #在系统启动时，如果没有 admin 账户，就创建一个默认 admin
   ├─ controller
   │  └─ admin
   │     └─ AdminUserController.java
   │
   ├─ dto
   │  └─ ProfileResponseDTO.java
   │
   ├─ bo
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