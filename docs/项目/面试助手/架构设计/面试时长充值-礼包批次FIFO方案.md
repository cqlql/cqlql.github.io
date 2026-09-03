---
title: 面试时长充值-礼包批次FIFO方案
icon: mdi:clock-check-outline
sort: 99
---

# 面试时长充值 / 批次优先级消费方案（礼包优先 + 临期优先 + FIFO）

针对 PassUp「新增**单独充时长接口** + **礼包时长独立管理**（多次礼包先耗最早）+ **礼包有效期**（过期不可再消耗）」的方案选型与最终结论。

> 关联笔记：
> - [虚拟支付充值-资产发放方案](./虚拟支付充值-资产发放方案.md)：资产怎么**进来**（RECHARGE / 礼包下单与支付链路）
> - [AI问答计费-资产扣减方案](./AI问答计费-资产扣减方案.md)：资产怎么**消耗**（CONSUME / `user_asset` + `user_asset_log`）
> - [websocket计时扣费](./websocket计时扣费.md)：实时面试按秒扣费链路
>
> 本篇记录新引入的「批次（Batch）」概念，是在已有 `user_asset` 聚合余额体系之上叠加的**库存批次层**，不另起炉灶建新余额表。
>
> **🔑 账本定位（最重要）**：`asset_batch.remaining_amount` 是 `INTERVIEW_SECONDS` 的**唯一权威账本**；`user_asset.balance` 退化为**历史兼容字段**，不再作为扣费依据（详见第三节）。

---

## 一、背景与需求

### 1.1 现状

| 项 | 现状 |
|---|---|
| 资产模型 | `user_asset` 每用户每资产一行**聚合余额**；`INTERVIEW_SECONDS` 只存总秒数 |
| 充值方式 | 仅购买 `asset_package` 礼包 → `RechargeOrder`（jsonb 快照）→ 支付成功 → `RechargeAssetGrantService.grantAssets` → `BillingService.grantAsset` 累加进聚合余额 |
| 消耗方式 | `InterviewBillingService.doBilling` 心跳结算 → `BillingService.consumeAsset` 从聚合余额扣，**不区分来源 / 不区分批次** |
| 同桶来源 | 注册赠送 `INITIAL_GRANT`、邀请奖励 `INVITE_REWARD`、管理员调整 `ADMIN_ADJUST` 均进同一桶 |

> **根因**：聚合余额没有「批次」概念，无法回答「第几批礼包各自剩多少」「先耗最早的那批」→ 必须先引入批次层。

### 1.2 需求

1. 新增**单独充时长接口**（不通过礼包商品，直接充时长）。
2. **礼包时长独立管理**：每次礼包购买 = 一个独立批次；多次礼包消耗时**先耗最早的礼包**。
3. 礼包**以后可能加有效期**：指定时间内未使用，过期后**不可再消耗**（过期作废）。

---

## 二、方案选型（结论：批次表 + 优先级消费）

| 维度 | **A. 批次表（采用）** | B. 拆双桶（礼包桶/普通桶） | C. Redis 队列做 FIFO |
|---|---|---|---|
| 精确「几批礼包先耗最早」 | ✅ 按批次精确排序 | ❌ 只能分总量，无法分批次 | ✅ 队列本身 FIFO |
| 数据可靠性 / 账实一致 | ✅ DB 事务 + 行锁，批次即权威账本 | ✅ | ❌ Redis 非账本，重启即错账，难与 DB 事务原子 |
| 单批次剩余 / 礼包明细展示 | ✅ 天然支持 | ❌ | ❌ |
| 有效期 / 单批次退款 | ✅ 预留 expires_at，可按批次回滚 | ❌ | ❌ |
| 一个模型覆盖礼包/单独充/赠送/调整 | ✅ 统一 source 枚举 | 需多桶扩展 | 队列+DB 双写易不一致 |
| 并发安全（同用户多端） | ✅ FOR UPDATE 锁该用户批次 | ✅ | 需额外分布式锁 |
| 改动量 | 中 | 小 | 大 |

**结论**：采用「**批次表 `asset_batch` + 事务内优先级消费**」，且 `asset_batch` 作为 `INTERVIEW_SECONDS` 的唯一权威账本。

---

## 三、模型定位：`user_asset` 与 `asset_batch` 的关系（核心）

这是整套方案最关键的定位，先定清楚，后面的发放 / 消耗 / 过期都会简单很多。

```text
旧体系（AI_CHAT_COUNT 等未批次化资产仍在用）
  user_asset.balance
      ↓
  历史聚合余额 / 兼容字段

新体系（INTERVIEW_SECONDS 已迁移到批次模型）
  asset_batch.remaining_amount
      ↓
  实际可消费余额（唯一权威）
```

**三条规则：**

1. **实际可消费余额以批次为准**：

   ```text
   INTERVIEW_SECONDS 可消费 = SUM(remaining_amount)
       WHERE remaining_amount > 0
         AND (expires_at IS NULL OR expires_at > NOW())
   ```

2. **`BillingService.getBalance(INTERVIEW_SECONDS)` 内部改为上面的 SUM**，对调用方（`InterviewBillingService`、`AssetController`）完全透明；`AI_CHAT_COUNT` 等未批次化资产仍读 `user_asset`。即「按资产类型路由」，调用方无感。

3. **`user_asset.balance` 不再作为扣费 / 余额不足的权威依据**：迁移后该用户 `INTERVIEW_SECONDS` 的历史行**冻结存档、不再双写更新**；批次过期也**不回写**它。它可能与批次 SUM 存在偏差（差额=已过期作废部分），属预期，不作为对账依据。

> **为什么不「双写强一致」**：若批次和 `user_asset.balance` 同时维护、要求实时一致，等于维护两份账本——任何一次发放 / 扣减 / 过期遗漏同步就会错账，新旧模型严重耦合。让批次做唯一权威、`getBalance` 走 SUM，从根上消除漂移，改动也仅集中在 `BillingService` 内部。

**一句话架构收敛：**

> `user_asset` 负责兼容历史聚合余额（及未批次化资产），`asset_batch` 负责新模型的批次库存与实际消费；新充值 / 赠送产生批次，新面试消费只依据有效批次进行「礼包优先 → 临期优先 → FIFO → LEGACY 垫底」的扣减，二者不要求实时强一致。

---

## 四、数据模型

### 4.1 新增批次表 `asset_batch`

```sql
CREATE TABLE asset_batch (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT      NOT NULL,
    asset_type       VARCHAR(32) NOT NULL,          -- INTERVIEW_SECONDS / AI_CHAT_COUNT
    source           VARCHAR(32) NOT NULL,          -- PACKAGE / TOPUP / INITIAL_GRANT / INVITE_REWARD / ADMIN_ADJUST / LEGACY
    ref_order_id     BIGINT,                        -- 订单来源(PACKAGE/TOPUP)=recharge_order.id；赠送/调整等非订单来源为 NULL
    total_amount     INTEGER     NOT NULL,          -- 本批次总量（秒）
    remaining_amount INTEGER     NOT NULL,          -- 本批次剩余量（秒），FIFO 扣减基准
    expires_at       TIMESTAMPTZ,                   -- 到期时间；NULL = 永久有效
    status           VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE 有剩余未过期 / DEPLETED 已耗尽 / EXPIRED 到期作废
    expired_at       TIMESTAMPTZ,                   -- 实际作废时间；NULL = 未作废
    created_at       TIMESTAMPTZ NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL
);

-- FIFO 消费只扫「仍有剩余」的批次
CREATE INDEX idx_asset_batch_fifo
    ON asset_batch (user_id, asset_type) WHERE remaining_amount > 0;

-- 发放幂等的「数据库最后一道防线」：订单来源一个订单只允许一个批次。
-- 仅约束 ref_order_id 非空的订单来源；赠送类 ref 为 NULL，不参与唯一约束。
CREATE UNIQUE INDEX uk_asset_batch_order
    ON asset_batch (source, ref_order_id, asset_type)
    WHERE ref_order_id IS NOT NULL;
```

**`status` 三态语义：**

| 状态 | 含义 |
|---|---|
| `ACTIVE` | 有剩余且未过期 |
| `DEPLETED` | 已全部消费完（`remaining_amount = 0`） |
| `EXPIRED` | 到期时仍有剩余，被作废（`remaining_amount = 0` 且记录作废量） |

> ⚠️ **扣减硬条件是 `remaining_amount > 0 AND 未过期`，不是 `status`**。`status` 主要用于展示 / 统计 / 对账；即使某次状态没来得及更新，SQL 过滤条件仍能保证不会扣到已耗尽 / 已过期批次（双保险）。

### 4.2 `user_asset_log` 增加 `batch_id`（正式字段，非可选）

```sql
ALTER TABLE user_asset_log ADD COLUMN batch_id BIGINT;
CREATE INDEX idx_user_asset_log_batch ON user_asset_log (batch_id);
```

- 所有涉及批次的流水（`GRANT` / `CONSUME` / `EXPIRE`）都记录对应 `batch_id`，形成完整链路：

  ```text
  订单 → Batch → GRANT → CONSUME → CONSUME →（可能）EXPIRE
  ```

- **一次心跳跨多个批次扣减时，按批次各记一条 `CONSUME` 流水**（各带自己的 `batch_id`，共享同一 `biz_id = interviewId`），后续对账 / 资产明细 / 退款 / 统计都可精确到批次。

### 4.3 存量表增量

| 表 / 配置 | 新增 | 说明 |
|---|---|---|
| `recharge_order` | `order_type`（`PACKAGE` / `TOPUP`） | 区分礼包订单与单独充时长订单，支付链路完全复用 |
| `asset_package` | `valid_days`（INTEGER，可空） | 礼包有效期天数；**`expires_at = 支付成功时间(payment_success_at) + valid_days`**，NULL 即永久 |
| 新配置项 | `recharge.topup-unit-price`（分钟单价） | 单独充时长计费：实付金额 = 单价 × 分钟数 |

> **有效期时间基准必须是「支付成功时间」**，而不是批次 `created_at` / 发放时间。这样即使支付回调延迟几分钟甚至几小时，用户买到的有效期也不受影响。

---

## 五、发放侧改造

**每次到账 = 落一个独立批次**（替代现在「只累加聚合余额」）：

```text
礼包支付成功  → grantBatch(PACKAGE, orderId)   expires_at = payment_success_at + valid_days
单独充支付成功 → grantBatch(TOPUP,  orderId)   expires_at = NULL（永久）
赠送/后台调整  → grantBatch(INITIAL/INVITE/ADMIN) expires_at = NULL
```

每次 grantBatch（单事务）：
1. 插入一行 `asset_batch`（`remaining = total`，礼包按**支付成功时间**算 `expires_at`）；
2. 写一条带 `batch_id` 的 `GRANT` 流水；
3. **不再为 `INTERVIEW_SECONDS` 双写 `user_asset.balance`**（批次即权威，见第三节）。

**幂等双保险**：
- 业务层沿用现有 `(user_id, asset_type, biz_type, biz_id)` 判断；
- 数据库层由 `uk_asset_batch_order` 部分唯一索引兜底，支付回调重推 / 补偿任务绝不会为同一订单生成两个批次。

---

## 六、消耗侧改造（礼包优先 + 临期优先 + FIFO）

> 术语说明：最终规则**不是严格 FIFO**，而是「**礼包优先 → 临期优先 → 同级 FIFO**」。

`BillingService.consumeAsset` 对 `INTERVIEW_SECONDS` 走新分支 `consumeByFifo`，核心逻辑（单事务）：

```sql
-- 事务内锁定该用户该资产的全部「仍有剩余且未过期」批次
SELECT * FROM asset_batch
WHERE user_id = :uid AND asset_type = :type
  AND remaining_amount > 0
  AND (expires_at IS NULL OR expires_at > NOW())   -- 过期批次不可消耗（硬过滤）
ORDER BY <排序键>
FOR UPDATE;

-- 循环：按排序结果逐个批次扣，一个扣完再扣下一个，直至本次请求秒数扣完
-- 每个被扣批次：remaining_amount -= 该批扣减；写一条带 batch_id 的 CONSUME 流水
```

**排序键（最终保留版本）：**

```sql
ORDER BY CASE source
           WHEN 'PACKAGE' THEN 0     -- 第一级·来源：礼包最优先
           WHEN 'LEGACY'  THEN 2     --            LEGACY 垫底
           ELSE 1                    --            TOPUP / 赠送 / 调整
         END ASC,
         (expires_at IS NULL) ASC,   -- 第二级·有效期：有过期的排前面
         expires_at ASC NULLS LAST,  -- 第三级：到期时间越近越优先（临期优先）
         created_at ASC,             -- 第四级：同级按到账先后（FIFO）
         id ASC                      -- 第五级：id 兜底，保证排序稳定
```

五级语义：**来源（PACKAGE→其他→LEGACY）→ 是否有有效期（有→无）→ 到期近→远 → 到账早→晚 → id**。

- **礼包（PACKAGE）最优先**：有过期按 `expires_at` 近→远（临期优先，避免浪费），无过期按 `created_at` FIFO；
- **TOPUP / 赠送 / 调整**：无有效期，按 `created_at` FIFO；
- **LEGACY（历史存量）垫底**。

> 若未来产品要求**严格按购买先后**消费，移除 `expires_at` 两级、仅保留 `created_at ASC, id ASC` 即可，只动排序策略。

**可用余额来源**：扣减后 / 开始面试时的「剩余秒数」由 `getBalance(INTERVIEW_SECONDS) = SUM(有效批次 remaining)` 得到，不再读 `user_asset.balance`。

**职责边界（`InterviewBillingService` 无需改动）：**

```text
InterviewBillingService
      │  consumeAsset(seconds) / getBalance()
      ▼
BillingService（批次选择、有效期过滤、实际扣减、余额判断全封装在此）
      ├── asset_batch
      ├── 优先级排序
      ├── expires_at 过滤
      ├── batch_id 流水
      └── 实际可消费余额（SUM）
```

**锁粒度**：当前按「用户 + 资产」整体 `FOR UPDATE` 锁定其全部可用批次，优先保证实现简单与并发正确性；后续若压测出现锁竞争，再优化为按消费顺序逐批 `LIMIT` 锁定，现在不过度设计。

**扣减示例**（示意，非真实数据，顺序 = 先礼包 → 再 TOPUP）：本次心跳扣 100s

```text
Batch A（9/1 礼包）剩 60s     → 全部扣完（remaining=0, status=DEPLETED），记 1 条 CONSUME
Batch B（9/2 礼包）剩 5400s   → 扣 40s（剩 5360s），记 1 条 CONSUME
Batch C（9/3 单独充值）剩 7200s → 不动
```

---

## 七、有效期支持（礼包过期不可再消耗）

### 7.1 过期只动批次，不回写历史聚合余额

定时任务（每 5~10 分钟，复用现有调度体系）扫描 `expires_at < NOW() AND remaining_amount > 0` 的批次，单事务内：

```text
过期批次
  → remaining_amount = 0
  → status = EXPIRED, expired_at = NOW()
  → 写一条 biz_type=EXPIRE、带 batch_id 的流水
```

**不修改 `user_asset.balance`**：它已是历史兼容字段、非权威，强行让它与批次实时一致只会重新引入双账本耦合（见第三节）。

### 7.2 扣减侧硬过滤必须保留

即使不过期清零任务，消费 SQL 的 `AND (expires_at IS NULL OR expires_at > NOW())` 也保证**永远扣不到过期批次**。因此「是否还有可消费时长」的权威判断是：

```text
asset_batch：remaining_amount > 0 AND 未过期   ✅
而不是 user_asset.balance > 0                  ❌
```

举例（示意）：

```text
user_asset.balance = 1000（历史字段，含已过期部分，不作数）
asset_batch：PACKAGE 已过期 600 + TOPUP 可用 0
→ 实际可消费 = 0 → balanceExhausted = true，面试应终止
```

### 7.3 配套

- `AssetChangeSource` 枚举新增 `EXPIRE("过期作废")`；
- **⚠️ 必须同步更新 `V6__asset.sql` 的 `chk_user_asset_log_biz` CHECK 约束**（`biz_type IN (...) 白名单`），否则 EXPIRE 流水写不进去——最容易漏的一处。

**前端展示（建议做）**：`AssetController` 新增「时长批次明细」接口，返回每批次 `remaining` + `expires_at` + `status`；礼包列表展示到期时间，临期（如剩 ≤3 天）标黄提醒。

---

## 八、单独充时长接口（自定义任意分钟，最终确认）

- **形态**：用户输入**任意分钟数**（如 17 / 125 分钟），不限定档位。
- **复用 `recharge_order` 全链路**：下单 → 支付 → 回调 → `handlePaymentSuccess` → 发放，支付、回调、补偿、幂等全部零新增。
- `order_type = TOPUP`；快照存 `{assetType, amount(秒), price(实付)}`；支付成功落 `source = TOPUP` 批次（无有效期，`expires_at = NULL`）。
- **金额**：`实付金额 = 分钟单价 × 分钟数`（分钟单价为后台配置 `recharge.topup-unit-price`）。
- **支付渠道注意**：虚拟支付（道具直购）价格由微信后台锁定、**不支持动态改价** → 自定义分钟必须走**普通微信支付 JSAPI**（后续如需 iOS 虚拟支付，再引入代币模式，见 [虚拟支付充值-资产发放方案](./虚拟支付充值-资产发放方案.md)）。
- 入口：`POST /recharge-orders/topup`（body 传分钟数）。

---

## 九、存量迁移

现有 `user_asset.INTERVIEW_SECONDS` 聚合余额整体落成**一个独立的 `source = LEGACY` 批次**：

```text
迁移前：user_asset.balance = 5000
迁移后：LEGACY 批次 total=5000, remaining=5000, expires_at=NULL（永久有效）
       user_asset 该行仍保留 5000 作为历史存档，但冻结、不再更新、不再权威
```

- **位置（最终确认）：队尾垫底**——历史余额来源不可追溯（赠送 + 购买混杂），视为最不优先兜底，不干扰「先礼包 → 再 TOPUP」顺序；LEGACY 永久有效，对用户可消耗总量无影响。
- 实现：排序键用 `CASE source WHEN 'LEGACY' THEN 2` 直接控制，**不要人为伪造 `created_at`**。

**迁移期间的并发处理（上线顺序）：**

```text
停止旧版本（暂停 INTERVIEW_SECONDS 的消费 / 发放）
  → 执行数据库迁移（建表 + user_asset_log 加列）
  → 为每个用户生成 LEGACY 批次
  → 部署新版本
  → 开启批次消费
```

存量迁移必须在新版本批次消费**正式启用前**完成，避免迁移脚本与批次扣减 / 资产发放同时修改同一用户资产。

---

## 十、并发、幂等与余额判断

- **并发安全**：`FOR UPDATE` 锁该用户该资产的全部正余量批次行 → 同用户多端心跳串行化，不会两个会话同时扣同一批次超扣。当前不优化锁粒度，正确性优先。
- **发放幂等双保险**：业务唯一键判断 + 数据库 `uk_asset_batch_order` 部分唯一索引兜底，尤其覆盖支付回调 / 补偿任务重入。
- **余额不足语义不变、来源切换**：业务上仍是「有多少扣多少」（扣到 0），`InterviewBillingService` 的 `balanceExhausted` 判定逻辑不变；但 `BillingService` 内部的可用余额来源由聚合余额**切换为批次 SUM**（见 7.2 例子）。
- **状态与余量解耦**：扣减 / 过期的硬条件是 `remaining_amount > 0` + 未过期；`status(ACTIVE/DEPLETED/EXPIRED)` 服务于展示与统计，不作为唯一过滤条件，防止状态漏更新导致误扣。

---

## 十一、改造清单（映射现有代码）

| 步骤 | 位置 | 动作 |
|---|---|---|
| 1 | `db/migration/` 新脚本 | 建 `asset_batch`（含三态 status、`idx_asset_batch_fifo`、`uk_asset_batch_order`）；`user_asset_log` 加 `batch_id`；`recharge_order.order_type`、`asset_package.valid_days`；存量余额迁移为 LEGACY 批次并冻结旧聚合行 |
| 2 | `BillingService.getBalance` | 按资产类型路由：`INTERVIEW_SECONDS` 改为 SUM 有效批次；其他资产维持读 `user_asset` |
| 3 | `BillingService.grantAsset` | 增加写批次行 + 带 batch_id 的 GRANT 流水；INTERVIEW_SECONDS 不再双写 `user_asset.balance` |
| 4 | `BillingService.consumeAsset` | 增加 `consumeByFifo`：以批次为权威，按排序键优先级消费 + 过期过滤 + 跨批次各记 CONSUME 流水；`user_asset.balance` 不作为可消费判断 |
| 5 | `RechargeAssetGrantService.grantAssets` | 每订单落一个 `source=PACKAGE` 批次，`expires_at = 支付成功时间 + valid_days` |
| 6 | `RechargeController` | 新增 `POST /recharge-orders/topup`（自定义任意分钟，金额 = 单价 × 分钟数；走普通微信支付 JSAPI） |
| 7 | `AssetController` / 新 DTO | 新增「我的时长批次明细」（remaining + expires_at + status） |
| 8 | 新增定时任务 | 过期批次 `remaining=0 / status=EXPIRED` + 带 batch_id 的 EXPIRE 流水；**不回写** `user_asset.balance` |
| 9 | `AssetChangeSource` + `V6__asset.sql` CHECK | 新增 `EXPIRE` 枚举并同步约束 |
| 10 | `InterviewBillingService` | **无需改动**（批次逻辑全封装在 BillingService 内） |

---

## 十二、最终决策（2026-09-03 已确认）

**方案层面：**
- ✅ 采用「批次表 + 事务内优先级消费」，`asset_batch` 为 `INTERVIEW_SECONDS` **唯一权威账本**，`user_asset.balance` 退化为历史兼容字段
- ✅ 礼包时长独立管理，每次礼包 = 独立批次
- ✅ 礼包支持有效期，过期不可再消耗（扣减侧硬过滤 + 定时任务作废）

**拍板点（均已确认）：**

| 决策点 | 最终决策 |
|---|---|
| 消耗策略术语 | **礼包优先 + 临期优先 + FIFO**（非严格 FIFO） |
| TOPUP 与礼包消耗顺序 | **先按优先级扣礼包，再扣 TOPUP**，LEGACY 垫底 |
| 有效期下消耗排序 | **临期优先**：礼包内有过期按 `expires_at` 近→远，同级按 `created_at` |
| 单独充时长形态 | **自定义任意分钟**（金额 = 分钟单价 × 分钟数；走普通微信支付 JSAPI） |
| 礼包有效期计算 | **购买后 N 天**，基准为**支付成功时间**（`expires_at = payment_success_at + valid_days`） |
| 存量 LEGACY 位置 | **队尾垫底**（排序键 CASE 控制，不伪造 created_at；永久有效） |
| 批次状态 | `ACTIVE / DEPLETED / EXPIRED` 三态；扣减硬条件以 remaining + 未过期为准 |
| 流水粒度 | `user_asset_log.batch_id` 正式字段，GRANT/CONSUME/EXPIRE 均记录，跨批次按批次各记一条 |

---

## 十三、附：关键设计取舍回顾

- **为什么是批次表而非在 user_asset 加字段**：需求本质是「库存批次 + 优先级消费」，字段无法表达「每批剩多少、按来源/到期/到账排序扣减」。
- **为什么批次是唯一权威、`user_asset.balance` 退化为兼容字段**：避免维护两份需要实时强一致的账本；`getBalance` 按资产类型路由到批次 SUM 后，调用方无感且永不漂移。`user_asset` 继续服务 `AI_CHAT_COUNT` 等未批次化资产。
- **为什么过期不回写 `user_asset.balance`**：它已非权威，回写只会重新制造双账本耦合；过期只动批次 + 记 EXPIRE 流水即可。
- **为什么不用 Redis 队列**：Redis 是缓存不是账本，无法与 DB 事务原子一致，账实不可靠。
- **为什么暂不优化 FOR UPDATE 锁粒度**：当前按用户资产整体锁实现最简单、正确性有保证；逐批锁定留待压测证明有竞争后再做，不提前复杂化。
