---
title: Java 异步方案对比
icon: mdi:sync
---

# Java 异步方案对比

真正的 java 异步，但不好用。

目前主要用在：

-  极致吞吐
- Streaming / backpressure
- Netty 生态

## Loom 虚拟线程（协程）

另辟蹊径对标反击 .NET 的 `async/await`。

开启虚拟线程只需要在 `application.properties` 加一行配置：

```
spring.threads.virtual.enabled=true
```

它们解决的是 **不同层问题**。

| 技术         | 解决问题     |
| ------------ | ------------ |
| epoll / IOCP | IO效率       |
| Netty        | 高效 IO 框架 |
| async/await  | 线程不阻塞   |
| Loom         | 线程成本低   |

## 未来 Java 高并发 WebSocket：Netty + Loom

IO效率 = Netty

代码可读性 = 同步代码

并发能力 = Loom

##  目前 Java 高并发 WebSocket

1. Spring Boot WebSocket：开发简单，性能一般

2. Spring WebFlux WebSocket：高并发，但 Reactive 编程复杂

3. **Netty**：性能极高，需要自己搭很多基础设施

对于绝大多数项目：**直接用 Spring Boot 做 WebSocket 是完全合理的选择。**

只有当系统达到：

```
10万+
甚至百万连接
```

才需要认真考虑 **Netty**。