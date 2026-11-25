> 状态：**现行**（2026-11-25，骨架期）。第 4 周末接真接口、出第一批数字后更新一次。

# AGENTS.md · pass-up.agent

面向 AI 编码助手的红线。判据和数字的权威在笔记仓 `cqlql-notes.learning`
（`D:\_work\cqlql-notes-branches\cqlql-notes.learning`）的 `cards/02-agent/` 与 `实验台账.md` §4，
本文件只写「每次动代码都要遵守」的东西，不复述原理。这两个路径不在本仓，也不在 `pass-up` 树下。

| | |
| :--- | :--- |
| **这个域是什么** | PassUp 面试复盘 Agent：三工具 + ReAct 循环 + 失败处理，独立仓、独立部署 |
| **不是什么** | 不重写面试 / 题库业务；不做 pass-up 后端；不接 RAG（notes-rag 在另一个仓） |
| **最硬的一条约束** | **到上限永远降级返回部分答案，不抛异常、不给用户 500** |
| **数字落点** | `cqlql-notes.learning/实验台账.md` §4（轮次分布 / 选对率 / 死循环次数 / 描述改动前后） |
| **现在跑的是假的** | `LLM_PROVIDER=fake` 是脚本化 provider，证明循环通，不能证明模型选得对 |

## 1. 依赖方向

```
features（prompt / 场景文案）
    │
capabilities（agent loop / tools / llm 契约）
    │
adapters（fake / openai_compat）
    │
config（settings + container，唯一 import adapters 的地方）
```

- `capabilities` 与 `features` **不许直接 import adapters**，也不许 import `httpx`。
- 新增供应商：只加 `adapters/*` + 在 `config/container.py` 里选，循环层零改动。
- 不 import `pass-up.ai` / `pass-up.backend` 的代码。跨仓只走 HTTP，地址放 `PASS_UP_API_BASE`。

## 2. 红线

1. **上限是代码硬约束，不是 prompt 建议**：`max_rounds` / `max_repeats` / `total_timeout`
   只能来自 `config.settings`，不许在循环或工具里再写死一份，也不许只写进 system prompt 指望模型自觉。
2. **到上限降级**：`_degrade()` 必须给「已查到什么 + 缺什么」，不许 `raise` 到 CLI 变红。
   新增停止原因时，`_STOP_TEXT` 和 CLI 的 `_REASON_TEXT` 两处都要补。
3. **错误回给模型的形态固定**：`{"ok": false, "error_type", "message", "suggestion"}`。
   堆栈只进日志（`logger.exception`），不许塞进 tool message。
4. **工具描述是实验变量**：改 `name` / `description` / `parameters` 前先想清楚要量什么；
   改完必须跑同一批标注任务，before/after 记台账 §4，**不要凭感觉说「变准了」**。
   schema 必须 `additionalProperties: false`，必填字段给例子（ID 长什么样、枚举有哪些）。
5. **重复调用三层防护缺一不可**：空结果在工具返回值里显式标注「已查询，无记录，不要重复查询」；
   循环里按 `(name, 参数 JSON)` 计数拦停；system prompt 里写一句就够，别指望它兜底。
6. **离线可用是回归底线**：任何改动后 `uv run pytest -q` + `uv run ruff check .` 全绿，
   且 `uv run python -m app` 能跑完 4 轮。`fake` provider 不许删、不许依赖网络。
7. **三个工具只换数据源，不换签名**：接真接口时改 handler 内部（HTTP / 鉴权 / 字段映射），
   `description` 与参数保持稳定，否则工具选对率的前后对比就失去意义。

## 3. 运行与验证

```bash
uv sync
uv run python -m app                 # 离线 4 轮：查记录 -> 题库 -> 建议 -> 结论
uv run python -m app --max-rounds 2  # 演示降级：部分答案 + 缺什么
uv run pytest -q                     # 11 个离线用例
uv run ruff check .                  # E,F,I,UP,B / line-length 100
```

- 换真模型：`.env` 里改 `LLM_PROVIDER=doubao|vllm`，密钥只放 `.env`（已 gitignore）。
- 新增测试优先覆盖**防护**（重复、未知工具、缺参、超时/降级），而不是再测一遍 happy path。

## 4. 阶段验收（面试要能现场演示）

- [ ] 一次完整的多轮工具调用（现在 fake 已能演，真模型待接）
- [ ] 一个「工具描述改一句话 → 选对率从 a/b 到 c/d」的真实例子（台账 §4）
- [ ] Agent 跑飞的两种表现 + 对应防护（轮次上限 / 重复拦截 / 降级）

## 5. 变更清单

动了循环、工具 schema、或降级文案：跑测试 → 跑一次真模型（有 key 的话）→ 记台账 → 回来改本文件。
顺序反了会出现「红线说 A、代码是 B」，而 AI 只信 AGENTS。
