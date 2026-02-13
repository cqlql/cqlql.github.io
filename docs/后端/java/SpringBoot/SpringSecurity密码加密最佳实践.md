# [笔记] Spring Security 密码编码器最佳实践

**分类：** `#SpringSecurity` `#Cryptography` `#Java` `#Backend`

**核心问题：** 为什么推荐使用 `DelegatingPasswordEncoder` 而不是硬编码 `BCryptPasswordEncoder`？

------

## 1. 背景对比

在 Spring Security 5.0 之后，官方不再推荐直接实例化具体的加密算法，而是通过工厂模式创建**委托密码编码器**。

### 传统方式

```java
// 不推荐：扩展性差，无法平滑升级算法
PasswordEncoder encoder = new BCryptPasswordEncoder(12);
```

### 推荐方式

```java
// 推荐：支持多算法共存，具有前瞻性
PasswordEncoder encoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();
// 这样当你存储密码时，它会自动带上 {bcrypt} 前缀。即便以后 BCrypt 过时了，你的系统也能在不宕机、不重置用户密码的前提下平滑过渡。
```

------

## 2. 核心优势：为什么需要“委托”？

### A. 算法演进与平滑迁移

密码学算法并非永久安全。如果未来 `BCrypt` 被攻破或有更高效的 `Argon2` 出现：

- **硬编码方式：** 你必须修改所有加密逻辑，且数据库中旧的哈希值将失效。
- **委托方式：** 通过存储格式中的 `{id}` 前缀识别算法（如 `{bcrypt}$2a$...`）。系统可以同时识别旧的 BCrypt 和新的 Argon2 密码，实现无感迁移。

### B. 兼容多套加密系统

在企业级开发或系统重构中，数据库可能存在多种历史遗留的加密格式（如 MD5, SHA-256, BCrypt）。`DelegatingPasswordEncoder` 可以根据前缀自动路由到对应的解析器。

### C. 默认安全配置

`PasswordEncoderFactories` 会根据当前的 Spring Security 版本自动选择业界公认最安全的默认配置，无需开发者手动调整复杂的强度参数。

------

## 3. 技术细节对比表

| **特性**     | **BCryptPasswordEncoder** | **DelegatingPasswordEncoder**          |
| ------------ | ------------------------- | -------------------------------------- |
| **存储格式** | 仅哈希值 (e.g. `$2a$...`) | `ID + 哈希值` (e.g. `{bcrypt}$2a$...`) |
| **算法升级** | 需硬编码修改，兼容性差    | **自动支持**多算法并存                 |
| **安全性**   | 依赖手动配置参数          | **开箱即用**的现代安全标准             |
| **适用场景** | 极简、无迁移需求的旧项目  | **所有新项目**、微服务、复杂系统       |

------

## 4. 最佳实践代码 (Spring Boot)

在配置类中定义 Bean：

```java
@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        // 创建委托编码器，默认通常为 BCrypt
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
```

------

> **注意：** 如果你的旧数据库中已经存有大量没有 `{id}` 前缀的 BCrypt 密码，可以通过配置 `DelegatingPasswordEncoder` 的 `setDefaultPasswordEncoderForMatches` 来兼容处理。

## 旧密码升级策略

### 登录时自动升级（最佳实践）

这是目前最优雅的方案。当用户输入正确密码登录时，程序可以顺便把哈希值升级为带前缀的格式，甚至升级到更强的算法。

Spring Security 提供了 `UserDetailsPasswordService` 接口专门处理这个逻辑：

#### 实现步骤：

1. **用户登录**：用户提交明文密码。
2. **校验成功**：`DaoAuthenticationProvider` 校验通过。
3. **判断是否需要升级**：如果存储的密码格式过时（例如没有前缀，或者算法强度不够）。
4. **自动重写**：系统自动调用 `updatePassword` 方法更新数据库。

#### 代码示例：

```java
@Service
public class MyUserDetailsPasswordService implements UserDetailsPasswordService {

    @Autowired
    private UserRepository userRepository; // 你的数据库操作类

    @Override
    public UserDetails updatePassword(UserDetails user, String newPassword) {
        // 当 DelegatingPasswordEncoder 发现密码需要优化（upgrade）时会调用此方法
        // newPassword 已经是加密后的新格式（例如带了 {bcrypt} 前缀）
        
        userRepository.updateUserPassword(user.getUsername(), newPassword);
        
        // 返回更新后的用户对象
        return user; 
    }
}
```

------

### 总结建议

- **短期内**：使用 `setDefaultPasswordEncoderForMatches` 保证旧用户能登录。
- **长期看**：实现 `UserDetailsPasswordService`。随着用户不断登录，数据库中的密码会**自动、平滑地**从 `$2a$...` 变成 `{bcrypt}$2a$...`（甚至变成更安全的算法）。
- **死账户处理**：对于那些一年都没登录过的“僵尸号”，它们会一直保持旧格式，但这并不影响系统运行，也不存在安全隐患。