

## 一句话结论（先给方向）

> **安全 Token：只选 SecureRandom**
>  UUID ≈ 唯一 ID
>  RandomStringUtils ≈ 普通随机字符串

------

## 1️⃣ RandomStringUtils.randomAlphanumeric

```
String token = RandomStringUtils.randomAlphanumeric(32);
```

### 本质

- **工具库级随机字符串生成**
- 底层：`java.util.Random`
- ❌ **非加密安全**

### 特点

| 项目     | 说明           |
| -------- | -------------- |
| 随机源   | `Random`       |
| 可预测性 | ⚠️ 有风险       |
| 字符集   | A–Z a–z 0–9    |
| 长度     | 完全可控       |
| 依赖     | Apache Commons |

### 适合场景

✅ requestId
 ✅ 临时标识
 ✅ UI 层的 key
 ❌ accessToken / refreshToken
 ❌ 登录态标识

> ⚠️ **一句狠话**：
>  RandomStringUtils 生成的 token **不应该拿来当“安全凭证”**

------

## 2️⃣ UUID.randomUUID()

```
String token = UUID.randomUUID().toString().replace("-", "");
```

### 本质

- **唯一标识（UUID v4）**
- 目标是：**不重复**，不是**不可预测**

### 特点

| 项目     | 说明                     |
| -------- | ------------------------ |
| 随机源   | SecureRandom（实现相关） |
| 可预测性 | 很低                     |
| 字符集   | 0–9 a–f                  |
| 长度     | 固定 32                  |
| 依赖     | JDK 原生                 |

### 适合场景

✅ sessionId
 ✅ 数据库主键
 ✅ 分布式唯一 ID
 ⚠️ token 勉强能用
 ❌ 高安全需求 token

> UUID 是 **“唯一”设计**，不是 **“安全”设计**

------

## 3️⃣ SecureRandom（推荐）

```
SecureRandom random = new SecureRandom();
byte[] bytes = new byte[32];
random.nextBytes(bytes);

String token = Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(bytes);
```

### 本质

- **密码学级随机数**
- 专门用来生成 **密钥 / token / nonce**

### 特点

| 项目     | 说明         |
| -------- | ------------ |
| 随机源   | OS 熵池      |
| 可预测性 | ❌ 几乎不可能 |
| 安全等级 | ⭐⭐⭐⭐⭐        |
| 长度     | 完全可控     |
| 依赖     | JDK 原生     |

### 适合场景

✅ accessToken
 ✅ refreshToken
 ✅ 重置密码 token
 ✅ OAuth / JWT jti / sid

> 💡 **真正的 Token，就该用它**

------

## 🔥 三者硬核对比表（收藏级）

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

## 🧠 放到你现在的 Redis Token 体系里

你之前问过：

- accessToken
- refreshToken
- jti / sid
- Redis 存储

👉 **最佳实践组合**

| 用途          | 推荐                 |
| ------------- | -------------------- |
| accessToken   | SecureRandom         |
| refreshToken  | SecureRandom         |
| jwt jti / sid | UUID 或 SecureRandom |
| requestId     | UUID                 |
| 前端 key      | RandomStringUtils    |

------

## 📌 记忆口诀（送你一个）

> **RandomStringUtils 看起来随机**
>  **UUID 保证不重复**
>  **SecureRandom 才是真的安全**

## TokenGenerator 工具类

```java
package com.example.utils;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

/**
 * Token 生成器工具类
 * <p>
 * - 安全随机 token: SecureRandom + Base64 URL-safe
 * - UUID token: 用于唯一标识、requestId
 */
public class TokenGenerator {

    // 密码学安全随机数生成器
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    // 默认 token 字节长度 (32 bytes = 256 bit)
    private static final int DEFAULT_TOKEN_BYTE_LENGTH = 32;

    private TokenGenerator() {
        // 私有构造器，防止实例化
    }

    /**
     * 生成安全随机 token（适合 accessToken / refreshToken）
     *
     * @return URL-safe Base64 字符串
     */
    public static String generateSecureToken() {
        return generateSecureToken(DEFAULT_TOKEN_BYTE_LENGTH);
    }

    /**
     * 生成指定长度的安全随机 token
     *
     * @param byteLength 字节长度
     * @return URL-safe Base64 字符串
     */
    public static String generateSecureToken(int byteLength) {
        byte[] bytes = new byte[byteLength];
        SECURE_RANDOM.nextBytes(bytes);
        // Base64 URL-safe 编码，无 padding
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * 生成 UUID 类型 token（适合 requestId / jti / sid）
     *
     * @return 32 位十六进制字符串
     */
    public static String generateUUIDToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    /**
     * 生成随机字母数字字符串（仅作非安全用途）
     *
     * @param length 长度
     * @return 字母数字字符串
     */
    public static String generateRandomAlphanumeric(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(SECURE_RANDOM.nextInt(chars.length())));
        }
        return sb.toString();
    }

    // 测试 main
    public static void main(String[] args) {
        System.out.println("Secure Token: " + generateSecureToken());
        System.out.println("UUID Token:   " + generateUUIDToken());
        System.out.println("Random Alpha: " + generateRandomAlphanumeric(32));
    }
}

```

