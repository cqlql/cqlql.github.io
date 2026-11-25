# pass-up.agent

PassUp 的面试复盘 Agent：**Function Calling + 多工具编排 + 失败处理**。
这是 notes-rag 之后单独开的项目，不塞进笔记仓库，也不改 `pass-up.ai` 的业务代码。

> 状态：骨架可跑（2026-11-25）。三个工具读 `data/fake/`，真接口还没接。
> 演示链路是脚本化的 `fake` provider，所以「模型第几轮调哪个工具」是写死的 ——
> 它能证明**循环、防护、回填**是通的，不能证明模型选得对。后者要等接真模型再量。

## 现在能做什么

- 一轮完整的「查记录 -> 找同类题 -> 生成建议 -> 给结论」离线跑通，不联网、不要密钥
- 四层硬约束：最大轮次、总超时、重复调用拦截、工具报错包装回填
- 到上限**降级给部分答案**，不抛异常给用户
- 8 个离线测试覆盖：正常链路、重复调用硬停、未知工具自纠、缺参数、轮次降级、空结果标注、序列化与坏 JSON

```bash
uv sync
uv run python -m app                                    # 离线演示（默认 fake）
uv run python -m app "复盘 itv_20261118_01 这场面试"     # 同上，问题可以自己写
uv run python -m app --max-rounds 2                     # 演示「到轮次上限降级」
uv run pytest -q
uv run ruff check .
```

真实输出（`uv run python -m app`）：

```
provider=fake · max_rounds=5 · max_repeats=2 · timeout=60s

[1] get_interview_record({"interview_id": "itv_20261118_01"})  ok  0ms
    {"ok": true, "record": {"interview_id": "itv_20261118_01", "company": "某电商中台", ...
[2] search_question_bank({"tags": ["Spring 事务", "消息队列"], "difficulty": "any"})  ok  0ms
    {"ok": true, "items": [{"id": "q_001", "tags": ["spring", "事务"], ...
[3] generate_improvement({"interview_id": "itv_20261118_01", "topics": [...]})  ok  0ms
    {"ok": true, "interview_id": "itv_20261118_01", "suggestions": [...]

回答 · 4 轮 · 3 次工具调用 · 失败 0 · 正常结束
```

## 换真模型

`cp .env.example .env`，改一行 `LLM_PROVIDER`：

| 值 | 要什么 | 说明 |
|---|---|---|
| `fake`（默认） | 无 | 脚本化，离线可复现 |
| `doubao` | `DOUBAO_API_KEY` | 火山方舟 OpenAI 兼容接口 |
| `vllm` | 本地服务已起 | 和 `pass-up.ai` 共用同一台 vLLM 也行 |

两个供应商共用一个 `OpenAICompatProvider`，只差 base_url / 模型名 / 思考开关键名（vLLM 是
`chat_template_kwargs`，豆包是 `thinking.type`），翻译收在 adapter 里，循环层不感知。

> 换真模型后第一件事不是调 prompt，是**量工具选对率**：人工标 20~30 次调用，
> 再把某条 description 改一句话、重跑同一批任务。数字记 `learning/实验台账.md` §4，本仓不存数字。

## 目录

```
app/
├── cli.py                    # python -m app 入口
├── config/settings.py        # 只从环境变量读
├── config/container.py       # 唯一 import adapters 的地方（装配 DI）
├── capabilities/
│   ├── llm/contracts.py      # ChatMessage / ToolCall / LLMProvider 协议
│   ├── tools/registry.py     # 工具定义 + 顶层参数校验 + 错误包装
│   ├── tools/interview_tools.py   # 三个工具（现在读 data/fake）
│   └── agent/loop.py         # ReAct 循环 + 四层硬约束 + 降级
├── adapters/
│   ├── fake.py               # 脚本化 provider + demo_script
│   └── openai_compat.py      # 豆包 / vLLM 共用，OpenAI 兼容
└── features/review/prompt.py # 复盘助手的 system prompt
data/fake/                    # interviews.json + question_bank.json
tests/                        # 8 个离线测试
```

## 下一步（第 3~4 周）

1. 三个工具换成真接口：`pass-up.backend` 的 `modules/mianjing`（题库 / 面经）与
   `modules/realtime/interview`（面试记录），只换 handler，不动工具描述。
2. 人工标 20~30 次调用，统计工具选对率；改一条 description 前后各测一遍 —— 这是面试要讲的「改一句话」。
3. 统计正常任务的轮次分布，用它定 `AGENT_MAX_ROUNDS`（现在是拍的 5）。
4. 模型对比：同一批任务，豆包 vs 本地 Qwen3.5-4B，记准确率 / 延迟 / 成本（台账 §6）。
5. 加可观测：每轮的 token 用量、单工具重试次数、单任务成本上限。
