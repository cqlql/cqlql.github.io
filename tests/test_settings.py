"""`.env` 读取：改一行 LLM_PROVIDER 必须真的生效，且不许盖掉 shell 里已有的值。"""

import os
from pathlib import Path

import pytest

from app.config.settings import _load_env_file


@pytest.fixture(autouse=True)
def _restore_environ():
    """setdefault 新建的键不在 monkeypatch 的还原范围内，整份环境自己兜。"""
    saved = dict(os.environ)
    yield
    os.environ.clear()
    os.environ.update(saved)


def test_env_file_is_read(tmp_path: Path) -> None:
    os.environ.pop("LLM_PROVIDER", None)
    os.environ.pop("DOUBAO_API_KEY", None)
    env = tmp_path / ".env"
    env.write_text(
        "\ufeff# 注释行不算配置\nexport LLM_PROVIDER=doubao\nDOUBAO_API_KEY=\"sk-test\"\n\n",
        encoding="utf-8",
    )

    _load_env_file(env)

    assert os.environ["LLM_PROVIDER"] == "doubao"
    assert os.environ["DOUBAO_API_KEY"] == "sk-test"


def test_shell_env_wins(tmp_path: Path) -> None:
    os.environ["LLM_PROVIDER"] = "vllm"
    env = tmp_path / ".env"
    env.write_text("LLM_PROVIDER=doubao\n", encoding="utf-8")

    _load_env_file(env)

    assert os.environ["LLM_PROVIDER"] == "vllm"


def test_missing_env_file_is_noop(tmp_path: Path) -> None:
    _load_env_file(tmp_path / ".env")

    assert "LLM_PROVIDER" not in os.environ
