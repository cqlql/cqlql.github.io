## 整体架构

```
WebSocket
   ↓
SessionManager（内存 + Redis）
   ↓
BillingService（扣费）
   ↓
Redis（余额 + 会话）
   ↓
Scheduler（兜底扣费）
```

------

## Redis 结构设计

```
# 用户余额（秒）
user:balance:{userId} -> 3600

# 会话信息
ws:session:{sessionId} -> JSON
{
  userId,
  lastChargeTime
}

# 用户当前会话
user:session:{userId} -> sessionId
```

## 常见问题

### 为什么推荐redis？

- 天然倒计时
- 重启可恢复
- 自动通知（时间到了可以主动通知）
- 支持多实例 WebSocket





