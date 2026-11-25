import asyncio
import json
from pathlib import Path

from app.adapters.fake import DEMO_INTERVIEW_ID, FakeLLMProvider, call, demo_script
from app.adapters.openai_compat import parse_response, serialize_messages
from app.capabilities.agent.loop import AgentLoop, AgentResult
from app.capabilities.llm.contracts import ChatMessage, ChatResponse, ToolCall
from app.capabilities.tools.interview_tools import build_interview_tools
from app.capabilities.tools.registry import ToolRegistry
from app.features.review.prompt import REVIEW_SYSTEM_PROMPT

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "fake"
TASK = "帮我复盘 itv_20261118_01 这场面试：哪些题答得弱？"


def _registry() -> ToolRegistry:
    registry = ToolRegistry()
    for tool in build_interview_tools(DATA_DIR):
        registry.register(tool)
    return registry


def _run(script: list[ChatResponse], **kwargs) -> AgentResult:
    loop = AgentLoop(
        provider=FakeLLMProvider(script),
        registry=_registry(),
        system_prompt=REVIEW_SYSTEM_PROMPT,
        **kwargs,
    )
    return asyncio.run(loop.run(TASK))


def test_demo_chain_runs_offline() -> None:
    result = _run(demo_script())
    assert result.stop_reason == "answer"
    assert result.rounds == 4
    assert [step.tool for step in result.steps] == [
        "get_interview_record",
        "search_question_bank",
        "generate_improvement",
    ]
    assert result.failed_calls == 0
    assert "下周" in result.answer


def test_repeat_call_is_blocked_then_stops() -> None:
    same = {"interview_id": DEMO_INTERVIEW_ID}
    script = [call(f"c{i}", "get_interview_record", same) for i in range(1, 5)]
    result = _run(script, max_rounds=5, max_repeats=2)
    assert result.stop_reason == "repeat_guard"
    assert [step.blocked for step in result.steps] == [False, False, True, True]
    assert result.steps[1].ok is True
    assert "repeat_call" in result.steps[2].output
    assert "反复" in result.answer


def test_unknown_tool_error_is_fed_back_and_model_recovers() -> None:
    script = [
        call("c1", "get_interview_record_v2", {"interview_id": DEMO_INTERVIEW_ID}),
        call("c2", "get_interview_record", {"interview_id": DEMO_INTERVIEW_ID}),
        ChatResponse(content="已拿到记录。"),
    ]
    result = _run(script)
    assert result.steps[0].ok is False
    assert "unknown_tool" in result.steps[0].output
    assert "get_interview_record" in result.steps[0].output
    assert result.steps[1].ok is True
    assert result.stop_reason == "answer"


def test_missing_param_is_reported_with_type_hint() -> None:
    result = _run([call("c1", "get_interview_record", {}), ChatResponse(content="好的")])
    assert result.steps[0].ok is False
    assert "missing_param" in result.steps[0].output
    assert "interview_id" in result.steps[0].output


def test_max_rounds_degrades_with_partial_info() -> None:
    result = _run(demo_script()[:2], max_rounds=2)
    assert result.stop_reason == "max_rounds"
    assert "轮次上限" in result.answer
    assert "不完整" in result.answer
    assert "get_interview_record" in result.answer


def test_empty_search_result_is_annotated() -> None:
    ok, output = asyncio.run(
        _registry().invoke("search_question_bank", {"tags": ["不存在的标签"], "difficulty": "any"})
    )
    assert ok is True
    assert "无记录" in output and "不要用相同参数重复查询" in output


def test_assistant_tool_calls_serialize_in_openai_shape() -> None:
    args = {"interview_id": DEMO_INTERVIEW_ID}
    messages = [
        ChatMessage(
            role="assistant",
            tool_calls=[
                ToolCall(
                    id="c1",
                    name="get_interview_record",
                    arguments=args,
                    arguments_raw=json.dumps(args, ensure_ascii=False),
                )
            ],
        ),
        ChatMessage(role="tool", content="{}", tool_call_id="c1", name="get_interview_record"),
    ]
    out = serialize_messages(messages)
    assert out[0]["tool_calls"][0]["type"] == "function"
    assert json.loads(out[0]["tool_calls"][0]["function"]["arguments"]) == args
    assert out[1]["tool_call_id"] == "c1"


def test_bad_json_arguments_survive_as_empty_dict() -> None:
    data = {
        "choices": [
            {
                "message": {
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "c1",
                            "function": {"name": "get_interview_record", "arguments": "{bad"},
                        }
                    ],
                }
            }
        ]
    }
    resp = parse_response(data)
    assert resp.tool_calls[0].arguments == {}
    assert resp.tool_calls[0].arguments_raw == "{bad"
