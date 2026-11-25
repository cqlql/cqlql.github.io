"""LLM 能力契约：与供应商无关的消息 / 工具调用结构。

adapters 实现 LLMProvider，capabilities 与 features 只依赖本契约，不碰 httpx。
"""

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass
class ToolCall:
    """模型请求的一次工具调用。

    arguments 已解析成 dict（循环里直接当 kwargs 用）；
    arguments_raw 保留原始 JSON 字符串 —— 模型偶尔吐坏 JSON，回填错误时要能说清是哪个参数。
    """

    id: str
    name: str
    arguments: dict
    arguments_raw: str = ""


@dataclass
class ChatMessage:
    """一条对话消息。四种 role 各有专属字段：

    - system / user：只有 content
    - assistant：content 可为空；tool_calls 非空表示这一轮是「想调工具」而不是给结论
    - tool：必须带 tool_call_id，content 是工具执行结果（含错误）
    """

    role: str
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_call_id: str | None = None
    name: str | None = None


@dataclass
class ChatRequest:
    messages: list[ChatMessage]
    tools: list[dict] | None = None
    temperature: float = 0.0
    model: str | None = None


@dataclass
class ChatResponse:
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw: dict = field(default_factory=dict)


@runtime_checkable
class LLMProvider(Protocol):
    """LLM 供应商协议 —— adapters/fake 实现它，agent 循环消费它。"""

    async def chat(self, req: ChatRequest) -> ChatResponse: ...
