"""检索效果可视化：起一个只监听 127.0.0.1 的本地小服务。

    uv run --no-sync python scripts/serve_ui.py
    uv run --no-sync python scripts/serve_ui.py --port 9000

然后浏览器打开 http://127.0.0.1:8765 。

边界（别越线）：
- 只读 data/index/ 与 data/eval/queries.jsonl，**不建索引、不写数据、不碰生成层**。
  这个页面看的是检索层召回效果，不是答案正确率（见 docs/evaluation.md §2）。
- 索引**懒加载 + 按 manifest.json 的 mtime 热重载**：ingest.py 还在跑时也能先起服务，
  索引一写好就自动可用；重建索引后不用重启服务。
- 只用标准库，不往 pyproject.toml 加依赖。
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from notes_rag.config import load_config  # noqa: E402
from notes_rag.embedder import Embedder  # noqa: E402
from notes_rag.retriever import Retriever  # noqa: E402
from notes_rag.store import VectorStore, read_manifest  # noqa: E402

HTML_FILE = ROOT / "web" / "index.html"
QUERIES_FILE = ROOT / "data" / "eval" / "queries.jsonl"


class SearchEngine:
    """持有 embedding 模型与索引；索引就绪前不加载模型，省一次冷启动。"""

    def __init__(self) -> None:
        self.cfg = load_config()
        self._lock = threading.Lock()
        self._embedder: Embedder | None = None
        self._store: VectorStore | None = None
        self._manifest: dict = {}
        self._index_stamp: float | None = None
        self._queries_rows: list[dict] = []
        self._queries_stamp: float | None = None
        self.corpus_files = len(list(self.cfg.corpus_dir.rglob("*.md")))

    def _stamp(self) -> float | None:
        try:
            return (self.cfg.index_dir / "manifest.json").stat().st_mtime
        except FileNotFoundError:
            return None

    def _ensure_index(self) -> str | None:
        """返回 None 表示索引可用，否则返回给页面看的错误文案。"""
        stamp = self._stamp()
        if stamp is None:
            return "索引还没建好：data/index/manifest.json 不存在，等 ingest.py 跑完即可"
        if self._store is not None and self._index_stamp == stamp:
            return None
        # ingest.py 是先写 vectors.npy / meta.jsonl、最后写 manifest.json，
        # 理论上不会读到半成品；仍然兜住，避免构建中途刷新页面看到栈回溯。
        try:
            store = VectorStore.load(self.cfg.index_dir)
            manifest = read_manifest(self.cfg.index_dir)
        except (OSError, ValueError, EOFError) as exc:
            return f"索引正在写入或已损坏，稍后刷新重试（{exc}）"
        with self._lock:
            self._store = store
            self._manifest = manifest
            self._index_stamp = stamp
        return None

    def queries(self) -> list[dict]:
        """评估集，按 mtime 缓存；页面拿它当示例问题，也拿它做命中判定。"""
        try:
            stamp = QUERIES_FILE.stat().st_mtime
        except FileNotFoundError:
            return []
        if self._queries_stamp != stamp:
            rows = []
            for line in QUERIES_FILE.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    row = json.loads(line)
                    rows.append({"query": row["query"], "expected": row.get("expected") or []})
            self._queries_rows, self._queries_stamp = rows, stamp
        return self._queries_rows

    def meta(self) -> dict:
        err = self._ensure_index()
        return {
            "ok": True,
            "ready": err is None,
            "error": err,
            "manifest": self._manifest,
            "corpus_files": self.corpus_files,
            "strategy": self.cfg.chunk_strategy,
            "chunk_size": self.cfg.chunk_size,
            "embed_model": self.cfg.embed_model,
            "llm_enabled": bool(self.cfg.llm_api_key),
            "eval_count": len(self.queries()),
        }

    def search(self, query: str, top_k: int) -> dict:
        err = self._ensure_index()
        if err:
            return {"ok": False, "error": err}
        query = query.strip()
        if not query:
            return {"ok": False, "error": "问题不能为空"}

        if self._embedder is None:
            with self._lock:
                if self._embedder is None:
                    self._embedder = Embedder(self.cfg.embed_model)

        top_k = max(1, min(50, top_k))
        t0 = time.perf_counter()
        with self._lock:  # sentence-transformers 的 encode 不保证线程安全，串行化
            hits = Retriever(self._embedder, self._store).search(query, top_k=top_k)
        elapsed_ms = (time.perf_counter() - t0) * 1000

        lookup = {r["query"].strip(): r["expected"] for r in self.queries()}
        expected = lookup.get(query)
        sources = [h["source"] for h in hits]
        rank = next(
            (i + 1 for i, s in enumerate(sources) if expected is not None and s in expected),
            None,
        )

        return {
            "ok": True,
            "query": query,
            "top_k": top_k,
            "elapsed_ms": round(elapsed_ms, 1),
            "hits": [
                {
                    "rank": i + 1,
                    "score": round(float(h["score"]), 4),
                    "source": h["source"],
                    "heading": h.get("heading") or "",
                    "text": h["text"],
                }
                for i, h in enumerate(hits)
            ],
            # 只有「问题正好在评估集里」才带 eval，避免把随手一问误标成未命中
            "eval": None
            if expected is None
            else {"expected": expected, "rank": rank, "hit": rank is not None},
        }


class Handler(BaseHTTPRequestHandler):
    engine: SearchEngine

    def log_message(self, fmt: str, *args: object) -> None:
        # 默认日志会把每条请求打到 stderr，本地工具保持安静
        return

    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj: dict, code: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self._send(code, body, "application/json; charset=utf-8")

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        if parsed.path in ("/", "/index.html"):
            if not HTML_FILE.exists():
                self._json({"ok": False, "error": f"页面文件缺失：{HTML_FILE}"}, 500)
                return
            self._send(200, HTML_FILE.read_bytes(), "text/html; charset=utf-8")
        elif parsed.path == "/api/meta":
            self._json(self.engine.meta())
        elif parsed.path == "/api/queries":
            self._json({"ok": True, "rows": self.engine.queries()})
        elif parsed.path == "/api/search":
            q = qs.get("q", [""])[0]
            try:
                top_k = int(qs.get("top_k", ["5"])[0])
            except ValueError:
                self._json({"ok": False, "error": "top_k 必须是整数"}, 400)
                return
            try:
                self._json(self.engine.search(q, top_k))
            except Exception as exc:  # 页面要看到原因，而不是连接被重置
                self._json({"ok": False, "error": f"{type(exc).__name__}: {exc}"}, 500)
        else:
            self._json({"ok": False, "error": f"未知路径 {parsed.path}"}, 404)


def main() -> None:
    parser = argparse.ArgumentParser(description="启动检索效果可视化页面")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    engine = SearchEngine()
    Handler.engine = engine
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    meta = engine.meta()
    print(f"页面：http://{args.host}:{args.port}", flush=True)
    print(f"索引：{'就绪' if meta['ready'] else meta['error']}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
