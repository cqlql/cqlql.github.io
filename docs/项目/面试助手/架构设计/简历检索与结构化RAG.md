# 简历检索与结构化 RAG

> 场景：PassUp 面试助手。不再把整份简历塞给 LLM，而是用「结构化查询 + 向量检索」动态找到当前面试最相关的信息，再喂给模型生成问题 / 评价 / 追问。这是传统 RAG 的增强版，也叫 **Structured RAG / Resume Retrieval**。

## 为什么普通 RAG 不够？

普通 RAG：`简历PDF → 文本切片 → Embedding → Vector DB → 相似度搜索 → LLM`

问题：

1. **简历是高度结构化数据**（个人信息 / 技能 / 工作经历 / 项目 / 教育 / 时间线 / 技术栈 / 职责 / 成果），普通 RAG 按字数切碎后丢失字段间关系。
2. **面试问题不是纯语义搜索**。例如"你最近一个项目用了什么技术？"要的是结构化结果（project.techStack），而不是几个包含"技术"的文本块。

所以需要：`Structured Query + Vector Retrieval + LLM`。

## 整体架构（增强版）

```
Resume PDF
   ↓
AI Resume Parser
   ↓
Full Resume Schema
   ↓
+------------+------------+
↓                        ↓
PostgreSQL            Vector DB
Structured             Semantic
Data                  Search
   ↓                        ↓
        Resume Retrieval Layer
                ↓
              LLM
                ↓
Interview Question / Follow-up / Evaluation
```

## Full Resume Schema（数据源，不是 Prompt）

```json
{
  "basic": { "name": "张三", "yearsExperience": 8 },
  "skills": [ { "name": "Java", "level": "expert", "years": 6 } ],
  "projects": [
    {
      "name": "支付系统", "role": "后端负责人",
      "description": "...",
      "techStack": ["Spring Boot", "Redis", "Kafka"],
      "responsibilities": ["设计订单系统", "优化支付链路"],
      "achievements": ["TPS 提升 30%"]
    }
  ]
}
```

存 PostgreSQL。

## Structured Query vs Vector Retrieval

- **Structured Query**：精确"找对东西"。例如当前岗位=Java、问题=Redis，则 `tech_stack @> '{"Redis"}'`。
- **Vector Retrieval**：语义"找相关表达"。例如简历写"引入缓存减少数据库压力"，用户问"如何解决系统性能问题"，关键词没有 Redis/缓存/优化，但语义相近，Embedding 能命中。

两者组合 = Hybrid Retrieval。

## Hybrid Retrieval 流程

```
1. 用户问题：请介绍一下你的高并发经验
2. LLM 分类 → Query Plan：intent=project_experience, filters.techStack=[Redis,Kafka], semanticQuery="高并发系统设计 性能优化"
3. Structured Search (PostgreSQL)：tech_stack && ARRAY['Redis','Kafka'] → 订单系统 / 秒杀系统
4. Vector Search：搜"高并发/性能优化/流量/架构"
5. 融合（如结构化 70% + 向量 30%）→ context
6. LLM 按 context 生成深入追问
```

## Structured Search 不要直接让 AI 生成 SQL

推荐 **AI 生成 Query Plan（JSON），后端据此构造 SQL**。

- ✗ 不推荐：AI 直接输出 `SELECT ... WHERE tech_stack @> '["Redis"]'` 执行。SQL 不稳定、易错、有注入风险、库一改 Prompt 全废。
- ✓ 推荐：AI 只输出意图，由 Java 用 JPA / QueryDSL 生成 SQL。

```json
// AI 输出（不知道库表）
{ "intent": "project_search", "filters": { "techStack": ["Redis"] } }

// Java
resumeProjectRepository.findByTechStack("Redis");
```

Query Plan 可逐步丰富（must / should / sort / limit，类似 ES DSL）：

```json
{
  "must":   [{ "field": "techStack", "operator": "contains", "value": "Redis" }],
  "should": [{ "field": "techStack", "operator": "contains", "value": "Kafka" }],
  "sort": "recent", "limit": 3
}
```

复杂场景 AI 还能决定查哪些表（projects / skills / experience），Retriever 分别查后融合。

## 实时面试场景

Full Resume Schema 不要一直放上下文，而是按需检索（类似 短期记忆=会话历史，长期记忆=简历库，检索=RAG）：

```
面试开始
   ↓
建立 Interview Session（最近 10 轮聊天）
   +
Resume Retrieval（取相关片段）
   ↓
LLM
```

## MVP：直接把 Resume Schema 塞进上下文（最简方案）

简历数据量天然很小，项目早期**完全直塞上下文**甚至是最优方案。很多 AI 产品早期易犯错误：还没用户规模就先设计复杂 RAG / Agent / Vector DB / Hybrid Retrieval。

简历长度与 token 估算：

- 1 页 ≈ 500~1000 字；2 页 ≈ 1000~2000 字；3 页 ≈ 3000~5000 字
- 转成 JSON 约 5KB~30KB，对应约 3000~10000 tokens
- 主流模型上下文 32K / 64K / 128K / 200K+，完全装得下

MVP 流程（比 RAG 更简单）：

```
上传简历 → AI解析 → Resume Schema JSON → 创建 Interview Session → 放入 Session Context → LLM 面试
```

系统 Prompt 示例：

```
你现在是一名资深 Java 面试官。

候选人简历：
{ resume JSON }

要求：
1. 根据真实经历提问
2. 不允许虚构候选人经历
3. 优先深入项目细节
```

第一问"请介绍一下你的支付系统项目"，模型直接能看到完整 project 节点并生成追问。

上传时异步解析后缓存，面试开始直接加载 JSON，**无需实时裁剪 / 检索**，也不影响面试开始速度。

## PassUp 演进路线（关键结论）

**MVP（最优早期）：直接把 Resume Schema 放进 Session Context，不搞 RAG。** 理由：

1. 简历数据量极小（≤3 页 / ≤1万 token），现代模型上下文完全装得下。
2. 面试问题本质依赖完整经历，全量上下文反而让模型看得更全、不乱编。
3. 省掉 Embedding / Vector DB / Retrieval 层，最快验证产品。

**之后若规模/场景复杂化再升级**（架构可平滑演进，不推倒重来）：

- V1（需要检索时）：`Resume Schema → Chunk Builder → Embedding → pgvector → TopK → LLM`。面试问题（"介绍最有挑战的项目""Redis 怎么用""缓存一致性怎么解决"）本质语义检索，Vector 天然擅长；现代 Embedding 已很强，"利用缓存减少数据库压力"能搜到"Redis 怎么用"。
- V2（轻量过滤）：TopK 后按 `chunk_type` 元数据过滤（PROJECT / SKILL / EXPERIENCE），已属轻量 Hybrid Retrieval，无需 AI 生成 SQL。
- V3（规模大、需精确筛选时）：再引入真正的 Structured Query（Query Plan → QueryDSL → SQL），Chunk / Embedding / Retrieval 层均可复用。

> Resume Schema 的价值贯穿始终：在 MVP 它是直接上下文，在 V1+ 它是高质量切片（按 Project/Skill/Experience/Achievement 分别成块）的数据源，召回率远高于按 500 字一刀切。

**当前阶段把精力放在三件事**：① 设计好 Resume Schema；② 把解析 + 缓存流程跑通；③ 打磨面试 Prompt（基于全量简历提问、防编造）。待产品验证确有按时间/岗位/技术栈精确筛选需求时，再上向量检索与 Structured Query。
