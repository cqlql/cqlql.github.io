---
title: 模拟面试第二版-语音识别与LLM回合解耦方案
icon: mdi:source-branch
sort: 2
---

# 模拟面试第二版：语音识别与 LLM 回合解耦方案

> **文档定位：后端方案（Step 1 / Step 2 / Step 3 均已交付；前置的实时会话重构 P0-0…P1-3 已完成）。**
> 即：本文档依赖的"接缝"（ASR 运行独立、回合执行独立、连接退出收敛、启动事务边界、注册表查询化）
> 都已落地，并且 **§4.1 的「文字作答」、§4.2 的 `/ws/asr`、以及 Step 3 的治理（配额 / 指标 / 埋点口径 / 日志脱敏）
> 都已经在代码里跑通**（含单测 + 全量回归，2026-09-22）；识别运行本体复用 `AsrStreamRunner`（P0-1），未重写消费循环。
> 落地记录见 §12.3 / §12.4 / §12.5 —— **改这三块代码前先看那三节**；
> 联调记录见 **§12.6**：一个真缺陷（INFO 日志泄漏作答原文，已修）与一个已撤销的误判
> （把 `final` 字段判成 `isFinal`，误以为「回答结束」信号不存在）。
> 回答一个问题：现在「ASR 出文本」与「触发 LLM 回答」是同一根链条上的两段，V2 要
> 「打字作答 + 话筒当输入法」两种新玩法，这条链条该怎么拆。
>
> 前置文档：小程序方案《模拟面试第二版-文字作答与实时语音输入方案》（第 5、6 节）。
> 另一个消费者是 PC 端 `pass-up.frontend/apps/user` 的 `features/realtime-voice`（正式面试，无独立笔记），
> 本次不动它，但方案必须保证不打扰它 —— 见 §2.3。

## 1. 结论先行

**核心结论：**

1. **需要拆，但不是把 ASR 和 LLM 拆成两个服务，而是把「输入源」和「回合执行」拆开。**
   现在只有一个输入源（ASR final），它硬编码了「出文本 ⇒ 立刻跑一轮 LLM」。V2 要多一个输入源（客户端文本），且 ASR 要有一种「只出文本、不跑回合」的用法。
2. **面试会话继续复用 `/ws/audio`**（计时扣费、心跳、暂停恢复、顶号、记录落库、LLM 流式都在那儿），只新增一条文本上行消息；**不另起 HTTP 文本接口** —— 否则等于把 `InterviewSessionState` + 计费 + 逻辑会话恢复那套在 HTTP 上重建一遍。
3. **语音识别独立成一条轻量通道 `/ws/asr`**，只做识别：不落库、不计费、不触发 LLM、不承载会话语义。理由是它的**失败语义**跟面试会话完全不同 —— 话筒识别失败不该把整场面试以 `ASR_UNAVAILABLE(4003)` 关掉（现状就会）。
   **但它的「使用资格」挂靠面试会话（2026-09-24 修订，见 §4.2.5）**：豆包识别是成本入口，不能"只要登录就能用" —— 建连必须有**一场进行中的面试**，面试结束（含失联 / 余额耗尽 / 顶号 / 暂停超时）时由面试侧**主动回收**该用户的识别连接。
   两条连接仍不共享**物理**生命周期（`/ws/audio` 可以暂停/重连/换连接 ID，识别连接不该跟着抖）；共享的只有"资格"这一件事。

**以及一条硬边界：正式面试（PC 端，`mode=ASSIST`）本次一行不改，仍然是「识别后立即 LLM」。**
它采集的是**会议音频**（`getDisplayMedia` 共享会议窗口的声音），AI 扮演求职者给出回答思路 ——
「听清问题就立刻回答」正是它的全部价值，既不需要文字作答，也不会用话筒当输入法。
所有新增能力都由 `input=text` 参数与独立识别通道承载：PC 端不传新参数、不连新通道，
行为与今天一致（见 §2.3 与 §5）。

```text
① 文字作答   /ws/audio（面试会话）  上行 {"type":"ANSWER","text":"..."} → LLM 回合 → 流式下行（协议不变）
② 语音输入   /ws/asr  （新，纯识别）上行 PCM 帧 → 下行 {"type":"ASR_RESULT",...} → 前端填输入框
③ 会话本身   心跳 / 计时扣费 / 暂停恢复 / 落库 / 顶号 —— 全部沿用现状，零改动
④ 正式面试   /ws/audio（PC，mode=ASSIST，不传 input）→ ASR final 即触发 LLM —— 一行不改
```

**当前进度（2026-09-22，以仓库为准）**：

| 形态 | 状态 |
| :--- | :--- |
| ① 文字作答（`input=text` + V26 + `ANSWER` + 回合串行化/`SubmitResult` + 就绪点迁移） | ✅ **已交付**（Step 1；全量测试 182 通过；两端协议文件已登记） |
| ② 语音识别独立通道 `/ws/asr` | ✅ **已交付**（Step 2：路由 + 轻量鉴权 + 时长/并发上限 + 错误语义；识别运行本体复用 `AsrStreamRunner`）；**2026-09-24 补上使用资格与回收**（Step 4，见 §4.2.5） |
| ③ 会话本身（心跳 / 计时扣费 / 暂停恢复 / 落库 / 顶号） | ✅ 未改动，行为等价（回归见 §5.2） |
| ④ 正式面试（PC，`mode=ASSIST`，不传 `input`） | ✅ 一行不改，`audio` 路径按「等价改写」验收 |
| ⑤ **识别通道的使用资格与回收（Step 4，2026-09-24）** | ✅ **已交付**：`AsrUsageGuard`（建连资格闸门）+ `AsrSessionReclaimer`（面试结束回收）；**无前端协议改动**（只多一个错误码 4007）。落地记录见 §12.8 |

**Step 3（治理）也已交付**：每日识别配额（限流）、识别通道指标、埋点口径（`input_mode`）、
日志脱敏（只记长度不记内容）—— 见 §4.2.4 与 §12.5。后端侧 V2 到此**功能与治理都齐了**。

## 2. 现状：耦合点与它带来的三个连带约束

### 2.1 耦合点（代码事实）

> **本节的"代码事实"已按 P0-1 / P0-2 / P1-1 / P1-2 落地后的代码复核更新（2026-09-22）。**
> 变化对本文档的影响是**小了好几个量级** —— 原先要"啃"的两处结构问题，现在都已经是现成的接缝：
>
> | 现在的样子 | 对 V2 的意义 |
> | :--- | :--- |
> | ASR 消费/重连已独立为 `modules/realtime/session/AsrStreamRunner.java`（P0-1，含退避、残留帧丢弃、`asrId` 轮换） | `/ws/asr` **直接复用它**，不要再抽第二个（§4.2 的"抽公共组件"已完成） |
> | 回合执行已独立为 `ConversationTurnRunner`（P0-2）：`submit(UserTurnInput)` / `submitOpening()` / `cancel()` | 步骤一不用再"抽出 `submitUserTurn`"，只需在文本分支调 `turnRunner.submit(...)`（§4.1.3 已改写） |
> | 连接退出已收敛为 `requestClose(...)` + `cleanup(reason)` 两个入口，退出原因用 `CleanupReason`（P1-1/P1-2） | 约束 3（ASR 故障不该杀面试）现在**只需保证识别通道不接这条入口**；`/ws/audio` 内 `ASR_UNAVAILABLE` 语义未变 |
> | 会话启动收敛为 `start()` 事务边界，构造器无副作用；迟到收尾有防护（P1-2/P1-3） | text 模式的起算/开场应挂在「**会话就绪**」= `start()` 成功完成之后（§4.1.4），不是 `onOpen` |
>
> 也就是说：**V2 现在主要是在既有接缝上加分支与新通道，而不是先重构再改造。**

当初的耦合点（保留了代码位置的历史痕迹，便于对照）：

```java
// 原 onAsrText（ASR 每几百毫秒一帧回调）—— 这段现在属于 AsrStreamRunner 的事件产出 + AudioStreamSession 的事件分支
var asrResponse = sendTranscriptMessage(segment);   // ① 下行 ASR_RESULT
var replyParam = new LlmRequestContext();
replyParam.setReplyId(asrResponse.getId());
replyParam.setText(asrResponse.getText());
triggerLlmReply(replyParam);                        // ② final 且非空 ⇒ 立刻跑 LLM 回合
```

`triggerLlmReply` 里的三件事全绑在一条线上：`handleUserMessage`（写上下文 + 落库）→ `sendThinkingMessage` → `DoubaoLlmClient.streamChat`。

另一侧，上行文本的入口只有控制指令，没有任何业务文本：

```java
// AudioStreamSession#receiveText：只认 heartbeat 与 PAUSE，其余一律落到 "非控制指令" 的 debug 日志
```

### 2.2 三个连带约束

| # | 约束 | 后果 |
| :--- | :--- | :--- |
| 1 | 有音频就有 LLM 回合（final 即触发） | 话筒没法当「输入法」用：说一句 AI 就抢答一轮，V2 要求识别结果只填输入框 |
| 2 | 没有文本作答入口 | V2 的核心玩法（打字）后端根本没有路径，必须新增 |
| 3 | ASR 故障 = 会话故障 | 重连耗尽 → `AsrEvent.Unavailable` → `closeListener.onAsrSessionError` → `requestClose(ASR_UNAVAILABLE)` → 下发 `ASR_UNAVAILABLE` + 关闭码 `4003` 整场结束（`asrUnavailable` 布尔已在 P1-2 换成 `CleanupReason`，语义未变）。对「输入辅助」来说这是灾难：用户只是想用语音打个字，面试被终止了 |

约束 3 是「识别必须离开面试会话」的决定性理由 —— 不是洁癖，而是**失败语义**确实不同：

| 维度 | 面试会话（`/ws/audio`） | 输入法式识别 |
| :--- | :--- | :--- |
| 生存期 | 整场面试（分钟级），可暂停/恢复 | 一次说话（秒级），说完即弃 |
| 失败后果 | 会话结束、停计费、落库收尾 | 提示「改用打字」，其余不受影响 |
| 计费 | 按会话时长扣 `INTERVIEW_SECONDS` | 不扣面试时长（但**资格**来自面试） |
| 是否需要落库 | 是（`interview_message`） | 否（识别原文不落库，隐私上更干净） |
| 是否需要跨重连存活 | 是（`InterviewSessionState`） | 否 |
| **使用资格**（2026-09-24 修订） | 自带（用户主动开始一场面试） | **挂靠面试会话**：必须有进行中的面试才能建连；面试结束即被回收 |

> **两条理由要分开看（2026-09-24 定稿）**：「失败语义不同」是识别**离开**面试会话的理由；
> 「豆包识别是成本入口」是识别**资格挂靠**面试会话的理由。二者不矛盾：
> 识别不许**反过来**动面试状态，但"谁能用识别"必须由面试的授权与资产来回答。见 §4.2.5。

### 2.3 另一个消费者：PC 端「正式面试助手」（本次不动，但要保证不被打扰）

`pass-up.frontend/apps/user`（Web 端）的 `features/realtime-voice` 与小程序**共用同一条 `/ws/audio`**，
改动必须按「一个后端同时服务两个客户端」来评估：

| 维度 | 现状 | 说明 |
| :--- | :--- | :--- |
| 建连 | `useVoiceWebSocket#connect` 拼 `/ws/audio?ticket=...`（暂停重连才追加 `&resume=`） | **不传 `mode`** ⇒ 后端 `InterviewMode.from(null)` 回退 `ASSIST`，即正式面试 |
| 音频来源 | `useDisplayAudio` 的 `getDisplayMedia`（共享会议窗口 / 标签页声音） | **不是麦克风**；`usePCMProcessor` 转 16k PCM 后上行 |
| 上行 | 二进制 PCM + `{"type":"PAUSE"}` + `{"type":"heartbeat"}`（`CLIENT_CONTROL`） | 没有任何业务文本上行 |
| 下行消费 | `hooks/protocol.ts#parseServerMessage`：**逐字段运行时校验**，未知 type / 字段畸形 → 返回 null → `console.warn` 后忽略 | 新增下行消息类型对老客户端是安全的（不会崩，但也不会被理解） |
| 会话起点 | 首次收到**任意**后端消息即视为 started | 依赖「ASR 就绪后立刻有下行」，与 `onAsrReady` 触发首问/起算相配 |
| 展示逻辑 | `ASR_RESULT` 建/更新转写气泡；`LLM_REPLY.replyId` 回指 ASR id，把回答插在该转写之后 | 这条「转写 ↔ 回答」配对是 PC 的核心体验 |

**结论：PC 端不在本次改造范围内。** 方案里所有行为变化都收在 `input=text` 与 `/ws/asr` 两个新开关后面：
PC 端不传新参数、不连新通道、不发 `ANSWER`，因此不受影响；但改动仍必须做回归（见 §5.2）。

顺带记一处**既有协议漂移**（本次不修，但别重蹈）：后端在 ASR 重连耗尽时会下发
`ErrorMessage("ASR_UNAVAILABLE")` + 关闭码 `4003`，而两端的错误码白名单里**都没有这个码**：

- PC：`protocol.ts` 的 `SERVER_ERROR_CODES` 未包含 → `parseServerMessage` 直接丢弃 → 只剩一条 console 告警，
  **用户看不到任何原因**，只能感知「监听已结束」；
- 小程序：`features/interview/ws.ts#resolveServerErrorCode` 未包含 → 兜底归为 `BILLING_ERROR`
  （文案用服务端 message，表现尚可但不精确）。

→ **新增 / 调整任何错误码或下行消息类型时，必须同步更新两端协议文件**
（`apps/user/src/features/realtime-voice/hooks/protocol.ts`、`src/features/interview/ws.ts`）。
V2 的识别通道沿用 `ASR_RESULT` 时无需动协议；若新增 type，则两端都要登记。

## 3. 方案对比：识别通道放在哪

| 维度 | **A. 独立识别通道（推荐）** | B. 留在面试会话内按需开关 | C. 文本作答走 HTTP SSE（`/api/qna/chat` 同构） |
| :--- | :--- | :--- | :--- |
| 连接数 | 2 条（会话 + 识别，识别短命） | 1 条 | 2 条（会话 + HTTP），仍要 1 条 WS 承载计时 |
| 文本作答 | `/ws/audio` 新增 `ANSWER` 上行 | 同 A | 新接口 `POST /api/interviews/{id}/messages` |
| ASR 失败影响 | **仅识别通道**，面试不受影响 | 需为 text 模式单独拆掉 `4003` 分支，否则话筒故障杀面试 | 同 A |
| 复用现有 ASR 逻辑 | 复用 `DoubaoAsrClient`（含 8 秒空闲保活）+ 抽取消费循环 | 复用 `consumeLoop`，但它是「长跑重连」结构，要改成可启停 | 同 A |
| 计费/暂停/恢复/顶号 | 全部沿用 | 全部沿用 | **全部要重建**（HTTP 无连接，`isConnectionLost` 失效，暂停恢复无从下手） |
| 语义清晰度 | 高：识别就是识别 | 低：同一个 `ASR_RESULT` 在两种模式下含义不同 | 中 |
| 可复用性 | 高：AI 问答、简历诊断等页面都能用同一条识别通道 | 低：只能服务面试 | 中 |
| 主要代价 | 多一条 WS 的鉴权/心跳/限流/监控；需要抽公共 ASR 运行器 | 改动集中在 `AudioStreamSession`，看似省事，实则要按模式分支它的错误路径与生命周期 | 会话层重建成本最高 |

**结论：A。** B 作为「先不新增端点」的降级备选保留（见 §10），C 不建议。

> **A 的资格模型（2026-09-24 定稿）**：A 说的"独立"是**通道独立**，不是**资格独立** ——
> 建连要过"有进行中的面试"这道闸（§4.2.5）。这不是把 A 退回 B：B 是"在**同一条连接**里按模式开关 ASR"，
> 被否掉的是那个（要为一个连接同时维护两套生命周期）；A 是"两条连接 + 面试会话授权"，两套生命周期各自干净。

## 4. 推荐方案细化

### 4.1 面试会话侧：新增「文本作答」输入源（✅ 已交付，Step 1）

> **实现状态（2026-09-22）：本节已全部落地。** 关键落点：
> `InterviewInputMode` + `converter/InterviewInputModeConverter`（V26 `interview.input_mode`）、
> `ControlMessage.TYPE_ANSWER`、`AudioStreamSession#handleAnswer`、`ConversationTurnRunner.SubmitResult`、
> `AudioStreamSession#markSessionReady()`。
> 与本节描述**只有三处细节差异**（实现比方案更严/更简），已记在 §12.3，改代码前先看那三条。

#### 4.1.1 建连参数与持久化

```text
/ws/audio?ticket=xxx&mode=MOCK&input=text&language=zh&...
                                    ^^^^^^^^^^ 新增，取值 audio | text，默认 audio
```

- 默认 `audio` ⇒ **老前端不传即保持现状**（ASR 自动提交回合、ASR 故障 4003 全不变）。PC 端与 V1 小程序都走这条分支。
- **`input=text` 只对 `mode=MOCK` 成立**：`ASSIST`（正式面试）+ `text` 视为非法参数，直接回
  `INTERVIEW_PREPARE_FAILED` / 握手错误，不静默降级为 audio。
  理由与「传了无效参数就失败、不静默换一个」的既有原则一致：正式面试若被误配成打字，
  用户会觉得「AI 不回答了」，而这是个配置错误，必须当场暴露。将来若真要做「PC 端文字提问」，再放开。
- `input` 需要落库：`interview.input_mode`（Flyway `V26`；**已复核(2026-09-22)：当前最新仍是 `V25`**），
  否则进程重启后 `LogicalSessionRebuilder` 从 DB 重建逻辑会话时无法还原作答方式。
  **列定义用 `varchar(...) NOT NULL DEFAULT 'audio'`，不要用可空列**：

  ```sql
  ALTER TABLE interview ADD COLUMN input_mode varchar(16) NOT NULL DEFAULT 'audio';
  -- 历史行因此自动落到 'audio'（未设置 / 老数据 / 默认值 三者不再需要区分）
  ```

  理由：这个字段是**会话行为的一部分**（决定这条连接起不起 ASR、ACK 什么上行），不是可选业务属性。
  留成可空会让 `NULL` 同时承担三种含义（老数据 / 未设置 / 默认 audio），
  而代码层又是"默认 audio" —— 两边语义一错位，重建逻辑会话时就可能把 text 会话还原成 audio。
  **约定：代码层默认 `audio`，数据库层最终统一 `NOT NULL + DEFAULT 'audio'`，两者一致。**

  Java 侧**不要散落字符串**，用枚举（与项目既有枚举风格一致），DB 仍是 `varchar(16)`（不上 PostgreSQL ENUM）：

  ```java
  public enum InterviewInputMode { AUDIO, TEXT }   // 默认 AUDIO
  ```

  落库/回读都经 `InterviewInputMode.from(String)`：**`null` / blank → `AUDIO`（历史数据与缺省），
  但未知值（`"voive"` / `"TEXTT"` 这类）抛异常，不静默降级**。
  理由：这个字段是**行为型**的（决定起不起 ASR、收不收 `ANSWER`、怎么触发会话就绪），
  把脏数据悄悄变成另一种业务行为，比当场报错危险得多。`null` 与"未知值"语义完全不同，不能合并处理。
  **SQL 默认值与代码缺省值保持一致，并明确区分"缺省值"与"非法值"**（前者静默取默认，后者必须报错）。
  注意这是"两个默认、语义一致"，不是"一处定义"：DB 的 `DEFAULT 'audio'` 与代码的 `null → AUDIO` 各存在一份，
  改动时要两边一起看 —— 别把它当成唯一的默认值来源。
- 传导链：`TicketHandshakeInterceptor`（透传）→ `InterviewPrepareService.ConnectionRequest`（新增字段）
  → `Interview`（落库）→ `InterviewContext`（新增字段）→ `InterviewSessionState`（新增字段）。

#### 4.1.2 回合执行：复用 `ConversationTurnRunner`（P0-2 已完成，本次不再抽取）

把「用户说了什么 → AI 回什么」抽成一个方法，任何输入源都汇入它：

```java
// 已存在（P0-2 抽出）：一个输入 = 一个完整回合（写上下文 + 落库 + THINKING + LLM 流式 + 落库）
// com.xiaodingtie.passup.modules.realtime.session.ConversationTurnRunner
public void submit(UserTurnInput input);   // record UserTurnInput(String inputId, String text)
```

- ASR 路径（不变）：`AsrEvent.Transcript(final)` → 下行 `ASR_RESULT` → `inputMode == AUDIO && final && 非空` ⇒
  `turnRunner.submit(new UserTurnInput(segment.id(), segment.text()))`
- 文本路径（新增）：`receiveText` 的 `ANSWER` 分支 ⇒ `turnRunner.submit(new UserTurnInput(后端生成 inputId, text))`

> **`UserTurnInput` 的 ID 语义（建议随本次一起改名）**：现有 record 是
> `UserTurnInput(String replyId, String text)` —— 字段叫 `replyId`，但它其实承载的是**输入侧**的标识
> （ASR 用 segment id、文本输入没有 transcript），只是"顺手"被复用成了回复的关联 ID
> （前端据此把 `LLM_REPLY` 配到对应的 `ASR_RESULT` 转写气泡上）。建议改为：
>
> ```java
> record UserTurnInput(String inputId, String text)   // ASR: segment id；TEXT: 后端生成
> ```
>
> 理由：以后还会有 `paste` / 快捷回复 / 断线补发等输入源，不该让它们全都叫 `transcript` / `reply`。
> 顺带把 §4.1.3 里"UUID"这件事写清：**ID 由后端生成**（`UUID.randomUUID()` 只是实现细节，
> 不要在方案里把它当成契约；前端不需要自己造 ID，也不该依赖 ID 的格式）。
>
> **协议边界（写死）**：`ANSWER` **仅允许 `inputMode=text`**。
> audio 模式收到 `ANSWER` ⇒ 回 `ErrorMessage("INVALID_INPUT_MODE")`、**不触发任何回合**、不改会话状态。
> 理由：否则"`ControlMessage.TYPE_ANSWER` 存在"很容易被读成"audio 模式也能直接发文字"。
> 这与「`ASSIST` + `input=text` 直接拒绝」是同一条原则 —— **模式与能力一一对应，不做静默兼容**。
- **原来的"抽 `submitUserTurn`"这一步已由 P0-2 完成**，本方案不再需要它；
  唯一新增的是「谁把文本喂给 runner」这一处分支（外加 `inputMode` 判定）。
- 注意：回合串行化（`turnInProgress`）在 `ConversationTurnRunner` 内部（它自己持 `cancel()` 语义），
  文本模式不需要在会话层再实现一遍；但**前端连点**仍可能出现，见 §4.1.5。

> 刻意**不做**的事：不引入「Turn/Message 领域模型」、不改 `DoubaoLlmClient` 的调用方式（仍是每轮 `new`）。
> 这次重构只需要一个入口方法，把顺手的重写压到最小 —— 旧链路的稳定性优先。

#### 4.1.3 上行协议新增 ANSWER

```json
{ "type": "ANSWER", "text": "用户的回答文本" }
```

- 校验（✅ 已实现）：剔除控制字符（**保留换行与制表符**，多行作答是正常输入）、去首尾空白后必须**非空**
  且不超过 **2000 字**；违规分别回 `ErrorMessage`：
  - `INVALID_ANSWER`（空）—— 明确报错而不是静默丢弃，否则前端会以为"发了没反应"；
  - `ANSWER_TOO_LONG`（超长）—— **拒绝而不是截断**，截断会让 AI 收到残缺语义而用户无感知。
- **不做幂等，也不加 `answerId` / `clientMsgId`**（2026-09-22 定稿；评审里"给 `ANSWER` 加客户端幂等 ID"的
  建议**已撤回**）：前端发送后即禁用输入（等回复），没有重发场景；将来若真要「失败重试」，
  再加 `clientMsgId` 并由**后端**做去重。
- **加字段不是"可选增强"，而是协议变更 —— 现在单边加会把整条消息废掉**：
  上行解析走 `Jsons.parse`（Jackson 默认 `FAIL_ON_UNKNOWN_PROPERTIES=true`），而 `ControlMessage`
  只声明了 `type` / `text`，多传一个字段会让整条 `ANSWER` 被当解析失败丢弃（只剩一条 debug 日志）。
  要加必须两端同版本一起改（`ControlMessage` 加字段 + 显式放开未知字段）。
- 下行协议**完全不变**（`THINKING` / `LLM_REPLY` / `TIME_UPDATE` / `ERROR` / `PAUSED`）：
  文本作答没有 ASR id，`replyId` 由后端生成 UUID，前端仍按 `onThinking(replyId)` 建占位气泡、
  按 `LLM_REPLY.replyId` 填充 —— 前端零协议改动。

> **协议事实（2026-09-22 联调确认）**：`LLM_REPLY{final:true}` 就是豆包流式响应的**末分片**
> （`finish_reason != null`），**它同时带最后一段正文** —— 前端对它是**追加**语义、不要整段替换，
> 一轮回复只应有一条。它是 V2「等 `final` 再恢复输入框」的唯一依据。
> 字段名以实际 JSON 为准：是 `final` 而不是 `isFinal`（Jackson 对 `isXxx()` 会去掉前缀）。
> 细节与一次相关误判见 §12.6.1。

#### 4.1.4 会话起点的迁移（容易被漏掉的一处）

现状（**P0-1/P0-2/P1-2 之后仍然成立**）：**计费起算与 MOCK 首问都挂在 ASR 就绪上**
（`AudioStreamSession#handleAsrReady()` → `publishStarted()` / `turnRunner.submitOpening()`）。
`start()` 里**刻意没有**发「面试开始」事件（P1-2 明确保留了"起算点必须与识别真的可用对齐"这一语义），
所以 text 模式不启 ASR 时，这两个回调一样永远不会来 —— 会话会既不扣费也不开场。

| 触发点 | audio 模式 | text 模式（新增） | 幂等守卫（不变） |
| :--- | :--- | :--- | :--- |
| 计费起算 `publishStarted()` | `handleAsrReady()` | **会话就绪：`start()` 成功完成之后** | `InterviewSessionState#startedPublished` |
| MOCK 首问 `turnRunner.submitOpening()` | `handleAsrReady()` | **同上** | `InterviewSessionState#initialQuestionSent` |

- 用同一对 `AtomicBoolean` 守卫，保证 ASR 内部重连、暂停后重连都不重复起算/重复开场。
- 实现建议：把 `handleAsrReady()` 的两段逻辑抽成一个「会话就绪」入口 —— **✅ 已按此实现，方法就叫
  `markSessionReady()`**：audio 由 `AsrEvent.Ready` 触发、text 由「**会话就绪**」触发，
  且**未改 audio 的触发时机**（那会是行为变更）。

> **「WebSocket 建立成功」≠「面试开始」**（这一条要在实现时写死，别让它漂）：
> `onOpen` 里在建连之后还有 prepare、`new Session`、`start()`；其中 `start()` 才是生命周期事务边界
> （状态迁移、绑连接、起 runner），它**可能失败并就地回滚**（P1-2）。
> 如果 text 模式把起算点挂在泛化的 `onOpen` 上，就会出现「连接建立了、会话其实没准备好，却已经开始计费」。
> 因此 text 模式的触发点是：
>
> ```text
> WebSocket onOpen → prepare（pending → active）→ new Session → session.start() 成功
>                                                                    ↓
>                                                             【会话就绪】
>                                                                    ↓
>                                        markSessionReady(): publishStarted() + submitOpening()
> ```
>
> 落地方式（二选一，建议后者）：
> 1. `AudioStreamingService.onOpen` 在 `streamSession.start()` 返回后调用一次 `streamSession.markSessionReady()`（text 分支）；
> 2. 或让 `start()` 接收「就绪来源」（`ASR_READY` / `CONNECT_READY`），由内部统一决定何时 `markSessionReady()` ——
>    好处是"就绪"这件事只有一个写入口，不会出现两处各调一次（也就不会重复起算）。
> 无论选哪个，**幂等仍由 `startedPublished` / `initialQuestionSent` 这对 `AtomicBoolean` 保证**。
- text 模式下不启动 ASR 运行期（不创建 `AsrStreamRunner`，或创建但不 `start()`）⇒ 也就没有
  `AsrEvent.Ended → closeListener.onAsrSessionEnd` 这条「ASR 结束即关闭物理连接」的路径。
- `receiveAudio` 在 text 模式下收到音频帧：**忽略并 warn**（防御性，前端不该推），不要静默喂给不存在的 ASR。

#### 4.1.5 回合串行化（text 模式必须做）

现状的 ASR final 天然串行（同一回调线程），但 LLM 是流式异步的，用户连续说两句本来就可能并发两个回合；
改为打字后「连点发送」会变得非常容易，直接并发会打乱上下文顺序。

**归属原则（定死，别把复杂度塞回 Session）**：

> **「回合是否正在执行」以及「同一时间允不允许再提交一个回合」，全部由 `ConversationTurnRunner` 负责；
> Session 只负责把不同输入源转换成 `UserTurnInput`。**

这一点 `ConversationTurnRunner` 的类注释里已经写好（"回合串行化是回合执行的语义，落在这里而不是会话里"），
**不要在会话里再放 `AtomicBoolean turnInProgress`** —— 否则会出现两层回合状态：

```text
需要避免的形态：
AudioStreamSession
  ├── inputMode
  ├── turnInProgress      ← 与 Runner 内部状态重复
  └── ConversationTurnRunner
        └── （自己也在判断忙/闲）
```

落地方式：给 Runner 的提交入口加返回值，让"忙时拒绝"成为 Runner 的能力：

```java
// modules/realtime/session/ConversationTurnRunner
public SubmitResult submit(UserTurnInput input);   // ACCEPTED / BUSY / REJECTED

// 会话侧只做输入源适配与结果转译：
ANSWER → turnRunner.submit(new UserTurnInput(inputId, text))
            ├─ ACCEPTED → 无需额外动作
            ├─ BUSY     → 回 ErrorMessage("TURN_BUSY")（前端等待期间禁用输入框）
            └─ REJECTED → 忽略（会话已结束/暂停，前端本就该断开）
```

**三种状态的语义（写死，别让实现者自行发挥）**：

| 值 | 含义 | 典型场景 | 前端应对 |
| :--- | :--- | :--- | :--- |
| `ACCEPTED` | 已进入回合执行，可以等 `THINKING` / `LLM_REPLY` | 正常提交 | 正常等待 |
| `BUSY` | **已有回合在执行**，本次输入未被接受 | 用户连点 / 上一轮还在流式输出 | 禁用输入框并提示"AI 正在回复" |
| `REJECTED` | **Runner 当前不允许创建新回合**（具体原因 —— ENDED / PAUSED / CLOSING / CANCELLED —— 由 Runner 内部判定，**不暴露给会话层**） | 断线残包、已结束/已取消会话上的提交 | 走断线 / 结束态 |

**`BUSY ≠ REJECTED`**：前者是"现在不行、等下可以"，后者是"这场面试已经不能答了"。两者前端体验不同，不要合成一个。

**`submitOpening()` 与 `submit()` 的关系**：**共享同一把回合状态，但不必共用同一个 public API**。
Opening 是系统触发的特殊回合（没有用户输入，文案来自 `OPENING_INSTRUCTION`），
为了"统一 API"把它伪装成一个 `UserTurnInput` 反而更脏；正确形态是：

```java
public SubmitResult submitOpening();            // 系统触发，走同一把"回合状态"
public SubmitResult submit(UserTurnInput input); // 用户输入
```

> **实现核对（2026-09-22，已落地）**：串行化已按本节实现，但有 **两处与原先的"现状核对"不同**，
> 别再按旧理解改代码：
>
> 1. **`submit` 不是同步阻塞的**。原先记录为"会一直执行到整轮流式结束才返回"是**误读**：
>    `DoubaoLlmClient#streamChat` 是 `executor.submit(...)` 之后**立即返回**（异步）。
>    因此"`submit` 返回即释放占用"根本兜不住连点 —— **占用必须覆盖整轮流式输出**：
>    在进入回合之前取占用，在本轮**终态**（`onComplete` / `onError` / `onCancel`）释放，
>    另加"提交本身失败"（建客户端 / 提交任务抛异常）的兜底释放，避免永久卡在 `BUSY`。
> 2. **`cancel()` 不清理占用标志**（即 §12.1 的"第二种做法"）：另设一个 `accepting` 标志表示
>    "本 Runner 还接不接受新回合"，`cancel()` 只关它 + 打断当前请求；占用一律由**拥有该回合的提交路径**释放。
>    于是"取消后再提交"得到的是 `REJECTED`（不是 `BUSY`），也不存在"旧回合收尾误清新一轮占用"。
>
> 由此仍然成立的硬约束只有一条：**占用必须是 CAS 标志**（`AtomicBoolean.compareAndSet`）——
> ASR 路径的 `submit` 来自 ASR 事件线程、文本路径来自 WS 处理线程，两者可能并发。
>
> **`BUSY` 仍必须在进入回合之前判断**：不能靠"同一连接顺序处理、反正不会并发"来兜 ——
> 那样用户看到的是**发了没反应**，比直接回 `TURN_BUSY` 更糟。

> **提交状态是统一的（不变）**：`ConversationTurnRunner` 的串行化状态对 opening 与用户回合**共用一把**，
> 因此 audio 路径也一样受它约束（ASR final 与 opening 不会并发）。
> 不要理解成"audio 绕过 BUSY、text 使用 BUSY" —— 那会变成两套语义。audio 的并发隐患（多句 ASR final 抢跑）
> 仍另开治理项，但**入口判断只有一处**。
> 注意：`submitOpening()` 也走同一个入口判断，否则「首问还没答完用户就打字」会并发两个回合。

#### 4.1.6 心跳仍是唯一存活判据 —— text 模式下更关键

text 模式**没有音频帧**，而「未声明心跳的老客户端」判据是音频活跃度 5 分钟：
用户写一段长回答超过 5 分钟不提交，就会在旧判据下被判失联。
因此前端接入 V2 会话时**必须发应用层心跳**（建连后立即一次，随后 25 秒一次，随连接启停），
一旦发过心跳就切到 60 秒严格判据，音频空窗不再影响。这条是前端方案的硬约束，后端不做兜底特例
（不把「收到 ANSWER」当心跳，否则又会回到「业务消息寄生心跳」的老问题）。

**状态语义（写死；评审里那条「失联 ≠ 暂停」就是这一节）**：

| 事件 | 后端行为（均为既有实现，V2 未改） | 会话状态 |
| :--- | :--- | :--- |
| 用户在思考，长时间不发 `ANSWER` | 无任何特判：只要心跳在就一直是 `ACTIVE`。**思考时间算面试时间**，按整场时长计费 | `ACTIVE` |
| 收到 `{"type":"heartbeat"}` | 只刷新"连接存活"，**不代表"用户正在操作"**，也不刷新计费活跃度 | `ACTIVE` |
| 超过失联阈值没收到心跳（语音 60 秒 / **文字作答 180 秒**） | 判连接失活 → **踢出并结束面试**（停计费、落库收尾）；**不是暂停** | `ENDED` |
| 客户端显式发 `{"type":"PAUSE"}` | 断开物理连接、保留逻辑会话，等 `resume=<逻辑会话ID>` 重连 | `PAUSED` |
| `PAUSED` 超过保留时长（默认 15 分钟）未重连 | `SESSION_EXPIRED` 结束 | `ENDED` |

三个要点：

1. **没有"无操作自动暂停"**：只有显式 `PAUSE` 才进 `PAUSED`；**用户思考 1 分钟仍是 `ACTIVE`**。
2. **失联是"结束"不是"暂停"**（✅ 2026-09-22 定稿，不再变更）：小程序切后台 / 计时器被系统挂起
   超过阈值，用户回来时**面试已经结束** —— 这是既定行为，V2 联调时不要当 bug 报。
3. **但文字作答的失联阈值放宽到 180 秒**（`realtime.text-heartbeat-timeout-ms`，语音仍 60 秒）：
   text 模式是"看题 → 思考 → 打字"，**切后台/锁屏想一会儿再回来是常态**
   （挂起的是 JS，心跳随之停，但 TCP 连接往往还在），沿用 60 秒会把回来的人判成失联。
   阈值的作用点只有一个：`AudioStreamSession#effectiveTimeoutMillis()`（三档：老客户端音频 5 分钟 /
   语音心跳 60 秒 / 文字心跳 180 秒），**没有新增状态**。
   阈值上限由计费约束：判定期间会话仍是 `ACTIVE`、**照常计时计费**，所以 `阈值 = 真的一去不回时最多多扣多少秒`。

> **为什么不引入 `DISCONNECTED` 状态或"失联可恢复"**：连接真的断了时，前端**没有自动重连**
> （当前唯一的恢复路径是"显式 `PAUSE` → 手动 `resume`"），后端留多久都不会有人来接；
> 而 TCP 未断（只是 JS 挂起）的场景，放宽阈值就能自动续上，**零前端改动**。
> 要真做"失联可恢复"，得引入新状态 + DB 语义 + 前端自动 resume，属独立议题，收益远小于成本。
> 另外，把失联映射成 `PAUSED` 会让 `PAUSED` 同时表示"主动暂停 / 锁屏 / 断网 / 杀进程 / 故意断网"，
> 「用户主动暂停」这个最有产品价值的信号会被冲掉 —— 这正是"两套语义分开"要守住的东西。

### 4.2 识别通道侧：`/ws/asr`（纯识别）（✅ 已交付，Step 2）

> **实现状态（2026-09-22）：本节已落地。** 关键落点：`WebSocketConfig`（注册 `/ws/asr`）、
> `AsrHandshakeInterceptor`（只验票）、`AsrWebSocketHandler`、`modules/realtime/asr/AsrStreamingService`
> 与 `AsrStreamSession`；识别运行本体直接复用 `AsrStreamRunner`（P0-1），**没有重写消费循环**。
> 与本节描述有三处实现细节差异（含一处**必须补的协议字段** `final`），见 §4.2.2 与 §12.4。
> 前端据此可以开始实现 `AsrTransport`（协议契约见 §4.2.2）。
>
> ✅ **2026-09-24 修订已落地（Step 4）**：识别通道从"与面试会话完全解耦"改为
> **「物理解耦 + 资格挂靠面试会话」** —— 建连要过"有进行中的面试"这道闸，面试结束回收识别连接。
> 实现落在 `AsrUsageGuard`（资格）+ `AsrSessionReclaimer`（回收），协议增量只有**一个错误码**
> （前端无需新增建连参数）。细节见 **§4.2.5**，实现差异与验收见 **§12.8**。

> **本次只服务 V2 小程序**：PC 端采集的是会议音频、没有「用户对着电脑说话」的场景，不接这条通道。
> 但通道本身按通用能力设计（只依赖 ticket 鉴权、语义就是「音频 → 文本」），
> 将来 PC 端要做「手动语音提问」时可直接复用（PC 已有 16k PCM 转换管线 `usePCMProcessor`），
> 不需要再为它改一次后端 —— 这也是 §4.2.3 建议把「鉴权」与「面试余额准入」分开的原因。

#### 4.2.1 组成

| 组件 | 作用 | 复用情况 |
| :--- | :--- | :--- |
| `WebSocketConfig` | 注册 `/ws/asr` | 改（加一行注册） |
| 握手拦截器 | 只校验 ticket（**不校验余额**） | 新增轻量实现，见 4.2.3 |
| `AsrWebSocketHandler` | 二进制上行 / 文本下行 + 关闭收尾 | 新增（结构对齐 `AudioWebSocketHandler`，去掉业务分支） |
| `AsrStreamingService` | 连接注册表 + **资格闸门**（§4.2.5）+ 单用户并发限制 + 时长上限 + **按 `userId` 被回收** | 新增 |
| `AsrStreamSession` | 一次识别的运行单元：推帧、收文本、生命周期 | 新增（**很薄**：只管连接 / 时长上限 / 单用户并发，识别运行本体复用下面的 Runner） |
| `DoubaoAsrClient` | 豆包实时识别 | **原样复用**（含静音保活、错误归一、`release()` 幂等） |
| 消费/重连循环 | `pumpAudio` + 退避重连 + 残留音频丢弃 + `asrId` 轮换 | ✅ **已就绪（P0-1）**：`modules/realtime/session/AsrStreamRunner.java`（`/ws/audio` 已在用，重连预算与 `realtime.asr.*` 属性都在它内部）→ `/ws/asr` **直接复用，禁止复制** |

> **原「抽公共组件」这一步已完成（P0-1）**，所以本方案不再包含"动旧代码"的重构点 ——
> 新增通道是纯增量。回归已在 P0-1 做过（重连预算 / 退避 / `reconnect-reset-ms` / 丢弃残留音频行为等价）。
>
> **三条边界（2026-09-24 修订：从"完全解耦"改为"物理解耦 + 资格挂靠"）**：
> 1. **不与 `/ws/audio` 共享物理连接生命周期**：一条 `/ws/asr` 的生死只取决于"用户这次说话"
>    与"面试是否还授权它"，不取决于某条 `/ws/audio` 连接是否在场（那条连接会暂停、重连、换连接 ID）。
> 2. **但受面试会话的「授权」与「回收」管理**：建连要过"有进行中的面试"这道闸，
>    面试**结束**时由面试侧主动关闭该用户的识别连接（§4.2.5）。
>    这不是业务耦合 —— 面试侧不需要理解识别，只需要知道"这个用户还有没有资格"；
>    识别侧也不需要理解面试，只需要问一句"现在允许吗"。
> 3. **`AsrStreamSession` 仍然不承载任何面试会话语义**：不拥有 `InterviewSessionState`、不维护会话状态机、
>    不碰计费/暂停恢复/顶号/`CleanupReason`、不落库、不创建或修改 `Interview`。它只是"一次识别"的运行单元。
>    否则很容易慢慢长成第二个 `AudioStreamSession`，把刚拆出来的边界又糊回去。
>
> 与旧的"边界 1（不接 `SessionRegistry`、不走 `requestClose/cleanup`）"的关系要写清：
> **它仍然不接注册表作为"会话载体"**（不登记、不参与心跳扫描、不写任何逻辑会话状态）；
> 新增的只是一个**单向的、按 `userId` 的回收入口**（面试侧 → 识别侧），以及一个**只读的资格检查**（识别侧 → 面试侧）。
> 一读一收，都不共享状态对象。
>
> 理想结构就是一条直线，复杂度全部压在最后一步的一个组件里：
>
> ```text
> AsrWebSocketHandler → AsrStreamingService → AsrStreamSession → AsrStreamRunner → DoubaoAsrClient
>                                                        ↑
>                                        （重连/退避/残留帧/自愈 全在这里，P0-1 已完成）
> ```
>
> 再加上 2026-09-24 的两条**单向边**（它们不构成第二个会话）：
>
> ```text
> 面试侧（AudioStreamingService#cleanup）──回收(userId)──→ AsrStreamingService        // 面试结束才走
> 识别侧（AsrStreamingService#ensureAuthorized）──只读问一句──→ 面试侧：现在有进行中的面试吗？
> ```
>
> 判断是否长歪的**两句话自检**（2026-09-24 加了第二句）：
> ① **"识别失败时会不会有人想动面试状态？"** —— 答案必须是"不会"；
> ② **"面试结束时会不会有人来收识别连接？"** —— 答案必须是"会，且只有一处入口"。
> 第一句保证识别没有反向侵入面试，第二句保证面试真的管得住识别（只有第一句而没有第二句，
> 就是本次修订前的状态：资格与生命周期都没人负责）。
>
> **`AsrStreamRunner` 依赖核对（2026-09-22 实测，不是"声明"）**：它的 import 只有
> `AsrSegment` / `DoubaoAsrClient` / `DoubaoAsrProperties` / `RealtimeProperties` 与 `java.util.concurrent.*`，
> **没有** `AudioStreamSession` / `InterviewSessionState` / `CleanupReason` / `SessionRegistry` / 计费 /
> `sendMessage` / `closeListener`；事件出口是 `AsrEventHandler` + `AsrEvent`（Ready / Transcript / Ended / Unavailable），
> 入口是 PCM 帧 —— 即"声音进、事件出"，符合公共 Runner 的形态。
> 唯一与面试沾边的是 `RealtimeProperties`（`realtime.asr.*` 的重连预算），那是**配置而非会话状态**，可接受；
> 新增消费者时不要往里塞任何"面试状态"。

#### 4.2.2 协议（与面试链路对齐，前端才能复用同一套合并规则）

- 上行：二进制 PCM 帧（16kHz / 16bit / 单声道），与现有前端采集参数一致，后端无需转码。
- 上行控制：**不使用应用层 heartbeat**。识别连接是短命的（点话筒 → 说话 → 关闭），
  复用面试那套心跳语义只会让实现者反复追问"到底需不需要"。连接存活由**物理连接绝对上限**兜底
  （落地为 `realtime.asr.session-max-duration-ms`，默认 **300 秒**；绝对墙钟、不重置 ——
  它 ≠ "单次回答允许时长"，后者是前端录音上限，见 §4.2.4）。
  > ✅ **2026-09-24 补：`/ws/asr` 新增「上游输入空闲释放」（25 秒）**。
  > 原先这里写的是"不做帧空闲超时，因为前端用本地 VAD、只在说话时推帧"—— 那句话**与实际实现不符**：
  > 小程序语音模块用的是微信录音机的**连续推帧**（`duration: 180000` / `frameSize: 4`，
  > `onFrameRecorded` 在静音时照样回调，见 `features/speech/recognizer.ts`），
  > 因此对这条通道而言「一段时间没有上行音频」**等价于**"用户已停止录音 / 客户端断了"。
  > 于是新增 `realtime.asr.input-idle-timeout-ms`（默认 **25 秒**，0 = 关闭）：到点**静默关闭**
  > （1000、不下发 ERROR，指标 tag `input_idle`）。
  > **它只属于 `/ws/asr`**：`/ws/audio` 在用户倾听 / AI 生成时本来就没有上行音频，不能套用；
  > 也正因语义不同，它**没有**放进共用的 `AsrStreamRunner`，而是落在 `AsrStreamSession`。
  > ⚠️ 前提是"客户端连续推帧"：**将来若有客户端在 `/ws/asr` 上做本地 VAD**，
  > 这个阈值必须跟着调大或关掉，否则会把"用户在想"判成"已停止"。
- 上行文本：**不使用**（没有心跳、没有控制指令）。收到文本只记 debug 日志，不回错误、不改状态。
- 下行：复用 `AsrResultMessage`，并**补上 `final` 字段**（✅ 实现时新增，见下方"实现修正"）：
  `{"type":"ASR_RESULT","id":"...","text":"...","final":false,"serverNow":...}`。
  保持现有 id 语义：**同一句的中间帧与 final 帧共享 id，final 之后轮换**。
- 错误与关闭码（**识别通道自己的语义空间**，不复用面试链路的业务错误）：

| 场景 | 下行 `ERROR.code` | 关闭码 | 前端应对 |
| :--- | :--- | :--- | :--- |
| 凭证缺失 / 无效 | `AUTH_FAILED` | 4001 | 重新取凭证；提示重新登录 |
| **没有进行中的面试**（2026-09-24 新增，见 §4.2.5） | `ASR_NO_ACTIVE_SESSION` | 4007 | 提示「请先开始面试」；**不要自动重连** —— 除非用户重新开始了一场面试 |
| 单用户并发识别连接超限 | `ASR_LIMIT_EXCEEDED` | 4004 | 先关掉自己那条旧识别连接再重试（不要静默重连） |
| **当日识别次数已用完**（Step 3） | `ASR_QUOTA_EXCEEDED` | 4006 | 提示「今日语音识别次数已用完，请明天再试或手动输入」；**重试无用**，不要自动重连 |
| 识别服务不可用（重连耗尽 / 未预期异常 / 未配置 Key） | `ASR_UNAVAILABLE` | 4003 | 提示「语音识别不可用，请手动输入」，**不影响面试** |
| 单次识别达到时长上限（兜底） | `ASR_TIMEOUT` | 4005 | 当作"本次语音输入已结束"，可再次点话筒 |
| **面试结束，服务端主动回收识别连接**（2026-09-24 新增） | 无（静默） | 1000 | 静默收尾：此时页面本就在结束/收尾态，**不要**弹"识别不可用" |
| 正常结束（用户停止 / 服务端正常收尾） | 无 | 1000 | 静默收尾，无需提示 |

> **四道准入闸门的顺序（实现里写死，前端可依赖）**：凭证 → **资格**（有没有进行中的面试）→
> **并发**（可即时自救）→ **日配额**（重试无用）。
> 资格放最前是因为它是**授权**层（没在面试里就谈不上"用识别"）；并发放配额之前是因为它可即时自救
> （关掉旧连接即可），而配额只能等到明天 —— 两个错误码给出的是完全不同的引导，不能合成一句。
> 被前**三**道拒绝的连接**不消耗**当日配额。

> **实现修正（2026-09-22，必须知道）**：本节原文写"复用 `AsrResultMessage`"时**没有 `final` 字段**，
> 但前端 `useSpeechInput` 的「中间态覆盖草稿 / 定稿追加」**必须有它**（"id 轮换"只能表达"下一句开始了"，
> 无法表达"最后一段已定稿"）。实现时给 `AsrResultMessage` 加了 `isFinal`（序列化名 `final`，
> 与 `LLM_REPLY` 一致），并**两条通道都填**：`/ws/audio` 也照带，
> 避免"同一个消息类型在两条通道上语义不一致"。
> 这是**协议只增不减**的增量：两端老客户端只读 `id` / `text`，多一个字段被忽略，行为不变（见 §5.1）。
- 结束方式：**先同步下发 `ERROR` 再关闭**（不能走发送队列 —— 队列是异步的，关闭帧可能先到，
> 用户看到的就是"识别莫名结束"而没有原因）。

#### 4.2.3 鉴权：复用 ticket，但不复用「余额校验」

`TicketHandshakeInterceptor` 现在做两件事：验 ticket + `billingService.canConsume(INTERVIEW_SECONDS)`。
第二件事只对 `/ws/audio` 成立 —— 识别通道不应该因为「面试时长余额为 0」而拒绝连接
（且将来 AI 问答等页面复用识别通道时更没有面试余额这个概念）。

建议：把「纯鉴权」与「业务准入」分开。**最小改法**是为 `/ws/asr` 新增一个只做
`WebSocketTicketService#verifyAndConsume` + 参数透传的拦截器；**更干净的做法**是把现有拦截器
拆成 `TicketAuthInterceptor`（鉴权 + 属性透传）与 `/ws/audio` 专用的余额准入，二者组合注册。
前者改动小、不动旧链路，建议先做前者，后者作为后续治理。

凭证获取不需要新接口：复用 `GET /api/ws/ticket`（TTL 30 秒、`GETDEL` 一次性），
点话筒时取一次即可，与「点话筒即建连」的时间窗完全匹配。

> **实施前必须确认的一条（2026-09-22 已查代码，结论：当前架构满足要求）**：
> **ticket 的签发过程本身不得承担 `INTERVIEW_SECONDS` 余额准入**，余额检查只能属于 `/ws/audio` 的业务握手准入。
> 否则 `/ws/asr` 会被"面试余额"间接限制，"识别通道与面试解耦"就是假象。
> 实测现状：余额检查在 `TicketHandshakeInterceptor#beforeHandshake` 里
> （`verifyAndConsume(ticket)` 之后调 `billingService.canConsume(userId, INTERVIEW_SECONDS)`），
> **不在签发侧** —— 所以新增一个只做 `verifyAndConsume` + 属性透传的轻量拦截器**就够了**，不需要先拆签发逻辑。
> 实施时若发现签发侧也加了余额判断，必须先把该职责移回拦截器，再加新通道。

> **留一个扩展点，但现在不改 Ticket 系统**：如果 `/ws/asr` 将来成为通用识别能力
> （AI 问答、简历诊断等页面复用），ticket 最好能表达**用途**，服务端验证时可区分 `INTERVIEW` / `ASR_INPUT`，
> 避免"给面试会话开的 ticket 被拿去建任意 ASR 连接"。短期没有实际风险（都要登录、都短 TTL、都一次性），
> 所以本次**仅记录该方向**：先在 ticket 载体（或属性透传）里预留 `scene/purpose` 的位置，
> 真正收紧放在「识别通道被第二个页面复用」时再做 —— 属于本文档之外的一次独立改动。

> **2026-09-24 补充：识别通道的准入从"只验票"升级为"验票 + 资格"（§4.2.5）。**
> 这里有两件**必须分清**的事，混成一个就会写错方向：
>
> | 闸门 | 判据 | `/ws/asr` 是否做 | 理由 |
> | :--- | :--- | :--- | :--- |
> | **余额准入** | `billingService.canConsume(INTERVIEW_SECONDS)` | **不做** | 看的是"面试时长够不够用"；面试余额见底不该让用户连字都打不了 |
> | **资格准入** | 有没有一场**进行中的面试** | **要做** | 看的是"这个用户此刻是不是在付费的业务里"；这是本通道的成本护栏 |
>
> 一句话：**一个问"够不够用"，一个问"在不在用"**。前者只属于 `/ws/audio`（`TicketHandshakeInterceptor` 里那段），
> 后者是 `/ws/asr` 自己新增的一道闸。

#### 4.2.4 生命周期与成本治理

```text
点话筒 → 取 ticket → 建连 → 前端开始推 PCM 帧 → 边说边收 ASR_RESULT → 用户停止 / 录音达上限 / 静默
        → 前端关闭连接（或后端在时长上限触发关闭）→ 释放 DoubaoAsrClient
```

- 连接是**短命**的：不做暂停恢复、不进 `logicalSessions`、不参与心跳踢出扫描。✅ **已落地**：
  识别连接的收尾只有自己的资源（停 `AsrStreamRunner` + 清发送队列 + 摘并发闸门）。
- 物理连接上限 ✅ **已落地**：`realtime.asr.session-max-duration-ms`
  （**2026-09-24 当天由 120 → 180 → 300 秒**，每次都跟着前端回答上限走）。
  到点由**会话自己的计时器**主动关闭并回 `ASR_TIMEOUT`（关闭码 4005）。
  > **两个概念必须分清**（2026-09-24 明确，别把它们混成同一个数字）：
  > ① **单次回答允许说多久** —— 产品口径，落在前端录音上限（`RECORDER_OPTIONS.duration`，**2026-09-24 由 60 → 120 → 180 秒**）；
  > ② **这条物理连接最多活多久** —— 资源兜底口径，就是本参数。
  > 后者必须**明显大于**前者并留足余量：真实面试里"介绍项目 / STAR 案例"说到 2~3 分钟是合理的
  > （先思考几秒、中间停顿重组织语言、语速偏慢都很常见），一次合理回答贴着上限被掐断是最坏的边界。
  > 取 300 秒 = 前端回答上限 180 秒 + **120 秒余量**（余量覆盖尾包、网络抖动与"客户端还没走到 close"的窗口）。
  > **关系固定为「后端 = 前端 + 120 秒」**：改任一个都必须跟着改另一个，并同步 `RealtimePropertiesTest` 的断言。
  > 它**不因收到音频、也不因静音保活而重置**：想让它可重置就等于把它变成第二个空闲计时器，
  > 而那个角色已由 `input-idle-timeout-ms` 承担（语义更准：`/ws/asr` 无帧 ≈ 停止录音）。
  > 为什么用"会话内计时器"而不是加一个全局扫描任务：它**不依赖任何回调**，
  > 连接悬挂（网络黑洞 / 前端崩溃）时照样会到期收尾，于是识别通道不需要第二个 `WsHeartbeatScheduler`。
- 单用户并发识别连接上限 ✅ **已落地**：`realtime.asr.max-connections-per-user`（默认 **1**）。
  超限的**拒绝**（`ASR_LIMIT_EXCEEDED` / 4004），不做顶号 —— 顶号会把"前端两条连接竞态"变成静默互踢。
  另有一条自愈：建连时先摘掉"传输已关闭但回调还没到"的死连接登记，否则死连接会把用户锁住最长一个时长上限。
- 上游输入空闲释放 ✅ **已落地（2026-09-24）**：`realtime.asr.input-idle-timeout-ms`（默认 **25 秒**，0 = 关闭）。
  正路是前端自己收干净（**停止推帧后留 ~8 秒给尾包再 `dispose()`**，见前端方案 §6.2）；
  这条兜的是"客户端该关却没关"（前端崩溃 / 老版本没有空闲释放 / 小程序切后台导致定时器不跑）——
  不兜的话连接会挂到 300 秒上限，而这段时间豆包会话靠 `DoubaoAsrClient` 的**静音保活**一直活着
  （空闲 3 秒补 200ms 静音帧，豆包侧 8 秒空闲会终结会话，所以客户端侧必须喂），
  **静音帧同样按音频时长计费**。
  两条路径都**静默关闭**（1000、无 ERROR），指标上按 `end` tag 区分：
  `input_idle` = 服务端兜底、`client_close` = 前端正常释放。
- 埋点/指标 ✅ **已落地（Step 3）**：走 `MeterRegistry`，出口是已暴露的 `/actuator/prometheus`：
  - `asr_stream_sessions_active`（Gauge）：当前活跃识别连接数；
  - `asr_stream_connections_total{result}`：建连结果（`accepted` / `rejected_limit` / `rejected_quota` / `rejected_auth` / `rejected_error`）；
  - `asr_stream_session_duration_seconds{end}`：单次识别时长，`end` = `client_close` / **`server_close`（面试结束回收）**
    / **`input_idle`（上游空闲兜底）** / `asr_unavailable` / `timeout` ——
    **失败率 = `asr_unavailable` 的占比**（其余三类都是正常收尾，不算故障），
    同时给出时长分布（一次收尾只上报一次）。
    > `input_idle` 的 count 持续增长 = 有客户端没走"停止后自己释放"那条正路，值得看一眼。
  - `asr_stream_audio_bytes_total`：上行音频字节数，**识别成本的代理量**（16k/16bit/单声道 = 32000 B/s）。
  > 刻意不做"每次识别打一行成本日志"：字节数换算成音频时长就够了，日志里只留长度（见下一条）。
- 每日配额 ✅ **已落地（Step 3）**：`realtime.asr.daily-sessions-per-user`（默认 **300**，0 = 不限制）。
  补的是"不停建连 → 说话 → 关闭"这种循环刷量（单用户并发 1 + 单次 300 秒挡不住它）；
  超限回 `ASR_QUOTA_EXCEEDED` / 4006。三条性质：**按北京时间自然日滚动**（JVM 跑 UTC，
  按 UTC 切会让用户在北京时间早 8 点被重置）、**只有被接受的连接才计数**、**Redis 异常时放行**（失败开放）。
  > **2026-09-24 定位调整**：日配额**不再是主护栏** —— 主护栏是 §4.2.5 的"必须有一场进行中的面试"
  > （成本上限 = 用户自己付的面试时长）。它降级为"防一场面试里狂点话筒 / 前端失控重连"的兜底，
  > 数值可以调宽，但**不要因为有了资格闸门就把它删掉**：两者限的是不同维度（资格 vs 频次）。
  >
  > **2026-09-24 量纲变化（前端回答上限 60 → 120 → 180 秒）**：配额是**次数**口径，所以单账号的
  > 音频时长天花板从 `300 × 60 = 5 小时/天` 变成 `300 × 180 = 15 小时/天`。
  > **注意这只是理论天花板**：每个识别连接都要求"有一场正在计费的面试"（§4.2.5），
  > 而面试本身按时长扣用户自己的资产 —— 所以真实上限是**用户付得起的面试时长**，
  > 次数配额只是"防前端失控重连"的兜底。若成本监控发现异常，优先收紧**这个次数**（例如 100）
  > 或引入音频秒数维度，而不是回头去压单次回答上限 —— 单次上限是产品体验口径，不该被成本问题牵连。
- 日志脱敏 ✅ **已落地（Step 3）**：用户内容只记长度、不记原文 ——
  `LogTextUtils#describe()` 返回 `len=42` 这类摘要，用在 V2 新增的三处日志（收到 `ANSWER`、
  识别结果未触发回合、识别通道收到上行文本）。
  > 与既有的 `truncate()` 分工：截断仍会保留前 512 字符的**内容**，只适合"不是隐私但要防刷屏"的文本；
  > 用户作答 / 识别转写这类内容一律用 `describe()`。
- 音频不落盘、识别原文不落库：只存在于内存与下行消息里。✅ 已落地。

#### 4.2.5 使用资格与回收（2026-09-24 定稿，✅ 已实现）

> 本节是本次修订的核心。**前提事实**：豆包识别按音频时长计费，而识别通道原来的准入只有"登录态"（ticket）——
> 于是一个账号就能把识别当免费的算力入口刷（§4.2.4 的日配额只是**限速**，不是**资格**）。

**定稿语义**：

> **`/ws/asr` 不与 `/ws/audio` 共享物理连接生命周期，但它是归属于面试会话的受控语音输入通道。**
> 它的使用资格、成本边界与最终回收由面试会话负责；未来若独立开放 ASR，
> 只需换一个业务/资产上下文来提供资格，识别通道本身不用改。

**准入判据（多一道闸，位置在"凭证"之后）**：

```text
建连 → 凭证（ticket 验身份）→ 【资格：该用户当前存在「进行中」的面试？】→ 并发 → 日配额
```

- "进行中" = 逻辑会话存活**且未暂停**。`PAUSED` 不算：前端在暂停态已把输入区禁用（不会点话筒），
  后端没必要放行"暂停期间的识别"；
- **采用的取法：复用计费会话**。现有实现里已经有现成的 `userId → 当前会话` 索引：
  `InterviewBillingService#getSessionInfo(userId)`（Redis `interview:session:user:{userId}`，
  值里带逻辑会话 ID / `interviewId` / `usedSeconds` / `paused`），`hasActiveSession(userId)` 就是它的存在性判断。
  判据即 `getSessionInfo(userId) != null && !isPaused()`，落在 `AsrUsageGuard#decide`；
- 为什么它适合当资格：**"有正在计费的面试"本身就等于"这个用户正在为自己的时长付费"** ——
  成本上限由用户自己的面试时长约束，不需要另造一套 ASR 资产；

| 备选取法 | 说明 | 本次是否采用 |
| :--- | :--- | :--- |
| A. 复用计费会话（`getSessionInfo`） | 零新增状态；识别侧只读依赖计费模块一个方法 | ✅ **本次采用** |
| B. 给注册表加 user 维度索引（`findActiveByUser`） | 语义更"会话"；进程内索引，多实例限制与现状相同；要动 `SessionRegistry` | 备选 |
| C. 面试侧写一个会过期的 grant（Redis） | 最解耦；但多一份状态要维护（起算写、结束删、TTL 兜底） | 本次不做 |

**失败关闭，与配额的"失败开放"刻意相反**（实现里的 `Decision.UNAVAILABLE`）：
读不到资格时**不放行**，但**不冒充**"没在面试" —— 两者给用户的引导不同
（"去开始面试" vs "改用打字"）。理由：配额放行只是少一层限速，资格放行等于**整条护栏消失**；
而识别不是唯一输入方式，拒绝的代价是"这次语音用不了"，不是"产品用不了"。

**一条硬约束（别长歪）**：资格判断**只允许出现在一个方法里**（建议 `AsrStreamingService#ensureAuthorized(userId)`，
或一个极小的 `AsrUsageGuard`），**不要**在 `AsrStreamSession` / handler / 拦截器里各写一遍。
将来独立开放 ASR（另一个收费链路）时，只换这个方法内部的数据源 —— 这正是 §4.2.3 预留 `scene/purpose` 的方向。
**不要让 `AsrStreamSession` 自己判断"这个用户有没有资格"**：它只消费"允许/拒绝"这个结论。

**回收判据（面试结束时）**：

```text
面试整场结束（任何 end_reason）
   ↓
【唯一入口】InterviewEndedEvent（AsrSessionReclaimer 监听）
   ↓
AsrStreamingService#closeForUser(userId) → 静默关闭该用户的 /ws/asr（1000，不下发 ERROR）
```

三条实现要点：

1. **挂在 `InterviewEndedEvent` 上，而不是挂某条物理连接的收尾**（`AudioStreamingService#cleanup`）：
   施工时比原计划更严了一层 —— "面试结束"有两条互不相交的路径，
   而其中**"暂停超时回收"（`evictExpiredPausedSessions`）根本没有物理连接**，
   挂 `cleanup` 永远等不到它。而 `InterviewEndedEvent` **恰好只在这两处发布**（另一处是
   `AudioStreamSession#publishEnded`），于是"一个入口"与"覆盖全部结束路径"同时满足。
2. **"排除暂停"由事件语义天然保证，不需要维护任何清单**：`PAUSE` 走的是 `publishPaused()`，
   **不发** `InterviewEndedEvent` —— 所以不需要写"哪些 `CleanupReason` 算结束"那种判断
   （那种清单漏一项就是**静默**烧钱：没有编译错误、没有报错日志）。判据始终是
   "**逻辑会话是否 ENDED**"，而不是"物理连接是否关闭"。
3. **回收是幂等的、单向的**：`AsrStreamingService#activeByUser` 本来就是 `userId → 识别会话`
   （第 2 道闸门那张表），按 userId 取出并关闭即可；没有连接时是无操作。
   识别侧**不回调**面试侧（面试不需要知道识别被关了）。
4. **静默关闭，不下发 ERROR**：此时前端已经在收尾（面试结束态），再弹一条"识别不可用"只会造成误导。
   前端那边也会因为 `terminated` 自己 `dispose()` —— 两条路径都到也无所谓（双方幂等）。

**PAUSE 的策略（写死）**：暂停**不回收**已存在的识别连接（前端已经 `stop()` 停录音），
但**暂停期间不允许新建**（资格判据里的 `paused` 直接拒）。恢复后按需重新建连。

**为什么不用传 sessionId（前端零协议改动）**：资格与回收**都只需要 `userId`**，而 `userId` 来自 ticket。
所以不需要让前端在建连 URL 上多传参数，也不需要把逻辑会话 ID 塞进 ticket ——
前端只需保证"只在面试进行中才点话筒"（它已经这么做：`useSpeechInput` 的 `enabled` / `terminated`，
见前端方案 §6.2 落地记录）。这是"挂靠"比"显式绑定会话"省事的地方：**挂靠的是资格，不是身份**。

**与 §4.2.4 日配额的关系**：300 次/天从"主护栏"**降级为兜底**（防"一场面试里狂点话筒"或前端失控重连），
主护栏变成"必须有一场正在计费的面试"。两者都保留、不冲突：一个限资格，一个限频次。

### 4.3 文字作答的完整时序

```text
前端                                后端
 |  建连 /ws/audio?...&input=text     |
 |--------------------------------->| prepare（快照 + 提示词）→ pending→active
 |                                    | inputMode=text ⇒ 不起 ASR
 |                                    | session.start() 成功 → 【会话就绪】markSessionReady()
 |                                    |   → publishStarted() + submitOpening()（均按逻辑会话幂等）
 |<----------------- THINKING + LLM_REPLY(流式) ---- AI 面试官开场
 |
 |  用户打字 / 话筒识别后编辑
 |  {"type":"ANSWER","text":"..."}   |
 |--------------------------------->| 校验（inputMode / 非空）→ turnRunner.submit(input)
 |                                    |   写上下文 + 落库(user) + THINKING
 |<----------------- THINKING + LLM_REPLY(流式) ----+
 |                                    |   落库(assistant)（忙/闲状态由 Runner 自持，会话不参与）
 |
 |  （每 25 秒）{"type":"heartbeat"}   |→ 刷新连接心跳（唯一存活判据）
 |  （可选）另一条 /ws/asr 做语音输入   |→ 只回 ASR_RESULT，不触发任何回合
```

## 5. 兼容与灰度

| 场景 | 行为 |
| :--- | :--- |
| **PC 正式面试**（`pass-up.frontend/apps/user`，不传 `mode` / 不传 `input`） | `ASSIST` + `audio`，**对用户可见行为保持不变**：ASR final 即触发 LLM、ASR 故障仍是 4003、计费起算仍挂 ASR 就绪（协议、时序语义、计费口径一致；重构后日志/内部时序可能有细微差异，不作为验收标准） |
| 小程序 V1（`input` 不传） | 等价 `input=audio`，行为与今天完全一致（含 ASR 自动提交、`4003` 关码） |
| 小程序 V1 显式传 `input=audio` | 与不传等价 |
| V2（`mode=MOCK` + `input=text`） | 文本作答；不起 ASR；ASR 相关错误路径不可达 |
| `ASSIST` + `input=text` | **拒绝**（非法参数），不静默降级 |
| text 模式收到音频帧 | 忽略 + warn（防御） |
| 重连（暂停后） | `inputMode` 从 `InterviewSessionState` / DB 还原，重连后仍是 text，不误启 ASR |
| 跨进程重建 | `LogicalSessionRebuilder` 从 `interview.input_mode` 还原 |
| 客户端发版顺序 | **现有 PC 端与 V1 小程序无需因后端兼容性而发版**（协议只增不减、新增能力全在不传参数的分支之外）；**V2 小程序按正常功能节奏单独发版**（`input=text` / `ANSWER` / `/ws/asr` / `useSpeechInput` 都是新能力）。**后端可以先发布，不要求等待 V2 客户端** |

灰度上不需要开关：`inputMode` 本身就是入口级开关，前端选择走 V1 还是 V2 即完成分流。

### 5.1 本次改动的「影响面矩阵」（改前逐项确认）

| 改动 | PC 正式面试 | 小程序 V1 | 小程序 V2 |
| :--- | :--- | :--- | :--- |
| 新增 `input` 查询参数（默认 audio） | 无影响（不传） | 无影响（不传） | 生效 |
| `V26` 新增 `interview.input_mode` 列（`NOT NULL DEFAULT 'audio'`） | 无影响（历史行自动为 `audio`） | 无影响 | 生效 |
| `ControlMessage` / 上行新增 `ANSWER` | 无影响（不发） | 无影响（不发） | 生效 |
| 回合执行 `ConversationTurnRunner` | ✅ **已完成（P0-2），本次直接复用**；V2 仅新增 `SubmitResult`（`ACCEPTED`/`BUSY`/`REJECTED`）与 `submitOpening()` 共享串行化状态 | 同左 | 生效（只加提交治理，不重构） |
| 「计费起算 / MOCK 首问」触发点迁移 | 无影响（仍走 ASR 就绪） | 无影响（audio 分支不变） | 生效（改为**会话就绪**触发：`start()` 成功后 `markSessionReady()`） |
| 新增 `/ws/asr` 通道 | 无影响（不连） | 无影响（V1 不用） | ✅ 已交付 |
| `TicketHandshakeInterceptor` 拆分鉴权与余额校验 | 无影响（`/ws/audio` 的余额准入保留） | 无影响 | ✅ 已交付（新增轻量拦截器，原拦截器一行未改；余额准入仍在 `/ws/audio`） |
| `AsrResultMessage` 新增 `final` 字段（Step 2） | 无影响：老客户端逐字段校验只认 `id`/`text`，多余字段被忽略 | 同左 | 生效（语音输入靠它分「中间态/定稿」） |
| `ConversationTurnRunner` 触发日志改只记长度（§12.6 的真缺陷修复） | **行为变化（正面的）**：日志里不再有用户作答原文 | 同左 | 生效（INFO 级脱敏，生产同样受益） |
| `AsrStreamRunner` 从 `AudioStreamSession` 抽取 | ✅ **已完成（P0-1）**，行为等价已回归；本次是"复用"而非"抽取" | 同左 | 不适用 |
| **`/ws/asr` 建连新增「资格」闸门**（2026-09-24，✅ 已交付） | 无影响（PC 不连识别通道） | 无影响（V1 不用） | **协议增量只有一个错误码**：`ASR_NO_ACTIVE_SESSION`(4007)；前端**不需要**新增建连参数（§4.2.5） |
| **面试结束 → 回收识别连接**（2026-09-24，✅ 已交付） | 无影响 | 无影响 | 生效：面试结束 / 失联 / 余额耗尽 / 暂停超时后该用户的 `/ws/asr` 被**静默关闭**（1000，不带 ERROR） |

> **矩阵状态（2026-09-24）**：Step 1 / Step 2 / Step 3 / **Step 4** 均已落地
> （旧的"`/ws/asr` 尚未动工"是 09-22 的陈述，已过期）。

### 5.2 回归验证清单（按客户端）

**PC 正式面试（`pass-up.frontend`，必须先跑）**

1. 共享会议音频 → 开始监听 → 转写气泡按 `ASR_RESULT` 生成、AI 回答插在对应转写之后（`replyId` 配对正确）。
2. 静默 ≥ 60 秒：连接不被误杀（心跳生效），期间无音频、无转写。
3. 暂停 → `PAUSED` → 继续监听（带 `resume`）→ 上下文与转写不丢、不重复开场。
4. 余额耗尽 / 心跳超时 / ASR 故障三条中断路径的提示与关闭行为与改造前一致
   （其中 `ASR_UNAVAILABLE` 的既有漂移见 §2.3，可顺带修，但不要混在本次改动里）。
5. 结束监听 → `interview` 记录落库、历史列表可见。

**小程序 V1**：同上（语音整场跑通）。

**小程序 V2**：建连即收到首问（`input=text`）、发 `ANSWER` 收到流式追问、
心跳维持 60 秒判据、暂停/恢复后仍是 text 模式、识别通道独立开关且失败不影响会话。
**Step 4 的验收项（2026-09-24 落地，见 §12.8）**：

6. **没有面试时点话筒被拒**：未建连 / 已结束的页面上点话筒 → `ASR_NO_ACTIVE_SESSION`(4007)，
   提示「请先开始面试」，且**不会**打开麦克风（前端"先建连、后开录音"保证）。
7. **面试结束后识别连接被回收**：坐在识别中直接结束面试（或让心跳超时 / 把余额耗到 0）→
   服务端静默关闭 `/ws/asr`（1000，不弹错误）；前端同时 `terminated → dispose()`，
   两条路径都不报错、不留麦克风。
8. **暂停期间不许新建**：暂停态点话筒（前端本已禁用，若手工发请求）→ 同样被资格闸门拒；
   恢复后可正常建连。

## 6. 改动清单（文件级）

> 标记：✅ = Step 1 已交付；⬜ = 尚未动工（Step 2）。

新增：

```text
modules/realtime/InterviewInputMode.java                    # ✅ 枚举 + from() 严格解析（+ converter/InterviewInputModeConverter.java）
src/main/resources/db/migration/V26__interview_input_mode.sql   # ✅ input_mode NOT NULL DEFAULT 'audio'
infrastructure/websocket/AsrWebSocketHandler.java           # ✅ /ws/asr 入口
infrastructure/websocket/AsrHandshakeInterceptor.java       # ✅ 只校验 ticket（复用 WebSocketTicketService）
modules/realtime/asr/AsrStreamingService.java               # ✅ 识别连接登记 + 单用户并发闸门 + 错误语义 + 建连指标
modules/realtime/asr/AsrStreamSession.java                  # ✅ 一次识别的运行单元（含时长兜底计时器 + 时长/音频量指标）
modules/realtime/asr/AsrConnectionQuota.java                # ✅ 每日识别次数配额（Step 3；Redis 计数、失败开放）
modules/realtime/session/AsrStreamRunner.java               # ✅ 已就绪（P0-1）：ASR 消费/重连循环；本方案只复用，不重写
```

修改：

```text
infrastructure/websocket/TicketHandshakeInterceptor.java    # ✅ 透传 input 参数
modules/realtime/model/ControlMessage.java                  # ✅ 新增 TYPE_ANSWER + text 字段
modules/realtime/session/AudioStreamSession.java            # ✅ ANSWER 分支 + inputMode + text 模式不启 ASR + markSessionReady()
modules/realtime/session/ConversationTurnRunner.java        # ✅ SubmitResult 三态 + 回合串行化（ACCEPTED/BUSY/REJECTED）
modules/realtime/streaming/AudioStreamingService.java       # ✅ inputMode 传导（查询参数 → InterviewContext）+ 重连沿用
modules/realtime/interview/InterviewService.java            # ✅ createPending / InterviewContext 增加 inputMode + 严格校验组合
modules/realtime/interview/InterviewPrepareService.java     # ✅ ConnectionRequest 增加 inputMode + 组合校验 + 落库
modules/realtime/interview/entity/Interview.java            # ✅ input_mode 列
modules/realtime/session/LogicalSessionRebuilder.java       # ✅ 从 DB 还原 inputMode
infrastructure/websocket/WebSocketConfig.java               # ✅ 注册 /ws/asr
modules/realtime/model/AsrResultMessage.java                # ✅ 新增 final 字段（两条通道都填，见 §4.2.2 的实现修正）
modules/realtime/config/RealtimeProperties.java             # ✅ 新增 asr.session-max-duration-ms / max-connections-per-user / daily-sessions-per-user
common/util/LogTextUtils.java                               # ✅ 新增 describe()：用户内容只记长度（Step 3 日志脱敏）
modules/realtime/lifecycle/InterviewStartedEvent.java       # ✅ 带 inputMode（Step 3 埋点口径）
modules/realtime/lifecycle/InterviewEndedEvent.java         # ✅ 带 inputMode（同上）
modules/realtime/analytics/InterviewAnalyticsEventHandler.java # ✅ props 增 input_mode（同上）
```

> **与方案原文的两处实现差异（不要照原文找文件）**：
> 1. **`InterviewSessionState` 不再单独存 `inputMode` 字段** —— 它委托给持有的 `InterviewContext`
>    （`getInputMode()`）。理由是避免"两个地方都能改"：重连时一旦漏同步，text 会话会被还原成 audio 且用户无感知。
> 2. **`AudioStreamSessionFactory` 无需改动** —— `inputMode` 随 `InterviewContext` 一起传进来，工厂不参与。
>
> 另外两端协议文件也已同步（详见 §9 的表）。

可选的后续治理（不在本次范围）：`AudioStreamSession` 改名为 `InterviewStreamSession`（现在它要承载文本，名字已名不副实），
但改名会牵动大量引用，建议等 V2 稳定后单独一次提交。

---



## 7. 风险与代价

| 风险 | 说明 | 对策 |
| :--- | :--- | :--- |
| **波及 PC 正式面试**（本次最大风险） | 两条前端共用 `/ws/audio`，改的是会话内部（回合抽取、参数透传、触发点），一旦写歪就会同时影响 ASSIST | 所有变化都收在 `input=text` / 新通道分支里，`audio` 路径按「等价改写」标准验收；PC 端零代码改动 + §5.2 的 5 条回归必须先跑 |
| 双连接 | 移动网络下同时维持会话连接 + 识别连接 | 识别连接按需建立、用完即关，不留空闲长连 |
| **`AsrStreamRunner` 跨场景复用风险** | `/ws/audio` 已在用它，V2 新增 `/ws/asr` 后它成为**两个消费者共用的公共件** | 已实测核对（见 §4.2.1）：Runner 不依赖 `AudioStreamSession` / `InterviewSessionState` / `CleanupReason` / `SessionRegistry` / 计费，只吃 PCM、只吐 `AsrEvent`。新增消费者时**保持这条边界**，不要为 `/ws/asr` 往 Runner 里加面试会话语义 |
| 新成本入口 | 识别通道可被脚本刷（豆包按音频时长计费）。**修订前只要求"登录"**，一个账号即可把识别当免费算力入口 | **主护栏（2026-09-24）：资格挂靠面试会话** —— 没有进行中的面试不能建连（§4.2.5），成本上限 = 用户自己付的面试时长；兜底仍是 ticket 一次性鉴权 + 单用户并发 1 + 单次时长上限 + 日配额 + 指标观测 |
| **回收漏挂**（2026-09-24 新增） | 面试结束后若不回收识别连接，它会活到 300 秒上限并继续产生豆包费用；若回收逻辑散落在各条退出原因分支里，漏一条就是**静默**烧钱（无编译错误、无报错日志） | 只挂 `InterviewEndedEvent` 这**一个**入口（覆盖"暂停超时回收"那条没有物理连接的路径）；判据是"**逻辑会话是否 ENDED**"，`PAUSE` 走 `publishPaused()` 天然不触发 |
| 会话起点迁移漏改 | text 模式不启 ASR，若忘迁「起算 / 首问」触发点，会既不扣费也不开场 | §4.1.4 的两处触发点必须与 `input` 参数同一次提交完成 |
| 计费口径 | 文本模式仍按会话时长计费，用户静默思考照样扣费 | ✅ 已定稿（§8 P0-1）：**V2 不引入「无操作自动暂停」**，保持"思考时间计入面试时长"；若将来数据显示长时间空转明显，再单独评估 |

## 8. 待确认问题

> 后端 V2 的**核心技术方案已定稿**：剩余待确认事项只有产品口径与后续能力边界，**均不阻塞当前实现**。
> 协议层面的"已经决定的事"统一列在 §8.1，不再重复讨论 —— 改动它们即为行为变更，须走 §12 的实施纪律。

| 优先级 | 事项 | 当前方案 | 建议 |
| :--- | :--- | :--- | :--- |
| **P0** | 是否引入「无操作自动暂停」 | 文字模式只要心跳正常就保持 `ACTIVE`，**思考时间照常计费**；只有显式 `PAUSE` 才暂停 | **V2 暂不引入**，保持显式 `PAUSE`（理由见下） |
| **P0** | ~~失联结束是否增加独立 `InterviewEndReason`~~ | 此前失联、余额耗尽、计费异常都与主动结束同记 `USER_ENDED`，数据分不出来 | ✅ **已落地（2026-09-23）**：新增 `DISCONNECTED`；并把 `BILLING_TERMINATED` **拆成** `BILLING_EXHAUSTED` / `BILLING_ERROR` → 各自映射到同名结束原因与 `SYSTEM_ERROR`。**历史数据不回溯** |
| **P1** | `/ws/asr` 是否扩展为通用语音输入能力 | 只服务 V2 小程序；**资格挂靠面试会话**（2026-09-24 定稿，§4.2.5），通道本身仍不碰注册表 / 计费 / `Interview` | **本期只服务 V2**；将来若独立开放，只需换一个业务/资产上下文来提供"资格"（即换 §4.2.5 那个方法内部的数据源），识别通道本身不用改；到那时再补 `scene/purpose` |
| **P1** | `ASSIST` 是否支持文本作答 | `ASSIST + input=text` 在建连阶段直接拒绝（`INTERVIEW_PREPARE_FAILED` / 4002），不静默降级 | **本期保持拒绝**；将来 PC 要"手动文字提问"，需同时决定它是否计入面试时长、是否复用同一会话 |

**P0-1 为什么建议不做「无操作自动暂停」**：难点不在实现（复用 `PAUSE` 链路即可），而在**定义** ——
"多久算无操作"、"什么算操作"（输入？光标？心跳？切后台？）都要逐一裁定；一旦判歪就是
"面试进行中莫名暂停"，而现有显式 `PAUSE` 已覆盖真正需要暂停的场景。
> 若将来数据证明存在明显的长时间空转（例：`duration_sec` 高但 `ANSWER` 极少），再单独评估。
> 注意 **`ANSWER` 不能当活跃度**：那会让"正在思考"与"已掉线"无法区分（见 §4.1.6）。

**P0-2 收口说明（结束原因，2026-09-23 一次做完两件事）**：映射规则与理由写在
`AudioStreamSession#toEndReason` 与 `InterviewEndReason` 的注释里，单测 `AudioStreamSessionEndReasonTest` 钉住。

| 连接退出原因（`CleanupReason`） | 结束原因（`InterviewEndReason`） | 语义 |
| :--- | :--- | :--- |
| `HEARTBEAT_TIMEOUT` / `TAKEOVER` / `TRANSPORT_ERROR` | **`DISCONNECTED`**（新增） | 连接层：系统无法确认用户还在 / 连接被换掉 |
| `BILLING_EXHAUSTED`（由原 `BILLING_TERMINATED` 拆出） | **`BILLING_EXHAUSTED`** | 余额耗尽：用户把时长用完了 |
| `BILLING_ERROR`（同上拆出） | **`SYSTEM_ERROR`** | 计费服务自身异常：系统故障，不是用户的锅 |
| `ASR_UNAVAILABLE` | `ASR_ERROR` | 识别服务挂了 |
| 其余（`CONNECTION_CLOSED` / `ASR_SESSION_END`…） | `USER_ENDED` | 用户的明确意图 |

> **为什么是"拆"而不是"改名"**：`CleanupReason` 原来只有一个 `BILLING_TERMINATED`
> （注释写着"余额耗尽 / 计费异常"），而 `InterviewBillingScheduler#terminateSession` 确实有
> **两个**调用点（结算抛异常 / 余额 ≤ 0）。只改名会让"计费服务抛异常"被记成"余额耗尽"，
> 埋点反而更失真 —— 所以拆成两个原因，并各映射到上表两个结束原因
> （正好用上此前从未被赋值的 `BILLING_EXHAUSTED` 与 `SYSTEM_ERROR`）。
>
> **历史数据不回溯**：`DISCONNECTED` / `BILLING_EXHAUSTED` / `SYSTEM_ERROR` 都从新版本起才有，
> 报表 / 看板需在时间轴标注分界；此前的 `USER_ENDED` 里混着失联与余额耗尽，
> **别直接拿来算"主动结束率"**。

### 8.1 已定稿、不再作为待确认项

| 项目 | 定稿内容 |
| :--- | :--- |
| 建连参数 | `input=audio\|text`（缺省 `audio`）；`mode` 仍决定 ASSIST / MOCK |
| 非法组合 | `ASSIST + input=text` **拒绝**（`INTERVIEW_PREPARE_FAILED` / 关闭码 4002），不静默降级成 audio |
| 文本作答通道 | 走**面试会话** `/ws/audio` 的上行 `ANSWER`（**不是**流式 HTTP）；下行沿用 `THINKING` / `LLM_REPLY` |
| 语音输入通道 | 独立 `/ws/asr`（音频进、文本出；不碰计费 / 注册表 / `Interview` / 暂停恢复） |
| 超长回答 | **拒绝**（`ANSWER_TOO_LONG` / 2000 字上限），不截断 |
| 回合串行化 | 同一时刻一个在途回合；忙时 `TURN_BUSY`（audio 路径只记日志、不回错误码） |
| `/ws/asr` 上限 | **物理连接 300 秒**（= 前端回答上限 180 秒 + 120 秒余量；绝对墙钟、不重置；**≠ 单次回答时长**）/ **上游空闲 25 秒**（客户端该关没关时的兜底）/ 单用户并发 **1** 条 / 每日 **300** 次（0 = 不限制，按北京时间自然日；Redis 异常放行） |
| `/ws/asr` 使用资格（2026-09-24） | **挂靠面试会话**：必须存在**进行中**（未结束、未暂停）的面试才能建连；面试**结束**时静默回收该用户的识别连接（**暂停不回收**，但暂停期间不许新建）。资格判断只允许出现在**一个方法**里 |
| 失联语义 | **失联 = 结束**（≠ 暂停）；只有显式 `PAUSE` 才进 `PAUSED`（保留 15 分钟等 `resume`） |
| text 失联阈值 | **180 秒**（`realtime.text-heartbeat-timeout-ms`；语音仍 60 秒），**不新增 `DISCONNECTED` 状态、不做"失联可恢复"** |
| 计费活跃度判据 | **只看心跳**；不做「收到 `ANSWER` 就当心跳」的特例，不做"无操作自动暂停"（本期） |
| `source`（voice / text） | 后端**不落列、不做这个口径**（只有前端知道），由前端埋点承担；后端提供 `input_mode` |
| 埋点口径 | 只出 `interview_session_started` / `ended` 两个事件，props：`mode` / `input_mode` / `end_reason` / `duration_sec`（+ `duration_source`） |
| 结束原因取值 | `USER_ENDED` 主动结束 / `DISCONNECTED` 连接层（失联·顶号·传输错误）/ `BILLING_EXHAUSTED` 余额耗尽 / `SYSTEM_ERROR` 计费异常 / `ASR_ERROR` 识别故障 / `SESSION_EXPIRED` 暂停超时 |

## 9. 与前端方案笔记的差异（✅ 已于 2026-09-22 同步修订）

> 前端有两份相关材料：小程序方案笔记《模拟面试第二版-文字作答与实时语音输入方案》，
> 以及 PC 端既有实现 `pass-up.frontend/apps/user/src/features/realtime-voice`（无独立笔记）。

小程序笔记第 6.1 节把「提交回答 + 收追问」建议为
「对齐 `qnaApi.streamChat` 的流式 HTTP 用法」。按本方案应修正为：

> 文本作答走**面试会话 WebSocket 的 `ANSWER` 上行消息**，下行事件仍是 `THINKING` / `LLM_REPLY`；
> 不使用 HTTP 流式接口 —— 会话计时、心跳、暂停恢复、顶号、余额推送都在同一条 WS 上，
> 另开 HTTP 会把一场面试拆成两条通道，前端要同时维护两者并额外校验「会话是否仍在进行」。

前端笔记第 6.2 / 5.x 的「识别通道」部分与本方案 §4.2 一致（独立通道、`ASR_RESULT` 的 id 语义、
点话筒才建连），无需修改；但要补两点：

- **建连 URL 用 `input=text`**（且 `mode=mock`）。注意别和页面入口的 `?mode=text` 混了 ——
  后者是前端自己的"页面形态"参数，**不能透传给后端**（`InterviewMode.from('text')` 会静默回退成 `ASSIST`，
  然后被 `assist + text` 校验拒掉）。
- **进度口径以本文档为准**：前端笔记曾写「方案 A 的后端侧已就绪」——**不成立**。
  已就绪的只有可复用的 `AsrStreamRunner`，`/ws/asr` 通道本体属 §11 的 **Step 2，尚未动工**；
  前端 `AsrTransport` 继续留桩（该处措辞已于 2026-09-22 同步修订）。

> **协议事实只有一个来源：本文档 + 两端协议文件。** 前端笔记只描述"前端怎么消费/怎么实现"，
> 不再维护第二份协议定义 —— 这轮已经在这里发生过一次漂移（前端说"后端已就绪"、这里说"Step 2 未开始"）。

另外三处「文档/协议真相源」已一并更新：

| 位置 | 写清的内容 | 状态 |
| :--- | :--- | :--- |
| `pass-up.backend/AGENTS.md` §3.6 / §3.6.1 | `input` 参数、`ANSWER` 上行、4 个错误码、回合串行化语义 | ✅ 已更新 |
| `pass-up.backend/AGENTS.md` §3.8（`/ws/asr`） | 已同步为"物理解耦 + 资格挂靠面试会话"（四道闸门、4007、结束回收、`server_close` 指标口径、资格失败关闭） | ✅ 已更新（2026-09-24） |
| 小程序 `src/features/interview/ws.ts` | `InterviewInputMode` + `InterviewConfig.input` + URL `&input=`；`sendAnswer(text)`；4 个错误码（含文案，且**不进 `FATAL_CODES`**，因为它们不终止会话） | ✅ 已登记 |
| PC `apps/user` 的 `hooks/protocol.ts` | 只扩了错误码白名单（PC 是 audio 会话、收不到这 4 个码；登记只为白名单完整性）；**`ANSWER` 不进 `CLIENT_CONTROL`** —— PC 永远不发它 | ✅ 已更新 |
| `/ws/asr` 的下行协议 | 沿用 `ASR_RESULT`，**不新增消息类型**，但**新增 `final` 字段**（协议只增不减，老客户端忽略）；错误码与关闭码见 §4.2.2 的表 | ✅ 后端已交付；前端已登记（含 4007 `ASR_NO_ACTIVE_SESSION`，2026-09-24，见前端方案 §6.2）—— **别塞进 `ws.ts` 的面试错误码空间** |

PC 端（`features/realtime-voice`）本身**本次零改动**，只需在 PR 描述与回归清单里显式声明「正式面试未受影响」（见 §5.2）。

## 10. 备选方案与「为什么不新写一套」

### 10.1 识别留在面试会话内（方案 B）的适用条件

如果短期内不想新增端点，B 也能满足功能，但需要接受并处理以下改造：

1. `input=text` 时，ASR 变为**按需启停**：新增 `{"type":"ASR_START"}` / `{"type":"ASR_STOP"}`，
   识别结果只下行不提交回合（即「不自动触发 LLM」）。
2. `consumeLoop` 从「长跑重连」改为「一次识别片段内重连」：启停、重连预算、`asrUnavailable` 标记
   都要按片段重定义，且必须在 text 模式下把「重连耗尽 ⇒ 4003 结束面试」改成「只通知、不结束」。
3. 同一个 `ASR_RESULT` 在两种模式下含义不同（自动作答 vs 输入辅助），协议语义开始漂移。

判断标准：**只要 V2 的语音输入要在面试中使用，就必须处理第 2 点**（否则用户的识别故障会终止面试）；
既然要处理，就没有理由不把它挪到独立通道（第 2 点的复杂度 > 新端点的复杂度）。

### 10.2 专门为 V2 新写一条会话链路？—— 不建议

先分清「专门写一套」的三档，代价差别很大：

| 档位 | 做法 | 代价 |
| :--- | :--- | :--- |
| ① 新端点 + 新 session 类，但注册进同一个 `AudioStreamingService` | 需要先抽 `InterviewSession` 接口（`isAlive` / `connectionIdleMillis` / `effectiveTimeoutMillis` / `isHeartbeatCapable` / `markClosing` / `markPaused` / `isPaused` / `getState` / `onClose` / `receiveText` / `sendMessage` ≈ 12 个方法），再把回合执行抽成公共件 | diff ≈ 复用方案的 2~3 倍，且两条链路都要回归 |
| ② 完全独立（新 handler + 新 service + 新注册表） | 除 ① 的开销外，还必须同时改 4 处「按物理连接定位会话」的调用点 | **最大，且有隐蔽故障**，见下 |
| ③ 纯 HTTP（SSE 文本对话，`/api/qna/chat` 同构） | 等于放弃「实时会话」这一整套（心跳、暂停恢复、顶号、`TIME_UPDATE`） | 只有产品语义也变成「异步聊天」时才成立 |

**② 为什么危险**：这套「按连接定位会话」的调用点散在三个类里，全部直接依赖 `AudioStreamingService` 的
`streamSessions` 注册表 ——

```java
// InterviewBillingScheduler#validateSessionState（每 10 秒跑一次）
String activeConnectionId = streamingService.resolveActiveConnectionId(sessionId);
if (activeConnectionId == null || !streamingService.hasActiveStreamSession(activeConnectionId)) {
    billingService.stopBilling(userId, sessionId);   // ← 文本会话若不在注册表里，会被这里静默停掉计费
    return false;
}
```

| 调用点 | 依赖 | 漏改后果 |
| :--- | :--- | :--- |
| `InterviewBillingScheduler#validateSessionState` | `isConnectionLost` / `resolveActiveConnectionId` / `hasActiveStreamSession` | 文本面试**静默停止扣费**（用户白嫖），`TIME_UPDATE` 也不再下发 |
| `InterviewBillingScheduler#terminateSession` | 同上 + `forceCloseSession` | 余额耗尽时关不掉会话 |
| `WsHeartbeatScheduler` → `evictDeadSessions` | 只遍历 `streamSessions` | 文本会话的死连接不会被回收 |
| `AudioStreamingService#onOpen`（新连接顶号） | `forceTerminateActiveSession` → `resolveActiveConnectionId` → `streamSessions.get` | 顶号失效，同一用户两条会话并行计费 |
| `evictExpiredPausedSessions` / `LogicalSessionRebuilder` | 按 `interview.session_id` 维护逻辑会话 | 暂停回收与跨进程重建对文本会话失效 |

漏改任一处都**不是编译错误**，而是「不扣费 / 不回收 / 顶号失效」这类要上线后才发现的故障。
另外 `/ws/audio` 这个**路径不能改**（2026-09-22 再次确认；评审里"改名 `/ws/interview`"的提议**已否决**）：
PC 端 `useVoiceWebSocket` 与小程序 `ws.ts` 都把它写死了，换路径等于两个前端同时发版。
名字现在确实名不副实（它承载的是"面试会话"而非"音频"），但正确做法是**在文档与代码注释里写明它是面试会话通道**；
将来真要改，也必须"新旧双路径并存 + 客户端版本判定"单独开一次改动。

由此得到判据：

> **判断标准不是「改动大小」，而是「会话语义是否相同」。**
> 语义相同（有时长、心跳、暂停恢复、顶号、落库）就复用同一条会话与注册表，输入源不同只是分支；
> 语义真的不同（异步、不需要保持连接、按条计费）时才值得另起一套 —— 而那种情况下连 WebSocket 都不该用（见档位 ③）。

### 10.3 本方案实际采用的结构（不是"建议再抽一次"）

> **这一节原写作"折中建议"，但那些抽取动作已经完成（P0-1 / P0-2），因此改写为结构说明** ——
> 免得后续读者以为 V2 Step 1 还要再做一次回合抽取。

本方案最终采用：

- `/ws/audio` 继续承载**面试会话**：不改变既有会话生命周期、计费、心跳、暂停恢复、顶号与落库的**语义**
  （代码会随参数透传与触发点迁移而动，改动标准是"对用户可见行为保持不变"）；
- `ConversationTurnRunner`（P0-2）已负责**回合执行**：上下文维护 + LLM 流式 + 落库 + 串行化；
- `AsrStreamRunner`（P0-1）已负责 **ASR 消费与重连**；
- `AudioStreamSession` 只负责**连接生命周期 + 输入源适配**。

因此 **V2 不再进行任何"抽取"重构**，只在已有边界上增加两样东西：

- 一个 **TEXT 输入分支**（`ANSWER` → `ConversationTurnRunner#submit`）；
- 一个 **`/ws/asr` 消费者**（复用 `AsrStreamRunner`）。

V2 对 `ConversationTurnRunner` 的唯一新增是**提交治理**：`SubmitResult submit(...)`
（`ACCEPTED` / `BUSY` / `REJECTED`）与 `submitOpening()` 走同一把回合状态。
将来若再加第三种输入源（粘贴 / 快捷回复 / 断线补发），仍是**加一个分支**，而不是再写一套会话。

可选收尾（不影响功能）：`AudioStreamSession` 与 `AudioWebSocketHandler` 的名字已名不副实
（现在要承载文本），可在 V2 稳定后单独一次提交改名为 `InterviewStreamSession` / `InterviewWebSocketHandler`
（**路径 `/ws/audio` 保持不动**）。

> `ConversationTurnRunner` / `AsrStreamRunner` / 注册表接口化这三项抽取的动机、优先级与验收方式，
> 另见[《实时会话链路复杂度评估与拆解清单》](../架构设计/实时会话链路复杂度评估与拆解清单.md) §6
> —— 本文只交代 V2 为什么需要它们。

## 11. 建议实施顺序

> **前置基线：已完成，不再作为实施步骤。**
>
> ```text
> P0-0 → P0-1 / P0-2 / P0-4 → P0-3 → P1-1 → P1-2 → P1-3     ✅ 全部完成（含单测与真实端到端冒烟）
> ```
>
> 因此本节下面的「步骤零：先拆职责 + 补测试接缝」以及 P0/P1 各项**属于历史记录**；
> **Step 1 / Step 2 / Step 3 都已交付**：
>
> ```text
> Step 1  文字作答            ✅ 已交付（2026-09-22）：input=text + V26 + ANSWER + 会话就绪点迁移
>                                + text 模式不启 ASR + 回合串行化/SubmitResult
> Step 2  独立识别通道        ✅ 已交付（2026-09-22）：/ws/asr + 复用 AsrStreamRunner + 轻量鉴权拦截器
>                                + 单用户并发闸门 + 单次时长上限 + 错误/关闭码语义
> Step 3  治理                ✅ 已交付（2026-09-22）：每日识别配额（限流）、识别通道指标、
>                                埋点口径（input_mode）、日志脱敏（只记长度）
> Step 4  资格与回收          ✅ 已交付（2026-09-24）：/ws/asr 建连资格闸门（必须有进行中的面试）
>                                + 面试结束回收识别连接（挂 InterviewEndedEvent，覆盖暂停超时）
>                                + 错误码 ASR_NO_ACTIVE_SESSION(4007)
>                                详见 §4.2.5 与 §12.8；无前端协议改动（不需要新增建连参数）
> ```
>
> 各步的准入门槛与"不许顺手做的事"见文末《定稿与实施纪律》（§12）。
> 落地记录见 **§12.3（Step 1）/ §12.4（Step 2）/ §12.5（Step 3）** —— 改代码前先看那三节。

  > 各步的价值：**Step 1 独立可发布**；**Step 2 是语音输入的前置**；**Step 3 让这条新成本入口可观测、可限额**；
  > **Step 4（2026-09-24 新增）把识别的使用资格交回面试会话**，让"豆包成本"这件事有主。
  >
  > 前端侧的两个缺口（面试链路接线、`AsrTransport` 接线）**已于 2026-09-23 落地**；
  > 后端侧当前唯一未完成的是 **Step 4**（§4.2.5，资格闸门 + 结束回收）。

---

## 12. 定稿与实施纪律（2026-09-22，2026-09-24 修订）

**本方案已定稿**：架构主线已进入实施，Step 1 / Step 2 / Step 3 均已落地。
**2026-09-24 的一次修订**：识别通道的资格模型从"完全解耦"改为"**物理解耦 + 资格挂靠面试会话**"
（§4.2.5，Step 4 待实现）。这是**语义修订，不是架构返工** —— 通道本身、`AsrStreamSession` 的职责、
`AsrStreamRunner` 的复用关系都不动，新增的只是一道"资格闸门"与一个"按 `userId` 的回收入口"，
详见 §12.7 的修订记录。

下面 4 点里 ①②③④ 均已落进代码：

| # | 位置 | 改成 | 状态 |
| :--- | :--- | :--- | :--- |
| ① | §4.1.4 | 触发点从"建连成功（`onOpen`）"改为「**会话就绪：`start()` 成功完成后**」，并写死"WS 建立成功 ≠ 面试开始" | ✅ 已落地（`markSessionReady()`） |
| ② | §4.1.5 | 回合串行化**全部归 `ConversationTurnRunner`**（新增 `SubmitResult submit(...)`）；会话里**不出现** `turnInProgress` | ✅ 已落地（`SubmitResult`） |
| ③ | §4.2.1 | 写死：`AsrStreamSession` **不承载任何面试会话语义** | ✅ 已落地（Step 2）；**2026-09-24 修订**为"物理解耦 + 资格挂靠"：仍不承载会话语义，但受面试的**授权与回收**管理（§4.2.5） |
| ④ | §4.1.1 / §5.1 | `interview.input_mode` 用 `NOT NULL DEFAULT 'audio'`（`null`/blank → `AUDIO`；**未知值抛异常**），**不用可空列** | ✅ 已落地（V26） |

随本次一起收敛（均已在本文档内改写）：§4.2.3 的 ticket 用途字段只**留扩展点、不实现**；
§4.1.3 的 `UserTurnInput` ID 语义（`replyId` → `inputId`，**ID 由后端生成**，前端不依赖其格式）。

### 12.1 `ConversationTurnRunner` 的提交契约（Step 1 要新增的部分）

**对外契约只有三态**，内部原因**不扩散到 `AudioStreamSession`**：

```java
public enum SubmitResult { ACCEPTED, BUSY, REJECTED }
```

- `ACCEPTED`：已进入回合执行；
- `BUSY`：**已有回合在执行**，本次输入不被接受（"现在不行、等下可以"→ 前端禁用输入框）；
- `REJECTED`：**Runner 当前不允许创建新回合**（"这场面试已经不能答了" → 前端走断线/结束态）。
  **具体原因（ENDED / PAUSED / CLOSING / CANCELLED）由 Runner 内部判定，不暴露给会话层** ——
  尤其 `paused` 之类语义是否等于"不能提交"，取决于 Runner 自己的生命周期约束，会话不需要知道。

实现骨架（**最终形态，2026-09-22 已落地** —— 与最初设想的 `try/finally` 不同，原因见下）：

```java
// 进入回合前先过两道闸
if (!accepting.get())                                   return SubmitResult.REJECTED;  // 本 Runner 已取消
if (!turnInProgress.compareAndSet(false, true))          return SubmitResult.BUSY;      // 必须在进入 streamTurn 之前判断
try {
    handleUserMessage(text);
    streamTurn(inputId, buildMessages());   // 内部是异步的：交给豆包客户端后立即返回
    return SubmitResult.ACCEPTED;
} catch (RuntimeException e) {
    endTurn();                              // 提交本身失败（建客户端 / 提交任务抛异常）：占用必须当场释放
    throw e;
}
// 占用的释放不在这里 —— 在本轮终态 onComplete / onError / onCancel（见 §4.1.5 的实现核对）
```

> - 为什么必须 CAS：ASR 路径来自 ASR 事件线程、文本路径来自 WS 处理线程，两者可能并发。
> - **为什么占用必须覆盖整轮流式输出**：`DoubaoLlmClient#streamChat` 是异步的（`executor.submit` 后立即返回），
>   "`submit` 返回即释放"会让用户连点直接并发两轮回合，上下文顺序被打乱。
> - 为什么释放放在终态回调：那是"这一轮真的结束了"的唯一可靠信号；
>   `onCancel`（被 `cancel()` 打断）也是终态，必须释放，否则暂停/关闭后这轮永远占着 `BUSY`。

> ⚠️ **`cancel()` 的并发硬约束（实现级，别简化）**：`cancel()` **不能无条件 `turnInProgress.set(false)`**。
> 反例：
>
> ```text
> A submit → turnInProgress=true
> cancel()  → turnInProgress=false
> B submit → turnInProgress=true
> A 的终态回调 → turnInProgress=false   ← 把 B 的占用清掉了，B 还没跑完就又能被提交
> ```
>
> 正确做法二选一：
> 1. **给在途回合一个身份**（generation / token），只释放"自己那一代"的占用；
> 2. 或让 `cancel()` **只做取消动作、不碰占用标志**，占用一律由**拥有该回合的提交路径**释放。
>
> **本次采用的是第 2 种**：`cancel()` 只关 `accepting` + `cancelToken.cancel()`。
> 于是"取消后再提交"得到的是 `REJECTED`（而不是 `BUSY`），
> 并从结构上排除了"旧回合收尾误清新一轮占用"—— 不需要额外的 generation 机制。
> 验收要求（下表最后两行）已由 `ConversationTurnRunnerTest` 覆盖。

**Step 1 必测清单（Runner 契约，不是架构改动）—— ✅ 已全部覆盖（`ConversationTurnRunnerTest`，8 例）**：

| 场景 | 期望 |
| :--- | :--- |
| `submit` → `submit`（第一轮未结束） | 第二次 `BUSY`，且**不落库**、不发 `THINKING` |
| `submit` → `submit`（第一轮已结束） | 第二次 `ACCEPTED` |
| `submit` 内部抛异常 | 状态复位，后续 `submit` 仍能 `ACCEPTED`（不能被卡死） |
| `opening` → `submit`（首问在途） | `BUSY`（两者共享同一把状态） |
| `submit` → `session close` / `cancel()` | 关闭后再 `submit` → `REJECTED`（而不是 `BUSY`） |
| `cancel()` 与在途回合的终态回调并发 | 不被二次清理（幂等），且不会把新一轮误判为 BUSY |

> "本轮结束"在测试里由 fake LLM 的 `onComplete` / `onError` / `onCancel` 显式驱动 ——
> 真实链路里这是豆包客户端的终态回调，单测必须自己模拟，否则占用永远不释放。

### 12.2 一条硬约束（本次最大的风险）

**不要因为 V2 又开始顺手治理旧代码。** 明确不在本次范围内：

- `AudioStreamSession` 大规模改名（等 V2 稳定后单独一次提交）
- Ticket 系统全面重构（只留 `scene/purpose` 扩展点）
- Turn / Message 领域模型重构
- `/ws/audio` 协议重新设计
- `ASSIST` 模式改造
- audio 模式的并发治理（并发隐患另开治理项）
- 计费系统重新设计
- 为 `/ws/asr` 再抽一层 `AsrRunner` 接口 / Strategy / Factory（`AsrStreamRunner` 已是公共件，够用）

一句话：V2 的需求是**"增加两种输入方式"**，别让它重新变成一次实时会话架构重构。

### 12.3 Step 1 落地记录（实现与本文档的 3 处差异 + 已验证项）

> 2026-09-22。**改代码前先看这三条**：它们不是"方案里的另一种写法"，而是已经跑在代码里的最终形态，
> 照方案原文的字面写法改回去会引入缺陷。

| # | 本文档原文 | 实现（最终形态） | 为什么 |
| :--- | :--- | :--- | :--- |
| 1 | §4.1.5 / §12.1 按"`submit` 同步阻塞、占用在 `submit` 的 `finally` 释放"写 | **占用覆盖整轮流式输出**：进入回合前 CAS 取得，本轮终态（`onComplete` / `onError` / `onCancel`）释放，加上"提交本身失败"的兜底释放；`cancel()` 只关 `accepting`、不碰占用 | `DoubaoLlmClient#streamChat` 是异步的（`executor.submit` 后立即返回），按字面写会导致"连点即并发两轮"；`cancel()` 不碰占用则从结构上排除了误清 |
| 2 | §4.1.1 传导链写 `… → InterviewContext（新增字段）→ InterviewSessionState（新增字段）` | **只在 `InterviewContext` 上存一份**；`InterviewSessionState#getInputMode()` 委托给持有的上下文；`AudioStreamSessionFactory` 无需改动 | 避免"两处都能改"：重连时漏同步会让 text 会话被还原成 audio，且用户无感知（单一来源优先于形态对称） |
| 3 | §4.1.1 只写了"DB 用小写 `DEFAULT 'audio'`、Java 用枚举" | 落库经 **`AttributeConverter`**（`InterviewInputMode.getCode()` 小写 ↔ `InterviewInputMode.from()`），**不用 `@Enumerated(EnumType.STRING)`** | `@Enumerated` 会写枚举名 `AUDIO`，与 V26 的 `DEFAULT 'audio'` 和历史行的小写值不一致 —— 读历史行会直接解析失败 |

**几处方案里没细写、实现时补齐的边界**（都属"方案边界"而非架构变更）：

- 空作答回 `INVALID_ANSWER`（**明确报错**，不静默丢弃）；
- `ANSWER` 解析失败 / 未知 type：只记 debug 日志并忽略，**不改变会话状态**（与既有控制指令一致）；
- text 模式收到音频帧：忽略 + **只 warn 一次**（音频是高频输入，逐帧 warn 会淹没日志）；
- text 模式下 `AudioStreamSession#receiveAudio` 直接返回，不把帧喂给"创建但未启动"的 ASR 运行期。

**已验证（2026-09-22）**：

- 全量测试 **182 通过 / 0 失败**，含 `ConversationTurnRunnerTest`(8)、text 模式会话行为(9)、
  `InterviewInputMode` 解析(5)、建连参数校验(3)，以及既有 audio 基线（ASR 运行期 / 回合触发 / 心跳 / 长尾收尾）；
- V26 与实体映射：在独立库上跑完整 Flyway 迁移链 + `ddl-auto=validate` + 真实 WebSocket 端到端用例，
  产出列为 `character varying(16) NOT NULL DEFAULT 'audio'`；
- 两端协议登记已落地（见 §9 的表）。

### 12.4 Step 2 落地记录（`/ws/asr` 实现与本文档的 3 处差异 + 已验证项）

> 2026-09-22。**改代码前先看这三条。**

| # | 本文档原文 | 实现（最终形态） | 为什么 |
| :--- | :--- | :--- | :--- |
| 1 | §4.2.2「复用 `AsrResultMessage`」未提 `final` | `AsrResultMessage` **新增 `isFinal`**（序列化名 `final`），`/ws/asr` 与 `/ws/audio` **都填** | 前端「中间态覆盖草稿 / 定稿追加」需要显式终态 —— 只靠 id 轮换无法表达"最后一段已定稿"。两条通道共用同一消息类型，语义必须一致（否则就是文档反复警惕的"协议语义漂移"） |
| 2 | §4.2.2 写「连接存活由**音频帧活跃度** + 最大识别时长控制」 | 实现时**只保留了最大时长**（当时 120 秒；**2026-09-24 依次调整为 180 → 300 秒**，跟着前端回答上限走）。<br>**2026-09-24 又补上"上游输入空闲 25 秒"**（`input-idle-timeout-ms`）—— 前提更正为：小程序端是**连续推帧**（无本地 VAD，见 `recognizer.ts` 的 `duration` / `frameSize`），所以"无帧 ≈ 停止录音"成立；`/ws/audio` **不适用**这条（用户倾听 / AI 生成时本来就没有上行音频） | 前半句（音频不是心跳）仍然成立：音频活跃度**不能**当"连接还活着"的唯一判据。但"完全不管输入"有另一个后果 —— 客户端该关没关时（崩溃 / 老版本）连接会一直挂着烧豆包时长（静音保活），所以补一条**输入空闲**兜底，且只给 `/ws/asr` |
| 3 | §4.2.4「（或只做识别连接超时兜底）」 | 兜底做在**会话自己的计时器**里，**没有新增全局扫描任务** | 计时器不依赖任何回调，连接悬挂（网络黑洞 / 前端崩溃）时照样到期收尾；识别通道因此不必挂到 `WsHeartbeatScheduler` 上，保持了"不接面试注册表/调度"的边界 |

**文档没写、实现时补的边界**（都属方案边界，不是架构变更）：

- **单用户并发超限是"拒绝"而不是"顶号"**：回 `ASR_LIMIT_EXCEEDED` / 4004。顶号会把"前端两条连接竞态"
  变成静默互踢；拒绝至少是明确的，前端可以先关掉自己那条旧连接再重试。
- **死连接自愈**：建连时先摘掉"传输已关闭、但容器 `onClose` 还没到"的登记，
  否则死连接会把用户锁住最长 300 秒（这条有单测）。
- **不收上行文本**：收到文本只记 debug 日志，不回错误、不改状态 —— 这条通道的能力就是"音频进、文本出"。
- **连接→会话的定位**用 `WebSocketSession#getAttributes`（不再维护第二张按连接索引的表）；
  并发闸门只用一张 `userId → 会话` 的表，`remove(userId, session)` 两参删除保证不误摘新连接。

**已验证（2026-09-22）**：全量 **198 通过 / 0 失败**，其中 Step 2 新增/扩展：
`AsrStreamingServiceTest`(9：`ASR_RESULT` + `final`、并发拒绝、关闭后放行、死连接自愈、
`ASR_UNAVAILABLE`、`ASR_TIMEOUT`、缺 `userId`)、
`AsrHandshakeInterceptorTest`(4：缺票 / 无效票 / 有效票 / **不做余额准入**)、
`WebSocketConfigTest`(1：两条路径**各挂自己的拦截器**，按调用顺序断言)、
`RealtimePropertiesTest`(+2：两个上限的默认值 + "后端上限必须比前端录音上限宽松")。

### 12.5 Step 3 落地记录（治理：配额 / 指标 / 埋点口径 / 日志脱敏）

> 2026-09-22。这一步**没有新功能**，全是"让这条新链路可观测、可限额、不留隐私痕迹"。

| # | 事项 | 落地形态 | 为什么是这个形态 |
| :--- | :--- | :--- | :--- |
| 1 | 限流 | `AsrConnectionQuota`：Redis 计数 + **北京时间自然日**滚动；`realtime.asr.daily-sessions-per-user` 默认 **300**（0 = 不限制）；超限 `ASR_QUOTA_EXCEEDED` / 4006 | 并发 1 + 单次 300 秒挡不住"建连 → 说话 → 关闭"的循环刷量；按 UTC 切日会让用户在北京时间早 8 点"配额莫名回血"，且日志对不上 |
| 2 | 失败开放 | Redis 读/写异常一律放行 + WARN | 识别只是输入辅助，缓存抖动不该让用户连字都打不了（与"埋点采集故障绝不阻塞业务"同源） |
| 3 | 配额计数时机 | 只在连接**被接受**之后 `consume`；并发 / 配额 / 鉴权拒绝都不计数 | 用户"手滑点两下话筒"不该白掉当天额度（那两次并没有产生识别成本） |
| 4 | 指标 | 4 个 Micrometer 指标（清单见 §4.2.4），出口是**已暴露的** `/actuator/prometheus` | 沿用项目既有做法（`FileCleanupService` / `MinioStorageService` 同风格）；不引入新监控栈、不加埋点事件名（平台事件字典未登记的新事件有风险） |
| 5 | 埋点口径 | `InterviewStartedEvent` / `InterviewEndedEvent` 增 `inputMode` → props 里的 `input_mode` | V2 唯一能量化收益的口径（渗透率 / 时长 / 结束原因）；`source(voice/text)` 后端拿不到，明确交给前端上报 |
| 6 | 日志脱敏 | `LogTextUtils#describe()` = `len=42`，替换 V2 新增的 3 处日志 | 用户作答 / 识别转写是**内容**而不是诊断信息；截断仍会保留前 512 字符原文，用来脱敏不够 |

**闸门顺序（实现里写死，别调换）**：凭证 → **并发**（可即时自救：关掉旧连接即可）→ **日配额**（重试无用）。
调换的话，用户会先看到"次数已用完"，而真实原因只是旧连接没关干净 —— 一个能自救、一个不能，
错误码给错会让前端给出错误的引导。

**联调与回归**：协议层冒烟脚本 `pass-up.backend/scripts/smoke-v2.mjs`（零依赖 Node，用法与用例编号见
《[模拟面试第二版-联调与冒烟清单](../模拟面试第二版-联调与冒烟清单.md)》）；人工验收项与故障对照表也在那份清单里。

**已验证（2026-09-22）**：全量 **224 通过 / 0 失败**，其中 Step 3 新增 / 扩展：
`AsrConnectionQuotaTest`(10：放行 / 达上限 / 0 = 不限制 / Redis 读异常与写异常 / 首次设 TTL / 键按用户与日期隔离)、
`LogTextUtilsTest`(3：只暴露长度、不含原文、`truncate` 行为不变)、
`InterviewAnalyticsEventHandlerTest`(4：`input_mode` 上报、props 字符串化、读不到时长留空、缺失不猜)、
`AsrStreamingServiceTest`(+6：配额用完 4006、被拒连接不消耗配额、活跃数 / 建连结果 / 时长 tag / 音频字节)。

### 12.6 联调记录：一个真缺陷、一个误判（2026-09-22）

> 实跑协议冒烟（`scripts/smoke-v2.mjs`）暴露出两件事。**误判那条也写下来**：
> 它的成因（字段名判定错）比结论本身更值得记住，否则下一个人会再踩一遍。

| # | 结论 | 依据 | 处理 |
| :--- | :--- | :--- | :--- |
| 1 | **误判 → 已撤销改动**：曾判定"`LLM_REPLY` 从来没有 `final:true`，需在回合层补发一条空文本结束分片" | 冒烟脚本只判 JSON 里的 `isFinal` 字段，而实际字段名是 **`final`**（见 §12.6.1）→"70 个分片 0 条 final"是**假象**；改用兼容判定后实测为 **1 条/轮，且带正文** | 撤除补发的结束分片（它只是多余消息）；改为在单测里钉住"末分片原样透传" |
| 2 | **真缺陷（已修）**：作答原文进了 **INFO** 日志（**生产同样落盘**） | `ConversationTurnRunner#submit` 的 `[回合] 触发LLM回答 … text=` 一直用 `LogTextUtils.truncate`（仍保留前 512 字**内容**）；Step 3 只改了 V2 新增的三处日志 | 改用 `LogTextUtils#describe`（`len=39` 这种摘要） |

#### 12.6.1 协议事实：`LLM_REPLY.final` 到底是什么（写死，两端遵守）

- `final:true` 就是**豆包流式响应的末分片**（`finish_reason != null`），**它同时带最后一段正文**，
  不是"空标记"。因此：
  - 前端对 `final` 分片的 `text` 仍然是**追加**语义（`prev + msg.text`），
    **不能**改成"用 final 的文本整段替换"；
  - 一轮回复**只应有一条** final 分片（前端据此恢复输入框、结束 `loading`）；
  - 它是 V2 文字作答"等 `final` 再恢复输入框"的**唯一依据**：上游哪天不再把 `finish_reason`
    挂在末分片上（改成独立空分片或干脆不发），前端就会收不到 `onLlmDone`、输入框卡死。
    **冒烟用例 `S1-3` 就是这条的哨兵**（同时打印 `final` 分片条数与是否带正文）。
- **字段名陷阱（本次误判的根因）**：Java 侧字段是 `isFinal`（`@Data` 生成 `isFinal()`），
  Jackson 对 `isXxx()` 布尔 getter 会**去掉 `is` 前缀**，所以下行 JSON 里叫 **`final`**。
  消费方必须两个都认 —— 前端 `ws.ts` 是这么写的（`parsed.final === true || parsed.isFinal === true`），
  而冒烟脚本最初只判 `isFinal`，于是得出了"信号不存在"的假结论。
  > 一般化：**协议字段名以实际 JSON 为准，不要按 Java 字段名猜**；拿不准时两端都兼容。

#### 12.6.2 日志口径（Step 3 的补充规则，按级别分）

| 内容 | 级别 | 处理 |
| :--- | :--- | :--- |
| 用户输入（作答原文、识别转写） | INFO 及以上 | **只记长度**（`describe` → `len=42`） |
| AI 回答（`[回合] LLM回答完成`） | INFO | **保留截断**：它是"AI 到底说了什么"的唯一排查线索，且回答本来就落库（`interview_message`），不算新增暴露面 |
| 任意内容 | DEBUG | 可保留截断（dev 用来排查；生产 `root=INFO` 不输出） |

> 冒烟用例 `S3-3` 按**级别**判定，而不是"全文件搜不到原文"：dev profile 是 `root: debug`，
> 会把完整 LLM 上下文打成 DEBUG —— 那是调试用途，不该被误报成泄漏。
> 该用例还有一个正向断言（日志里必须能看到 `收到文本作答 … text=len=N`），
> 否则"没搜到原文"可能只是**压根没记**。

**验证（2026-09-22）**：

- 全量回归 **225 通过 / 0 失败**；`AudioStreamSessionTurnBaselineTest` 新增
  `末分片带finish_reason时_原样透传为final分片`（钉住"末分片带正文 + 一轮一条 + replyId 配对"，
  防的正是"再顺手补一条空 final"这类动作）。
- 冒烟实跑：**16 PASS / 0 FAIL / 1 SKIP**（首次跑出 `final 分片 2 条（空文本 1，带正文 1）`，
  即"补发版"的两条；撤销补发后应为 1 条带正文）。
- 日志侧：`logs/app-dev.log` 中修复前（17:25 / 17:37）各有一次 INFO 泄漏；修复后（17:50 起的新会话）
  触发日志已变成 `text=len=39`，INFO 中不再出现作答原文。

### 12.7 资格模型的修订记录（2026-09-24，Step 4）

> 起因是**成本安全**，不是架构洁癖：豆包识别按音频时长计费，而识别通道原来的准入只有"登录态"，
> 一个账号就能把它当免费算力入口刷 —— §4.2.4 的日配额只是**限速**
> （当时上限 120 秒：300 次 × 120 秒 = 10 小时/天/账号；现上限 300 秒 → 25 小时/天，但这只是理论值 ——
> 真实上限是"用户付得起的面试时长"，见 §4.2.4 的说明），
> 不是**资格**。

**改了什么（语义，不是代码结构）**：

| 维度 | 修订前（2026-09-22） | 修订后（2026-09-24） |
| :--- | :--- | :--- |
| 定位 | 与面试会话**完全解耦**的通用识别能力 | **归属于面试会话的受控语音输入通道**（资格挂靠，§4.2.5） |
| 建连准入 | 凭证 → 并发 → 日配额 | 凭证 → **资格**（有进行中的面试）→ 并发 → 日配额 |
| 面试结束时 | 不联动：识别连接活到 120 秒上限 | **静默回收**该用户的识别连接（关闭码 1000、不带 ERROR） |
| `PAUSE` 时 | 无定义 | **不回收**已存在的连接（前端已 `stop()` 停录音），但**不许新建** |
| 与 `/ws/asr` 协议的关系 | — | 只增**一个错误码** `ASR_NO_ACTIVE_SESSION`(4007)；**前端不需要新增建连参数** |

**没改什么（别顺手动）**：

- `AsrStreamSession` 仍不拥有 `InterviewSessionState`、不落库、不计费、不碰 `CleanupReason`；
- `AsrStreamRunner` 一行不改（它本来就不认识面试）；
- `/ws/audio` 的路径与协议、`TicketHandshakeInterceptor` 的余额准入都不动；
- 日配额**不删**（降级为兜底，见 §4.2.4）。

**Step 4 实施纪律（落地时必须遵守）**：

1. **资格判断只有一个落点**（落地为 `AsrUsageGuard#decide`），
   不要在拦截器 / `AsrStreamSession` / handler 里各写一遍；
2. **回收只挂一个入口** —— 最终形态是**监听 `InterviewEndedEvent`**，而不是挂
   `AudioStreamingService#cleanup`：因为"暂停超时回收"那条结束路径**没有物理连接**，挂 `cleanup` 会漏；
   而 `InterviewEndedEvent` 只在这两处发布、`PAUSE` 走 `publishPaused()` 不发它，
   ⇒"一个入口"与"排除暂停"同时天然成立（**不需要**维护任何 `CleanupReason` 清单）。
   判据始终是"**逻辑会话是否 ENDED**"，不是"物理连接是否关闭"；
3. **回收是单向的**：面试侧 → 识别侧。识别侧不回调面试侧，也不因此写任何面试状态；
4. **错误码不要复用 `ASR_UNAVAILABLE`**："没在面试里"与"识别服务挂了"给用户的引导完全不同
   （前者是"去开始面试"，后者是"改用打字"）—— 按 §4.2.2 的表新增 `ASR_NO_ACTIVE_SESSION` / 4007；
   同理，**资格读不出来**也不要用 4007 冒充"没在面试"。

**为什么不做成显式会话绑定（前端传 `sessionId` 或 ticket 带会话 ID）**：
挂靠的是**资格**，不是**身份**。资格与回收都只需要 `userId`，而 `userId` 来自 ticket ——
于是就不需要"前端必须知道逻辑会话 ID"（当前它只在 `PAUSED` 消息里才拿到），协议因此零改动。
将来若真要把识别绑到具体某场面试（例如"一场面试配一份识别额度"），再把 `sessionId` 补进 ticket 载体。

### 12.8 Step 4 落地记录（资格与回收，2026-09-24）

**新增**：

```text
modules/realtime/asr/AsrUsageGuard.java        # 资格判定：有进行中的面试才放行（只读计费会话；失败关闭，三态）
modules/realtime/asr/AsrSessionReclaimer.java  # 监听 InterviewEndedEvent → closeForUser(userId)（唯一回收入口）
```

**修改**：

```text
modules/realtime/asr/AsrStreamingService.java  # 第 2 道闸门（资格）+ ERR/CLOSE 4007 + closeForUser(userId)
                                               #   + 建连结果 tag rejected_no_session
modules/realtime/asr/AsrStreamSession.java     # closeByServer()：服务端主动收尾走静默关闭（1000，不发 ERROR）
                                               #   + 指标 tag server_close
AGENTS.md §3.8                                 # 同步新口径（四道闸门 / 4007 / 结束回收 / server_close / 失败关闭）
pass-up.frontend-mp/src/features/speech/transport.ts  # 登记 4007（白名单 + 关闭码映射 + 文案「请先开始面试」）
pass-up.frontend-mp/src/features/speech/types.ts      # SpeechErrorCode 增 ASR_NO_ACTIVE_SESSION
```

**与本文档原计划的两处差异（照原文改回去会引入缺陷）**：

| # | 原计划 | 实现（最终形态） | 为什么 |
| :--- | :--- | :--- | :--- |
| 1 | 回收"只挂 `AudioStreamingService#cleanup`" | 挂 **`InterviewEndedEvent`** 的监听 | `cleanup` 只覆盖"有物理连接退出"的结束；**暂停超时回收**（`evictExpiredPausedSessions`）没有连接可挂，会漏。事件路径天然覆盖全部结束、且天然排除暂停 |
| 2 | 资格判据返回"允许 / 拒绝"两态 | **三态**：`ALLOWED` / `NO_ACTIVE_SESSION` / `UNAVAILABLE` | "没在面试里"与"资格读不出来"给用户的引导不同（去开始面试 vs 改用打字）；合成一态会把系统故障说成用户的错 |

**已验证（2026-09-24）**：全量测试 **0 失败**（含 `PassUpApplicationTests` 的上下文加载 —— 两个新 bean 的 Spring 装配没问题），其中 Step 4 新增/扩展：

- `AsrStreamingServiceTest` **22 例**（+5：无资格拒绝 4007、无资格**不消耗**配额、资格不可用回 4003、
  结束回收静默关闭并放行并发闸门、无连接时回收为无操作）；
- `AsrUsageGuardTest` **5 例**（有未暂停会话放行 / 无会话拒绝 / 暂停拒绝 / 缺 `userId` 拒绝 / 读取异常按不可用拒绝）；
- `AsrSessionReclaimerTest` **4 例**（结束即回收 / 非主动结束同样回收 / 缺 `userId` 不动作 / 回收抛异常不上抛）。

**协议冒烟（`scripts/smoke-v2.mjs`，编号对照见《联调与冒烟清单》§1）**：

- 新增 `S4-1`（没有面试 → 4007）/ `S4-2`（面试进行中 → 放行）/ `S4-3`（面试结束 → 识别连接被静默回收：1000 且无 ERROR）；
- ⚠️ **三条既有用例必须先开一条「资格载体」会话**（脚本里的 `ensureCarrier`）：`S2-1` / `S2-2` / `S3-2`
  都要连识别通道，而 Step 4 之后它们会先被 4007 拒 —— 这是本次修订**对既有冒烟最直接的影响**，不改脚本冒烟就会红；
- `S3-1` 顺带打印 `rejected_no_session` 计数；`S4-1` 用"先开一条会话再关掉"的方式确定性制造"没有面试"的状态，
  并带一个小重试窗口（服务端的"结束 → 停计费"比客户端看到关闭帧稍晚，固定 sleep 会偶发假失败）。

### 12.9 停止语义的收口：前端 8 秒 + 后端 25 秒（2026-09-24）

**起因**：`/ws/asr` 的"停止录音"与"释放识别连接"原来是**无限期分离**的 ——
前端 `transport.stop()` 只置 `framesStopped`（连接留着），而后端 `DoubaoAsrClient` 自带**静音保活**
（空闲 3 秒补一帧 200ms 静音），于是"用户已经不再说话"之后豆包会话仍然活着、静音帧照样按时长计费，
最长能挂到 300 秒上限。更直接的副作用是**并发闸门被占**：同一账号在另一个页面 / 设备上点话筒会被 4004 拒。

**最终形态（B 是主机制，D 是兜底）**：

| 层 | 位置 | 行为 | 语义依据 |
| :--- | :--- | :--- | :--- |
| 前端（主） | `WsAsrTransport#stop()` | 停推帧后起一个 **8 秒**空闲定时器；到点仍没再 `start()` 就 `dispose()` | 留时间给豆包尾包（通常 1~2 秒内到），又不让连接无限期挂着 |
| 后端（兜底） | `AsrStreamSession#scheduleInputIdleClose()` | **25 秒**没有上行音频 → 静默关闭（1000、无 ERROR） | 只在 `/ws/asr` 成立：该通道上行只有音频帧，无帧 ≈ 停止录音 |

**三条实现纪律（别改坏）**：

1. **D 不许下沉到 `AsrStreamRunner`**。那是两个通道共用的运行期；`/ws/audio` 里"几十秒没有上行音频"
   是**正常态**（用户倾听 / AI 生成中），按无帧释放会把面试的 ASR 干掉。边界是：
   `AsrStreamRunner` 只管 ASR 流本身，"输入空闲"是 `/ws/asr` 自己的输入语义。
2. **前端定时器必须能被新一轮作废**。当前结构上已经安全（`SpeechRecognizer#start()` 每次都会
   `dispose()` 旧 transport 并新建一个，不复用），另外 `start()`/`dispose()` 都会清掉定时器，
   回调里还判了 `disposed` / `framesStopped` 两道 —— 三重保险，避免"旧定时器把正在用的新连接关掉"。
3. **两条路径都必须静默**（1000、不下发 ERROR）：这不是故障，是收尾。指标上靠 `end` tag 区分
   （`client_close` = 前端正常释放、`input_idle` = 后端兜底、`server_close` = 面试结束回收）。

**阈值的选择**：前端 8 秒（尾包窗口）、后端 25 秒（必须明显大于前端窗口，否则两条路径抢着关连接）。
8 秒不必追求精确 —— 实测尾包基本 1~2 秒内到；若日志显示普遍很快，可以收紧到 5 秒。
后端 25 秒也不是硬指标，它是"客户端失控"的兜底，不需要更紧。

**实跑结果（2026-09-24，本地 dev + admin token）**：

- ✅ **`PASS=19 / FAIL=0 / WARN=0 / SKIP=1`（`S3-2` 按设计跳过），连续两轮退出码 0**：
  - `S4-1` 第 1 次尝试即拿到 4007；`S2-1` 收到真实 `ASR_RESULT`（本机豆包 Key 已配）；
  - `S4-2` 面试进行中 ⇒ 放行；`S4-3` 面试结束 ⇒ `code=1000 reason=INTERVIEW_ENDED` 且全程无 ERROR
    ⇒ **"面试结束静默回收"已在真机确认**（这是本次最想验的一条）；
  - `S3-1` 打印 `accepted=2.0, rejected_limit=1.0, rejected_no_session=1.0` ⇒ 新 tag 在出数。
- ⚠️ **首次实跑时 `S4-2` / `S4-3` 曾不稳定失败，根因不在代码而在本地环境**：
  同一台机器上还有别的实例（3 台 VirtualBox VM）跑同一套后端，且**连的是同一个 Redis** ——
  它们各自的 `InterviewBillingScheduler` 会 `SCAN interview:session:user:*`，把"不在自己内存注册表里"的会话
  判成孤儿会话并 `stopBilling` 删键 ⇒ 本机正在进行的会话**静默停计费**（用户白嫖）+ `/ws/asr` 被判无资格（4007）。
  定位手段：Redis `MONITOR`（抓到一条**没有对应应用日志**的 `DEL`）→ 给两处删键点（`stopBilling` /
  `forceTerminateActiveSession`）加带调用栈的临时日志，**证明删键那一刻两者都没被调用**（不是本进程）→
  `CLIENT LIST` 里看到 age≈6.6 小时的 `Lettuce` 客户端在跑 `SCAN`。
  解决：给本机加一个**只绑 `127.0.0.1`** 的第二个 Redis（`redis-local:6380`），后端用环境变量指过去，
  与 VM 完全隔离（做法见《联调与冒烟清单》§0.3）。**隔离后连跑两轮全绿**。
- 排障过程中还证实并修掉了两处**真实竞态**（不是本次失败的主因，但确实存在，见《联调与冒烟清单》§5）：
  `markSessionReady()` 不校验会话是否已结束（迟到 ASR 就绪仍会起算）、`startBilling()` 的"已存在就跳过"是
  check-then-act（同一 JVM 内实测同一毫秒两条 `开始计费`）。
