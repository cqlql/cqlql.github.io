

---
title: WebSocket 认证方案
icon: mdi:shield-account
---

# WebSocket 认证方案

JWT 传输，由于标准的浏览器 WebSocket API 不支持自定义 Header，所以只能通过 **URL 参数**或者在 **STOMP 握手帧**中传递，或者使用**一次性票据**

### Session

不能使用 jwt

### 标准 STOMP 协议

没有成熟稳定的第三方依赖，**SockJS** 已经处于“半退役”状态

### token直接放url上

不够安全。可通过使用 **WSS (TLS加密)**，并关闭服务器的参数日志记录，勉强解决

### 一次性票据方案(Ticket/One-time Token)（推荐）

github、微信也是这种做法。

先通过post请求拿到临时票据，有效期设为极短（如 30 秒），客户端再用这个 `ticket` 去连接 WebSocket，验证通过后立即删除。由于票据是一次性的且过期飞快，即便日志泄露也无法被二次利用。

#### Ticket vs Token 对比

| 方案         | 安全性 | 复杂度 | 推荐     |
| ------------ | ------ | ------ | -------- |
| Session      | 中     | 低     | 内网     |
| JWT URL      | 低     | 低     | 不推荐   |
| Header Token | 高     | 中     | 非浏览器 |
| **Ticket**   | **高** | 中     | ⭐推荐    |