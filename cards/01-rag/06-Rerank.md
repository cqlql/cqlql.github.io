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

> 关键词桩，不是成稿。合上卡，用这几根桩自己连成 5 句话。

- 向量是 bi-encoder：两侧独立编码，doc 向量能离线算好，快但粗
- rerank 是 cross-encoder：query 和 doc 拼一起过模型，有词级交互，准但每对都要算一次
- 所以两段式：向量粗排 top-20 → rerank 精排 top-5
- 池子大小是上限：recall@20 决定 rerank 的天花板
- rerank 也会把对的排下去，必须用 eval 验证

## 展开

**结构差异决定了能力差异**

| | bi-encoder（向量检索） | cross-encoder（rerank） |
|---|---|---|
| 输入 | query、doc 分别过 encoder | `[query, doc]` 拼成一个序列 |
| 交互 | 无（只在最后用向量点积「碰」一下） | 全（注意力能在两侧 token 间自由流动） |
| 预计算 | doc 向量可离线算好、建索引 | 不行，每对都要跑一次完整前向 |
| 复杂度 | 编码 O(1) + ANN 检索 | O(n) 次推理 |
| 精度 | 粗 | 高 |

**为什么准但不能全库用**：cross-encoder 的精度来自词级交互，代价是「query 和 doc 必须一起进模型」，无法预计算。5000 块 × 20ms ≈ 100 秒一次查询，QPS 直接归零。所以它只能作用在一个小池子上。

**两段式的分工**：粗排负责「该有的在池子里」（看 recall@20），精排负责「排在前面的确实相关」（看 recall@5 / MRR）。两个指标分开看，才知道问题出在哪一层——recall@20 低是粗排的锅，recall@20 高但 recall@5 低才是 rerank 能救的。

**top-20 的依据不是经验值，是天花板**：rerank 只能从池子里挑，所以 `recall@5_after_rerank ≤ recall@20_before`。池子大小要先把 recall@k 曲线测出来，看 k 到多少接近饱和。

**延迟账**：20 对 × batch 8 × 每批 30ms ≈ 75ms，可接受。这是「20」这个数真正的约束来源——不是精度，是延迟预算。

**别假设 rerank 一定更好**：cross-encoder 也有偏差（偏好关键词密集、格式整齐的段落），会把原本排第一的正确块挤到第六。所以必须跑 eval，而且要同时看 recall@5 和 MRR。

## 我的数字

<!-- 该跑什么：台账第 2 节——50 条 eval 集上，纯向量 top-5 vs 向量 top-20 → rerank → top-5，记 recall@5、MRR、平均耗时。顺便记一下 recall@20，它是 rerank 的上限。记什么：recall@5 前后、MRR 前后、耗时前后。 -->

（待填）

## 追问预演

- **Q**：为什么不直接对所有文档做 rerank？
  **A**：**要点**：成本是 O(n) 次 cross-encoder 前向，随文档数线性涨。5000 块就是 100 秒/次查询，QPS 撑不住。而且边际收益递减——排到 200 名之外的，不是「差点意思」，是「压根不对」。两段式的本质是**用便宜的粗排把候选集缩到精排付得起的规模**。

- **Q**：top-20 这个数怎么定的？如果 recall@20 只有 0.6 呢？
  **A**：**要点**：20 是被延迟预算夹出来的（约 75ms），不是精度最优。如果 recall@20 只有 0.6，说明**粗排有问题，这时候调 rerank 是错的方向**——该回去修切分、embedding 或混合检索。这也是分层看指标的意义：先保证 recall@20 够高，rerank 才有发挥空间。

- **Q**：rerank 之后取 top-5，会不会把原来对的那条挤掉？
  **A**：**要点**：会。cross-encoder 有自己的偏好，会把关键词密集的块排前面。所以不能假设 rerank 单调改善，必须用 eval 集验证。实践上同时看 recall@5 和 MRR——只看 recall@5 会漏掉「对的还在但排名掉了」这种情况。

- **Q**：bge-reranker 的输入格式和 max length 有什么坑？
  **A**：**要点**：输入是 `(query, passage)` 对，不是自己拼字符串；`max_length` 通常 512，超了会被截断——**长 passage 的尾部信息直接丢失**，这也是 chunk 不能太大的另一个理由。另外输出的分数是 logit 不是概率，同一模型内可比，跨模型别比。

## 参考

- Nogueira & Cho, 2019, "Passage Re-ranking with BERT"（arXiv:1901.04085）—— cross-encoder 做 rerank 的起点
- BGE Reranker 模型卡（FlagEmbedding 仓库）—— `bge-reranker-v2-m3` 的输入格式与 max length
- Cohere Rerank 文档 —— 工程视角的用法、延迟量级、top_n 建议
