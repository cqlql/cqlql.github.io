> 状态：**现行**（2026-11-09）

# 评测口径与实验纪律

> 只写「怎么量、量什么、数字记哪」。🔴 **本仓不存实测数字**，权威在 `learning/实验台账.md`。
> 总体方案与技术决策见 [`rag-solution.md`](rag-solution.md)；链路实现判据见 [`rag-pipeline.md`](rag-pipeline.md)；
> JD 覆盖矩阵与排期见 [`roadmap.md`](roadmap.md)。

---

## 1. 评估集（契约）

生产方是代码，**唯一权威在 `scripts/evaluate.py` 的模块 docstring**，活样例是
`data/eval/queries.example.jsonl`。本文不复制 schema（`query` / `expected` 字段定义、命中判定公式）。

- 真实评估集是 `data/eval/queries.jsonl`：**从 example 复制而来、人工标注、要提交**。
  `evaluate.py` 找不到它会直接 `SystemExit`。
- 🔴 example 里两条是**占位示例**，标之前先删掉，否则跑出来的数字是假的。
- 🔴 query 按「**你会怎么问**」写，不按文档标题写；后者会让 recall 虚高。
- `expected` 是相对 `CORPUS_DIR` 的路径，一个问题在多个文件里有答案就写多个。
- 命中判定依赖 `Chunk.source` 的格式（相对语料根的 posix 路径）；改切分时别动它，理由见 `rag-pipeline.md` §4。
- 标 50 条大概 1 小时，这 1 小时是后面所有优化对比的前提。

---

## 2. 指标口径

| 指标 | 从哪来 | 口径与边界 |
| :--- | :--- | :--- |
| `recall@k` | `scripts/evaluate.py` | 命中条数 / 总条数；命中 = 返回的 k 条里任意一条 `source` 落在 `expected` |
| `MRR` | 同上 | 首个命中名次取倒数后求平均，衡量「排得靠不靠前」 |
| 检索 P95 | 同上 | 逐条 query 的检索耗时排序取分位；**50 条样本的分位分辨率有限**，别拿它当生产 SLA |
| 端到端响应 | `cli.py` 打印 | 分「加载 / 检索 / 生成」三段；加载含模型初始化，🔴 别把冷启动混进检索 P95 |
| 建索引 / 写入耗时 | `scripts/ingest.py` 打印 | 只在 pg 后端有；numpy 版不建索引，耗时记 0 |

🔴 **`recall@5` 是检索层指标，不是端到端指标**。`evaluate.py` 直接复用 `retriever`，不经过生成层。
「回答对不对 / 有没有编 / 该拒答时拒答了吗」的生成层评测**还没做**，这正是 JD「评测体系」目前只覆盖一半的原因
（见 `roadmap.md` §1）；在补上之前，不许把 recall 写成「答案正确率」。

---

## 3. 目标与简历口径

| 指标 | baseline | 目标 | 状态 |
| :--- | :--- | :--- | :--- |
| recall@5 | 待测 | ≥ 0.80 | ☐ |
| rerank 增益 | — | ≥ +10 个百分点 | ☐ |
| 端到端响应 | 待测 | < 5s | ☐ |
| 评估集 | 0 条 | 50 条人工标注 | ☐ |

**简历上要能写出这一行**：

> 为个人笔记站（632 篇 / 300 万字）构建 RAG 问答：标题感知切分 + bge-m3 向量召回 +
> bge-reranker 精排，recall@5 由 0.6x 提升至 0.8x，P95 响应 3.x s

🔴 上面是**待填模板，不是成果**：`x` 是占位符，不是实测值。
每个数字都必须能在 `learning/实验台账.md` 里找到「怎么来的」，否则不许填进简历。

---

## 4. 实验命令与对照纪律

```bash
# 0. 评估集：复制 → 删占位 → 人工标 50 条
cp data/eval/queries.example.jsonl data/eval/queries.jsonl

# 1. numpy 基准（先量 baseline，再动代码）
uv run python scripts/ingest.py
uv run python scripts/evaluate.py

# 2. pgvector 对比（仅做对比实验时起容器，端口 5433）
docker compose up -d
uv run python scripts/ingest.py --backend pg --index hnsw
uv run python scripts/evaluate.py --backend pg
uv run python scripts/ingest.py --backend pg --index ivfflat --lists 100
uv run python scripts/evaluate.py --backend pg

# 3. 最短冒烟：肉眼确认命中的是真笔记、不是 front matter 碎片
uv run python -m notes_rag.cli "rerank 为什么要对 top-20 做" --show-chunks
```

四条对照纪律：

1. 🔴 **同一份 `queries.jsonl`**：numpy 与 pg、改前与改后都用它，否则比的是两套标准，数字没意义。
2. 🔴 **每次只改一处**，前后各量一次；用到的参数（`.env` 或命令行 flag）要能复现，别只记结果数字。
3. 🔴 **改切分 / 换模型先重建索引**，两个后端都要重建；详见 `rag-pipeline.md` §4、§5。
4. `ingest.py --backend pg` 与 `evaluate.py --backend pg` **成对跑**，只跑其中一个没有可比数字。

**再进一步（面试加分项）**：把 `hnsw.ef_search` 调到 40 / 100 / 200 三档，各量一次 recall 与延迟，
用来回答「ef_search 调大有什么代价」。调用入口是 `PgVectorStore.set_ef_search()`，
🔴 目前没有 CLI flag，写一次性脚本（放 `.tmp/`，已 gitignore）调它即可，**别改 `store_pg.py` 的默认值**。
它是 session 级 `SET`，换连接要重设。

对比维度固定为：**建索引耗时 / 查询 P95 / recall@5**。这三项数字填进 `learning/实验台账.md`，本仓不放表格副本。

---

## 5. 数字落在哪

- 唯一落点：`learning/实验台账.md`（`cqlql-notes` 仓库 `learning` 分支）。
  切分参数、rerank 前后、召回失败案例都在那边；本仓文档只放指针，不复述数字。
- 召回失败案例的逐条分析也记在台账：`evaluate.py --max-miss` 会打印期望与实际返回的 source，
  按「切分切断 / 表述差异 / 关键词漏召」归类。面试问「遇到过什么问题」，答案在那边。

> ⚠️ **已知的节号漂移**：`chunker.py` / `store_pg.py` / `retriever.py` / `evaluate.py` 的注释里
> 写的是「`llm-learning/实验台账.md` 第 N 节」，那是**旧目录名 + 旧节号**：
> 当前 `learning/实验台账.md` 的 §4 是「Agent 工具调用」，并没有「向量库对比」一节。
> 以台账实际章节为准，**本仓不复制节号**。要修就先在 `learning` 分支把台账章节补齐，
> 再把源码注释里的指针改成 `learning/实验台账.md`（不带节号），不要反过来把数字写进本仓。
