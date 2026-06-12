## 函数式回调（Functional Callback）

### 自定义函数

业务语义更清晰

```java
public class AudioStreamingService {
    private final Map<String, AudioStreamSession> streamSessions = new ConcurrentHashMap<>();

    public void open(WebSocketSession session) {
        streamSessions.put(session.getId(), new AudioStreamSession(this::handleSessionClosed));
    }

    @FunctionalInterface
    public interface SessionCloseListener {
        void onSessionClosed(String sessionId);
    }
}
```

```java
public class AudioStreamSession {
    private final SessionCloseListener closeListener;

    public AudioStreamSession(SessionCloseListener closeListener) {
        this.closeListener = closeListener;
        closeListener.onSessionClosed(sessionId);
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

