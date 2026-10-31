"""命令行问答。

用法：
    python -m notes_rag.cli "rerank 为什么要对 top-20 做"
    python -m notes_rag.cli "问题" --top-k 8 --show-chunks
"""

from __future__ import annotations

import argparse
import time

from .config import load_config
from .embedder import Embedder
from .generator import answer
from .retriever import Retriever
from .store import open_store, read_manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="笔记站语义问答")
    parser.add_argument("question", help="你的问题")
    parser.add_argument("--top-k", type=int, default=None, help="检索几条（默认取 .env 的 TOP_K）")
    parser.add_argument("--backend", choices=["numpy", "pg"], default="numpy")
    parser.add_argument("--show-chunks", action="store_true", help="打印命中的原文片段")
    args = parser.parse_args()

    cfg = load_config()

    t0 = time.perf_counter()
    embedder = Embedder(cfg.embed_model)
    store = open_store(args.backend, cfg)
    retriever = Retriever(embedder, store)
    t_load = time.perf_counter() - t0

    if args.backend == "numpy":
        manifest = read_manifest(cfg.index_dir)
        if manifest.get("chunk_size") and manifest["chunk_size"] != cfg.chunk_size:
            print(
                f"⚠️  索引是用 chunk_size={manifest['chunk_size']} 建的，"
                f"当前配置是 {cfg.chunk_size}。改了切分要重跑 ingest.py。\n"
            )

    t1 = time.perf_counter()
    hits = retriever.search(args.question, top_k=args.top_k or cfg.top_k)
    t_search = (time.perf_counter() - t1) * 1000

    print(f"\n问题：{args.question}\n")

    if args.show_chunks:
        for i, h in enumerate(hits, 1):
            print(f"[{i}] {h['score']:.4f}  {h['source']}")
            print(f"    {h['text'][:120].replace(chr(10), ' ')}...")
        print()

    t2 = time.perf_counter()
    reply = answer(args.question, hits, cfg)
    t_gen = (time.perf_counter() - t2) * 1000

    print(reply)
    print("\n来源：")
    for i, h in enumerate(hits, 1):
        print(f"  [{i}] {h['source']}  ·  相似度 {h['score']:.3f}")

    print(
        f"\n耗时：加载 {t_load:.1f}s · 检索 {t_search:.0f}ms · 生成 {t_gen / 1000:.2f}s"
        f"　｜　索引 {len(store)} 块"
    )


if __name__ == "__main__":
    main()
