"""命令行入口：python -m app "帮我复盘 itv_20261118_01"

默认 provider=fake，完全离线；换成 doubao / vllm 才需要密钥和本地服务。
"""

import argparse
import asyncio
import dataclasses
import json
import logging
import re
import sys

from app.adapters.fake import DEMO_INTERVIEW_ID, demo_script
from app.capabilities.agent.loop import Step
from app.config.container import build_agent, build_provider
from app.config.settings import load_settings

DEMO_TASK = "帮我复盘 itv_20261118_01 这场面试：哪些题答得弱，下周该怎么练？"
_ID_PATTERN = re.compile(r"itv_\d{8}_\d{2}")

_REASON_TEXT = {
    "answer": "正常结束",
    "max_rounds": "到轮次上限，已降级",
    "repeat_guard": "重复调用，已拦停",
    "timeout": "总超时，已降级",
    "provider_error": "模型服务失败，已降级",
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pass-up-agent",
        description="PassUp 面试复盘 Agent：查记录 -> 找同类题 -> 给改进计划",
    )
    parser.add_argument("task", nargs="?", default=DEMO_TASK, help="用户这句话")
    parser.add_argument("--provider", choices=["fake", "doubao", "vllm"])
    parser.add_argument("--max-rounds", type=int, help="覆盖 AGENT_MAX_ROUNDS，用来演示降级")
    parser.add_argument(
        "--show-full", action="store_true", help="打印工具结果全文，而不是 100 字预览"
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")

    settings = load_settings()
    overrides = {"provider": args.provider} if args.provider else {}
    if args.max_rounds:
        overrides["max_rounds"] = args.max_rounds
    if overrides:
        settings = dataclasses.replace(settings, **overrides)

    interview_id = _ID_PATTERN.search(args.task)
    if settings.provider == "fake":
        script = demo_script(
            interview_id.group(0) if interview_id else DEMO_INTERVIEW_ID,
        )
        if not interview_id:
            print(f"（问题里没有面试 ID，fake 演示用 {DEMO_INTERVIEW_ID}）")
        provider = build_provider(settings, script)
    else:
        provider = build_provider(settings)

    agent = build_agent(settings, provider)
    print(
        f"provider={settings.provider} · max_rounds={settings.max_rounds} · "
        f"max_repeats={settings.max_repeats} · timeout={settings.total_timeout:g}s"
    )
    print(f"问题：{args.task}\n")

    result = asyncio.run(agent.run(args.task))
    for step in result.steps:
        _print_step(step, args.show_full)

    print()
    print(
        f"回答 · {result.rounds} 轮 · {result.tool_calls} 次工具调用 · "
        f"失败 {result.failed_calls} · {result.elapsed_ms}ms · "
        f"{_REASON_TEXT.get(result.stop_reason)}"
    )
    print()
    print(result.answer)
    return 0


def _print_step(step: Step, show_full: bool) -> None:
    args = json.dumps(step.arguments, ensure_ascii=False)
    status = "blocked" if step.blocked else ("ok" if step.ok else "error")
    print(f"[{step.round}] {step.tool}({args})  {status}  {step.elapsed_ms}ms")
    print(f"    {step.output if show_full else _preview(step.output)}")


def _preview(text: str, limit: int = 100) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= limit else flat[:limit] + "…"


def _reason(code: str) -> str:
    return _REASON_TEXT.get(code, code)


if __name__ == "__main__":
    sys.exit(main())
