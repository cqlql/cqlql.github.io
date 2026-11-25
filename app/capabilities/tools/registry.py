"""工具注册表：给模型看的定义（name / description / parameters）+ 给代码跑的调用。

模型选工具的唯一依据就是这三样，所以 description 是「给模型的 API 文档」，不是注释。
错误一律包装成 {ok: false, error_type, message, suggestion} 回填 —— 模型看不懂堆栈。
"""

import inspect
import json
import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

_JSON_TYPE: dict[str, type | tuple[type, ...]] = {
    "string": str,
    "integer": int,
    "number": (int, float),
    "boolean": bool,
    "array": list,
    "object": dict,
}


class ToolError(Exception):
    """可回填给模型的工具错误；原始异常只进日志，不给模型看堆栈。"""

    def __init__(self, error_type: str, message: str, suggestion: str = "") -> None:
        super().__init__(message)
        self.error_type = error_type
        self.message = message
        self.suggestion = suggestion

    def to_payload(self) -> str:
        return json.dumps(
            {
                "ok": False,
                "error_type": self.error_type,
                "message": self.message,
                "suggestion": self.suggestion,
            },
            ensure_ascii=False,
        )


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    handler: Callable[..., Any]

    def schema(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        if tool.name in self._tools:
            raise ValueError(f"工具重名：{tool.name}")
        self._tools[tool.name] = tool

    def schemas(self) -> list[dict]:
        return [tool.schema() for tool in self._tools.values()]

    async def invoke(self, name: str, arguments: dict) -> tuple[bool, str]:
        """返回 (ok, 回填给模型的文本)。参数错 / 工具不存在都不抛，一律包装回填。"""
        tool = self._tools.get(name)
        if tool is None:
            return False, ToolError(
                "unknown_tool",
                f"没有名为 {name} 的工具",
                f"可用工具：{', '.join(self._tools)}；只能从列表里选，不要自己造名字",
            ).to_payload()

        try:
            _validate(tool.parameters, arguments)
        except ToolError as err:
            return False, err.to_payload()

        try:
            result = tool.handler(**arguments)
            if inspect.isawaitable(result):
                result = await result
        except ToolError as err:
            return False, err.to_payload()
        except Exception:  # noqa: BLE001 - 任何未知异常都降级成可回填错误，堆栈只进日志
            logger.exception("工具 %s 执行失败", name)
            return False, ToolError(
                "internal_error",
                f"工具 {name} 执行失败",
                "换一个参数或另一个工具；相同参数不要重复调用",
            ).to_payload()

        return True, result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)


def _validate(schema: dict, arguments: dict) -> None:
    """只校验顶层字段：必填、类型、枚举、多余参数。数组元素等深层校验留给工具自己。"""
    properties: dict = schema.get("properties", {})
    for key in schema.get("required", []):
        if key not in arguments:
            raise ToolError(
                "missing_param",
                f"缺少必填参数 {key}",
                f"{key} 的取值：{_type_hint(properties.get(key, {}))}",
            )

    for key, value in arguments.items():
        spec = properties.get(key)
        if spec is None:
            raise ToolError(
                "unexpected_param",
                f"不接受参数 {key}",
                f"本工具只接受：{', '.join(properties) or '（无参数）'}",
            )
        expected = _JSON_TYPE.get(spec.get("type", ""))
        if expected is not None and not _is_type(value, expected):
            raise ToolError(
                "invalid_param_type",
                f"参数 {key} 应为 {spec.get('type')}，实际是 {type(value).__name__}",
                f"{key} 的取值：{_type_hint(spec)}",
            )
        if "enum" in spec and value not in spec["enum"]:
            raise ToolError(
                "invalid_param_value",
                f"参数 {key} 的取值 {value!r} 不在允许范围",
                f"可选：{' / '.join(str(v) for v in spec['enum'])}",
            )


def _is_type(value: Any, expected: type | tuple[type, ...]) -> bool:
    # bool 是 int 的子类，不能让 True 混过 integer 校验
    if expected is int and isinstance(value, bool):
        return False
    return isinstance(value, expected)


def _type_hint(spec: dict) -> str:
    if not spec:
        return "见工具描述"
    if "enum" in spec:
        return " / ".join(str(v) for v in spec["enum"])
    if spec.get("type") == "array":
        item = spec.get("items", {}).get("type", "string")
        return f"元素为 {item} 的数组，例如 [\"并发\", \"事务\"]"
    return spec.get("description") or spec.get("type", "见工具描述")
