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

```
public class AudioStreamSession {

    private final Consumer<String> onClose;
    private final BiConsumer<String, Throwable> onError;

    public AudioStreamSession(Consumer<String> onClose,
                              BiConsumer<String, Throwable> onError) {
        this.onClose = onClose;
        this.onError = onError;
    }
}
```

调用：

```
new AudioStreamSession(
    this::handleSessionClosed,
    this::handleSessionError
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

