"""召回。两段式：向量粗召回 top-N → cross-encoder 精排 → 取 top-k。

为什么必须两段：
- 向量是 bi-encoder，query 和 doc 各自编码，互相看不见，快但粗
- rerank 是 cross-encoder，把 query 和 doc 拼成一个输入过模型，能建模词级交互，准但慢
- 全库跑 cross-encoder 是 O(n) 次推理，6000 块要几十秒，不可接受

开关是 `.env` 的 `RERANK_ENABLED`：同一份代码、同一份索引，只改这一行就能做前后对比。
`RERANK_TOP_N` 控制粗召回几条进精排；`TOP_K` 控制最终返回几条。
"""

from __future__ import annotations

from .config import Config
from .embedder import Embedder
from .reranker import Reranker
from .store import VectorStore


class Retriever:
    def __init__(
        self,
        embedder: Embedder,
        store: VectorStore,
        reranker: Reranker | None = None,
        rerank_top_n: int = 20,
    ):
        self.embedder = embedder
        self.store = store
        self.reranker = reranker
        self.rerank_top_n = rerank_top_n

    @property
    def rerank_enabled(self) -> bool:
        return self.reranker is not None

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """检索。返回 [{score, text, source, heading, id, ...}, ...]，按最终排序。

        没有 rerank 时 `score` 就是余弦相似度；开了 rerank 时保持余弦不变，
        精排分放在 `rerank_score`，排序按 `rerank_score` 走 —— 两个口径不混用。
        """
        query_vec = self.embedder.encode([query])[0]

        # 粗召回：没开 rerank 就只取 top_k，开了就多取一些给精排挑
        coarse_k = max(self.rerank_top_n, top_k) if self.rerank_enabled else top_k
        hits = self.store.search(query_vec, top_k=coarse_k)
        if not self.rerank_enabled or not hits:
            return hits

        scores = self.reranker.score(query, [h["text"] for h in hits])
        ranked = [{**h, "rerank_score": float(s)} for h, s in zip(hits, scores, strict=True)]
        ranked.sort(key=lambda h: h["rerank_score"], reverse=True)
        return ranked[:top_k]


def build_retriever(embedder: Embedder, store: VectorStore, cfg: Config) -> Retriever:
    """按配置组装检索器。cli / evaluate / serve_ui 共用这一个入口，别各写一份。"""
    reranker = Reranker(cfg.rerank_model) if cfg.rerank_enabled else None
    return Retriever(embedder, store, reranker=reranker, rerank_top_n=cfg.rerank_top_n)
