## 发送 JSON

### 推荐：用 Jackson

Spring Boot 默认已经有 `Jackson`（`ObjectMapper`）。

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.socket.*;

public class MyWebSocketHandler extends TextWebSocketHandler {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {

        // 构造返回对象
        Map<String, Object> response = new HashMap<>();
        response.put("type", "greeting");
        response.put("message", "Hello WebSocket");
        response.put("timestamp", System.currentTimeMillis());

        // 转成 JSON
        String json = objectMapper.writeValueAsString(response);

        // 发送
        session.sendMessage(new TextMessage(json));
    }
}
```

------

### 推荐封装一个工具方法（更优雅）

如果你项目里很多地方要发 JSON，可以封装：

```
public class WsUtil {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static void sendJson(WebSocketSession session, Object data) {
        try {
            String json = objectMapper.writeValueAsString(data);
            session.sendMessage(new TextMessage(json));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
```

然后：

```
WsUtil.sendJson(session, responseObject);
```

### 多线程写同一个WebSocketSession情况（比 synchronized 更好）

Spring 官方推荐方式：

使用：

```
ConcurrentWebSocketSessionDecorator
```

它内部已经帮你做了：

- 写入缓冲
- 超时控制
- 并发保护

示例：

```
@Override
public void afterConnectionEstablished(WebSocketSession session) {

    WebSocketSession safeSession =
        new ConcurrentWebSocketSessionDecorator(
            session,
            5000,   // 发送超时时间
            1024 * 1024  // 缓冲区大小
        );

    sessions.put(session.getId(), safeSession);
}
```

之后你用的是 `safeSession`。

这样就不需要 `synchronized` 了。

✅ 生产环境推荐用这个。

## 全局的 WebSocket 异常拦截

### 方案：自定义装饰器 (Decorator)

这种方式的好处是：**一处编写，到处生效**。你不需要在每个 `handleTextMessage` 里写 `try-catch`。

#### 1. 编写全局异常包装类

这个类负责包裹真正的 `Handler`，并捕获它抛出的所有异常。

```java
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class ExceptionHandlingWebSocketHandlerDecorator extends WebSocketHandlerDecorator {

    public ExceptionHandlingWebSocketHandlerDecorator(WebSocketHandler delegate) {
        super(delegate);
    }

    @Override
    public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
        try {
            // 调用原本的业务逻辑（即你写的 MyWebSocketHandler）
            super.handleMessage(session, message);
        } catch (Exception e) {
            log.error("WebSocket 处理消息发生异常，SessionID: {}", session.getId(), e);
            
            if (session.isOpen()) {
                // 给前端一个友好的错误提示，防止前端干等
                String errorJson = "{\"type\":\"error\",\"message\":\"Internal Server Error\"}";
                session.sendMessage(new TextMessage(errorJson));
                
                // 根据业务决定是否关闭连接
                // session.close(CloseStatus.SERVER_ERROR);
            }
        }
    }
}
```

#### 2. 在配置类中应用

在 `WebSocketConfigurer` 中注册时，把你的 `MyWebSocketHandler` 套进装饰器里。

```java
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(myHandler(), "/ws")
                .setAllowedOrigins("*");
    }

    @Bean
    public WebSocketHandler myHandler() {
        // 将你的业务 Handler 包装起来
        return new ExceptionHandlingWebSocketHandlerDecorator(new MyWebSocketHandler());
    }
}
```