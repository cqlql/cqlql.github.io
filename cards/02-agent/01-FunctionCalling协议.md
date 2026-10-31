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

（待填）

## 展开

<!--
提示方向（按这个顺序讲，最清楚）：
1. 请求里带 tools（name / description / parameters 的 JSON Schema）
2. 模型返回 finish_reason=tool_calls + tool_calls 数组（id / function.name / arguments 是字符串）
3. 你的代码解析 arguments、执行真实函数
4. 把结果作为 role=tool 的消息回填，必须带上对应的 tool_call_id
5. 再请求一次，模型基于结果继续（可能再调，也可能给最终答案）
- 常见坑：arguments 是 JSON 字符串，要 parse；tool_call_id 必须对上，否则模型不知道哪条结果对应哪个调用
-->

（待填）

## 我的数字

<!-- 单次调用平均往返次数、tool_calls 解析失败率（有的话） -->

（待填）

## 追问预演

- **Q**：模型真的执行了你的函数吗？
  **A**：

- **Q**：模型一次返回多个 tool_calls，你怎么处理？
  **A**：

- **Q**：回填结果时为什么要带 tool_call_id？不带会怎样？
  **A**：

- **Q**：tool_choice 有哪几种取值，什么时候用 required？
  **A**：

## 参考

-
