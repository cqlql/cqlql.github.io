# ContentCachingResponseWrapper 导致流式响应空 Body

**分类：** `#SpringBoot` `#StreamingResponseBody` `#SSE` `#Filter` `#Java` `#Backend`

**核心问题：** 当 `RequestLoggingFilter` 使用 `ContentCachingResponseWrapper` 包装响应时，流式接口（SSE / NDJSON / StreamingResponseBody）返回空 Body，打字机效果消失。

------

## 1. 为什么 `ContentCachingResponseWrapper` 会导致空 Body？

`ContentCachingResponseWrapper` 的设计初衷是记录 HTTP 响应日志。其实现原理：

1. **拦截并缓存**：把后端 `OutputStream` / `Writer` 输出的所有数据暂存在内存字节数组缓存区（Buffer）中，**不直接发给客户端**。
2. **延迟计算 Header**：请求方法执行完毕准备返回时，通过缓存区大小自动设置 `Content-Length` Header。

**这与流式响应机制发生严重冲突：**

```
主线程                                    异步线程
  |                                         |
  | Controller 返回 ResponseEntity          |
  | <StreamingResponseBody>                 |
  |                                         |
  | Filter 认为响应已结束                     |
  | → copyBodyToResponse()                   |
  | → 缓存区大小 = 0                          |
  | → 写入 Content-Length: 0                 |
  | → 提交(Commit)响应                        |
  |                                         |
  |                                         | 开始 write()...
  |                                         | 响应头已提交，Socket 拒绝写入
  |                                         | 数据被全部丢弃！
```

具体过程：

1. **异步执行脱节**：`StreamingResponseBody` 是**异步**在另一个线程中分化写出数据。
2. **主线程提前结束**：当请求到达 Controller 并返回 `ResponseEntity<StreamingResponseBody>` 时，主线程处理已完成。`RequestLoggingFilter` 以为响应结束，触发 `copyBodyToResponse()`。
3. **缓存区为 0 → 写入 `Content-Length: 0`**：主线程结束时，异步线程尚未开始写入任何字符，缓存区大小为 `0`。Filter 随即写入 `Content-Length: 0` 并提交响应。
4. **后续写入静默失效**：稍后异步线程开始 `write` 时，HTTP 响应头已提交，底层 Socket 拒绝或丢弃后续写入。

------

## 2. 修复方案

核心原则：针对流式端点，**不能对 Response 进行包装**。

### 方案：在 Filter 中排除流式路径

```java
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain)
            throws ServletException, IOException {

        String requestURI = request.getRequestURI();

        // 流式端点：只包装 Request，Response 保持原样直通
        if (requestURI.contains("/qna/chat")) {
            ContentCachingRequestWrapper requestWrapper =
                new ContentCachingRequestWrapper(request);
            filterChain.doFilter(requestWrapper, response); // 传原生 response
            return;
        }

        // 普通非流式接口：正常双包装
        ContentCachingRequestWrapper requestWrapper =
            new ContentCachingRequestWrapper(request);
        ContentCachingResponseWrapper responseWrapper =
            new ContentCachingResponseWrapper(response);

        try {
            filterChain.doFilter(requestWrapper, responseWrapper);
        } finally {
            responseWrapper.copyBodyToResponse(); // 写回原响应
        }
    }
}
```

------

## 3. 扩展：其他需要排除的流式场景

除了 `/qna/chat` 这类 AI 聊天端点，以下场景也需要排除 Response 包装：

- `text/event-stream`（SSE 推送）
- `application/x-ndjson`（NDJSON 流）
- `Transfer-Encoding: chunked` 的大文件下载

可在 Filter 中通过 `Accept` Header 或响应 `Content-Type` 判断：

```java
// 方案 A：预先排除已知的流式路径
if (requestURI.startsWith("/api/stream/")) {
    filterChain.doFilter(requestWrapper, response);
    return;
}

// 方案 B：通过请求 Accept 头判断
String accept = request.getHeader("Accept");
if (accept != null && accept.contains("text/event-stream")) {
    filterChain.doFilter(requestWrapper, response);
    return;
}
```

------

## 4. 总结

`ContentCachingResponseWrapper` 是 Spring Boot 开发流式接口（结合 Logging Filter）时最容易踩到的"空 Response 杀手"。排除对流式端点 Response 的包装后，流式打字机效果即可恢复正常。
