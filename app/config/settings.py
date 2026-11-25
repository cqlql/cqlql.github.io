"""配置只从环境变量读；跑过什么参数，git 历史里说得清。

上限类参数（max_rounds / max_repeats / total_timeout）没有代码内默认之外的兜底：
.env 里改了就是改了，循环里不许再写死一遍。
"""

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    provider: str
    data_dir: Path
    max_rounds: int
    max_repeats: int
    total_timeout: float
    doubao_base_url: str
    doubao_model: str
    doubao_api_key: str
    doubao_timeout: float
    vllm_base_url: str
    vllm_model: str
    vllm_api_key: str
    vllm_timeout: float


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    return int(raw) if raw else default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    return float(raw) if raw else default


def load_settings() -> Settings:
    return Settings(
        provider=os.getenv("LLM_PROVIDER", "fake").strip().lower(),
        data_dir=Path(os.getenv("DATA_DIR") or ROOT / "data" / "fake"),
        max_rounds=_env_int("AGENT_MAX_ROUNDS", 5),
        max_repeats=_env_int("AGENT_MAX_REPEATS", 2),
        total_timeout=_env_float("AGENT_TOTAL_TIMEOUT", 60.0),
        doubao_base_url=os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
        doubao_model=os.getenv("DOUBAO_MODEL", "deepseek-v4-1-flash-260910"),
        doubao_api_key=os.getenv("DOUBAO_API_KEY", ""),
        doubao_timeout=_env_float("DOUBAO_TIMEOUT", 120.0),
        vllm_base_url=os.getenv("VLLM_BASE_URL", "http://127.0.0.1:8000/v1"),
        vllm_model=os.getenv("VLLM_MODEL", "Qwen3.5-4B"),
        vllm_api_key=os.getenv("VLLM_API_KEY", "EMPTY"),
        vllm_timeout=_env_float("VLLM_TIMEOUT", 120.0),
    )
