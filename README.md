> 状态：**现行**（2026-11-09）

# notes-rag

给自己的笔记站（632 篇 md）做语义问答。**不是 demo，是天天要用的东西。**

关键词搜「rerank 为什么要对 top-20 做」搜不到，因为笔记里写的是「精排只处理粗排的前 N 条」——
字面不重合，向量才救得回来。这个痛点是真的，所以这个项目会一直用下去。

> 这是 `cqlql-notes` 仓库的 `rag` 分支。同仓另有 `learning` / `resume` / `note` 三个分支工作区，见文末「资料在哪」。

---

## 快速开始

```bash
# 1. 装依赖（推荐 uv；没装就 pip install -e .）
uv sync

# 2. 配环境
cp .env.example .env      # 填 CORPUS_DIR / LLM_API_KEY

# 3. 入库（首次约 3-5 分钟，取决于 GPU）
uv run python scripts/ingest.py

# 4. 问一句
uv run python -m notes_rag.cli "rerank 为什么要对 top-20 做"

# 5. 想学向量库就跑 pg 后端
docker compose up -d
uv run python scripts/ingest.py --backend pg
```

---

## 现在是什么状态：**baseline，不是答案**

代码已经能跑通全链路，但每个环节都是最笨的版本。你的任务是把它改好，并且**用数字证明改好了**。

整体方案、架构与设计决策见 [`docs/rag-solution.md`](docs/rag-solution.md)；
指标目标与简历口径见 [`docs/evaluation.md`](docs/evaluation.md) §3；
实现判据、改造点、踩坑见 [`docs/rag-pipeline.md`](docs/rag-pipeline.md)；
范围与周节奏见 [`docs/roadmap.md`](docs/roadmap.md)。

> ⚠️ 最短路径是**先标 50 条评估集 → 量 baseline → 改一处 → 再量**。没有评估集的优化全是猜。

---

## 文档在哪

**唯一索引是 [`AGENTS.md`](AGENTS.md) §1「文档与红线速查」**（一行 = 一个功能 / 模块）。
红线、禁止事项、变更检查清单也在 `AGENTS.md`；本页不重复列索引。
新加文档前先过 [`docs/doc-conventions.md`](docs/doc-conventions.md) 的 4 问。

---

## 资料在哪（跨分支）

同一个 git 仓库 `cqlql-notes` 的四个分支，各自是一个本地工作区；**分支之间在 git 里互不可达**，
所以下面只写 `<分支>/<路径>` 指针，不做成链接（clone 单个分支后链接必断）：

| 想找什么 | 去哪 |
| :--- | :--- |
| 学习计划、简历 | `resume/学习计划-RAG与Agent.md` |
| 概念卡片 rag-01~07、能力清单、进度看板 | `learning/cards/01-rag/`、`learning/能力清单.md`、`learning/进度.md` |
| **实验台账（所有实测数字的唯一落点）** | `learning/实验台账.md` |
| 笔记语料（只读，`CORPUS_DIR` 指向它） | `note/docs/` |
| 文档规范母本 | `note/docs/工程/文档约定.md`、`note/docs/工程/AGENTS模板.md` |

🔴 本仓 `docs/` 是项目文档，**不是语料**；两个 `docs/` 别混。
