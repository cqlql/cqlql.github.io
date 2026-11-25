> 状态：**现行**（2026-11-09）

# RAG 链路：实现判据与已知坑

> 全链路的实现判据、改造点、踩坑收在这一份。
> **总体架构与「为什么这么设计 / 被否方案」见 [`rag-solution.md`](rag-solution.md) §3**（决策的唯一权威，
> 并进方案文档的决策节，不单开决策文档）；本文不复制决策表。
> 指标口径与实验命令见 [`evaluation.md`](evaluation.md)；施工节奏见 [`roadmap.md`](roadmap.md)。

---

## 1. 模块地图

```
src/notes_rag/
├── config.py       # 配置：全部从 .env / 环境变量读
├── chunker.py      # 切分        ← 主要改造点（rag-02）
├── embedder.py     # 向量化 bge-m3
├── reranker.py     # 精排 cross-encoder（bge-reranker-v2-m3）
├── store.py        # numpy 暴力检索 + 索引持久化 / open_store 分发
├── store_pg.py     # pgvector（HNSW / IVFFlat），与 store.py 同接口
├── retriever.py    # 两段式召回（粗召回 → rerank）+ build_retriever 工厂
├── generator.py    # 拼 prompt + 调 LLM
└── cli.py          # 命令行问答
scripts/
├── ingest.py       # 建索引（扫 md → 切 → 向量化 → 存盘/入库）
└── evaluate.py     # 算 recall@k / MRR  ← 所有数字的来源
data/
├── eval/queries.example.jsonl   # 评估集样例（真实集 queries.jsonl 要人工标）
└── index/                      # 索引产物，.gitignore 忽略
```

数据流：`note/docs/` 语料 → `chunker` → `embedder` → `store` → `retriever` → `generator` → 回答。
评估是旁路：`evaluate.py` 直接复用 `retriever`，**不经过生成层**（见 `evaluation.md` §2）。

🔴 本仓 `docs/` 是项目文档，**不是语料**；语料在 `note/docs/`，由 `CORPUS_DIR` 指定。

---

## 2. 当前 baseline 与改造点

代码已能跑通全链路，但每个环节都是最笨的版本。改造顺序有依赖：**先标评估集 → 量 baseline → 改一处 → 再量**，没有评估集的优化全是猜。

| 模块 | 当前 baseline | 要改什么 | 卡片 |
| :--- | :--- | :--- | :--- |
| `chunker.py` | `fixed` 策略：按固定字符数切，尽量在段落边界断开（对照组）；`heading` 为默认，短 section 合并 `MERGE_MIN_CHARS` 默认 0 | `heading`：代码块切断 1600→468；50 条评估集上 recall@5 +2.0pp / MRR +0.049（见 `learning/实验台账.md` §0.5）。短 section 合并已实现：120 让碎片 166→41 但检索零增益（§2.1）。待办：标题前缀是否进 text；再对比 256 / 512 / 1024 三组 | `learning/cards/01-rag/02-切分策略.md` |
| `embedder.py` | bge-m3 直接调，输出已归一化 | 基本不用改，但要测：入库耗时、单条 query 延迟 | `learning/cards/01-rag/03-Embedding选型.md` |
| `store.py` / `store_pg.py` | numpy 点积 / 已给 pgvector 实现 | **跑对比实验**：建索引耗时、查询 P95、recall@5 | `learning/cards/01-rag/04-向量检索.md` |
| `retriever.py` | 两段式已实现：粗召回 top-20 → cross-encoder 精排 → top-5，`RERANK_ENABLED` 切换（**默认关**） | 50 条集上没证明净收益，失败案例指向「短 section 碎片块」→ 先做短 section 合并再复测；可选 BM25 混合 | `learning/cards/01-rag/06-Rerank.md` |
| `generator.py` | top-3 拼进 prompt | 引用可点回原文、控制上下文长度、处理「资料里没有」 | `learning/cards/01-rag/01-为什么需要RAG.md` |
| `scripts/evaluate.py` | 框架已给，评估集是空的 | **先标 50 条 query**，这是所有数字的前提 | `learning/cards/01-rag/07-评估指标.md` |

两种策略由 `.env` 的 `CHUNK_STRATEGY` 切换（默认 `heading`），共用同一份代码与同一份评估集：
改策略只改配置，前后数字才可比。红线见 `../AGENTS.md` §3。
两段式检索同理：`RERANK_ENABLED` 一行开关，代码、索引、评估集都不动。

---

## 3. 技术选型决策 → 见方案文档

**决策的唯一权威在 [`rag-solution.md`](rag-solution.md) §3**：选型表、换型条件、被否方案与理由都在那一处，
本文件不复制 —— 改选型只改方案文档，别两处各改一半。

这里只留一条会影响实现的结论：

- 🔴 **「数据量小不需要向量库」是工程结论，不是学习结论**：两种后端都要跑，
  pg 侧的表与索引不能因为「用不上」而删掉；对照实验矩阵见 [`rag-solution.md`](rag-solution.md) §5.3。
- 决策变动后，回来检查本文 §2 的改造点与 §4 的实现判据是否还成立。

---

## 4. 实现判据与已知坑

**索引与参数**

- 🔴 改了 `chunker.py` / `CHUNK_STRATEGY` / `CHUNK_SIZE` / `CHUNK_OVERLAP` / `MERGE_MIN_CHARS` / embedding 模型，**必须重跑 `ingest.py`**，
  否则 `evaluate.py` 量的是旧索引。`cli.py` 会读 `manifest.json` 警告，但**只在 numpy 后端、且只比对 `chunk_size` / `chunk_strategy` / `merge_min_chars`** ——
  换模型、改 overlap 不会告警，别指望它兜底。
- 🔴 **语料本身也会变**（笔记搬迁 / 删除）：`manifest.files` 和 `CORPUS_DIR` 的实际篇数对不上时，索引就已经是旧的；
  评估集里失效的 `expected` 会让 recall 天花板变成 (50−N)/50，`evaluate.py` 会显式打印这个上限。
  语料一变先重建索引，再决定「重标」还是「删掉」那几条 query —— 原始 recall 不能跨语料比。
- **短 section 合并**（`MERGE_MIN_CHARS`，默认 0=关）的规则写在 `_merge_short_sections()` docstring 里：
  只向前并、被并节的标题行保留在正文、合并后不超过 `CHUNK_SIZE`。它是切分层的改动，
  `manifest.merge_min_chars` 会记下来；改成非 0 必须重建索引，「结构变干净 ≠ 检索变好」（§2.1 的数字）。
- 🔴 换 embedding 模型 = 向量维度变 = pg 的 `vector(dim)` 表结构变，pg 侧必须 `reset()` 整表重建；
  numpy 侧的 `vectors.npy` 同理。`store_pg.reset()` 是 `DROP TABLE chunks`，**不可撤销**，
  `DATABASE_URL` 只许指向 `docker-compose.yml` 那个本地实验库（端口 5433）。
- 改参数改 `.env`，不改代码：`config.py` 的注释写明了理由 —— 「跑过什么参数」要能在 git 历史里说清。
  `_int()` 对非法值静默回退默认值，.env 里写错数字不会报错，量之前看一眼 `ingest.py` 打印的参数。
- 🔴 `config.ROOT = Path(__file__).resolve().parents[2]` 依赖 `src/notes_rag/config.py` 的层级，
  别把它挪出 `src/notes_rag/`，否则 `data/eval/` 与 `data/index/` 全部指错。

**检索口径**

- 向量已归一化 → numpy 版点积即余弦；pg 版 `score = 1 - (embedding <=> %s::vector)`，
  **两边口径必须一致**。只改一边的排序逻辑，对比实验就没有意义。
- rerank 的分数是 cross-encoder 的输出（**不是余弦、也不是 0~1 的相似度**），所以 `Retriever`
  只在命中里加 `rerank_score`、并按它排序，**保留原来的 `score` 余弦值不变**：两个口径不混用，
  展示时也别把精排分标成「相似度」。
- `RERANK_TOP_N` 是粗召回送进精排的条数，`TOP_K` 是最终返回条数，🔴 **别把两者当同一个参数**：
  粗召回 recall@N 就是 rerank 的天花板，池子外面召不回来的块，精排再准也救不了。
- 🔴 **rerank 默认关**（`RERANK_ENABLED=false`）：50 条集上没证明净收益，且精排把
  「粗排第 1 的标题碎片块」和「主题相近但对象不同」的块排到前面。归因与数字在
  `learning/实验台账.md` §2；要复测先做短 section 合并，再改这一行跑前后两次。
- 精排模型本机走本地权重目录（`RERANK_MODEL` 填绝对路径），HF 不通时别指望自动下载；
  加载是懒的：`RERANK_ENABLED=false` 时完全不加载精排模型，不占显存/内存。
- `Chunk.source` 是相对 `CORPUS_DIR` 的 **posix 路径**，命中判定靠它和 `expected` 比对。
  改切分时别改 `source` 的格式，否则整份评估集静默失效。
- `fixed` 策略把整个文件当一个 section（去掉 front matter），已知两个毛病：代码块/表格被拦腰切、末尾产生碎片块。
  `heading` 策略按标题切 section、每块前缀标题路径，并用 `respect_fences` 把断点推到代码块之外；
  断点逻辑与判据写在 `chunker.py` 的 docstring 里，改之前先读。
- 🔴 **`heading` 已是默认策略**（50 条评估集上 +2.0pp recall / +0.049 MRR，见 `learning/实验台账.md` §0.5）。
  切默认后 `data/index` 必须同步换成 heading 建的索引，否则 `cli.py` 会报策略不符。
  ⚠️ 样本只 50 条、只差 1 条命中、P95 +16ms，后续扩样本复核；短 section 合并、标题前缀等优化
  都要用同一份 50 条集再量一次。
- bge-m3 **不需要 query instruction**（`bge-large-zh-v1.5` 才需要）。换模型先看模型卡，别照搬网上的写法，加错了会掉点。
- `PgVectorStore.set_ef_search()` 是 session 级 `SET`；换连接就失效，每轮实验重设一次再量。

**生成层**

- `cli.py` 的 `--top-k` 控制召回条数，`generator.answer()` 的 `max_hits=3` 控制塞进 prompt 的条数，
  🔴 **两者不是一个东西**：`--top-k 10 --show-chunks` 看到的第 4~10 条并不参与生成。
- `SYSTEM_PROMPT` 已写死「资料里没有就说没找到」；`answer()` 在 `hits` 为空时直接返回拒答文案，不调 LLM。
  但「该拒答时拒答了吗」**还没有评测**，别当成已验证能力。

**脚本与 lint**

- `scripts/*.py` 用 `sys.path.insert(0, .../src)` 引包，新脚本照抄那两行；
  其后的 import 必须带 `# noqa: E402`（ruff 开了 `E, F, I, UP, B`，line-length 100）。
- 依赖用 `uv sync`，别手动 `pip install` 散装包；改完跑 `uv run ruff check .`。

---

## 5. 变更检查清单

> 一句结论：**任何影响检索结果的改动，都要「重跑索引 → 前后各量一次 → 记台账 → 更新本文 §2」**。
> 详细命令见 [`evaluation.md`](evaluation.md) §4。

| 改动 | 必须同步 |
| :--- | :--- |
| 改 `CHUNK_STRATEGY` | 只改 `.env` → 重跑 `ingest.py` → `evaluate.py` 前后各一次 → 台账；确认 `manifest.json` 的 `chunk_strategy` 已更新 |
| 改 `chunker.py` / `CHUNK_SIZE` / `CHUNK_OVERLAP` | 重跑 `ingest.py`（numpy 与 pg 都要）→ `evaluate.py` 前后各一次 → `learning/实验台账.md` → 本文 §2 |
| 换 embedding 模型 | 同上 + pg 整表重建（dim 变）+ 确认要不要 query instruction + 检查 `.env` 的 `EMBED_MODEL` |
| 改 `retriever.py`（rerank / 混合检索） | 前后各量一次 + 台账；新参数进 `.env` 与 `.env.example`，别写死在代码里 |
| 改 `generator.py` | 生成层评测补上后再量；🔴 不许用 recall@5 代替「回答对不对」 |
| 加新后端 | 与 `store.py` 同接口（`search` / `__len__`）→ 在 `open_store()` 注册 → 用**同一份** `queries.jsonl` 跑对比 |
| 改评估集 schema | `scripts/evaluate.py` 模块 docstring（唯一权威）+ `data/eval/queries.example.jsonl` + `evaluation.md` 的指针 |
| 改文档 | **先** `AGENTS.md` §1 索引表，**再** `docs/`；每份第一行写状态；在本仓 `docs/doc-conventions.md` §7.2 补状态行 |

---

## 6. 不在本仓的东西

- **Agent 编排 / 开发**：另开 PassUp Agent，别塞进来（见 [`roadmap.md`](roadmap.md) §1）。
- **实测数字**：一律记在 `learning/实验台账.md`，本仓文档只放指针，不复述数字。
- **笔记语料**：`note/docs/`，只读。
