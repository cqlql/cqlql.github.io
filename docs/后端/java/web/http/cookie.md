## 获取方式

### WebUtils.getCookie（可控性强）

如果你使用的是 Spring 框架（通常这类代码出现在 Spring Controller 或 Filter 中），可以使用 `WebUtils`。它直接把那一长串逻辑封装好了：

```java
import org.springframework.web.util.WebUtils;

// 只需要一行，优雅且易读
Cookie cookie = WebUtils.getCookie(request, "refresh_token");
String refreshToken = (cookie != null) ? cookie.getValue() : null;
```

### Optional + Stream (不推荐，过度设计)

如果你就是喜欢函数式风格，可以通过静态导入和减少中间变量来让它看起来清爽一些：

```java
String refreshToken = Optional.ofNullable(request.getCookies())
        .stream()
        .flatMap(Arrays::stream)
        .filter(c -> "refresh_token".equals(c.getName()))
        .findFirst()
        .map(Cookie::getValue)
        .orElse(null);
```

### @CookieValue（最优雅）

如果你是在 Spring MVC 的 Controller 中获取这个值，最优雅的方式是直接使用注解，让框架帮你注入：

```java
@GetMapping("/refresh")
public ResponseEntity<?> refreshToken(@CookieValue(name = "refresh_token", required = false) String refreshToken) {
    // 直接使用 refreshToken 变量即可
    return ResponseEntity.ok(refreshToken);
}
```