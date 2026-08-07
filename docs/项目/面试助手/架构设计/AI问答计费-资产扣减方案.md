---
title: AI问答计费-资产扣减方案
icon: mdi:handshake-outline
sort: 99
---

# AI 问答计费 / 次数消耗方案

针对 PassUp 这种 **AI 问答计费/次数消耗** 场景，不直接在 `user` 表加字段，也不只靠聊天记录统计，而是设计成 **资产扣减 + 使用流水** 体系。

## 核心思路

- 不要统计，直接记账。
- `user_asset_log` 记录每次消耗
- `user_asset.balance` 保存当前余额
- `ai_chat_message` 保存聊天内容

## 已有资产体系

项目中已有：

| 表 | 说明 |
|---|---|
| `user_asset` | 用户资产余额 |
| `user_asset_log` | 资产变动流水 |

资产类型：

| 类型 | 说明 |
|---|---|
| `AI_CHAT_COUNT` | AI 问答次数 |
| `INTERVIEW_MINUTES` | 面试分钟 |
| `VIP_DAYS` | VIP 天数 |

---

## 1. 用户资产余额表 `user_asset`

```sql
id
user_uid
asset_type        -- AI_CHAT_COUNT
balance           -- 剩余次数
version           -- 乐观锁
created_at
updated_at
```

示例：

| user_uid | asset_type    | balance |
| -------- | ------------- | ------- |
| U001     | AI_CHAT_COUNT | 98      |

---

## 2. 资产变动流水表 `user_asset_log`（核心）

```sql
id
user_uid

asset_type
change_type       -- CONSUME / RECHARGE / GIVE

amount            -- -1
balance_before
balance_after

biz_type          -- AI_CHAT
biz_id            -- chat_message_id

created_at
```

### 一次 AI 问答流程

```
用户提问
 ↓
AI 生成回答成功
 ↓
扣减 AI_CHAT_COUNT -1
 ↓
写 user_asset_log
```

流水示例：

| user | type          | amount | biz_type |
| ---- | ------------- | ------ | -------- |
| U001 | AI_CHAT_COUNT | -1     | AI_CHAT  |

---

## 3. AI 聊天记录表（独立）

聊天记录负责 **历史记录**，不是 **计费统计**。

```sql
ai_chat_session
  id
  user_uid
  title
  created_at


ai_chat_message
  id
  session_id
  role              -- user / assistant
  content
  token_input
  token_output
  model
  status
  created_at
```

---

## 4. 扣次数时机

不要用户发送问题立即扣，而是 **AI 成功返回后再扣**：

```
用户发送问题
 ↓
创建 message(user)
 ↓
调用 LLM
 ↓
成功返回 answer
 ↓
事务:
    保存 assistant message
    扣 AI_CHAT_COUNT
    写 asset_log
 ↓
返回结果
```

> 原因：AI 失败不应该消耗用户次数。

---

## 5. 并发控制

用户余额为 `1`，同时打开两个页面发起请求，需要防止超卖。

**正确做法**（原子更新 + 条件判断）：

```sql
update user_asset
set balance = balance - 1
where user_uid=?
and asset_type='AI_CHAT_COUNT'
and balance > 0
```

判断影响行数：

| affected rows | 含义 |
|---|---|
| `0` | 次数不足 |
| `1` | 扣成功 |

**错误做法**（有并发问题）：

```sql
-- 先查
select balance
-- 再判断
if(balance > 0)
  update
```

> 这种先查后改会超卖。

---

## 6. 为什么不在 AI_CHAT 表统计？

假如用聊天记录统计次数：

```sql
select count(*)
from ai_chat_message
where user_id=xxx
```

存在以下问题：

### 6.1 免费赠送不好处理

| 来源 | 增加 |
|---|---|
| 注册赠送 | `AI_CHAT_COUNT +10` |
| 充值 | `AI_CHAT_COUNT +100` |
| 活动 | `AI_CHAT_COUNT +50` |

你无法回答：**当前用户为什么还有 83 次？**

### 6.2 删除消息会影响余额

用户删除聊天记录后，次数怎么算？

### 6.3 AI 失败怎么办？

用户提问后 LLM timeout，应该不扣次数——资产流水更容易处理这种场景。

---

## 7. 后期扩展

资产体系统一后，新增计费类型只需加资产类型：

| 扩展场景 | 资产类型 |
|---|---|
| AI 问答按 token 收费 | `AI_TOKEN` |
| 面试分钟 | `INTERVIEW_MINUTES` |
| 图片生成次数 | `IMAGE_GENERATE_COUNT` |

统一模型：

```
用户资产系统
        |
        |
   user_asset
        |
   user_asset_log
```

---

## 8. 建议最终结构

```
user
 |
 +-- user_asset
 |
 +-- user_asset_log


ai_chat_session
 |
 +-- ai_chat_message


recharge_order
 |
 +-- asset_grant
```

关系：

```
充值订单
   |
   v
增加资产
   |
   v
user_asset_log (+100)


AI 问答
   |
   v
消耗资产
   |
   v
user_asset_log (-1)
```
