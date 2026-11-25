"""依赖装配：唯一 import adapters 的地方。

features / capabilities 不许直接连供应商；provider 只在这里构造并注入循环。
"""

from app.adapters.fake import FakeLLMProvider
from app.adapters.openai_compat import OpenAICompatProvider
from app.capabilities.agent.loop import AgentLoop
from app.capabilities.llm.contracts import ChatResponse, LLMProvider
from app.capabilities.tools.interview_tools import build_interview_tools
from app.capabilities.tools.registry import ToolRegistry
from app.config.settings import Settings
from app.features.review.prompt import REVIEW_SYSTEM_PROMPT


def build_provider(settings: Settings, script: list[ChatResponse] | None = None) -> LLMProvider:
    if settings.provider == "fake":
        if not script:
            raise ValueError("fake provider 需要一份脚本；CLI 会用 demo_script 生成")
        return FakeLLMProvider(script)
    if settings.provider == "doubao":
        return OpenAICompatProvider(
            base_url=settings.doubao_base_url,
            model=settings.doubao_model,
            api_key=settings.doubao_api_key,
            timeout=settings.doubao_timeout,
            vendor="doubao",
        )
    if settings.provider == "vllm":
        return OpenAICompatProvider(
            base_url=settings.vllm_base_url,
            model=settings.vllm_model,
            api_key=settings.vllm_api_key,
            timeout=settings.vllm_timeout,
            vendor="vllm",
        )
    raise ValueError(f"未知 LLM_PROVIDER：{settings.provider}（可选 fake / doubao / vllm）")


def build_registry(settings: Settings) -> ToolRegistry:
    registry = ToolRegistry()
    for tool in build_interview_tools(settings.data_dir):
        registry.register(tool)
    return registry


def build_agent(settings: Settings, provider: LLMProvider) -> AgentLoop:
    return AgentLoop(
        provider=provider,
        registry=build_registry(settings),
        system_prompt=REVIEW_SYSTEM_PROMPT,
        max_rounds=settings.max_rounds,
        max_repeats=settings.max_repeats,
        total_timeout=settings.total_timeout,
    )
