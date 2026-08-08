---
title: JWT Token 方案
icon: mdi:shield-key
---

# JWT Token 方案

## 可选库

- [JJWT](https://github.com/jwtk/jjwt)
- [Auth0 Java-JWT](https://github.com/auth0/java-jwt)
- [Hutool-JWT](https://github.com/chinabugotech/hutool)
- [Spring Security OAuth2](https://docs.spring.io/spring-security/reference/servlet/oauth2/index.html)

## 方案选择

- **简单场景**：直接使用 Hutool-JWT
- **规范场景**：Spring Security + Hutool-JWT，支持权限
