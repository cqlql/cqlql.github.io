---
title: Token 生成方案对比
icon: mdi:dice-multiple-outline
sort: 3
---

# Token 生成方案对比

## 一句话结论

> **安全 Token：只选 SecureRandom**
> UUID ≈ 唯一 ID
> RandomStringUtils ≈ 普通随机字符串

------

## 1. RandomStringUtils.randomAlphanumeric

```java
String token = RandomStringUtils.randomAlphanumeric(32);
```

**本质**：工具库级随机字符串生成，底层 `java.util.Random`，❌ 非加密安全。

| 项目     | 说明           |
| -------- | -------------- |
| 随机源   | `Random`       |
| 可预测性 | ⚠️ 有风险       |
| 字符集   | A–Z a–z 0–9    |
| 长度     | 完全可控       |
| 依赖     | Apache Commons |

适合场景：✅ requestId、临时标识、UI 层的 key
不适合场景：❌ accessToken / refreshToken、登录态标识

> ⚠️ RandomStringUtils 生成的 token **不应该拿来当"安全凭证"**

------

## 2. UUID.randomUUID()

```java
String token = UUID.randomUUID().toString().replace("-", "");
```

**本质**：唯一标识（UUID v4），目标是**不重复**，不是**不可预测**。

| 项目     | 说明                     |
| -------- | ------------------------ |
| 随机源   | SecureRandom（实现相关） |
| 可预测性 | 很低                     |
| 字符集   | 0–9 a–f                  |
| 长度     | 固定 32                  |
| 依赖     | JDK 原生                 |

适合场景：✅ sessionId、数据库主键、分布式唯一 ID
勉强能用：⚠️ token
不适合场景：❌ 高安全需求 token

> UUID 是**"唯一"设计**，不是**"安全"设计**

------

## 3. SecureRandom（推荐）

```java
SecureRandom random = new SecureRandom();
byte[] bytes = new byte[32];
random.nextBytes(bytes);

String token = Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(bytes);
```

**本质**：密码学级随机数，专门用来生成密钥 / token / nonce。

| 项目     | 说明         |
| -------- | ------------ |
| 随机源   | OS 熵池      |
| 可预测性 | ❌ 几乎不可能 |
| 安全等级 | ⭐⭐⭐⭐⭐       |
| 长度     | 完全可控     |
| 依赖     | JDK 原生     |

适合场景：✅ accessToken、refreshToken、重置密码 token、OAuth / JWT jti / sid

> 💡 真正的 Token，就该用它

------

## 三者对比

| 维度           | RandomStringUtils | UUID        | SecureRandom |
| -------------- | ----------------- | ----------- | ------------ |
| 设计目标       | 普通随机字符串    | 全局唯一 ID | 安全随机     |
| 安全性         | ❌                 | ⚠️           | ✅            |
| 可预测性       | 高                | 低          | 极低         |
| 碰撞概率       | 中                | 极低        | 极低         |
| 是否适合 Token | ❌                 | 勉强        | ✅            |
| 是否推荐生产用 | ❌                 | ⚠️           | ✅            |
| 是否需要依赖   | 是                | 否          | 否           |

------

## 重复可能性对比

| 方法                             | 随机位数 | Base64/UUID | 理论碰撞概率   | 适用场景                        |
| -------------------------------- | -------- | ----------- | -------------- | ------------------------------- |
| `SecureRandom 32 bytes + Base64` | 256      | Base64 URL  | 极低（接近零） | 高安全 token，比如 access token |
| `UUID.randomUUID()`              | 128      | UUID        | 很低           | 一般标识符、会话 ID             |

------

## 最佳实践组合

| 用途          | 推荐                 |
| ------------- | -------------------- |
| accessToken   | SecureRandom         |
| refreshToken  | SecureRandom         |
| jwt jti / sid | UUID 或 SecureRandom |
| requestId     | UUID                 |
| 前端 key      | RandomStringUtils    |

------

## TokenGenerator 工具类

```java
package com.example.utils;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

/**
 * Token 生成器工具类
 * - 安全随机 token: SecureRandom + Base64 URL-safe
 * - UUID token: 用于唯一标识、requestId
 */
public class TokenGenerator {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int DEFAULT_TOKEN_BYTE_LENGTH = 32;

    private TokenGenerator() {}

    /** 生成安全随机 token（适合 accessToken / refreshToken） */
    public static String generateSecureToken() {
        return generateSecureToken(DEFAULT_TOKEN_BYTE_LENGTH);
    }

    /** 生成指定长度的安全随机 token */
    public static String generateSecureToken(int byteLength) {
        byte[] bytes = new byte[byteLength];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** 生成 UUID 类型 token（适合 requestId / jti / sid） */
    public static String generateUUIDToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    /** 生成随机字母数字字符串（仅作非安全用途） */
    public static String generateRandomAlphanumeric(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(SECURE_RANDOM.nextInt(chars.length())));
        }
        return sb.toString();
    }

    public static void main(String[] args) {
        System.out.println("Secure Token: " + generateSecureToken());
        System.out.println("UUID Token:   " + generateUUIDToken());
        System.out.println("Random Alpha: " + generateRandomAlphanumeric(32));
    }
}
```

------

## 记忆口诀

> **RandomStringUtils 看起来随机**
> **UUID 保证不重复**
> **SecureRandom 才是真的安全**
