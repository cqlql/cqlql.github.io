"""向量化。baseline：bge-m3，输出已归一化，所以点积即余弦。

这个模块基本不用改，但有两个点要测：
- 入库耗时：632 篇切完约 6000 块，GPU 上多久
- 单条 query 延迟：决定了端到端响应的下限

关于 instruction：bge-m3 不需要 query instruction（bge-large-zh-v1.5 才需要）。
如果你换了模型，先看模型卡，别照搬网上的写法——加错了会掉点。
"""

from __future__ import annotations

import numpy as np
from sentence_transformers import SentenceTransformer


class Embedder:
    def __init__(self, model_name: str = "BAAI/bge-m3", device: str | None = None):
        self.model_name = model_name
        self.model = SentenceTransformer(model_name, device=device)

    @property
    def dim(self) -> int:
        return int(self.model.get_sentence_embedding_dimension())

    def encode(
        self,
        texts: list[str],
        batch_size: int = 16,
        show_progress: bool = False,
    ) -> np.ndarray:
        """返回 shape=(n, dim) 的 float32 数组，每行已 L2 归一化。"""
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)

        vecs = self.model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=show_progress,
            convert_to_numpy=True,
        )
        return vecs.astype(np.float32)
