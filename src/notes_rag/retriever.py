"""召回。baseline：纯向量 top-k，没有重排。

════════════════════════════════════════════════════════
你的第一个改造点在这里（卡片 rag-06）
════════════════════════════════════════════════════════

现在 search() 直接取 top_k。要做的是两段式：

    召回 top-20（粗，快）  →  rerank 打分  →  取 top-5（准）

为什么必须两段：
- 向量是 bi-encoder，query 和 doc 各自编码，互相看不见，快但粗
- rerank 是 cross-encoder，把 query 和 doc 拼成一个输入过模型，能建模词级交互，准但慢
- 全库跑 cross-encoder 是 O(n) 次推理，6000 块要几十秒，不可接受

实现提示：
    from sentence_transformers import CrossEncoder
    ce = CrossEncoder("BAAI/bge-reranker-v2-m3")
    scores = ce.predict([(query, hit["text"]) for hit in coarse_hits])

验证方式：evaluate.py 跑两次（改前 / 改后），把 recall@5 和耗时记进
`llm-learning/实验台账.md` 第 2 节。没有这组数字，这个改动等于没做。
"""

from __future__ import annotations

from .embedder import Embedder
from .store import VectorStore


class Retriever:
    def __init__(self, embedder: Embedder, store: VectorStore):
        self.embedder = embedder
        self.store = store

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """检索。返回 [{score, text, source, heading, id}, ...]"""
        query_vec = self.embedder.encode([query])[0]
        return self.store.search(query_vec, top_k=top_k)
