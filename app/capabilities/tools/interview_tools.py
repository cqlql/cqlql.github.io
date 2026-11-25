"""三个工具：面试记录 / 题库检索 / 改进建议。

数据现在读 data/fake/*.json，离线就能跑；接 pass-up 真接口时只换 handler 内部的数据读取，
工具的 name / description / parameters 不动 —— 描述是实验变量，不该跟着数据源一起变。
"""

import json
from pathlib import Path
from typing import Any

from app.capabilities.tools.registry import Tool, ToolError

# 建议模板：真实现换成 pass-up 后端的 AI 接口，这里先按关键词拼可执行的练法
_TEMPLATES: dict[str, tuple[str, str, str]] = {
    "事务": (
        "Spring 事务与 AOP 代理边界",
        "手写一个「同类方法自调用」的最小复现，再用 @Transactional(propagation) 对照一次；"
        "刷 3 道同类题",
        "能不看资料讲清 self-invocation 为什么绕不过代理，并说出一个避免它的写法",
    ),
    "消息": (
        "消息可靠性四段链路",
        "本地起 RabbitMQ：生产 confirm、持久化、消费 ack、幂等消费各写一个失败用例",
        "能画出一条消息从生产到消费的链路图，并指出每一段可能丢在哪",
    ),
    "并发": (
        "线程池参数与拒绝策略",
        "按 CPU 密集 / IO 密集各算一组 core / max / queue，压测对比拒绝率与响应时间",
        "能说出你选的队列容量和拒绝策略的代价，而不是只背公式",
    ),
    "mysql": (
        "慢 SQL 排查顺序",
        "拿 3 条慢 SQL 跑 explain，按 type -> rows -> extra 判读，记录改前改后耗时",
        "能在 5 分钟内定位一条慢 SQL 的主要问题并说明依据",
    ),
}


def build_interview_tools(data_dir: Path) -> list[Tool]:
    store = _FakeStore(data_dir)
    return [_record_tool(store), _question_tool(store), _improvement_tool(store)]


class _FakeStore:
    def __init__(self, data_dir: Path) -> None:
        self.interviews: dict[str, dict] = json.loads(
            (data_dir / "interviews.json").read_text(encoding="utf-8")
        )
        self.questions: list[dict] = json.loads(
            (data_dir / "question_bank.json").read_text(encoding="utf-8")
        )


def _record_tool(store: _FakeStore) -> Tool:
    def handler(interview_id: str) -> dict[str, Any]:
        record = store.interviews.get(interview_id)
        if record is None:
            raise ToolError(
                "not_found",
                f"查不到面试 {interview_id}",
                "确认 ID 来自面试列表页（形如 itv_20261118_01）；不要用同一个 ID 再试一次",
            )
        return {
            "ok": True,
            "record": record,
            "note": "已查询，以上是该场全部题目；不要用相同 ID 重复查询",
        }

    return Tool(
        name="get_interview_record",
        description=(
            "查询某场已完成面试的记录：每道题、作答质量（good / ok / weak）与面试官备注。"
            "用户说「复盘上次面试」「这场哪里答得不好」，"
            "或给出形如 itv_20261118_01 的面试 ID 时使用。"
            "用户只是想刷题、问题库有没有某类题时，用 search_question_bank，不要用本工具。"
            "一个 ID 只查一次。"
        ),
        parameters={
            "type": "object",
            "properties": {
                "interview_id": {
                    "type": "string",
                    "description": "面试 ID，形如 itv_20261118_01（面试列表页可复制）",
                }
            },
            "required": ["interview_id"],
            "additionalProperties": False,
        },
        handler=handler,
    )


def _question_tool(store: _FakeStore) -> Tool:
    def handler(tags: list[str], difficulty: str) -> dict[str, Any]:
        if not tags:
            raise ToolError("missing_param", "tags 不能为空", "传 1~3 个中文标签，如 [\"并发\"]")
        hits = [
            q
            for q in store.questions
            if _tag_matches(q.get("tags", []), tags)
            and (difficulty == "any" or q.get("difficulty") == difficulty)
        ][:5]
        if not hits:
            return {
                "ok": True,
                "items": [],
                "note": (
                    "已查询，该条件无记录；换标签或把 difficulty 放宽成 any，"
                    "不要用相同参数重复查询"
                ),
            }
        return {"ok": True, "items": hits, "count": len(hits)}

    return Tool(
        name="search_question_bank",
        description=(
            "按标签和难度检索题库，返回题目、考察点与难度（最多 5 条）。"
            "需要为薄弱主题找同类题对照、或补练时使用；查历史面试表现用 get_interview_record。"
            "tags 传中文关键词（如 并发 / 事务 / MySQL），1~3 个；difficulty 不确定时传 any。"
        ),
        parameters={
            "type": "object",
            "properties": {
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "maxItems": 3,
                    "description": "中文标签，例如 [\"并发\", \"事务\"]",
                },
                "difficulty": {
                    "type": "string",
                    "enum": ["easy", "medium", "hard", "any"],
                    "description": "难度；不确定传 any",
                },
            },
            "required": ["tags", "difficulty"],
            "additionalProperties": False,
        },
        handler=handler,
    )


def _improvement_tool(store: _FakeStore) -> Tool:
    def handler(interview_id: str, topics: list[str]) -> dict[str, Any]:
        if interview_id not in store.interviews:
            raise ToolError(
                "not_found",
                f"查不到面试 {interview_id}",
                "先用 get_interview_record 查一场真实存在的面试，再生成建议",
            )
        if not topics:
            raise ToolError("missing_param", "topics 不能为空", "填 1~3 个记录里标 weak 的主题")
        suggestions = [_suggestion_for(topic) for topic in topics]
        return {
            "ok": True,
            "interview_id": interview_id,
            "suggestions": suggestions,
            "note": "建议已生成；直接基于这些内容回答用户，不要用相同参数重复调用",
        }

    return Tool(
        name="generate_improvement",
        description=(
            "基于已经查到的面试记录和题库结果，生成可执行的改进建议"
            "（每条含练什么 / 怎么练 / 怎么验收）。"
            "必须在拿到记录与题库结果之后调用；手里还没有这两样时先调前两个工具，"
            "不要直接调本工具。topics 只填记录里标 weak 的主题，1~3 个。"
        ),
        parameters={
            "type": "object",
            "properties": {
                "interview_id": {
                    "type": "string",
                    "description": "面试 ID，形如 itv_20261118_01",
                },
                "topics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "maxItems": 3,
                    "description": "薄弱主题，例如 [\"Spring 事务失效\", \"消息可靠性\"]",
                },
            },
            "required": ["interview_id", "topics"],
            "additionalProperties": False,
        },
        handler=handler,
    )


def _tag_matches(question_tags: list[str], wanted: list[str]) -> bool:
    for want in wanted:
        a = want.replace(" ", "").lower()
        for have in question_tags:
            b = have.replace(" ", "").lower()
            if a in b or b in a:
                return True
    return False


def _suggestion_for(topic: str) -> dict[str, str]:
    lowered = topic.lower()
    for keyword, (focus, drill, acceptance) in _TEMPLATES.items():
        if keyword in lowered:
            return {"topic": topic, "focus": focus, "drill": drill, "acceptance": acceptance}
    return {
        "topic": topic,
        "focus": f"围绕「{topic}」补齐标准答案之外的边界条件",
        "drill": "同类题刷 5 道，每道写 3 行复盘（考点 / 我漏了什么 / 下次先说哪句）",
        "acceptance": "能不看资料讲 3 分钟，并主动说出一个反例",
    }
