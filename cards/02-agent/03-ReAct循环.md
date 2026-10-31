---
id: agent-03
title: ReAct 和一次性 Function Calling 的区别
stage: agent
week: 3
---

# ReAct 和一次性 Function Calling 的区别

## 30 秒版

<!--
要答到的核心：
- 一次性：拿到结果就答，适合单步能解决的任务
- ReAct：Thought → Action → Observation 循环，根据上一步结果决定下一步
- Thought 那一步的实际作用（不是玄学，是让模型把推理显式化）
-->

> 关键词桩，不是成稿。合上卡，用这几根桩自己连成 5 句话。

- 一次性 FC：拿到工具结果就作答，只适合单步能解决的任务
- ReAct：Thought → Action → Observation 循环，看结果再定下一步
- Thought 是给模型的 scratchpad，让中间推理有依据，不是玄学
- 代价是每轮一次 LLM 调用，慢且贵，能一次解决就别上 ReAct

## 展开

**ReAct 论文的核心**：交替生成推理轨迹（Thought）和动作（Action），Observation 是环境返回。关键在「交替」——模型不是一次猜完所有步骤，而是每步根据上一步的实际结果修正方向。

**和 plan-and-execute 的对比**

| | ReAct | plan-and-execute |
|---|---|---|
| 节奏 | 边做边看 | 先出完整计划再执行 |
| 优点 | 能应对未知（下一步取决于结果） | 快（可并行）、可审查、可缓存 |
| 缺点 | 慢、贵、可能发散 | 计划错了要整体重来 |
| 适合 | 路径不固定 | 步骤可枚举 |

实际最常用的是**混合**：外层 plan 定骨架，需要探索的那一步用 ReAct；plan 失效时回退重规划。

**成本账**：每轮一次 LLM 调用，且每次都带全量上下文。3 轮 ≈ 3 倍 token + 3 倍延迟。所以「能用一次性 FC 解决的绝不上 ReAct」——这不只是省钱，也减少出错面。

**实现真相**：现在大多数框架里的「ReAct」其实就是**循环 Function Calling**，区别只在有没有显式的 reasoning 字段：

- reasoning 模型（o1 系、Claude 的 thinking）：thought 在 `reasoning_content` 里，不占用户可见上下文，且经过 RL 训练更可靠；但不可控、不可审计
- 普通模型：在 prompt 里要求先输出 `Thought: ...` 再输出 Action，thought 作为普通 assistant 文本进上下文（占 token、影响后续轮次）

**三种失效模式**：Thought 越推越偏（自我强化错误前提）、重复同一个 Action（没有「试过了」的记忆）、提前终止（模型觉得「差不多了」就停）。这三种都要靠外部硬约束兜，不能指望模型自觉。

## 我的数字

<!-- 该跑什么：PassUp Agent 跑一批任务，记平均轮次、平均耗时、单次成本、终止方式分布（模型自答 / 达上限 / 报错）。记什么：轮次、秒、元/次。 -->

（待填）

## 追问预演

- **Q**：Thought 那一步真的有用吗？去掉会怎样？
  **A**：**要点**：看任务。多步任务、且下一步依赖中间结果时，Thought 让模型把「为什么这么调」写出来，等于给自己一块草稿纸，实测能减少重复调用和参数错误。去掉后模型倾向「一次猜完」，复杂任务准确率下降。反例：单步任务（查个天气）加 Thought 只是白烧 token。

- **Q**：ReAct 和 plan-and-execute 怎么选？
  **A**：**要点**：看**路径是否可预知**。步骤固定、可枚举 → plan（快、可审查、可缓存）；路径依赖中间结果（要先查 A 才知道查 B）→ ReAct。实践中最常用是混合：外层固定骨架，需要探索的那一步用 ReAct。

- **Q**：ReAct 循环怎么终止？靠模型自己说结束可靠吗？
  **A**：**要点**：不可靠，必须双保险。硬上限（最大轮次 / 总超时 / 成本上限）+ 模型自答（`finish_reason=stop`）。到硬上限时不要抛错，让模型基于已有信息给「尽力而为」的回答并说明缺什么。另外加重复检测：连续两轮相同 Action + 相同参数 → 强制终止或换提示。

- **Q**：你的实现里，Thought 是模型的 reasoning 字段还是拼在 prompt 里的？
  **A**：**要点**：按实际实现答。reasoning 模型的 thought 在 `reasoning_content`，不进 messages、不占上下文；普通模型就在 prompt 里要求先输出 `Thought:`，作为 assistant 文本进上下文。区别很实际——拼在 prompt 里的 thought 会累积占 token 并影响后续轮次，reasoning 字段的不会（但要确认 API 是否回传）。

## 参考

- Yao et al., 2022, "ReAct: Synergizing Reasoning and Acting in Language Models"（arXiv:2210.03629）
- LangGraph 文档里的 ReAct agent 实现 —— 看它其实就是一个循环 tool calling
- Anthropic《Building effective agents》—— 五种 workflow 与 agent 的划分
