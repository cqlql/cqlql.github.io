"""精排。两段式的第二段：cross-encoder 给 (query, chunk) 打相关性分。

为什么只对候选打分，不在全库跑：
- bi-encoder（bge-m3）把 query 和 chunk 各自编码，互相看不见，快但粗
- cross-encoder 把 query 和 chunk 拼成一条输入过模型，能建模词级交互，准但慢
- 全库跑是 O(n) 次推理（6696 块要几十秒），所以只对粗召回的 top-N 精排

分数口径：CrossEncoder 输出的是 logit，**不是余弦相似度**，别和向量分混着比；
大模型只看排序，所以只排序、不解释绝对值的意义。
"""

from __future__ import annotations

import numpy as np
from sentence_transformers import CrossEncoder


class Reranker:
    def __init__(
        self,
        model_name: str = "BAAI/bge-reranker-v2-m3",
        device: str | None = None,
        max_length: int = 512,
    ):
        self.model_name = model_name
        self.model = CrossEncoder(model_name, device=device, max_length=max_length)

    def score(self, query: str, texts: list[str], batch_size: int = 8) -> np.ndarray:
        """返回每个 (query, text) 的相关性分，越大越相关。"""
        if not texts:
            return np.zeros((0,), dtype=np.float32)

        pairs = [(query, text) for text in texts]
        scores = self.model.predict(pairs, batch_size=batch_size, show_progress_bar=False)
        return np.asarray(scores, dtype=np.float32)
