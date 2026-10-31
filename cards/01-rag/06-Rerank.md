---
id: rag-06
title: rerank 为什么有效、为什么只对 top-20 做
stage: rag
week: 2
---

# rerank 为什么有效、为什么只对 top-20 做

## 30 秒版

<!--
要答到的核心：
- bi-encoder（向量）和 cross-encoder（rerank）的结构差异
- 为什么 cross-encoder 更准但不能全库用
- 你的提升数字
-->

（待填）

## 展开

<!--
提示方向：
- 向量检索：query 和 doc 各自编码，不互相看，所以快但粗；文档向量可以离线算好
- cross-encoder：query 和 doc 拼成一个输入过模型，能建模词级交互，准但必须实时算，O(n) 次推理
- 所以两段式：粗排（向量，快）取 top-20 → 精排（rerank，准）取 top-5
- top-20 这个数的依据：recall@20 是上限，rerank 只能在这个池子里挑
- rerank 也会把对的排下去，所以必须评估，不能假设它一定更好
-->

（待填）

## 我的数字

<!-- 从台账第 2 节抄：recall@5 前后、耗时前后、MRR -->

（待填）

## 追问预演

- **Q**：为什么不直接对所有文档做 rerank？
  **A**：

- **Q**：top-20 这个数怎么定的？如果 recall@20 只有 0.6 呢？
  **A**：

- **Q**：rerank 之后取 top-5，会不会把原来对的那条挤掉？
  **A**：

- **Q**：bge-reranker 的输入格式和 max length 有什么坑？
  **A**：

## 参考

-
