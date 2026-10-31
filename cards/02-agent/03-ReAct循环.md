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

（待填）

## 展开

<!--
提示方向：
- ReAct 论文的核心：交替生成推理轨迹和动作，让模型能利用中间观察结果修正方向
- 与 plan-and-execute 的对比：先规划全部步骤再执行 vs 边做边看
- ReAct 的问题：每步都要一次 LLM 调用，慢且贵；Thought 内容不可控，可能越推越偏
- 实现上，很多框架的「ReAct」其实就是循环 Function Calling，区别在有没有显式的 reasoning 字段
-->

（待填）

## 我的数字

<!-- 一个任务跑完平均几轮、几秒、多少钱 -->

（待填）

## 追问预演

- **Q**：Thought 那一步真的有用吗？去掉会怎样？
  **A**：

- **Q**：ReAct 和 plan-and-execute 怎么选？
  **A**：

- **Q**：ReAct 循环怎么终止？靠模型自己说结束可靠吗？
  **A**：

- **Q**：你的实现里，Thought 是模型的 reasoning 字段还是拼在 prompt 里的？
  **A**：

## 参考

-
