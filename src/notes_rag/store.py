"""向量存储。baseline：numpy 数组 + 点积暴力检索。

为什么不上向量库（面试会被问）：
6000 块 × 1024 维 float32 ≈ 24MB，一次检索是 6000 次 1024 维点积 ≈ 6M 次乘加，
在 CPU 上是毫秒级。这个量级引入 pgvector 只是多一套要运维的东西。

什么时候该换：超过 10 万块（单次检索上百毫秒），或者需要多进程并发写入。
那时候再迁 pgvector，并且用 `实验台账` 记录 HNSW 和 IVFFlat 的建索引耗时对比
（对应卡片 rag-04）。
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

VECTORS_FILE = "vectors.npy"
META_FILE = "meta.jsonl"
MANIFEST_FILE = "manifest.json"


class VectorStore:
    def __init__(self, vectors: np.ndarray, meta: list[dict]):
        assert len(vectors) == len(meta), "向量数和元数据条数必须一致"
        self.vectors = vectors
        self.meta = meta

    def __len__(self) -> int:
        return len(self.meta)

    def search(self, query_vec: np.ndarray, top_k: int = 5) -> list[dict]:
        """返回 [{score, text, source, heading, id}, ...]，按分数降序。

        向量已归一化，所以点积 = 余弦相似度。
        """
        if not len(self.meta):
            return []

        scores = self.vectors @ query_vec.astype(np.float32)
        k = min(top_k, len(scores))

        # argpartition 取 top-k 是 O(n)，比全排序快；取完再对这 k 个排序
        idx = np.argpartition(-scores, k - 1)[:k]
        idx = idx[np.argsort(-scores[idx])]

        return [{**self.meta[i], "score": float(scores[i])} for i in idx]

    # ── 持久化 ─────────────────────────────────────────
    def save(self, index_dir: Path, manifest: dict | None = None) -> None:
        index_dir.mkdir(parents=True, exist_ok=True)
        np.save(index_dir / VECTORS_FILE, self.vectors)
        with (index_dir / META_FILE).open("w", encoding="utf-8") as f:
            for m in self.meta:
                f.write(json.dumps(m, ensure_ascii=False) + "\n")
        if manifest:
            (index_dir / MANIFEST_FILE).write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
            )

    @classmethod
    def load(cls, index_dir: Path) -> VectorStore:
        vectors = np.load(index_dir / VECTORS_FILE)
        meta = []
        with (index_dir / META_FILE).open(encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    meta.append(json.loads(line))
        return cls(vectors, meta)


def read_manifest(index_dir: Path) -> dict:
    """读索引的构建信息。

    用途：改了 CHUNK_SIZE 却忘了重建索引时，这里能看出来。
    建议每次跑 evaluate 都打印一次 chunk_size 和条数。
    """
    p = index_dir / MANIFEST_FILE
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))
