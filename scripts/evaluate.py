"""评估：算 recall@k 和 MRR。**这是所有数字的来源。**

    python scripts/evaluate.py            # 用 .env 里的 TOP_K
    python scripts/evaluate.py --top-k 10

评估集格式（data/eval/queries.jsonl，一行一条 JSON）：

    {"query": "rerank 为什么要对 top-20 做", "expected": ["ai/框架与协议.md"]}

- `expected` 是相对 CORPUS_DIR 的路径，一个问题在多个文件都有答案时写多个
- 判定方式：检索结果里只要有一条的 source 在 expected 里，就算命中
- 标注原则：**按「你会怎么问」写 query，不要按「文档怎么写」写**。
  前者才是真实场景，后者会让数字虚高

标 50 条大概要 1 小时。这 1 小时是后面所有优化对比的前提，值得。
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from notes_rag.config import ROOT, load_config  # noqa: E402
from notes_rag.embedder import Embedder  # noqa: E402
from notes_rag.retriever import build_retriever  # noqa: E402
from notes_rag.store import open_store, read_manifest  # noqa: E402

QUERIES_FILE = ROOT / "data" / "eval" / "queries.jsonl"


def main() -> None:
    parser = argparse.ArgumentParser(description="评估检索质量")
    parser.add_argument("--top-k", type=int, default=None)
    parser.add_argument("--backend", choices=["numpy", "pg"], default="numpy")
    parser.add_argument("--max-miss", type=int, default=10, help="最多打印几条未命中")
    args = parser.parse_args()

    cfg = load_config()
    k = args.top_k or cfg.top_k

    if not QUERIES_FILE.exists():
        raise SystemExit(
            f"评估集不存在：{QUERIES_FILE}\n"
            "先复制 queries.example.jsonl 为 queries.jsonl，然后标 50 条。"
        )

    rows = [
        json.loads(line)
        for line in QUERIES_FILE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if not rows:
        raise SystemExit("评估集是空的")

    if args.backend == "numpy":
        manifest = read_manifest(cfg.index_dir)
        print(
            f"索引：{manifest.get('chunks', '?')} 块　chunk_size={manifest.get('chunk_size', '?')}"
            f"　strategy={manifest.get('chunk_strategy', 'fixed')}"
            f"　merge_min_chars={manifest.get('merge_min_chars', 0)}"
            f"　建于 {manifest.get('built_at', '?')}"
        )
    else:
        print("索引：PostgreSQL（pgvector）")

    # 语料会变（笔记搬迁 / 删除），评估集不会自动跟着变：expected 失效的必须显式报出来，
    # 否则 recall 天花板悄悄变成 (50-N)/50，还以为是自己改坏了
    expired = [
        r
        for r in rows
        if not any((cfg.corpus_dir / e).exists() for e in (r.get("expected") or []))
    ]
    if expired:
        print(
            f"⚠️  {len(expired)} 条 query 的 expected 在语料里全部不存在（评估集没跟上语料变更）："
        )
        for r in expired[:5]:
            print(f"    ✗ {r['query']}")
        print(
            f"   recall@{k} 的理论上限 = {(len(rows) - len(expired)) / len(rows):.3f}"
            f"；这 {len(expired)} 条要人工重标或删除，别拿原始 recall 直接和历史数字比。\n"
        )
    print(f"后端：{args.backend}　评估：{len(rows)} 条　top_k={k}")
    if cfg.rerank_enabled:
        print(
            f"rerank：开　粗召回 top-{cfg.rerank_top_n} → 精排取 top-{k}"
            f"　模型 {cfg.rerank_model}"
        )
    else:
        print("rerank：关　纯向量 top-k")
    print()

    embedder = Embedder(cfg.embed_model)
    store = open_store(args.backend, cfg)
    retriever = build_retriever(embedder, store, cfg)

    hit_count = 0
    mrr_sum = 0.0
    latencies: list[float] = []
    misses: list[dict] = []

    for r in rows:
        t = time.perf_counter()
        hits = retriever.search(r["query"], top_k=k)
        latencies.append((time.perf_counter() - t) * 1000)

        sources = [h["source"] for h in hits]
        expected = set(r.get("expected") or [])
        rank = next((i + 1 for i, s in enumerate(sources) if s in expected), None)

        if rank:
            hit_count += 1
            mrr_sum += 1.0 / rank
        else:
            misses.append({"query": r["query"], "expected": sorted(expected), "got": sources[:3]})

    recall = hit_count / len(rows)
    mrr = mrr_sum / len(rows)
    avg_ms = sum(latencies) / len(latencies)
    p95 = sorted(latencies)[int(len(latencies) * 0.95) - 1] if latencies else 0

    print("─" * 56)
    print(f"  命中        {hit_count} / {len(rows)}")
    print(f"  recall@{k}    {recall:.3f}")
    print(f"  MRR         {mrr:.3f}")
    print(f"  检索耗时    平均 {avg_ms:.0f}ms　P95 {p95:.0f}ms")
    print("─" * 56)

    if misses:
        print(f"\n未命中 {len(misses)} 条（前 {min(len(misses), args.max_miss)} 条）：")
        for m in misses[: args.max_miss]:
            print(f"\n  ✗ {m['query']}")
            print(f"    期望：{', '.join(m['expected']) or '（没标 expected）'}")
            print(f"    实际：{', '.join(m['got'])}")

        print(
            "\n这些是「召回失败案例」，逐条分析原因（切分切断 / 表述差异 / 关键词漏召），"
            "\n填进 `learning/实验台账.md`。面试问「遇到过什么问题」，答案在这。"
        )

    print(f"\n把上面三个数字抄进 `learning/实验台账.md`（recall@{k} = {recall:.3f}）")


if __name__ == "__main__":
    main()
