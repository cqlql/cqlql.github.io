---
title: URL 参数获取
icon: mdi:link
---

# URL 参数获取

👉 获取 URL 参数的方式取决于你在哪一层：

| 场景                     | 推荐方式                               |
| ------------------------ | -------------------------------------- |
| Controller（Spring MVC） | `@RequestParam` ✅                      |
| Controller（底层写法）   | `HttpServletRequest.getParameter()`    |
| WebFlux / Gateway        | `ServerHttpRequest.getQueryParams()` ✅ |
| WebSocket                | URI 解析（最稳）✅                      |
| 通用工具类               | `UriComponentsBuilder` ✅               |

------

# 二、各场景详细说明

------

## 1️⃣ Controller（最推荐方式）

```
@GetMapping("/test")
public String test(@RequestParam String ticket) {
    return ticket;
}
```

👉 特点：

- ✅ 最简洁
- ✅ 自动校验
- ✅ 支持默认值 / required

扩展：

```
@RequestParam(required = false, defaultValue = "") String ticket
```

------

## 2️⃣ Controller（传统写法）

```
String ticket = request.getParameter("ticket");
```

👉 使用类：

- `HttpServletRequest`

👉 特点：

- 简单直接
- 但不如 `@RequestParam` 优雅

------

## 3️⃣ WebFlux / Gateway（推荐）

```
String ticket = request.getQueryParams().getFirst("ticket");
```

👉 使用类：

- `org.springframework.http.server.reactive.ServerHttpRequest`

👉 特点：

- ✅ 原生支持 query 参数
- ✅ 最干净（不用自己解析）

------

## 4️⃣ WebSocket（重点！）

```
URI uri = request.getURI();
String ticket = UriComponentsBuilder.fromUri(uri)
        .build()
        .getQueryParams()
        .getFirst("ticket");
```

👉 特点：

- ✅ 最稳定
- ✅ 不依赖 Servlet
- ✅ WebSocket 标准方案

------

## 5️⃣ 通用方式（强烈推荐掌握）

```
String ticket = UriComponentsBuilder
        .fromUri(request.getURI())
        .build()
        .getQueryParams()
        .getFirst("ticket");
```

👉 适用于：

- WebFlux
- WebSocket
- Gateway
- 自定义拦截器

👉 本质：

👉 **统一 URL 解析方案（跨框架）**

------

# 三、不同方式对比

| 方式             | 是否推荐 | 适用范围   | 备注         |
| ---------------- | -------- | ---------- | ------------ |
| `@RequestParam`  | ⭐⭐⭐⭐⭐    | Controller | 最优         |
| `getParameter`   | ⭐⭐⭐      | MVC        | 依赖 Servlet |
| `getQueryParams` | ⭐⭐⭐⭐⭐    | WebFlux    | 官方推荐     |
| URI 解析         | ⭐⭐⭐⭐⭐    | 全场景     | 最通用       |

------

# 四、最佳实践

你现在：

- 有 Web
- 有 WebSocket
- 未来可能有 Gateway

👉 建议统一一套工具 👇

------

## ✅ RequestUtils（推荐最终版）

```
public class RequestUtils {

    public static String getQueryParam(ServerHttpRequest request, String key) {
        return request.getQueryParams().getFirst(key);
    }

    public static String getQueryParam(URI uri, String key) {
        return UriComponentsBuilder.fromUri(uri)
                .build()
                .getQueryParams()
                .getFirst(key);
    }
}
```

------

# 五、进阶建议（很关键）

👉 URL 参数 ≠ 唯一传参方式

在真实项目中：

| 方式          | 使用场景        |
| ------------- | --------------- |
| query 参数    | WebSocket / GET |
| header        | token（推荐）   |
| body          | POST 请求       |
| path variable | 资源定位        |

------

# 六、一句话总结

👉 **Controller 用注解，底层用 URI，WebFlux 用 getQueryParams**