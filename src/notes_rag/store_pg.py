"""pgvector 存储 —— 和 store.py 的 numpy 版本同接口，用来做对比实验。

════════════════════════════════════════════════════════
这张表就是卡片 rag-04 的答案来源
════════════════════════════════════════════════════════

要量出三组数字，填进 `llm-learning/实验台账.md`：

| 后端 | 建索引耗时 | 查询 P95 | recall@5 |
|------|-----------|---------|----------|
| numpy 暴力 | 0（不用建） | ? | ? |
| pgvector + HNSW | ? | ? | ? |
| pgvector + IVFFlat | ? | ? | ? |

然后你就能回答面试官这几个问题（答案在你的数字里，不在文档里）：
- 「HNSW 和 IVFFlat 怎么选？」→ 看你的建索引耗时和查询延迟差多少
- 「ef_search 调大有什么代价？」→ 改 SET hnsw.ef_search，量 recall 和延迟的变化
- 「数据量小的时候需要向量库吗？」→ 你有对比数据，答得比「不需要」有底气

注意：`recall@5` 要拿 numpy 版的结果当基准来算，否则比的是两套评估标准。
实际做法是——两种后端各自跑 evaluate.py，比较谁的 recall@5 高、谁的延迟低。
"""

from __future__ import annotations

import time

import numpy as np
import psycopg


def _vec_literal(vec: np.ndarray) -> str:
    """把 numpy 向量转成 pgvector 认的字面量 '[0.1,0.2,...]'。"""
    return "[" + ",".join(f"{float(x):.6f}" for x in vec) + "]"


class PgVectorStore:
    def __init__(self, dsn: str):
        self.dsn = dsn
        self.conn = psycopg.connect(dsn, autocommit=True)
        self.conn.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── 建表与写入 ─────────────────────────────────────
    def reset(self, dim: int) -> None:
        """清空重来。换 embedding 模型或切分方式时必须重建。"""
        self.conn.execute("DROP TABLE IF EXISTS chunks")
        self.conn.execute(
            f"""
            CREATE TABLE chunks (
                id        text PRIMARY KEY,
                source    text NOT NULL,
                heading   text,
                text      text NOT NULL,
                embedding vector({dim}) NOT NULL
            )
            """
        )

    def insert(self, chunks: list[dict], vectors: np.ndarray, batch: int = 500) -> float:
        """批量写入，返回耗时（秒）。"""
        t0 = time.perf_counter()
        with self.conn.cursor() as cur:
            for i in range(0, len(chunks), batch):
                rows = [
                    (
                        c["id"],
                        c["source"],
                        c.get("heading") or "",
                        c["text"],
                        _vec_literal(vectors[j]),
                    )
                    for j, c in enumerate(chunks[i : i + batch], start=i)
                ]
                cur.executemany(
                    "INSERT INTO chunks (id, source, heading, text, embedding)"
                    " VALUES (%s, %s, %s, %s, %s::vector)",
                    rows,
                )
        return time.perf_counter() - t0

    # ── 索引：单独拆出来，就是为了能计时 ────────────────
    def drop_index(self) -> None:
        self.conn.execute("DROP INDEX IF EXISTS chunks_embedding_idx")

    def build_index(self, kind: str = "hnsw", lists: int = 100) -> float:
        """建索引，返回耗时（秒）。这是对比实验的核心数字。

        HNSW：图结构，查询快、召回高；建得慢、吃内存；支持增量写入
        IVFFlat：聚类，建得快、省内存；召回依赖数据分布；建议先有数据再建
        """
        self.drop_index()
        t0 = time.perf_counter()
        if kind == "hnsw":
            self.conn.execute(
                "CREATE INDEX chunks_embedding_idx ON chunks"
                " USING hnsw (embedding vector_cosine_ops)"
            )
        elif kind == "ivfflat":
            # lists 的经验值：行数 / 1000，小于 100 万时取 100 左右
            self.conn.execute(
                "CREATE INDEX chunks_embedding_idx ON chunks"
                f" USING ivfflat (embedding vector_cosine_ops) WITH (lists = {lists})"
            )
        else:
            raise ValueError(f"未知索引类型：{kind}")
        return time.perf_counter() - t0

    # ── 检索 ───────────────────────────────────────────
    def search(self, query_vec: np.ndarray, top_k: int = 5) -> list[dict]:
        """`<=>` 是余弦距离，1 - 距离 = 相似度，和 numpy 版的 score 口径一致。"""
        lit = _vec_literal(query_vec)
        rows = self.conn.execute(
            """
            SELECT id, source, heading, text, 1 - (embedding <=> %s::vector) AS score
            FROM chunks
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (lit, lit, top_k),
        ).fetchall()

        return [
            {"id": r[0], "source": r[1], "heading": r[2], "text": r[3], "score": float(r[4])}
            for r in rows
        ]

    def count(self) -> int:
        return int(self.conn.execute("SELECT count(*) FROM chunks").fetchone()[0])

    def __len__(self) -> int:
        return self.count()

    def set_ef_search(self, n: int) -> None:
        """HNSW 的查询期参数：越大越准、越慢。调它就能量出「准和快的取舍」。"""
        self.conn.execute(f"SET hnsw.ef_search = {int(n)}")

    def close(self) -> None:
        self.conn.close()
