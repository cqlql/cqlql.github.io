> 状态：**现行**（2026-11-09）

# AGENTS.md · notes-rag（笔记站语义问答）

> 只放「每次动代码都要遵守」的红线：一句结论 + 指针。判据、实测、决策历史在 `docs/`。
> 面向 AI 编码助手；人类视角见 [`README.md`](README.md)。
> 新加文档前先过 [`docs/doc-conventions.md`](docs/doc-conventions.md) 的 4 问；**唯一索引是 §1 那张表**。

| | |
| :--- | :--- |
| **这个域是什么** | 632 篇个人笔记的 RAG 问答，Python 3.11 + `uv`，全链路（切分→向量化→召回→rerank→生成）都在本仓 |
| **最硬的一条约束** | **每个改动都要有前后数字**：先标评估集 → 量 baseline → 改一处 → 再量 |
| **数字权威在哪** | `learning/实验台账.md`（本仓文档只放指针，不复述实测数字） |
| **语料在哪** | `note/docs/`（`CORPUS_DIR`），🔴 **不是本仓 `docs/`** |
| **同仓四分支** | `rag`（本仓）/ `learning` / `resume` / `note`，同一个 `cqlql-notes` 仓库的四个 worktree |

> ⚠️ 跨分支文件在 git 里互不可达。引用一律写 `<分支>/<路径>`（如 `learning/实验台账.md`），
> **不要写 `../llm-learning/…` / `../resume/…`**：那是旧目录名，clone 后必断。见 `doc-conventions.md` §7.3。

---

## 1. 文档与红线速查（唯一索引）

> 一行 = 一个功能 / 模块。要补索引**直接补这张表**，不新增 README 类第二索引。
> 跨分支条目用反引号标注的是**路径指针，不是可点链接**。🗄 = 已完结 / 只作历史留痕。

| 功能 / 模块 | 文档 | 最硬的一条红线 | 状态 |
| :--- | :--- | :--- | :--- |
| 文档治理（新加文档前的 4 问） | [`docs/doc-conventions.md`](docs/doc-conventions.md) | 通用条款以母本为准，本仓实例只追加 §7 | 现行 |
| **总体方案 / 架构 / 设计决策（含被否方案）** | [`docs/rag-solution.md`](docs/rag-solution.md) | 决策唯一权威在 §3；不复制命令 / schema / 实测数字 | 现行 |
| 链路实现 / 改造点 / 踩坑 | [`docs/rag-pipeline.md`](docs/rag-pipeline.md) | 改切分或换模型必须重建索引；技术选型决策在方案文档 §3 | 现行 |
| 评估集契约 / 指标口径 / 实验命令 | [`docs/evaluation.md`](docs/evaluation.md) | schema 权威在 `evaluate.py` docstring；两种后端同一份评估集 | 现行 |
| 施工清单（JD 覆盖 / 周节奏） | [`docs/roadmap.md`](docs/roadmap.md) | 会过期；第 3 周转 Agent 后标 🗄 已完结 | 进行中 |
| 评估集数据 | `data/eval/queries.example.jsonl` → `queries.jsonl` | 删掉占位行再标；按「你会怎么问」写 query | 现行 |
| 人视角 / 快速开始 | [`README.md`](README.md) | 不是索引；文档指针指向本表 | 现行 |
| 实验台账（数字唯一落点） | `learning/实验台账.md` | 本仓不复制任何实测数字 | 现行 |
| 概念卡片 rag-01~07 | `learning/cards/01-rag/` | 只讲概念，不放实现判据 | 现行 |
| 能力清单 / 进度看板 | `learning/能力清单.md`、`learning/进度.md` | 砍需求顺序以能力清单为准；周复盘只改进度 | 现行 |
| 学习计划 / 简历 | `resume/学习计划-RAG与Agent.md` | 周末复盘才动；简历数字必须能溯源到台账 | 现行 |
| 笔记语料（只读） | `note/docs/` | 不在 rag 分支改笔记 | 现行 |
| 通用条款母本 | `note/docs/工程/文档约定.md`、`note/docs/工程/AGENTS模板.md` | 改通用条款只改母本，不要反向 | 现行 |

---

## 2. 数据与索引：最容易搞坏的一层

- 🔴 **改了 `chunker.py` / `CHUNK_SIZE` / `CHUNK_OVERLAP` / embedding 模型，必须重跑 `scripts/ingest.py`**。
  否则 `evaluate.py` 量的是旧索引；`cli.py` 的 `manifest.json` 告警**只在 numpy 后端、且只比对 `chunk_size`**，别指望它兜底。
- 🔴 **换 embedding 模型 = 维度变 = pg 表结构变**：`store_pg.reset()` 会 `DROP TABLE chunks`（不可撤销），
  `DATABASE_URL` 只许指向 `docker-compose.yml` 的本地实验库（5433），别指到任何真实库。
- 🔴 **numpy 与 pg 的 `recall@5` 必须用同一份 `queries.jsonl` 跑**，否则比的是两套标准。
  pg 的 `score = 1 - (embedding <=> vec)` 与 numpy 的归一化点积口径一致，不许只改一边。
- `Chunk.source` 是相对 `CORPUS_DIR` 的 posix 路径，命中判定靠它；改切分别改这个格式。
- bge-m3 输出已归一化（点积即余弦）、**不需要 query instruction**；换模型先看模型卡，别照搬网上的写法。
- 完整判据见 [`docs/rag-pipeline.md`](docs/rag-pipeline.md) §4。

## 3. 评测口径

- 🔴 **每个改动前后各跑一次 `evaluate.py`**，数字记进 `learning/实验台账.md`；没有数字的改动视为没做。
- 🔴 **先标评估集再优化**：从 `queries.example.jsonl` 复制成 `queries.jsonl`、**删掉两条占位示例**、
  `expected` 写相对 `CORPUS_DIR` 的路径。schema 的唯一权威是 `scripts/evaluate.py` 模块 docstring，文档不复制。
- 🔴 **`recall@5` 是检索层指标，不是端到端指标**：生成层评测（对不对 / 有没有编 / 该拒答时拒答）尚未实现，
  不许拿 recall 当「答案正确率」写进简历。
- `cli.py` 的 `--top-k` 与 `generator.answer()` 的 `max_hits=3` 不是一回事：召回 10 条也只有前 3 条进 prompt。
- 命令与四条对照纪律见 [`docs/evaluation.md`](docs/evaluation.md) §4。

## 4. 代码与依赖边界

- 🔴 **配置只从环境变量读**（`config.py`），`CORPUS_DIR` 必填、不硬编码；改参数改 `.env` 不改代码 ——
  这样「跑过什么参数」在 git 历史里说得清。
- 🔴 **`config.ROOT = parents[2]` 依赖 `src/notes_rag/config.py` 的层级**：别把它挪出 `src/notes_rag/`，
  否则 `data/eval/` 与 `data/index/` 全部指错。
- 🔴 `scripts/*.py` 用 `sys.path.insert(0, .../src)` 引包，新脚本照抄那两行，
  其后的 import 必须带 `# noqa: E402`（ruff 开了 `E, F, I, UP, B`，line-length 100）。
- 🔴 **不复制别人的代码**：可以看文档、看论文，写下的每一行要能解释为什么。
- 🔴 **API key 只在 `.env`**（已 gitignore）；`docker-compose.yml` 里的 `postgres/postgres` 是本地实验库默认值，不是凭据。
- 依赖用 `uv sync`，不要手动 `pip install` 散装包；改完跑 `uv run ruff check .`。
- **不把 Agent 编排塞进本仓**：另开 PassUp Agent；模型选型 / vLLM / MCP 是本仓增量模块，见 `docs/roadmap.md` §1。

## 5. 构建、冒烟与验证

```bash
uv sync
cp .env.example .env                 # 填 CORPUS_DIR / LLM_API_KEY
uv run python scripts/ingest.py      # 首次 3–5 分钟，取决于 GPU
uv run python scripts/evaluate.py    # 先准备好 queries.jsonl
uv run python -m notes_rag.cli "rerank 为什么要对 top-20 做" --show-chunks
docker compose up -d                 # 仅做 pg 对比实验时，端口 5433
```

- 🔴 `evaluate.py` 在 `queries.jsonl` 不存在时直接 `SystemExit`；示例文件里有占位行，**先删再标**，否则数字是假的。
- 🔴 pg 命令要成组跑：`ingest.py --backend pg --index hnsw` → `evaluate.py --backend pg`；只跑一个没有可比数字。
- 最短冒烟是 `cli --show-chunks`：肉眼确认 hit 是真笔记、不是 front matter 碎片或表格残片。
- `hnsw.ef_search` 调参没有 CLI 入口，用一次性脚本（放 `.tmp/`）调 `PgVectorStore.set_ef_search()`，别改 `store_pg.py` 默认值。

## 6. 变更检查清单

一句结论：**任何影响检索结果的改动，都要「重跑索引 → 前后各量一次 → 记台账 → 更新 `docs/rag-pipeline.md` §2」**。
分模块清单见 [`docs/rag-pipeline.md`](docs/rag-pipeline.md) §5。
🔴 **改完代码先改本文件，再改 `docs/`** —— 顺序反了会出现「红线说 A、文档说 B」，而 AI 只信 AGENTS。

## 7. 禁止事项

- 不把实测数字写进本仓文档（权威在 `learning/实验台账.md`）
- 不建 `docs/README.md` 第二索引，不建 `docs/归档/`（废弃文档直接删，git 历史即留档）
- 不复制评估集 schema 到文档、不在多处写同一条判据
- 不在 `note` 分支以外改笔记语料；不把 Agent 编排塞进本仓
- 不硬编码密钥、不硬编码 `CORPUS_DIR`、改参数不改 `.env` 而改代码
