## refresh token 的作用

主要是**长期会话体验优化**，不用让用户频繁登录

## RefreshToken存储

Refresh Token 的安全性提升关键在于 **存储安全 + 生命周期管理 + 可撤销性**，而不是单纯存在。

### 存储策略

#### (1) 浏览器端

- **最安全**：HttpOnly Cookie
  - JS 无法访问，浏览器自动随请求发送
  - 注意 SameSite / CSRF 风险
- **不安全**：localStorage / sessionStorage / IndexedDB
  - 可被 XSS 攻击读取
  - 可通过加密 + 短期 Access Token 降低风险，但不能完全替代 Cookie

#### (2) 客户端 App（移动 / 桌面）

- **存储位置**：
  - iOS → Keychain
  - Android → EncryptedSharedPreferences / Keystore
  - 桌面 App → 系统 Keychain / Credential Manager / 加密文件
- **刷新请求**：必须显式从安全存储中读取 Refresh Token 并发送给刷新接口。

---

### 刷新流程

#### 浏览器（HttpOnly Cookie）

```
[Access Token 过期]
      ↓
浏览器发请求 /auth/refresh （Cookie 自动发送 Refresh Token）
      ↓
服务器验证 Refresh Token
      ↓
返回新 Access Token
```

#### 客户端 App

```
[Access Token 过期]
      ↓
从 Keychain/Keystore 读取 Refresh Token
      ↓
调用 /auth/refresh，显式带上 Refresh Token
      ↓
服务器验证 Refresh Token
      ↓
返回新 Access Token
      ↓
更新内存中 Access Token
```

### Refresh Token vs Access Token 可撤销性对比

| 类型                                   | 存储方式 | 是否可撤销   | 方法                    |
| -------------------------------------- | -------- | ------------ | ----------------------- |
| Access Token（JWT）                    | 无状态   | ❌天然无撤销 | 黑名单 / 缩短 TTL       |
| Refresh Token（JWT）                   | 无状态   | ❌天然无撤销 | 黑名单 / TTL / 绑定设备 |
| Access Token / Refresh Token（Redis）  | 状态化   | ✅天然可撤销 | 删除 Redis key          |
| Refresh Token（Cookie / App 安全存储） | 状态化   | ✅天然可撤销 | 删除服务器存储 token    |

> 核心区别：**撤销依赖服务器是否能查 token 状态**
