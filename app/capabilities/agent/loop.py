"""ReAct 循环：Thought（模型）-> Action（工具调用）-> Observation（回填）-> 下一轮。

四层硬约束全在代码里，不指望 prompt：
1. 最大轮次 max_rounds       —— 到顶就降级，不抛异常
2. 总超时 total_timeout      —— 整轮任务卡死时兜底
3. 重复调用 max_repeats      —— 同一 (tool, args) 先注入提示，再硬停
4. 错误回填                  —— 工具报错包装成可行动文本，让模型自己改参数

到上限的返回永远是「部分答案 + 缺什么」，不是 500。
"""

import asyncio
import json
import time
from dataclasses import dataclass, field

from app.capabilities.llm.contracts import ChatMessage, ChatRequest, LLMProvider, ToolCall
from app.capabilities.tools.registry import ToolRegistry


@dataclass
class Step:
    """一次工具调用（含被拦下的重复调用）"""

    round: int
    tool: str
    arguments: dict
    ok: bool
    output: str
    elapsed_ms: int
    blocked: bool = False


@dataclass
class AgentResult:
    answer: str
    rounds: int
    stop_reason: str
    steps: list[Step] = field(default_factory=list)
    elapsed_ms: int = 0

    @property
    def tool_calls(self) -> int:
        return sum(1 for step in self.steps if not step.blocked)

    @property
    def failed_calls(self) -> int:
        return sum(1 for step in self.steps if not step.blocked and not step.ok)


_STOP_TEXT = {
    "max_rounds": "已到轮次上限",
    "repeat_guard": "检测到反复用相同参数调用同一个工具，已停止",
    "timeout": "整轮任务超时，已停止",
    "provider_error": "模型服务调用失败",
}


class AgentLoop:
    def __init__(
        self,
        provider: LLMProvider,
        registry: ToolRegistry,
        system_prompt: str,
        max_rounds: int = 5,
        max_repeats: int = 2,
        total_timeout: float = 60.0,
    ) -> None:
        if max_rounds < 1:
            raise ValueError("max_rounds 至少为 1")
        self._provider = provider
        self._registry = registry
        self._system_prompt = system_prompt
        self._max_rounds = max_rounds
        self._max_repeats = max_repeats
        self._total_timeout = total_timeout

    async def run(self, task: str) -> AgentResult:
        started = time.perf_counter()
        messages = [
            ChatMessage(role="system", content=self._system_prompt),
            ChatMessage(role="user", content=task),
        ]
        steps: list[Step] = []
        attempts: dict[tuple[str, str], int] = {}
        rounds = 0
        stop_reason = "max_rounds"
        answer = ""

        try:
            async with asyncio.timeout(self._total_timeout):
                while rounds < self._max_rounds:
                    rounds += 1
                    resp = await self._provider.chat(
                        ChatRequest(messages=messages, tools=self._registry.schemas())
                    )
                    if not resp.tool_calls:
                        answer = resp.content.strip()
                        stop_reason = "answer"
                        break

                    messages.append(
                        ChatMessage(
                            role="assistant",
                            content=resp.content,
                            tool_calls=resp.tool_calls,
                        )
                    )

                    hit_guard = False
                    for call in resp.tool_calls:
                        step, should_stop = await self._execute(call, rounds, attempts)
                        steps.append(step)
                        if should_stop:
                            hit_guard = True
                            break
                        messages.append(
                            ChatMessage(
                                role="tool",
                                content=step.output,
                                tool_call_id=call.id,
                                name=call.name,
                            )
                        )
                    if hit_guard:
                        stop_reason = "repeat_guard"
                        break
        except TimeoutError:
            stop_reason = "timeout"
        except RuntimeError:
            stop_reason = "provider_error"

        if stop_reason != "answer":
            answer = self._degrade(stop_reason, steps)

        return AgentResult(
            answer=answer,
            rounds=rounds,
            stop_reason=stop_reason,
            steps=steps,
            elapsed_ms=int((time.perf_counter() - started) * 1000),
        )

    async def _execute(
        self,
        call: ToolCall,
        round_no: int,
        attempts: dict[tuple[str, str], int],
    ) -> tuple[Step, bool]:
        """返回 (这一步的记录, 是否该硬停)。"""
        key = (call.name, json.dumps(call.arguments, ensure_ascii=False, sort_keys=True))
        attempts[key] = attempts.get(key, 0) + 1
        count = attempts[key]
        started = time.perf_counter()

        if count > self._max_repeats:
            blocked = True
            if count > self._max_repeats + 1:
                output = "相同参数再次调用，触发硬停止"
                return (
                    Step(round_no, call.name, call.arguments, False, output, 0, True),
                    True,
                )
            output = json.dumps(
                {
                    "ok": False,
                    "error_type": "repeat_call",
                    "message": f"相同参数已调用 {self._max_repeats} 次",
                    "suggestion": "换参数、换工具，或直接基于已有结果回答，不要再重复调用",
                },
                ensure_ascii=False,
            )
            return Step(round_no, call.name, call.arguments, False, output, 0, blocked), False

        ok, output = await self._registry.invoke(call.name, call.arguments)
        elapsed = int((time.perf_counter() - started) * 1000)
        return Step(round_no, call.name, call.arguments, ok, output, elapsed), False

    def _degrade(self, stop_reason: str, steps: list[Step]) -> str:
        lines = [f"{_STOP_TEXT.get(stop_reason, stop_reason)}。以下是已查到的信息（不完整）："]
        for step in steps:
            if step.blocked or not step.ok:
                continue
            args = json.dumps(step.arguments, ensure_ascii=False)
            lines.append(f"- {step.tool}({args})：{_preview(step.output)}")
        if len(lines) == 1:
            lines.append("- （这一轮没有拿到任何工具结果）")
        lines.append("")
        lines.append("缺的部分需要你补充：确认面试 ID、换一个标签重试，或直接说清你关心的点。")
        return "\n".join(lines)


def _preview(text: str, limit: int = 80) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= limit else flat[:limit] + "…"
