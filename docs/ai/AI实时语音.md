



# WebRTC API

```
WebRTC
比 WebSocket 更适合音频
```

优点：

```
UDP
低延迟
内置 jitter buffer
自动重传
```

## Java vs .NET WebSocket

| 技术                 | 并发       |
| -------------------- | ---------- |
| Spring Boot (Tomcat) | 5k – 20k   |
| ASP.NET Core         | 20k – 50k  |
| Spring WebFlux       | 50k – 100k |
| Netty                | 200k+      |

但绝大多数业务，Spring Boot (Tomcat)完全够用：

| 产品类型 | 同时在线    |
| -------- | ----------- |
| 企业系统 | 100 – 1000  |
| AI 面试  | 100 – 2000  |
| 教育直播 | 1000 – 5000 |
| IM       | 1万+        |

而 **Spring Boot WebSocket** 在合理配置下：

```
5000 – 20000 连接
```

是比较常见的。

所以很多项目其实 **用不到 Netty/WebFlux**。