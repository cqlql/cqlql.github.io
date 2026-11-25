"""脚本化的离线 provider。

按顺序吐出预先写好的响应 —— 用来跑通循环、复现防护、写测试，全程不碰网络。
它不是「假的模型」，是「被写死的模型行为」：演示链路固定，才能断言第几轮该调哪个工具。
"""

import json

from app.capabilities.llm.contracts import ChatRequest, ChatResponse, LLMProvider, ToolCall

DEMO_INTERVIEW_ID = "itv_20261118_01"
DEMO_TAGS = ["Spring 事务", "消息队列"]
DEMO_TOPICS = ["Spring 事务失效", "消息可靠性"]

DEMO_FINAL_ANSWER = (
    "这场 4 道题里 2 道标了 weak：Spring 事务失效、消息可靠性；"
    "线程池答得还行，但漏了队列容量和拒绝策略。\n\n"
    "题库里有 4 道同主题的题（事务 2 道、消息 2 道），下周按这个顺序练：\n\n"
    "1. 事务失效：手写「同类方法自调用」的最小复现，再对照 @Transactional(propagation)，"
    "刷 3 道同类题。验收是能讲清 self-invocation 为什么绕不过代理。\n"
    "2. 消息不丢：生产 confirm、持久化、消费 ack、幂等消费四段各写一个失败用例。"
    "验收是能画出链路图并指出每段丢在哪。\n"
    "3. 线程池：把队列容量与拒绝策略补进答案，面试时主动说代价，而不是只背公式。"
)


class FakeLLMProvider(LLMProvider):
    def __init__(self, script: list[ChatResponse]) -> None:
        self._script = list(script)
        self.calls: list[ChatRequest] = []

    async def chat(self, req: ChatRequest) -> ChatResponse:
        self.calls.append(req)
        if not self._script:
            raise RuntimeError("Fake 脚本已用尽：脚本轮次要和 max_rounds 对得上")
        return self._script.pop(0)


def call(call_id: str, name: str, arguments: dict) -> ChatResponse:
    """造一轮「模型想调某个工具」的响应"""
    return ChatResponse(
        tool_calls=[
            ToolCall(
                id=call_id,
                name=name,
                arguments=arguments,
                arguments_raw=json.dumps(arguments, ensure_ascii=False),
            )
        ]
    )


def demo_script(
    interview_id: str = DEMO_INTERVIEW_ID,
    tags: list[str] | None = None,
    topics: list[str] | None = None,
) -> list[ChatResponse]:
    """固定四轮：查记录 -> 查题库 -> 生成建议 -> 给结论"""
    return [
        call("call_1", "get_interview_record", {"interview_id": interview_id}),
        call("call_2", "search_question_bank", {"tags": tags or DEMO_TAGS, "difficulty": "any"}),
        call(
            "call_3",
            "generate_improvement",
            {"interview_id": interview_id, "topics": topics or DEMO_TOPICS},
        ),
        ChatResponse(content=DEMO_FINAL_ANSWER),
    ]
