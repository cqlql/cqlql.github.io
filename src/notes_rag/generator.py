"""生成。baseline：把 top-3 拼进 prompt，要求标注引用。

改造方向：
1. 引用要能点回原文：现在只给了文件名，可以给「文件名 + 标题路径」
2. 拒答：资料里确实没有时，模型容易硬编。prompt 里写死「没有就说没有」，
   再在评估里统计「该拒答时拒答了吗」
3. 上下文长度：top-5 全塞可能超预算，可以考虑按分数截断或压缩
"""

from __future__ import annotations

from openai import OpenAI

from .config import Config

SYSTEM_PROMPT = """你是笔记助教。严格遵守：
1. 只根据<资料>回答，不要用资料之外的知识补充
2. 资料里没有相关内容，直接说「笔记里没找到相关内容」，不要编
3. 每句话末尾标注来源编号，如 [1]、[2]，编号对应资料序号
4. 中文回答，先给结论，再给细节，不要客套话"""


def build_context(hits: list[dict]) -> str:
    lines = []
    for i, h in enumerate(hits, 1):
        head = f"（{h.get('heading') or ''}）" if h.get("heading") else ""
        lines.append(f"[{i}] 来源：{h['source']}{head}\n{h['text']}")
    return "\n\n---\n\n".join(lines)


def answer(question: str, hits: list[dict], cfg: Config, max_hits: int = 3) -> str:
    """调 LLM 生成回答。max_hits 控制塞几块资料进去（token 成本）。"""
    if not hits:
        return "笔记里没找到相关内容。"

    client = OpenAI(api_key=cfg.llm_api_key, base_url=cfg.llm_base_url)
    context = build_context(hits[:max_hits])

    resp = client.chat.completions.create(
        model=cfg.llm_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"<资料>\n{context}\n</资料>\n\n问题：{question}"},
        ],
        temperature=0.2,
    )
    return resp.choices[0].message.content or ""
