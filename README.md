# notes-rag

给自己的笔记站（632 篇 md）做语义问答。**不是 demo，是天天要用的东西。**

关键词搜「rerank 为什么要对 top-20 做」搜不到，因为笔记里写的是「精排只处理粗排的前 N 条」——字面不重合，向量才救得回来。这个痛点是真的，所以这个项目会一直用下去。

配套学习计划：[`cqlql-notes-resume/学习计划-RAG与Agent.md`](../cqlql-notes-resume/学习计划-RAG与Agent.md)

---

## 目标（可量化，面试直接引用）

| 指标 | baseline | 目标 | 状态 |
|---|---|---|---|
| recall@5 | 待测 | ≥ 0.80 | ☐ |
| rerank 增益 | — | ≥ +10 个百分点 | ☐ |
| 端到端响应 | 待测 | < 5s | ☐ |
| 评估集 | 0 条 | 50 条人工标注 | ☐ |

**简历上要能写出这一行**：

> 为个人笔记站（632 篇 / 300 万字）构建 RAG 问答：标题感知切分 + bge-m3 向量召回 + bge-reranker 精排，recall@5 由 0.6x 提升至 0.8x，P95 响应 3.x s

每个数字都必须能在 `实验台账` 里找到怎么来的。

---

## 技术选型（面试会被问「为什么」）

| 选择 | 理由 | 什么时候该换 |
|---|---|---|
| **两种后端都做**：numpy 暴力 vs pgvector | 不是二选一，是**对比实验**。numpy 五分钟能跑通，当基准和对照组；pgvector 用来学 HNSW / IVFFlat，这是 JD 里的硬要求 | 生产环境按数据量选，学习场景两个都要 |
| **bge-m3** 本地 | 多语言、8192 上下文、数据不出网、免费。8G 显存 fp16 够跑 | 需要多模态，或显存不够 |
| **bge-reranker-v2-m3** | cross-encoder 比向量准，但必须实时算，所以只对 top-20 做 | 延迟预算更紧时换更小的 reranker |
| **切分按标题层级 + 长度兜底** | 笔记天然带 `##` 层级，按标题切语义完整；超长再按长度切 | 语料换成没有结构的（PDF/聊天记录） |
| **豆包 API** 生成 | 便宜、快、已开通；本地 vLLM 作为备选 | 数据敏感或成本敏感时切本地 |

> 上面每一条都是「我先用了什么，因为什么，什么情况下会换」——这就是面试要的答法。
> 「数据量小不需要向量库」是**工程结论**，不是**学习结论**：你没做过 pgvector，就答不出「HNSW 和 IVFFlat 怎么选」。两个都做，你才有对比数据。

---

## 快速开始

```bash
# 1. 装依赖（推荐 uv；没装就 pip install -e .）
uv sync

# 2. 配环境
cp .env.example .env      # 填 LLM_API_KEY

# 3. 入库（首次约 3-5 分钟，取决于 GPU）
uv run python scripts/ingest.py

# 4. 问一句
uv run python -m notes_rag.cli "rerank 为什么要对 top-20 做"

# 5. 想学向量库就跑 pg 后端（见下节）
docker compose up -d
uv run python scripts/ingest.py --backend pg
```

---

## 现在是什么状态：**baseline，不是答案**

代码已经能跑通全链路，但每个环节都是**最笨的版本**。你的任务是把它改好，并且**用数字证明改好了**。

| 模块 | 当前 baseline | 你该改什么 | 对应卡片 |
|---|---|---|---|
| `chunker.py` | 按固定字符数切，尽量在段落断开 | 改成标题感知：按 `##` 切，超长再切；对比 256/512/1024 三组的检索质量 | `rag-02` |
| `embedder.py` | bge-m3 直接调，已归一化 | 基本不用改，但要测：入库耗时、单条延迟 | `rag-03` |
| `store.py` | numpy 数组 + 点积 | 已给 pgvector 实现（`store_pg.py`），**跑对比实验**：建索引耗时、查询 P95、recall@5 | `rag-04` |
| `retriever.py` | 纯向量 top-k | 加 rerank（top-20 → top-5）；可选加 BM25 混合 | `rag-06` `rag-05` |
| `generator.py` | top-3 直接拼进 prompt | 加引用标注、控制上下文长度、处理「资料里没有」的情况 | `rag-01` |
| `scripts/evaluate.py` | 框架已给，评估集是空的 | **先标 50 条 query**，这是所有数字的前提 | `rag-07` |

**改的顺序很重要**：先标评估集 → 量 baseline → 改一处 → 再量。没有评估集的优化全是猜。

---

## 向量库对比实验（卡片 rag-04 的答案来源）

```bash
docker compose up -d                                    # 起 pgvector（端口 5433）

uv run python scripts/ingest.py                         # numpy 基准
uv run python scripts/ingest.py --backend pg --index hnsw
uv run python scripts/ingest.py --backend pg --index ivfflat --lists 100

uv run python scripts/evaluate.py                       # numpy
uv run python scripts/evaluate.py --backend pg          # pgvector
```

要填的表（`llm-learning/实验台账.md` 第 4 节）：

| 后端 | 建索引耗时 | 查询 P95 | recall@5 |
|---|---|---|---|
| numpy 暴力 | 0（不用建） | | |
| pgvector + HNSW | | | |
| pgvector + IVFFlat | | | |

**再进一步**（面试加分项）：调 `SET hnsw.ef_search` 到 40 / 100 / 200 三档，各量一次 recall 和延迟。
这组数字能直接回答「ef_search 调大有什么代价」——不是背文档，是实测。

> 注意：pg 和 numpy 的 `recall@5` 要**用同一份评估集**跑，否则比的是两套标准，数字没意义。

---

## 目录

```
notes-rag/
├── src/notes_rag/
│   ├── config.py       # 配置与环境变量
│   ├── chunker.py      # 切分 ← 主要改造点
│   ├── embedder.py     # 向量化
│   ├── store.py        # 向量存储与检索
│   ├── retriever.py    # 召回 + 重排 ← 主要改造点
│   ├── generator.py    # 拼 prompt + 调 LLM
│   └── cli.py          # 命令行问答
├── scripts/
│   ├── ingest.py       # 建索引
│   └── evaluate.py     # 算 recall@k / MRR
└── data/
    ├── eval/queries.jsonl   # 评估集（人工标注，要提交）
    └── index/               # 向量文件（不提交）
```

---

## 四周节奏（**建议，不是规定**）

> 这是按「每天 2 小时」推的。你自己的学习计划才是主，这份只是把它落到具体任务上。
> 觉得不合适就改——改完记得同步 `llm-learning/进度.md`，别两处打架。

| 周 | 做什么 | 产出 |
|---|---|---|
| **1** | 跑通 baseline → 改切分（标题感知）→ 上 pgvector 做后端对比 | 切分前后块数 + 两种后端的建索引/查询数字 |
| **2** | 加 rerank → 标满 50 条评估集 → 出 recall@5 前后对比 | **核心数字**，简历那三行的原料 |
| 3 起 | 转 Agent（另开项目）。notes-rag 只做增量维护 | — |

> 这是按你六周计划的前两周排的，第 3 周该转 Agent 了，别在这里恋战。
> ⚠️ 一个矛盾要你自己权衡：第 1 周改切分时评估集还没标完，改完不知道好坏。
> 折中办法是**第 1 周先标 10 条试水**，够看出趋势就行，完整的 50 条第 2 周补。
> 你也可以先标完再动手——那样慢一点，但每一步都有数。

**有余力再做**（不占主线，第 2 周之后想起来再说）：
引用标注能点回原文、资料里没有时拒答、混合检索（BM25 + 向量）、接进笔记站前端。

---

## 约定

- **不复制别人的代码**。可以看文档、看论文，但写下来的每一行要能解释为什么
- **每个改动都要有数字**。改了切分不量，等于没改
- **API key 不进仓库**。`.env` 已在 `.gitignore` 里
- 语料路径通过 `CORPUS_DIR` 配，不硬编码
