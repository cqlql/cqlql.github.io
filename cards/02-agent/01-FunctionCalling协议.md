---
id: agent-01
title: Function Calling 的完整交互流程
stage: agent
week: 3
---

# Function Calling 的完整交互流程

## 30 秒版

<!--
要答到的核心：
- 一次调用往返了几次、每步消息里有什么
- tools 怎么定义、模型返回什么、结果怎么回填
- 关键点：模型不执行函数，只决定「调什么、参数是什么」
-->

> 关键词桩，不是成稿。合上卡，用这几根桩自己连成 5 句话。

- 最少两次请求：带 tools 请求 → 模型返回 tool_calls → 本地执行 → 回填 role=tool → 再请求
- 模型只产出「调哪个、参数是什么」的结构化意图，不执行
- arguments 是 JSON 字符串要 parse；tool_call_id 必须一一对上
- 执行权在应用侧，这是安全边界

## 展开

**五步流程**

1. 请求里带 `tools`：`[{type:"function", function:{name, description, parameters: <JSON Schema>}}]`
2. 模型返回 `finish_reason: "tool_calls"`，`message.tool_calls` 是数组，每项形如
   ```json
   {"id": "call_abc", "type": "function",
    "function": {"name": "get_interview_record",
                 "arguments": "{\"candidate_id\":\"c_01\"}"}}
   ```
   注意 `arguments` 是**字符串**，不是对象
3. 你的代码 `JSON.parse(arguments)` → 校验 → 执行真实函数（鉴权、超时、幂等都要自己做）
4. 回填一条 `{"role":"tool","tool_call_id":"call_abc","content":"<结果字符串>"}`，**每个 id 一条，不能合并**
5. 再请求一次，模型基于结果继续：可能再调（继续循环），也可能给最终答案（`finish_reason: "stop"`）

**核心认知**：整个流程里模型只输出文本（一段 JSON），执行权在你手里。所以你可以拒绝执行、可以改参数、可以加人工审批。这是 Function Calling 比「让模型直接输出 SQL / shell」安全的根本原因——**边界不在模型有多听话，在执行权归谁**。

**两个必踩的坑**

- `arguments` 是 JSON 字符串，直接当对象用会报错；而且模型可能产出非法 JSON（缺引号、多逗号），要 try/catch 兜住并把错误回给模型让它重发
- `tool_call_id` 对不上：一次返回多个 `tool_calls` 时，模型靠 id 把结果和请求配对。少回一条、id 写错，轻则答错，重则 API 直接 400

## 我的数字

<!-- 该跑什么：PassUp Agent 跑 20-30 个真实任务，记平均往返轮次（几轮才给出最终答案）、tool_calls 解析失败次数、单次调用平均 token。记什么：平均轮次、解析失败率、平均 token/成本。 -->

（待填）

## 追问预演

- **Q**：模型真的执行了你的函数吗？
  **A**：**要点**：没有。模型只输出结构化意图（函数名 + 参数 JSON），执行的是我的代码。所以危险动作（删数据、发消息、付款）必须在我这层做校验和确认。这也是它比「让模型直接生成 SQL」安全的地方——**执行权在应用侧，不在模型侧**。

- **Q**：模型一次返回多个 tool_calls，你怎么处理？
  **A**：**要点**：无依赖就并行执行，然后为每个 id 各回一条 `role=tool` 消息；**必须全部回填**，漏一个下次请求就报错。有依赖时（第二个参数来自第一个结果）不能并行，要让它分两轮。

- **Q**：回填结果时为什么要带 tool_call_id？不带会怎样？
  **A**：**要点**：一次可能返回多个调用，模型靠 id 把「结果」和「请求」配对。不带或对不上，模型不知道哪条结果对应哪个调用——轻则把结果安错地方，重则 API 直接 400（OpenAI 要求每个 `tool_calls` 都有对应响应）。

- **Q**：tool_choice 有哪几种取值，什么时候用 required？
  **A**：**要点**：`auto`（默认，模型自己决定）、`none`（禁止调，只要文本）、`required`（强制至少调一个）、指定函数（强制调这个）。`required` 用在「这一步必须拿到工具数据才能继续」的流程节点，防止模型偷懒直接编答案。

## 参考

- OpenAI Function Calling 文档 —— `tool_calls` / `tool_call_id` 的字段约束
- Anthropic Tool Use 文档 —— `tool_use` / `tool_result` content block 形式，和 OpenAI 的差异
- 自己的 `PassUp Agent` 调用日志
