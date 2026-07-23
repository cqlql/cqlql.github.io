# 已部署 Spring Boot 项目动态开启 Debug 日志

**分类：** `#SpringBoot` `#Actuator` `#Logging` `#Java` `#Backend`

**核心问题：** 对于已经部署好、不能轻易重启的 Spring Boot 项目，如何在不重启的情况下动态开启 Debug 日志（适合线上排查）？

------

## 通过 Actuator 动态开启（推荐，无需重启）

如果项目中集成了 `spring-boot-starter-actuator`，可以在不重启应用的情况下动态调整指定包或全局的日志级别。

### 1. 检查或暴露 loggers 端点

在 `application.yml` 或 `application.properties` 中，确保 Actuator 的 loggers 端点已开启并暴露：

```yaml
management:
  endpoints:
    web:
      exposure:
        include: "loggers,health" # 暴露 loggers 端点
```

### 2. 通过 HTTP 请求动态修改日志级别

使用 `curl` 或 Postman 发送 `POST` 请求到 `/actuator/loggers/{packageName}` 即可。

**修改指定包/类的日志级别为 DEBUG：**

```bash
curl -X POST http://localhost:8080/actuator/loggers/com.example.demo \
  -H "Content-Type: application/json" \
  -d '{"configuredLevel": "DEBUG"}'
```

**修改全局日志级别为 DEBUG：**

```bash
curl -X POST http://localhost:8080/actuator/loggers/ROOT \
  -H "Content-Type: application/json" \
  -d '{"configuredLevel": "DEBUG"}'
```

**恢复为默认（清除特定配置）：**

```bash
curl -X POST http://localhost:8080/actuator/loggers/com.example.demo \
  -H "Content-Type: application/json" \
  -d '{"configuredLevel": null}'
```

> 注意：通过 Actuator 动态修改的日志级别在**应用重启后会恢复为配置文件中的原始级别**，因此适合线上临时排查，无需改代码、无需重启。

## 安全风险提示

如果 `/actuator/loggers` 端点未经保护直接暴露在公网上，攻击者或恶意分子完全可以利用它发起攻击，造成严重的线上事故。

主要存在以下几个安全风险：

- **拒绝服务攻击（DoS / 磁盘爆满）：** 将全局（`ROOT`）或高频业务包的日志级别修改为 `TRACE` 或 `DEBUG`，可以在短时间内产生海量的日志文件。这不仅会瞬间拉高 CPU 和 I/O 飙升，还会迅速刷满服务器磁盘，导致整个服务宕机。
- **敏感数据泄露：** 许多框架和业务代码在 `DEBUG`/`TRACE` 级别下会打印非常详细的参数，例如数据库 SQL（含查询参数）、HTTP 请求体、Token、甚至明文密码等，攻击者可以通过日志收集系统或泄漏的文件窃取敏感信息。
- **配置破坏：** 随意篡改日志级别会干扰运维监控和问题排查，甚至掩盖其他正在进行的恶意攻击行为。

---

## 防范与安全加固方案

线上生产环境使用 Actuator 时，**强烈建议配合以下安全措施**：

### 1. 引入 Spring Security 增加身份认证（推荐）

为 Actuator 端点加上权限控制，只有具备管理员权限的用户才能调用：

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: "loggers,health"

```

配合 Spring Security 配置，限制访问权限：

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
        .securityMatcher("/actuator/**")
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/actuator/health").permitAll() // 仅健康检查对外公开
            .requestMatchers("/actuator/loggers/**").hasRole("ADMIN") // 修改日志需要 ADMIN 权限
        )
        .httpBasic(Customizer.withDefaults()); // 使用 Basic Auth 或 JWT
    return http.build();
}

```

### 2. 更改 Actuator 独立端口 / 内网隔离

将 Actuator 管理端点暴露在独立的端口上，并在防火墙或 Nginx/安全组层面上限制该端口，**仅允许内网 IP 或 VPN 访问**，不对外网暴露：

```yaml
management:
  server:
    port: 8081 # 独立管理端口，外部流量无法访问

```

### 3. 修改 Actuator 基础路径（隐蔽化）

避免使用默认的 `/actuator` 路径，防止被扫描工具一秒扫描到：

```yaml
management:
  endpoints:
    web:
      base-path: "/internal-sys-management-xyz" # 自定义隐蔽路径

```

### 4. 结合配置中心（如 Nacos / Apollo）

如果觉得暴露 HTTP 端点有风险，也可以使用配置中心实现动态日志切换：在 Nacos 中监听日志配置文件（如 `logback-spring.xml`），通过配置中心刷新的机制动态更新日志级别，完全无需暴露 Actuator 的 HTTP 修改接口。
