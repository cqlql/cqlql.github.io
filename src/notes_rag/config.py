"""配置：全部从环境变量读，默认值只用于本地开发。

改参数不要改代码，改 .env —— 这样「跑过什么参数」在 git 历史里说得清。
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parents[2]


def _int(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Config:
    corpus_dir: Path
    index_dir: Path
    chunk_size: int
    chunk_overlap: int
    top_k: int
    rerank_top_n: int
    embed_model: str
    rerank_model: str
    llm_api_key: str
    llm_base_url: str
    llm_model: str
    database_url: str


def load_config() -> Config:
    corpus = os.getenv("CORPUS_DIR", "")
    if not corpus:
        raise SystemExit("没有配置 CORPUS_DIR，复制 .env.example 为 .env 并填写")

    return Config(
        corpus_dir=Path(corpus),
        index_dir=ROOT / "data" / "index",
        chunk_size=_int("CHUNK_SIZE", 512),
        chunk_overlap=_int("CHUNK_OVERLAP", 51),
        top_k=_int("TOP_K", 5),
        rerank_top_n=_int("RERANK_TOP_N", 20),
        embed_model=os.getenv("EMBED_MODEL", "BAAI/bge-m3"),
        rerank_model=os.getenv("RERANK_MODEL", "BAAI/bge-reranker-v2-m3"),
        llm_api_key=os.getenv("LLM_API_KEY", ""),
        llm_base_url=os.getenv("LLM_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
        llm_model=os.getenv("LLM_MODEL", "doubao-pro-32k"),
        database_url=os.getenv(
            "DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/notesrag"
        ),
    )
