# JWT + sid + jti + Redis key





## 二、Redis Key 设计（重点）

```
# access token → sid
auth:access:{jti} -> sid
TTL: 30 min

# refresh token → sid
auth:refresh:{refreshToken} -> sid
TTL: 7 days

# session 信息
auth:session:{sid} -> {
  userId,
  username,
  roles,
  jti,
  loginTime
}
TTL: 7 days
```

🔥 **只要 session 被删，所有 token 全部失效**

## 三、JWT Payload 设计（最简但够用）

```
{
  "sub": "1001",
  "sid": "sid-uuid",
  "jti": "access-jti-uuid",
  "exp": 1700000000
}
```

- `sub`：用户id
- `sid`：会话id→ 这次登录
- `jti`：用来找到具体的哪个token



## 登录流程（Login）

```
账号密码正确
   ↓
生成 sid
   ↓
生成 accessToken（15min）
生成 refreshToken（7d）
   ↓
写 Redis
   ↓
返回前端
```

## 校验逻辑（标准做法）

```
Header 带 accessToken
   ↓
解析 JWT 拿 sid
   ↓
Redis 查 auth:access:{token}
   ↓
存在 & sid 匹配 → 放行
```

## 刷新逻辑（正确姿势）

```
refreshToken → sid
   ↓
session 是否存在
   ↓
删除旧 accessToken
   ↓
生成新 accessToken
```

### 

## 💡 常见问答（FAQ）

### refreshToken 需要 JWT 吗？

refreshToken **不需要 JWT，直接 UUID 或 SecureRandom 就够了**。

大部分企业级系统，即使 accessToken 是 JWT，refreshToken 也**只用随机字符串**，用 Redis 管控