---
title: App 防冒充方案
icon: mdi:cellphone-lock
sort: 4
---

# App 防冒充方案

防止客户端 App 被伪造、重放、模拟器攻击。**注意：以下手段是「提高攻击成本」，没有绝对防冒充**——安全是层层叠加的纵深防御。

------

## 方案对比

| 方案                       | 成本 | 防御强度 | 适用场景             |
| -------------------------- | ---- | -------- | -------------------- |
| **请求签名 (Sign)**        | 中   | 高       | 绝大多数商业 App     |
| **设备指纹**               | 中   | 较高     | 预防羊毛党、批量刷票 |
| **双向证书校验 (Pinning)** | 高   | 极高     | 金融、支付、隐私类   |
| **硬件验证 (Attest)**      | 高   | 最高     | 核心机密、防止模拟器 |

> 实际项目中通常**组合使用**：签名 + 设备指纹打底，金融类再加 Pinning / Attest。

------

## 方案详解

### 1. 请求签名 (Sign)

最通用的防冒充手段：客户端与服务端共享密钥，每个请求用密钥生成签名。

```
请求参数（按约定排序）+ timestamp + nonce + 密钥 → HMAC-SHA256 → sign
```

服务端收到后用同样方式计算并比对；即使攻击者抓包拿到请求，因不知道密钥也无法伪造签名。

**防重放三要素：**

- **timestamp（时间戳）**：服务端校验 `|now - timestamp|` 在允许窗口内（如 ±5 分钟），超窗直接拒绝。
- **nonce（随机数）**：每次请求附带唯一 nonce，服务端用 Redis `SETNX` 记录，已存在则视为重放。
- **签名覆盖 timestamp + nonce**：确保二者无法被篡改替换。

**密钥管理：**

- 密钥存于 App 安全区（Keychain / Keystore），❌ 不要硬编码在代码中（可被逆向提取）。
- 可配合「动态下发密钥」进一步降低泄露风险。

**参考实现（服务端校验）：**

```java
public boolean verifySign(Map<String, String> params, String sign) {
    // 1. 剔除 sign，按 key 字典序拼接
    String raw = params.entrySet().stream()
            .filter(e -> !"sign".equals(e.getKey()))
            .sorted(Map.Entry.comparingByKey())
            .map(e -> e.getKey() + "=" + e.getValue())
            .collect(Collectors.joining("&"));

    // 2. 计算签名
    String expected = hmacSha256Hex(raw, appSecret);

    // 3. 常量时间比较，防时序攻击
    return MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.UTF_8),
            sign.getBytes(StandardCharsets.UTF_8));
}
```

### 2. 设备指纹

收集设备硬件 / 系统特征生成唯一标识，用于识别异常设备、风控与限流。

常见维度：设备型号、系统版本、屏幕分辨率、时区、语言、安装应用列表、传感器特征等。

⚠️ 注意：单一维度易被伪造（如改机型），应**多维度组合 + 权重**提高稳定性；同时遵守隐私合规，避免采集敏感信息。

### 3. 双向证书校验 (SSL Pinning)

App 内嵌服务端证书或公钥，只信任指定证书，防止中间人攻击（即使安装了伪 CA）。

- **证书锁定**：绑定具体证书，证书轮换需发版。
- **公钥锁定**：绑定公钥，证书续签（同密钥对）不受影响，运维更友好。

⚠️ 失效风险：证书轮换时旧版本 App 会连不上，需做好降级与灰度。

### 4. 硬件验证 (SafetyNet / App Attest)

利用平台能力验证设备完整性与 App 真实性：

- **Android**：Play Integrity API（原 SafetyNet）判断是否为真机、未被篡改、非模拟器。
- **iOS**：App Attest 证明 App 实例真实且运行在合法设备。

返回的是**一次性挑战凭证**，需服务端校验后才放行核心接口，防模拟器与越狱设备效果最佳，但接入成本高。

------

## 落地建议

| 业务类型     | 推荐组合                              |
| ------------ | ------------------------------------- |
| 普通工具类   | 请求签名 + 时间戳/nonce 防重放        |
| 电商 / 社交  | 签名 + 设备指纹 + 风控限流            |
| 金融 / 支付  | 签名 + Pinning + App Attest / Play Integrity |
| 高敏后台     | 全部叠加 + 行为风控                   |
