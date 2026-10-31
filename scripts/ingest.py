"""建索引：扫 md → 切分 → 向量化 → 存盘 / 入库。

    python scripts/ingest.py                     # 存成 numpy 文件（默认）
    python scripts/ingest.py --backend pg        # 写进 pgvector
    python scripts/ingest.py --backend pg --index ivfflat --lists 100

跑完会打印一组统计（文件数 / 块数 / 平均块长 / 耗时 / 建索引耗时），
全部记进 `llm-learning/实验台账.md` 第 1 节——它们是后面所有对比的基线。

⚠️ 每次改 chunker.py 或 CHUNK_SIZE，都要重跑，否则 evaluate.py 量的是旧索引
（cli.py 会检测并警告）。
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from tqdm import tqdm  # noqa: E402

from notes_rag.chunker import chunk_file  # noqa: E402
from notes_rag.config import load_config  # noqa: E402
from notes_rag.embedder import Embedder  # noqa: E402
from notes_rag.store import VectorStore  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="建索引")
    parser.add_argument("--backend", choices=["numpy", "pg"], default="numpy")
    parser.add_argument("--index", choices=["hnsw", "ivfflat"], default="hnsw", help="仅 pg 后端")
    parser.add_argument("--lists", type=int, default=100, help="IVFFlat 的 lists，仅 pg 后端")
    args = parser.parse_args()

    cfg = load_config()

    if not cfg.corpus_dir.exists():
        raise SystemExit(f"语料目录不存在：{cfg.corpus_dir}")

    files = sorted(cfg.corpus_dir.rglob("*.md"))
    if not files:
        raise SystemExit(f"{cfg.corpus_dir} 下没有 md 文件")

    print(f"语料：{len(files)} 篇　切分：size={cfg.chunk_size} overlap={cfg.chunk_overlap}")

    t0 = time.perf_counter()
    chunks = []
    for f in tqdm(files, desc="切分", unit="篇"):
        chunks.extend(chunk_file(f, cfg.corpus_dir, cfg.chunk_size, cfg.chunk_overlap))
    t_chunk = time.perf_counter() - t0

    if not chunks:
        raise SystemExit("切完是空的，检查 chunker.py")

    total_chars = sum(len(c.text) for c in chunks)
    print(
        f"切分完成：{len(chunks)} 块　平均 {total_chars // len(chunks)} 字/块　耗时 {t_chunk:.1f}s"
    )

    print(f"向量化（{cfg.embed_model}）...")
    t1 = time.perf_counter()
    embedder = Embedder(cfg.embed_model)
    vectors = embedder.encode([c.text for c in chunks], show_progress=True)
    t_embed = time.perf_counter() - t1
    print(f"向量化完成：{vectors.shape}　耗时 {t_embed:.1f}s")

    meta = [{"id": c.id, "text": c.text, "source": c.source, "heading": c.heading} for c in chunks]
    manifest = {
        "files": len(files),
        "chunks": len(chunks),
        "avg_chars": total_chars // len(chunks),
        "chunk_size": cfg.chunk_size,
        "chunk_overlap": cfg.chunk_overlap,
        "embed_model": cfg.embed_model,
        "dim": embedder.dim,
        "built_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    if args.backend == "pg":
        from notes_rag.store_pg import PgVectorStore

        store = PgVectorStore(cfg.database_url)
        print(f"写入 pgvector（{store.dsn.split('@')[-1]}）...")
        store.reset(embedder.dim)
        t_insert = store.insert(meta, vectors)
        print(f"写入完成：{t_insert:.1f}s")

        t_index = store.build_index(args.index, lists=args.lists)
        print(f"建 {args.index.upper()} 索引：{t_index:.1f}s")

        print(
            f"\n✅ 已写入 PostgreSQL：{store.count()} 行\n"
            f"   把这两个数字记进台账：写入 {t_insert:.1f}s　建索引 {t_index:.1f}s\n"
            f"   下一步：python scripts/evaluate.py --backend pg"
        )
        store.close()
    else:
        store = VectorStore(vectors, meta)
        store.save(cfg.index_dir, manifest)
        print(
            f"\n✅ 索引已写入 {cfg.index_dir}\n"
            f"   {len(chunks)} 块 × {embedder.dim} 维\n"
            f"   下一步：python -m notes_rag.cli \"你的问题\""
        )


if __name__ == "__main__":
    main()
