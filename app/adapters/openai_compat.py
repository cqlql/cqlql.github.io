"""OpenAI 兼容 provider：豆包（火山方舟）与本地 vLLM 共用。

两边请求体一致，只差三件事：base_url / 模型名 / 思考开关的键名。
其余（tools、tool_calls、消息序列化）完全按 OpenAI 规范，一个 class 就够。
"""

import json
import logging

import httpx

from app.capabilities.llm.contracts import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    LLMProvider,
    ToolCall,
)

logger = logging.getLogger(__name__)


def serialize_messages(messages: list[ChatMessage]) -> list[dict]:
    out: list[dict] = []
    for msg in messages:
        if msg.role == "tool":
            out.append(
                {
                    "role": "tool",
                    "tool_call_id": msg.tool_call_id,
                    "content": msg.content,
                }
            )
        elif msg.role == "assistant" and msg.tool_calls:
            out.append(
                {
                    "role": "assistant",
                    "content": msg.content or None,
                    "tool_calls": [
                        {
                            "id": call.id,
                            "type": "function",
                            "function": {
                                "name": call.name,
                                "arguments": call.arguments_raw
                                or json.dumps(call.arguments, ensure_ascii=False),
                            },
                        }
                        for call in msg.tool_calls
                    ],
                }
            )
        else:
            out.append({"role": msg.role, "content": msg.content})
    return out


def parse_response(data: dict) -> ChatResponse:
    """把 OpenAI 兼容响应转成契约对象；坏 JSON 参数不抛，留给循环回填错误。"""
    message = data["choices"][0]["message"]
    content = message.get("content") or ""
    calls: list[ToolCall] = []
    for index, raw in enumerate(message.get("tool_calls") or []):
        fn = raw.get("function") or {}
        raw_arguments = fn.get("arguments")
        arguments: dict = {}
        if isinstance(raw_arguments, str):
            arguments_raw = raw_arguments
            try:
                parsed = json.loads(raw_arguments)
            except json.JSONDecodeError:
                parsed = {}
        else:
            parsed = raw_arguments
            if isinstance(parsed, dict):
                arguments_raw = json.dumps(parsed, ensure_ascii=False)
            else:
                arguments_raw = ""
        if isinstance(parsed, dict):
            arguments = parsed
        calls.append(
            ToolCall(
                id=raw.get("id") or f"call_{index}",
                name=fn.get("name") or "",
                arguments=arguments,
                arguments_raw=arguments_raw,
            )
        )
    return ChatResponse(content=content, tool_calls=calls, raw=data)


class OpenAICompatProvider(LLMProvider):
    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str = "",
        timeout: float = 120.0,
        vendor: str = "vllm",
        thinking: bool = False,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._api_key = api_key
        self._vendor = vendor
        self._thinking = thinking
        self._client = client or httpx.AsyncClient(timeout=timeout)

    def _thinking_payload(self) -> dict:
        # 两个供应商的键名不同：vLLM 走 chat_template_kwargs，豆包走 thinking.type。
        # 上层只表达「开不开」，翻译在这里做，别扩散到循环里。
        if self._vendor == "doubao":
            return {"thinking": {"type": "enabled" if self._thinking else "disabled"}}
        return {"chat_template_kwargs": {"enable_thinking": self._thinking}}

    async def chat(self, req: ChatRequest) -> ChatResponse:
        payload: dict = {
            "model": req.model or self._model,
            "messages": serialize_messages(req.messages),
            "temperature": req.temperature,
        }
        if req.tools:
            payload["tools"] = req.tools
            payload["tool_choice"] = "auto"
        payload.update(self._thinking_payload())

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        url = f"{self._base_url}/chat/completions"
        try:
            resp = await self._client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as err:
            # ReadTimeout / ConnectError 的 str() 常是空串，不补类型名等于没有错误信息
            logger.error("%s 请求失败（%s）: %s", self._vendor, type(err).__name__, err)
            raise RuntimeError(f"{self._vendor} 请求失败（{type(err).__name__}）: {err}") from err
        except ValueError as err:
            logger.error("%s 返回非 JSON: %s", self._vendor, err)
            raise RuntimeError(f"{self._vendor} 返回解析失败: {err}") from err

        try:
            return parse_response(data)
        except (KeyError, IndexError, TypeError) as err:
            logger.error("%s 返回结构异常: %s", self._vendor, data)
            raise RuntimeError(f"{self._vendor} 返回结构异常") from err

    async def aclose(self) -> None:
        await self._client.aclose()
