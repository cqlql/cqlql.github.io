---
title: WebSocket 客户端
icon: mdi:desktop-classic
---

# WebSocket 客户端

## OkHttp

使用简单，Android开发标配。

## Java 11 HttpClient

原生/轻量，深度适配**虚拟线程**

### runAsync对比completedFuture

runAsync 将新开线程，WebSocket 会等你执行完。可以指定虚拟线程。

completedFuture 当前线程执行，WebSocket 认为你已经处理完，将立即接收下一条消息。

也就是说，异步任务用 runAsync ，同步任务用 completedFuture 



runAsync 例子

```java
private final Executor executor = Executors.newVirtualThreadPerTaskExecutor();

@Override
public CompletionStage<?> onBinary(WebSocket webSocket, ByteBuffer data, boolean last) {
    byte[] chunk = new byte[data.remaining()];
    data.get(chunk);

    // 新开一个线程
    return CompletableFuture.runAsync(() -> {
        // 这里必须同步阻塞
        String result = llmClient.askSync(data);
    }, executor);
}
```



completedFuture 例子

```
@Override
public CompletionStage<?> onBinary(WebSocket webSocket, ByteBuffer data, boolean last) {
    byte[] chunk = new byte[data.remaining()];
    data.get(chunk);
    
    // 这里必须同步阻塞
    String result = llmClient.askSync(data);
    
	return CompletableFuture.completedFuture(null);    
}
```

