---
title: 回调（Callback）
icon: mdi:call-made
---

# 回调（Callback）

## 函数式回调（Functional Callback）

### 自定义函数

业务语义更清晰

 1. 触发者：`AudioStreamSession`

```java
public class AudioStreamSession {
    private final String sessionId;
    private final CloseListener closeListener;

    /**
     * 在内部声明函数式接口，属于 Session 组件的一部分
     */
    @FunctionalInterface
    public interface CloseListener {
        void onClosed(String sessionId);
    }

    // 构造函数只负责初始化，不应该在构造时就触发“关闭”回调
    public AudioStreamSession(String sessionId, CloseListener closeListener) {
        this.sessionId = sessionId;
        this.closeListener = closeListener;
    }

    public String getSessionId() {
        return sessionId;
    }

    /**
     * 模拟通道关闭、或者客户端断开连接的实际触发点
     */
    public void destroy() {
        // 1. 执行 Session 自身的资源释放（如关闭底层套接字、清理流媒体缓冲区等）
        System.out.println("Session " + sessionId + " 正在释放自身资源...");

        // 2. 触发回调，通知外部（Service）
        if (closeListener != null) {
            closeListener.onClosed(sessionId);
        }
    }
}

```

2. 监听者：`AudioStreamingService`

```java
public class AudioStreamingService {
    private final Map<String, AudioStreamSession> streamSessions = new ConcurrentHashMap<>();

    public void open(WebSocketSession session) {
        String sessionId = session.getId();
        
        // 使用方法引用 this::handleSessionClosed，自动匹配 AudioStreamSession.CloseListener
        AudioStreamSession audioSession = new AudioStreamSession(sessionId, this::handleSessionClosed);
        
        streamSessions.put(sessionId, audioSession);
        System.out.println("成功开启并缓存 Session: " + sessionId);
    }

    /**
     * 核心业务清理逻辑
     */
    private void handleSessionClosed(String sessionId) {
        streamSessions.remove(sessionId);
        System.out.println("【回调触发】Service 已清理缓存中的 Session: " + sessionId);
    }
}

```



### 内置函数

1. 会话类（持有两个函数回调）
```java
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public class AudioStreamSession {
    private final Consumer<String> onClose;
    private final BiConsumer<String, Throwable> onError;

    // 构造注入回调
    public AudioStreamSession(Consumer<String> onClose, BiConsumer<String, Throwable> onError) {
        this.onClose = onClose;
        this.onError = onError;
    }

    // 模拟出错，触发异常回调
    public void testError(String sessionId) {
        onError.accept(sessionId, new Exception("流异常"));
    }

    // 模拟关闭，触发关闭回调
    public void testClose(String sessionId) {
        onClose.accept(sessionId);
    }
}
```

2. 调用方（写回调处理方法，方法引用传入）
```java
public class Caller {
    // 关闭回调方法
    public void handleSessionClosed(String id) {
        System.out.println("会话关闭：" + id);
    }

    // 异常回调方法
    public void handleSessionError(String id, Throwable e) {
        System.out.println("会话异常：" + id + "，原因：" + e.getMessage());
    }

    public static void main(String[] args) {
        Caller caller = new Caller();

        // 传入两个回调方法引用
        AudioStreamSession session = new AudioStreamSession(
                caller::handleSessionClosed,
                caller::handleSessionError
        );

        // 内部主动执行回调
        session.testError("sid_001");
        session.testClose("sid_001");
    }
}
```

3. Java Lambda 匿名函数（和JS箭头函数最像）
不用提前写 `handleXXX` 方法，当场写逻辑
```java
AudioStreamSession session = new AudioStreamSession(
    // 对应 onClose Consumer<String>
    id -> System.out.println("关闭：" + id),
    // 对应 onError BiConsumer<String, Throwable>
    (id, err) -> System.out.println("异常：" + id + " " + err.getMessage())
);
```

## 单监听器的事件回调模式（Listener Pattern + Callback Interface）

```java
public class DoubaoRealtimeClient extends WebSocketListener {

    private final DoubaoRealtimeListener eventListener;

    public DoubaoRealtimeClient(DoubaoRealtimeListener listener) {

        this.eventListener = listener;
    }

    public interface DoubaoRealtimeListener {
        void onOpen();

        void onReady();

        void onTextMessage(String text);

        void onAudioMessage(byte[] data);

        void onError(Throwable t, @Nullable Response response);

        void onClose(String reason);
    }



    @Override
    public void onOpen(WebSocket webSocket, Response response) {

        if (eventListener != null) {
            eventListener.onOpen();
        }
    }

    @Override
    public void onMessage(WebSocket webSocket, String text) {
        eventListener.onTextMessage(text);

    }

    @Override
    public void onMessage(WebSocket webSocket, ByteString bytes) {
        eventListener.onAudioMessage(bytes.toByteArray());
    }

    @Override
    public void onFailure(WebSocket webSocket, Throwable t, @Nullable Response response) {

        eventListener.onError(t, response);
    }

    @Override
    public void onClosing(WebSocket webSocket, int code, String reason) {
        eventListener.onClose(reason);
    }

    @Override
    public void onClosed(WebSocket webSocket, int code, String reason) {

    }

}

```

