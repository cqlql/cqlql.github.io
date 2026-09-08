---
title: 面试时长充值-礼包批次FIFO方案
icon: mdi:clock-check-outline
sort: 99
---

# 面试时长充值 / 批次优先级消费方案（礼包批次优先 + 临期优先 + FIFO）

针对 PassUp「新增**单独充时长接口** + **礼包资产独立管理**（时长 + 次数，多次礼包先耗最早）+ **礼包有效期**（过期不可再消耗）」的方案选型与最终结论。

> 关联笔记：
> - [虚拟支付充值-资产发放方案](./虚拟支付充值-资产发放方案.md)：资产怎么**进来**（RECHARGE / 礼包下单与支付链路）
> - [AI问答计费-资产扣减方案](./AI问答计费-资产扣减方案.md)：资产怎么**消耗**（CONSUME / `user_asset` + `user_asset_log`）
> - [websocket计时扣费](./websocket计时扣费.md)：实时面试按秒扣费链路
>
> 本篇记录新引入的「批次（Batch）」概念，是在已有 `user_asset` 聚合余额体系之上**只为礼包叠加**的库存批次层，不另起炉灶建新余额表。
>
> **🔑 账本定位（最重要）**：`asset_batch.remaining_amount` 是「礼包（PACKAGE）资产（面试时长 + AI 次数）」的**唯一权威账本**；`user_asset.balance` 是「无批次需求充值（TOPUP / 赠送 / 调整 / 历史存量）」的**唯一权威账本**。二者按资产来源天然分工，互不重叠（详见第三节）。

---

## 一、背景与需求

### 1.1 现状

| 项 | 现状 |
|---|---|
| 资产模型 | `user_asset` 每用户每资产一行**聚合余额**；`INTERVIEW_SECONDS` 只存总秒数 |
| 充值方式 | 仅购买 `asset_package` 礼包 → `RechargeOrder`（jsonb 快照）→ 支付成功 → `RechargeAssetGrantService.grantAssets` → `BillingService.grantAsset` 累加进聚合余额 |
| 消耗方式 | `InterviewBillingService.doBilling` 心跳结算 → `BillingService.consumeAsset` 从聚合余额扣，**不区分来源 / 不区分批次** |
| 同桶来源 | 注册赠送 `INITIAL_GRANT`、邀请奖励 `INVITE_REWARD`、管理员调整 `ADMIN_ADJUST` 均进同一桶 |

> **根因**：聚合余额没有「批次」概念，无法回答「第几批礼包各自剩多少」「先耗最早的那批」→ 必须先为**礼包**引入批次层。单独充时长（TOPUP）等无批次、无有效期需求，聚合余额即可满足，**不必批次化**。

### 1.2 需求

1. 新增**单独充时长接口**（不通过礼包商品，直接充时长）。
2. **礼包资产独立管理**：每次礼包购买 = 一个独立批次（时长 + 次数）；多次礼包消耗时**先耗最早的礼包**。
3. 礼包**以后可能加有效期**：指定时间内未使用，过期后**不可再消耗**（过期作废）。

---

## 二、方案选型（结论：礼包批次表 + 优先级消费）

| 维度 | **A. 礼包批次表（采用）** | B. 拆双桶（礼包桶/普通桶） | C. Redis 队列做 FIFO |
|---|---|---|---|
| 精确「几批礼包先耗最早」 | ✅ 按批次精确排序 | ❌ 只能分总量，无法分批次 | ✅ 队列本身 FIFO |
| 数据可靠性 / 账实一致 | ✅ DB 事务 + 行锁，批次即礼包权威账本 | ✅ | ❌ Redis 非账本，重启即错账，难与 DB 事务原子 |
| 单批次剩余 / 礼包明细展示 | ✅ 天然支持 | ❌ | ❌ |
| 有效期 / 单批次退款 | ✅ 预留 expires_at，可按批次回滚 | ❌ | ❌ |
| 只覆盖「有批次需求的礼包」 | ✅ 范围最小、职责单一 | 需多桶扩展 | 队列+DB 双写易不一致 |
| 并发安全（同用户多端） | ✅ FOR UPDATE 锁该用户礼包批次 + user_asset 行 | ✅ | 需额外分布式锁 |
| 改动量 | 中 | 小 | 大 |

**结论**：采用「**礼包批次表 `asset_batch` + 事务内优先级消费**」，`asset_batch` 作为礼包资产（时长 + 次数）的唯一权威账本；`user_asset` 继续作为无批次需求充值的唯一权威账本。

---

## 三、模型定位：`user_asset` 与 `asset_batch` 的关系（核心）

这是整套方案最关键的定位，先定清楚，后面的发放 / 消耗 / 过期都会简单很多。

```text
无批次需求充值（单独充时长 TOPUP / 赠送 / 调整 / 历史存量）
  user_asset.balance
      ↓
  聚合余额 / 唯一权威（继续活跃使用，非历史遗留）

礼包资产（PACKAGE，面试时长 + AI 次数，需要独立批次 + 先耗最早 + 有效期）
  asset_batch.remaining_amount
      ↓
  实际可消费余额（礼包唯一权威）
```

**两条规则：**

1. **实际可消费余额 = 礼包批次 + 聚合余额之和**（对任意资产类型）：

   ```text
   可消费余额(assetType) = user_asset.balance
                         + SUM(asset_batch.remaining_amount)
                               WHERE remaining_amount > 0
                                 AND (expires_at IS NULL OR expires_at > NOW())
   ```

2. **`BillingService.getBalance(assetType)` 内部统一改为上面的「聚合余额 + 有效礼包批次 SUM」**，对调用方（`InterviewBillingService`、`QnaAssetService`、`AssetController`）完全透明，所有资产（时长 / 次数）统一走批次 + 聚合，不再按资产类型路由。

3. **两个账本天然不重叠、不要求实时强一致**：`asset_batch` 只放礼包批次（时长 + 次数），`user_asset.balance` 只放非礼包充值（TOPUP/赠送/调整/存量），二者相加即总量，不存在「同一笔资产写两份账本」的双写漂移问题。礼包过期只动 `asset_batch`，**不回写** `user_asset.balance`。

> **为什么不把礼包也继续塞进 `user_asset.balance` 双写**：若礼包既落批次又累加 `user_asset.balance`、要求实时一致，等于同一笔礼包资产维护两份账本——任何一次发放 / 扣减 / 过期遗漏同步就会错账。让「礼包 → 批次」「非礼包 → 聚合」按来源各归各账本，从根上消除漂移，改动也仅集中在 `BillingService` 内部。

**一句话架构收敛：**

> `asset_batch` 负责礼包的批次库存与实际消费（时长 + 次数，临期优先 → FIFO），`user_asset` 负责无批次需求充值的聚合余额；消费先扣礼包批次，扣尽后再扣 `user_asset` 聚合余额，二者相加即总量，不要求实时强一致。

---

## 四、数据模型

### 4.1 新增礼包批次表 `asset_batch`

```sql
CREATE TABLE asset_batch (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT      NOT NULL,
    asset_type       VARCHAR(32) NOT NULL,          -- INTERVIEW_SECONDS / AI_CHAT_COUNT
    source           VARCHAR(32) NOT NULL DEFAULT 'PACKAGE', -- 当前仅 PACKAGE；预留扩展（未来可能有时限赠送/活动批次）
    ref_order_id     BIGINT,                        -- 礼包订单 recharge_order.id；非订单来源为 NULL
    total_amount     BIGINT      NOT NULL,          -- 本批次总量（通用资产数量，BIGINT 预留范围）
    remaining_amount BIGINT      NOT NULL,          -- 本批次剩余量，FIFO 扣减基准
    expires_at       TIMESTAMPTZ,                   -- 到期时间；NULL = 永久有效
    status           VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE 有剩余未过期 / DEPLETED 已耗尽 / EXPIRED 到期作废
    expired_at       TIMESTAMPTZ,                   -- 实际作废时间；NULL = 未作废
    created_at       TIMESTAMPTZ NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL
);

-- FIFO 消费只扫「仍有剩余」的批次
CREATE INDEX idx_asset_batch_fifo
    ON asset_batch (user_id, asset_type) WHERE remaining_amount > 0;

-- 发放幂等的「数据库最后一道防线」：一个礼包订单只允许一个批次。
CREATE UNIQUE INDEX uk_asset_batch_order
    ON asset_batch (ref_order_id, asset_type)
    WHERE ref_order_id IS NOT NULL;
```

> **`source` 边界（重要）**：`asset_batch` 是通用的「有批次管理需求的资产库存」，但当前第一阶段**仅 `PACKAGE`（礼包）来源进入批次**；其他来源（TOPUP / 赠送 / 调整 / 历史存量）仍进入 `user_asset`。未来若某种赠送 / 活动资产需要独立有效期，再增加对应 `source`（如 `TIME_LIMITED_GIFT`、`ACTIVITY`），无需修改表结构。不要因为看到 `source` 字段就误以为「所有赠送都应落批次」。

**`status` 三态语义：**

| 状态 | 含义 |
|---|---|
| `ACTIVE` | 有剩余且未过期 |
| `DEPLETED` | 已全部消费完（`remaining_amount = 0`） |
| `EXPIRED` | 到期时仍有剩余，被作废（`remaining_amount = 0` 且记录作废量） |

> ⚠️ **扣减硬条件是 `remaining_amount > 0 AND 未过期`，不是 `status`**。`status` 主要用于展示 / 统计 / 对账；即使某次状态没来得及更新，SQL 过滤条件仍能保证不会扣到已耗尽 / 已过期批次（双保险）。

### 4.2 `user_asset_log` 增加 `batch_id`（可空字段）

```sql
ALTER TABLE user_asset_log ADD COLUMN batch_id BIGINT;
CREATE INDEX idx_user_asset_log_batch ON user_asset_log (batch_id);
```

- 只有**礼包批次**相关流水填 `batch_id`，形成完整链路：

  ```text
  礼包订单 → Batch → GRANT → CONSUME → CONSUME →（可能）EXPIRE
  ```

- **TOPUP / 赠送 / 调整 / 历史存量的流水 `batch_id = NULL`**（它们不落批次，仍走现有 `user_asset_log` 记录，天然区分）。
- **一次心跳跨多个礼包批次扣减时，按批次各记一条 `CONSUME` 流水**（各带自己的 `batch_id`，共享同一 `biz_id = interviewId`）；跨到 `user_asset` 聚合余额的部分再记一条 `batch_id = NULL` 的 `CONSUME`。

### 4.3 存量表增量

| 表 / 配置 | 新增 | 说明 |
|---|---|---|
| `recharge_order` | `order_type`（`PACKAGE` / `TOPUP`） | 区分礼包订单与单独充时长订单，支付链路完全复用 |
| `asset_package` | `valid_days`（INTEGER，可空） | 礼包有效期天数；**`expires_at = 支付成功时间(payment_success_at) + valid_days`**，NULL 即永久 |
| 新配置项 | `recharge.topup-unit-price`（分钟单价） | 单独充时长计费：实付金额 = 单价 × 分钟数 |

> **有效期时间基准必须是「支付成功时间」**，而不是批次 `created_at` / 发放时间。这样即使支付回调延迟几分钟甚至几小时，用户买到的有效期也不受影响。

---

## 五、发放侧改造

**按来源分流到账**（替代现在「一律累加聚合余额」）：

```text
礼包支付成功  → grantBatch(PACKAGE, orderId)     落 asset_batch 批次；expires_at = payment_success_at + valid_days
单独充支付成功 → grantAsset(TOPUP)                累加 user_asset.balance + RECHARGE 流水（batch_id = NULL）
赠送/后台调整  → grantAsset(INITIAL/INVITE/ADMIN)  累加 user_asset.balance（batch_id = NULL）
```

每次 grantBatch（单事务）：
1. 插入一行 `asset_batch`（`remaining = total`，礼包按**支付成功时间**算 `expires_at`）；
2. 写一条带 `batch_id` 的 `GRANT` 流水。

每次 grantAsset（非礼包，沿用现有逻辑，单事务）：
1. 累加 `user_asset.balance`；
2. 写一条 `batch_id = NULL` 的流水。

**幂等双保险**：
- 礼包：业务层沿用现有 `(user_id, asset_type, biz_type, biz_id)` 判断 + 数据库层 `uk_asset_batch_order` 部分唯一索引兜底，支付回调重推 / 补偿任务绝不会为同一订单生成两个批次。
- TOPUP / 赠送 / 调整：沿用现有 `uk_asset_log_noconsume` 唯一索引 + 业务唯一键防重。

---

## 六、消耗侧改造（礼包批次优先 + 临期优先 + FIFO）

> 术语说明：最终规则**不是严格 FIFO**，而是「**礼包批次优先（临期优先 → FIFO）→ 聚合余额垫底**」。

`BillingService.consumeAsset` 对所有资产（时长 + 次数）统一走 `consumeByFifo`，核心逻辑（单事务，**两级扣减**）：

```text
第 1 级：扣礼包批次 asset_batch
  -- 事务内锁定该用户该资产的全部「仍有剩余且未过期」礼包批次
  SELECT * FROM asset_batch
  WHERE user_id = :uid AND asset_type = :type
    AND remaining_amount > 0
    AND (expires_at IS NULL OR expires_at > NOW())   -- 过期批次不可消耗（硬过滤）
  ORDER BY <排序键>
  FOR UPDATE;

  -- 循环：按排序结果逐个批次扣，一个扣完再扣下一个
  -- 每个被扣批次：remaining_amount -= 该批扣减；写一条带 batch_id 的 CONSUME 流水

第 2 级：礼包批次扣尽后仍不足，扣聚合余额 user_asset
  SELECT * FROM user_asset
  WHERE user_id = :uid AND asset_type = :type
  FOR UPDATE;

  -- balance -= 剩余待扣量；写一条 batch_id = NULL 的 CONSUME 流水
```

**礼包批次排序键（最终保留版本）：**

```sql
ORDER BY (expires_at IS NULL) ASC,   -- 第一级：有过期的排前面（临期优先，避免浪费）
         expires_at ASC NULLS LAST,  -- 第二级：到期时间越近越优先
         created_at ASC,             -- 第三级：同级按到账先后（FIFO）
         id ASC                      -- 第四级：id 兜底，保证排序稳定
```

四级语义：**是否有有效期（有→无）→ 到期近→远 → 到账早→晚 → id**。

- 礼包内有有效期的按 `expires_at` 近→远（临期优先，避免浪费），无有效期的按 `created_at` FIFO；
- 所有礼包批次优先于 `user_asset` 聚合余额消耗（由「第 1 级扣尽后才进入第 2 级」的代码流程保证，非排序键）。
- **TOPUP / 赠送 / 调整 / 历史存量**全部聚合在 `user_asset.balance`，无批次优先级需求，垫底即可。

> 若未来产品要求**礼包严格按购买先后**消费，移除 `expires_at` 两级、仅保留 `created_at ASC, id ASC` 即可，只动排序策略。

**可用余额来源**：扣减后 / 开始面试时的「剩余量」由 `getBalance(assetType) = user_asset.balance + SUM(有效礼包批次 remaining)` 得到，时长（秒）与次数（次）共用同一公式。

**职责边界（`InterviewBillingService` 无需改动）：**

```text
InterviewBillingService
      │  consumeAsset(seconds) / getBalance()
      ▼
BillingService（批次选择、有效期过滤、两级扣减、余额判断全封装在此）
      ├── asset_batch（礼包批次，临期优先 + FIFO）
      ├── user_asset（聚合余额垫底）
      ├── expires_at 过滤
      ├── batch_id 流水
      └── 实际可消费余额（聚合余额 + 礼包批次 SUM）
```

**锁粒度**：事务内先 `FOR UPDATE` 锁该用户该资产的全部正余量礼包批次，再锁 `user_asset` 行（固定「先批次、后聚合」顺序避免死锁），同用户多端心跳串行化，不会超扣。当前优先保证实现简单与并发正确性；后续若压测出现锁竞争，再优化为逐批 `LIMIT` 锁定，现在不过度设计。

**扣减示例**（示意，非真实数据，顺序 = 先礼包 → 再聚合余额）：本次心跳扣 100s

```text
Batch A（9/1 礼包）剩 60s     → 全部扣完（remaining=0, status=DEPLETED），记 1 条 CONSUME(batch_id=A)
Batch B（9/2 礼包）剩 5400s   → 扣 40s（剩 5360s），记 1 条 CONSUME(batch_id=B)
user_asset.balance（TOPUP/赠送聚合）剩 7200s → 不动（礼包已扣足 100s）
```

---

## 七、有效期支持（礼包过期不可再消耗）

### 7.1 过期只动礼包批次，不回写聚合余额

定时任务（每 5~10 分钟，复用现有调度体系）扫描 `expires_at < NOW() AND remaining_amount > 0` 的礼包批次，单事务内：

```text
过期礼包批次
  → remaining_amount = 0
  → status = EXPIRED, expired_at = NOW()
  → 写一条 biz_type=EXPIRE、带 batch_id 的流水
```

**不修改 `user_asset.balance`**：礼包与聚合余额本就各归各账本，礼包过期只动 `asset_batch`，与 `user_asset` 无关。

### 7.2 扣减侧硬过滤必须保留

即使不过期清零任务，消费 SQL 的 `AND (expires_at IS NULL OR expires_at > NOW())` 也保证**永远扣不到过期礼包批次**。因此「是否还有可消费时长」的权威判断是：

```text
user_asset.balance > 0  OR  asset_batch（remaining_amount > 0 AND 未过期）   ✅
而不是只看 user_asset.balance > 0                                              ❌
```

举例（示意）：

```text
user_asset.balance = 0（TOPUP/赠送聚合已耗尽）
asset_batch：PACKAGE 已过期 600（remaining 已清零）
→ 实际可消费 = 0 → balanceExhausted = true，面试应终止
```

### 7.3 配套

- `AssetChangeSource` 枚举新增 `EXPIRE("过期作废")`；
- **⚠️ 必须同步更新 `V6__asset.sql` 的 `chk_user_asset_log_biz` CHECK 约束**（`biz_type IN (...) 白名单`），否则 EXPIRE 流水写不进去——最容易漏的一处。

**前端展示（建议做）**：`AssetController` 新增「资产批次明细」接口，返回 `user_asset.balance`（聚合）+ 每礼包批次（时长 + 次数）`remaining` + `expires_at` + `status`；礼包列表展示到期时间，临期（如剩 ≤3 天）标黄提醒。

---

## 八、单独充时长接口（自定义任意分钟，最终确认）

- **形态**：用户输入**任意分钟数**（如 17 / 125 分钟），不限定档位。
- **复用 `recharge_order` 全链路**：下单 → 支付 → 回调 → `handlePaymentSuccess` → 发放，支付、回调、补偿、幂等全部零新增。
- `order_type = TOPUP`；快照存 `{assetType, amount(秒), price(实付)}`；支付成功**累加 `user_asset.balance`**（无有效期、无批次，`batch_id = NULL`）。
- **金额**：`实付金额 = 分钟单价 × 分钟数`（分钟单价为后台配置 `recharge.topup-unit-price`）。
- **支付渠道注意**：虚拟支付（道具直购）价格由微信后台锁定、**不支持动态改价** → 自定义分钟必须走**普通微信支付 JSAPI**（后续如需 iOS 虚拟支付，再引入代币模式，见 [虚拟支付充值-资产发放方案](./虚拟支付充值-资产发放方案.md)）。
- 入口：`POST /recharge-orders/topup`（body 传分钟数）。

---

## 九、存量迁移（几乎零迁移）

现有 `user_asset` 的聚合余额（时长 `INTERVIEW_SECONDS` + 次数 `AI_CHAT_COUNT`）**原样保留在 `user_asset.balance`**，天然成为「礼包批次扣尽后」的垫底余额，**无需生成任何 LEGACY 批次、无需冻结旧行**：

```text
迁移前：user_asset.balance = 5000
迁移后：user_asset.balance = 5000（继续活跃使用，作为垫底聚合余额）
        asset_batch = 空（后续礼包购买才开始落批次）
```

- **位置：队尾垫底**——历史余额（赠送 + 购买混杂，不可追溯）与 TOPUP/赠送/调整同处 `user_asset` 聚合余额，整体在礼包批次之后消耗；对用户可消耗总量无影响。
- **迁移实现**：仅需建表 + `user_asset_log` 加 `batch_id` 列 + `recharge_order.order_type` / `asset_package.valid_days`，**不写任何数据迁移脚本**。

**上线顺序（简化）：**

```text
停止旧版本（暂停礼包资产的消费 / 发放）
  → 执行数据库迁移（建 asset_batch + user_asset_log 加列 + order_type / valid_days）
  → 部署新版本
  → 开启消费
```

存量余额无需移动，迁移窗口显著缩短；仍需在批次消费正式启用前完成建表，避免新旧逻辑同时读写。

---

## 十、并发、幂等与余额判断

- **并发安全**：事务内先 `FOR UPDATE` 锁该用户该资产的全部正余量礼包批次，再锁 `user_asset` 行（固定锁顺序）→ 同用户多端心跳串行化，不会两个会话同时扣同一批次 / 聚合余额超扣。当前不优化锁粒度，正确性优先。
- **发放幂等双保险**：礼包走业务唯一键 + `uk_asset_batch_order` 部分唯一索引兜底；TOPUP / 赠送 / 调整沿用 `uk_asset_log_noconsume` + 业务唯一键，覆盖支付回调 / 补偿任务重入。
- **余额不足语义不变、来源切换**：业务上仍是「有多少扣多少」（扣到 0），`InterviewBillingService` 的 `balanceExhausted` 判定逻辑不变；但 `BillingService` 内部的可用余额来源由单一聚合余额**切换为「聚合余额 + 礼包批次 SUM」**（见 7.2 例子）。
- **状态与余量解耦**：礼包扣减 / 过期的硬条件是 `remaining_amount > 0` + 未过期；`status(ACTIVE/DEPLETED/EXPIRED)` 服务于展示与统计，不作为唯一过滤条件，防止状态漏更新导致误扣。

---

## 十一、改造清单（映射现有代码）

| 步骤 | 位置 | 动作 |
|---|---|---|
| 1 | `db/migration/` 新脚本 | 建 `asset_batch`（三态 status、`idx_asset_batch_fifo`、`uk_asset_batch_order`）；`user_asset_log` 加 `batch_id`；`recharge_order.order_type`、`asset_package.valid_days`；**无需存量迁移脚本** |
| 2 | `BillingService.getBalance` | 所有资产统一改为 `user_asset.balance + SUM(有效礼包批次)` |
| 3 | `BillingService.grantAsset` / 新增 `grantBatch` | 非礼包仍累加 `user_asset.balance`；礼包新增写批次行 + 带 batch_id 的 GRANT 流水 |
| 4 | `BillingService.consumeAsset` | 所有资产统一走 `consumeByFifo`：先扣礼包批次（临期优先 + FIFO + 过期过滤 + 跨批次各记 CONSUME），不足再扣 `user_asset`（batch_id = NULL） |
| 5 | `RechargeAssetGrantService.grantAssets` | 礼包订单落一个 `source=PACKAGE` 批次，`expires_at = 支付成功时间 + valid_days`；TOPUP 订单走聚合余额 |
| 6 | `RechargeController` | 新增 `POST /recharge-orders/topup`（自定义任意分钟，金额 = 单价 × 分钟数；走普通微信支付 JSAPI） |
| 7 | `AssetController` / 新 DTO | 新增「我的资产批次明细」（聚合余额 + 每礼包批次 remaining + expires_at + status） |
| 8 | 新增定时任务 | 过期礼包批次 `remaining=0 / status=EXPIRED` + 带 batch_id 的 EXPIRE 流水；**不回写** `user_asset.balance` |
| 9 | `AssetChangeSource` + `V6__asset.sql` CHECK | 新增 `EXPIRE` 枚举并同步约束 |
| 10 | `InterviewBillingService` | **无需改动**（两级扣减逻辑全封装在 BillingService 内） |
| 11 | `QnaAssetService` | 次数扣减改走 `BillingService.consumeAsset`（复用批次优先消费），`hasEnoughChatCount` 改读 `getBalance` |

---

## 十二、最终决策（2026-09-03 已确认）

**方案层面：**
- ✅ 采用「礼包批次表 + 事务内两级消费」，`asset_batch` 为礼包资产（时长 + 次数）**唯一权威账本**，`user_asset` 为无批次需求充值的**唯一权威账本**（非历史遗留）
- ✅ 礼包资产独立管理，每次礼包 = 独立批次（时长 + 次数）
- ✅ 礼包支持有效期，过期不可再消耗（扣减侧硬过滤 + 定时任务作废）

**拍板点（均已确认）：**

| 决策点 | 最终决策 |
|---|---|
| 账本定位 | 礼包资产（时长 + 次数）→ `asset_batch`（批次）；TOPUP/赠送/调整/历史 → `user_asset`（聚合余额），二者相加即总量 |
| 消耗策略术语 | **礼包批次优先（临期优先 + FIFO）→ 聚合余额垫底**（非严格 FIFO） |
| TOPUP 与礼包消耗顺序 | **先扣礼包批次，扣尽后再扣 `user_asset` 聚合余额** |
| 有效期下消耗排序 | **临期优先**：礼包内有过期按 `expires_at` 近→远，同级按 `created_at` |
| 单独充时长形态 | **自定义任意分钟**（金额 = 分钟单价 × 分钟数；走普通微信支付 JSAPI；发放累加 `user_asset.balance`） |
| 礼包有效期计算 | **购买后 N 天**，基准为**支付成功时间**（`expires_at = payment_success_at + valid_days`） |
| 存量处理 | **原样保留在 `user_asset.balance`**，天然垫底，无需 LEGACY 批次 / 冻结 / 迁移脚本 |
| 批次状态 | `ACTIVE / DEPLETED / EXPIRED` 三态；扣减硬条件以 remaining + 未过期为准 |
| 流水粒度 | `user_asset_log.batch_id` 可空字段，仅礼包批次 GRANT/CONSUME/EXPIRE 填充，跨批次按批次各记一条 |

---

## 十三、附：关键设计取舍回顾

- **为什么是礼包批次表而非在 user_asset 加字段**：需求本质是「礼包库存批次 + 优先级消费」，字段无法表达「每批剩多少、按到期/到账排序扣减」。
- **为什么 `user_asset` 不批次化、也不退化为历史遗留**：单独充时长（TOPUP）、赠送、调整、历史存量均无「批次 / 有效期 / 先耗最早」需求，聚合余额已足够；只有礼包（时长 + 次数）需要批次。按来源各归各账本，`user_asset` 继续活跃服务非礼包充值，`asset_batch` 只服务礼包资产，职责单一、无重叠。
- **为什么礼包过期不回写 `user_asset.balance`**：礼包与聚合余额本就分属两个独立账本，礼包过期只动 `asset_batch` + 记 EXPIRE 流水即可，回写只会制造无谓耦合。
- **为什么不用 Redis 队列**：Redis 是缓存不是账本，无法与 DB 事务原子一致，账实不可靠。
- **为什么暂不优化 FOR UPDATE 锁粒度**：当前按用户资产整体锁实现最简单、正确性有保证；逐批锁定留待压测证明有竞争后再做，不提前复杂化。
