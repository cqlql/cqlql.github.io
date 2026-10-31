"""切分 —— 这是本项目第一个要改造的地方（对应卡片 rag-02）。

当前 baseline：按固定字符数切，尽量在段落边界断开。
它的问题很明显：一段讲 A 的结尾和讲 B 的开头被切进同一块，
向量被两个主题平均掉，相似度上不去。

改造方向（按性价比排序）：
1. 标题感知：笔记天然有 `##` 层级，按标题切成 section，每块带上标题路径。
   面试官问「为什么这么切」，答案是「我的语料有结构，不用白不用」。
2. 超长 section 再按段落切，保留标题作为上下文前缀。
3. 对比实验：256 / 512 / 1024 三组，用 evaluate.py 各跑一次，把数字填进
   `llm-learning/实验台账.md` 第 1 节。

注意：切分改了必须重建索引（scripts/ingest.py），否则量的是旧数据。
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Chunk:
    id: str
    text: str
    source: str  # 相对 corpus_dir 的路径，用作评估时的命中判定
    heading: str = ""
    meta: dict = field(default_factory=dict)


def _chunk_id(source: str, index: int, text: str) -> str:
    h = hashlib.md5(text.encode("utf-8")).hexdigest()[:8]
    return f"{source}#{index}-{h}"


def split_text(
    text: str,
    size: int,
    overlap: int,
    source: str,
    heading: str = "",
) -> list[Chunk]:
    """把一段文本切成若干块。

    baseline 策略：
      - 每块不超过 size 个字符
      - 优先在段落边界（\\n\\n）断开，找不到就硬切
      - 相邻块重叠 overlap 个字符，避免答案正好落在切口上
    """
    text = text.strip()
    if not text:
        return []

    chunks: list[Chunk] = []
    start = 0
    n = len(text)
    idx = 0

    while start < n:
        end = min(start + size, n)

        if end < n:
            # 只在后半段找段落边界，否则块会太短
            cut = text.rfind("\n\n", start + size // 2, end)
            if cut != -1:
                end = cut

        piece = text[start:end].strip()
        if piece:
            chunks.append(
                Chunk(
                    id=_chunk_id(source, idx, piece),
                    text=piece,
                    source=source,
                    heading=heading,
                )
            )
            idx += 1

        if end >= n:
            break
        start = max(end - overlap, start + 1)

    return chunks


def chunk_file(path: Path, corpus_dir: Path, size: int, overlap: int) -> list[Chunk]:
    """读一个 md 文件并切分。

    TODO(rag-02)：这里现在把整个文件当一个 section。
    改成：先按 `## ` 拆成 section，每个 section 调一次 split_text，
    并把标题路径（`# 一级 / ## 二级`）传进 heading。

    实测这个 baseline 有两个毛病，改的时候一起解决：
    1. 代码块和表格会被拦腰切断（用 512 切 632 篇，实测 5052 块，
       平均 428 字，但里面有不少块是从表格中间开始的）
    2. 会产生 19 字左右的碎片块（文件末尾残余）。要不要丢弃（比如 < 50 字），
       丢多少，用 evaluate.py 前后各跑一次再决定——别凭感觉
    """
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return []

    # 去掉 front matter，它不参与检索
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            text = parts[2]

    rel = path.relative_to(corpus_dir).as_posix()
    return split_text(text, size, overlap, source=rel, heading=path.stem)
