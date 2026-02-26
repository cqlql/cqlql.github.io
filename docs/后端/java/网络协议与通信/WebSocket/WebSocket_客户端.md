# WebSocket_客户端

## 对比（流式语音处理）

针对**流式语音处理**（通常涉及高频发送二进制包、低延迟要求、以及可能的异常断连重连），我给出的推荐排序和详细分析如下：

### 核心结论：首选 **[OkHttp](https://github.com/square/okhttp)**

| **方案**               | **推荐指数** | **优势**                                               | **劣势**                                          |
| ---------------------- | ------------ | ------------------------------------------------------ | ------------------------------------------------- |
| **[OkHttp](https://github.com/square/okhttp)**             | ⭐⭐⭐⭐⭐        | **工业级标准**、自动心跳、API 极其简洁、支持多种拦截器 | 需要引入额外依赖                                  |
| **Java 11 HttpClient** | ⭐⭐⭐⭐         | **原生无依赖**、支持 Reactive Streams (Flow)、性能优秀 | 缺少自动重连、心跳需手动实现                      |
| **[TooTallNate](https://github.com/TooTallNate/Java-WebSocket)**        | ⭐⭐⭐          | 纯 Java 实现、历史悠久                                 | API 较老、维护活跃度一般、性能略逊于现代 NIO 框架 |
| **Spring WebSocket**   | ⭐⭐           | 适合 STOMP 协议、集成 Spring 体系                      | 客户端模式较重、流式原始二进制处理稍显繁琐        |

------

### 1. 为什么流式语音最推荐 OkHttp?

流式语音（如对接 ASR 语音识别或 TTS 语音合成）的关键点在于：**稳定性 > 绝对并发量**。

- **自动心跳（Ping/Pong）：** 语音流传输时间较长，OkHttp 可以简单通过 `.pingInterval(10, TimeUnit.SECONDS)` 维持长连接，防止被网关断开。
- **背压与流控：** OkHttp 内部基于 Okio，处理 `ByteString`（字节数组封装）非常高效，非常适合音频分片发送。
- **容错性：** 它的连接池和错误恢复机制比原生 Java 实现更成熟。

### 2. 如果追求“原生/轻量”，选 Java 11 HttpClient

如果你不想增加项目体积（如在微服务瘦客户端中），Java 11 的 `java.net.http.WebSocket` 是极佳选择。

- **响应式支持：** 它的 `Listener` 接口原生支持 `onBinary(ByteBuffer data, boolean last)`，可以直接对接 Java 9+ 的 Flow API。
- **性能：** 它是基于 NIO 定义的，异步处理能力非常强。
- **缺点：** 它太“干净”了，你得自己写 `ScheduledExecutorService` 来定时发 Ping 包，也要自己实现指数退避的重连逻辑。

### 3. TooTallNate/Java-WebSocket：仅推荐用于特殊兼容性

这个库在 Java 8 时代是主流，因为它不依赖于容器环境。

- **现状：** 虽然还在维护，但在现代异步编程模型（CompletableFuture/Reactive）下显得有些格格不入。如果你的项目中已经有了它，或者需要极其精细地控制底层的 TCP 参数，可以考虑。

### 4. Spring WebSocket Client：慎选

Spring 的 WebSocket 封装主要是为了 **STOMP** 或 **SockJS** 协议设计的。

- **痛点：** 如果你只是连接一个标准的 Web API（比如 OpenAI 或 讯飞的语音接口），使用 Spring 的 `StandardWebSocketClient` 会引入过多的 Spring 上下文依赖，且对于原始 Binary 流的操作不如 OkHttp 直观。

------

### 代码示例：使用 OkHttp 发送语音流

```java
OkHttpClient client = new OkHttpClient.Builder()
    .pingInterval(10, TimeUnit.SECONDS) // 关键：自动维持语音长连接
    .build();

Request request = new Request.Builder().url("wss://voice-api.example.com").build();

WebSocket ws = client.newWebSocket(request, new WebSocketListener() {
    @Override
    public void onMessage(WebSocket webSocket, ByteString bytes) {
        // 处理返回的语音解析结果
        System.out.println("收到响应: " + bytes.utf8());
    }
});

// 模拟发送语音流切片
byte[] audioData = ...; 
ws.send(ByteString.of(audioData)); 
```

### 总结建议

1. **工程实践：** 直接上 **OkHttp**，它处理了 90% 你还没遇到的网络坑（断网、代理、TLS、心跳）。
2. **追求极致纯净：** 使用 **Java 11 原生**，但要做好自己写心跳和重连代码的准备。
3. **音频处理小提示：** 发送语音流时，务必注意**单次发送的 Buffer 大小**，建议控制在 10ms - 40ms 的音频时长对应的大小，以保证实时感。