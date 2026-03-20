# 一、四种 HTTP 客户端对比（核心认知）

如何选？RestClient > RestTemplate > WebClient

| 技术 | 同步/异步 | 推荐程度 | 场景 |
|------|----------|---------|------|
| RestTemplate | 同步 | ⭐⭐ | 老项目 |
| RestClient   | 同步 | ⭐⭐⭐⭐ | 新项目 |
| WebClient    | 异步 | ⭐⭐⭐ | 高并发 |
| OkHttp       | 底层 | ⭐⭐⭐⭐ | SDK |

## 1️⃣ RestTemplate（老牌方案）

来自 Spring Framework

**特点：**

- 同步阻塞
- API 简单（getForObject / postForEntity）
- 已被官方标记为“**不再推荐新项目使用**”（但还没废弃）

**适用场景：**

- 老项目维护
- 简单调用第三方接口

------

## 2️⃣ RestClient（新一代同步客户端）

来自 Spring Framework（Spring 6+）

**特点：**

- 同步（阻塞）
- **链式调用，API更现代**
- 官方推荐替代 RestTemplate

```
restClient.get()
    .uri(url)
    .retrieve()
    .body(String.class);
```

**优势：**

- 写法更优雅
- 和 WebClient 风格统一

👉 可以理解为：**RestTemplate 的升级版**

------

## 3️⃣ WebClient（响应式客户端）

来自 Spring WebFlux

**特点：**

- 异步 / 非阻塞（Reactive）
- 基于 Mono / Flux
- 支持高并发

```
webClient.get()
    .uri(url)
    .retrieve()
    .bodyToMono(String.class);
```

**适用场景：**

- 高并发系统
- 网关 / 微服务
- 流式处理

⚠️ 注意：

- 引入响应式编程复杂度
- 如果你整个项目是 MVC（同步），不建议强上

------

## 4️⃣ OkHttp（底层 HTTP 客户端）

来自 Square

**特点：**

- 纯 HTTP 客户端（不是 Spring 的）
- 性能优秀
- 连接池、HTTP2、拦截器很强

```
OkHttpClient client = new OkHttpClient();
Request request = new Request.Builder().url(url).build();
Response response = client.newCall(request).execute();
```

**适用场景：**

- 自定义 HTTP 行为（比如重试、签名）
- SDK 开发
- 非 Spring 项目

👉 在 Spring 里一般作为底层被封装（比如给 WebClient 用）

## 重点：虚拟线程时代谁更香？

在 Java 21 虚拟线程普及后，**OkHttp 变得非常受欢迎**。

因为 `WebClient` 的响应式编程（Reactor/WebFlux）学习曲线太陡峭了。很多开发者发现：

> **“虚拟线程 + OkHttp”** 或者 **“虚拟线程 + RestClient (用OkHttp作底)”**

这种组合既能享受同步代码的**简单易读**，又能获得类似异步框架的**超高并发能力**。

## 最佳实践

### 1. RestClient + OkHttp (业务开发首选)

如果你是在开发传统的 Spring Boot 业务（比如微服务之间调接口、对接第三方支付等），**RestClient 是“高级感”的代名词**。

- **自动 JSON 转换**：你只需定义 `User.class`，RestClient 配合 Jackson 自动帮你完成序列化。而原生 OkHttp 需要你自己调用 `objectMapper.readValue()`。
- **异常处理更优雅**：RestClient 提供了 `onStatus()` 等方法来集中处理 4xx、5xx 错误，不用满地写 `if (response.isSuccessful())`。
- **配置解耦**：你可以在一个地方统一配置 OkHttp 的超时、连接池、拦截器，然后把它注入给 RestClient。业务代码只需要关注 URL 和参数。
- **URL 模板支持**：它原生支持变量替换，比如 `.uri("/users/{id}", 1)`，这比字符串拼接要安全且清晰得多。

**适用场景：** Spring Boot 业务逻辑、微服务调用、日常 API 对接。

------

### 2. 直接上 OkHttp (底层/特殊场景首选)

如果你脱离了 Spring 环境，或者有极其精细的控制需求，原生 OkHttp 是“自由”的象征。

- **轻量无依赖**：如果你写的是一个 Android App 或者一个追求极小体积的独立 JAR 包，不想带上庞大的 Spring 依赖，OkHttp 是最佳选择。
- **协议全家桶**：正如我们刚才讨论的，如果你需要 **WebSocket**、**HTTP/2** 深度定制、或者是复杂的 **多部分上传 (Multipart)**，直接操作 OkHttp 的 API 会更直观，没有中间层的“隔靴搔痒”。
- **拦截器高度定制**：OkHttp 的拦截器链（Interceptor Chain）非常强大，如果你要写复杂的重试逻辑、加密解密层，直接操作 OkHttp 会更丝滑。

**适用场景：** WebSocket 通信、Android 开发、SDK 开发、高性能中间件、非 Spring 项目。

### 3. 为什么不建议“直接上”原生的 RestClient？

`RestClient` 默认的底层发动机（JDK `HttpURLConnection`）比较老旧，存在以下硬伤：

- **连接池支持极差**：每次请求可能都在新建和关闭 TCP 连接，在高并发（即便有虚拟线程）下，频繁的握手会带来明显的延迟。
- **超时控制不灵活**：虽然能设超时，但在复杂的网络环境下，它的表现不如专业库稳健。
- **缺少高级特性**：比如透明的 Gzip 压缩、HTTP/2 支持、更完善的重试机制等。

