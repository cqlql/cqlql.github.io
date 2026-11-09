"""切分 —— 两种策略由 CHUNK_STRATEGY 选（fixed / heading），改 .env 不改代码。

当前默认 **heading**（50 条评估集上反超 fixed，见 `learning/实验台账.md` §0.5）；
config.py 的 fallback 与这里保持一致，fixed 保留作对照组。

fixed   = baseline：整篇当一个 section，按固定字符数切，尽量在段落边界断开。
heading = 标题感知：按 markdown 标题层级切 section，每块带标题路径；
          超长 section 再按长度兜底，且断点避开 fenced code block。

为什么留着 fixed：它是对照组。用同一份 queries.jsonl 各量一次，数字记进
`learning/实验台账.md`；改没变好由数字说话，不由感觉说话。

🔴 改了策略 / CHUNK_SIZE / CHUNK_OVERLAP / embedding 模型，必须重跑
scripts/ingest.py 重建索引，否则 evaluate.py 量的是旧索引。
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
_FENCE_MARKS = ("```", "~~~")


@dataclass
class Chunk:
    id: str
    text: str
    source: str  # 相对 corpus_dir 的 posix 路径，用作评估时的命中判定
    heading: str = ""
    meta: dict = field(default_factory=dict)


def _chunk_id(source: str, index: int, text: str) -> str:
    h = hashlib.md5(text.encode("utf-8")).hexdigest()[:8]
    return f"{source}#{index}-{h}"


def _fence_spans(text: str) -> list[tuple[int, int]]:
    """返回 fenced code block 的字符区间 [start, end)，含围栏行本身。"""
    spans: list[tuple[int, int]] = []
    pos = 0
    opened: int | None = None
    for line in text.splitlines(keepends=True):
        if line.strip().startswith(_FENCE_MARKS):
            if opened is None:
                opened = pos
            else:
                spans.append((opened, pos + len(line)))
                opened = None
        pos += len(line)
    if opened is not None:
        spans.append((opened, len(text)))
    return spans


def _fence_at(pos: int, spans: list[tuple[int, int]]) -> tuple[int, int] | None:
    for a, b in spans:
        if a <= pos < b:
            return a, b
    return None


def split_text(
    text: str,
    size: int,
    overlap: int,
    source: str,
    heading: str = "",
    respect_fences: bool = False,
) -> list[Chunk]:
    """把一段文本切成若干块。

    baseline（respect_fences=False）：每块不超过 size 个字符，优先在段落边界
    （\\n\\n）断开，找不到就硬切；相邻块重叠 overlap 个字符。
    heading 策略（respect_fences=True）：段落断点避开 fenced code block；
    硬切若落在代码块内，把块尾推到代码块结束（上限 2×size），不把代码/表格拦腰切断，
    也不会为了保住一个超长代码块而产出几千字的巨型块。
    """
    text = text.strip()
    if not text:
        return []

    spans = _fence_spans(text) if respect_fences else []
    chunks: list[Chunk] = []
    start = 0
    n = len(text)
    idx = 0

    while start < n:
        end = min(start + size, n)

        if end < n:
            cut = -1
            if respect_fences:
                hi = end
                while True:
                    i = text.rfind("\n\n", start + size // 2, hi)
                    if i == -1:
                        break
                    if _fence_at(i, spans) is None:
                        cut = i
                        break
                    hi = i
            else:
                cut = text.rfind("\n\n", start + size // 2, end)

            if cut != -1:
                end = cut
            elif respect_fences:
                fence = _fence_at(end, spans)
                if fence:
                    # 推到代码块结束，但最多 2×size：超长代码块宁可被切断，
                    # 也不能让一块涨到几千字（向量被稀释，还会撞模型截断长度）
                    end = min(fence[1], n, start + size * 2)

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

        next_start = max(end - overlap, start + 1)
        if respect_fences:
            fence = _fence_at(next_start, spans)
            # 回退到代码块开头，让下一块含有完整代码块；不能退到 start 之前
            if fence and fence[0] > start:
                next_start = fence[0]
        start = next_start

    return chunks


def _iter_sections(text: str, fallback: str) -> list[tuple[str, str]]:
    """按标题层级切成 (标题路径, 正文)。代码块内的 `#` 不算标题。"""
    sections: list[tuple[str, str]] = []
    stack: list[tuple[int, str]] = []
    buf: list[str] = []
    heading = ""
    in_fence = False

    def flush() -> None:
        body = "".join(buf).strip()
        if body:
            sections.append((heading or fallback, body))
        buf.clear()

    for line in text.splitlines(keepends=True):
        if line.strip().startswith(_FENCE_MARKS):
            in_fence = not in_fence
            buf.append(line)
            continue

        m = _HEADING_RE.match(line) if not in_fence else None
        if m:
            flush()
            level = len(m.group(1))
            title = m.group(2).strip().rstrip("#").strip()
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, title))
            heading = " / ".join(f"{'#' * lv} {t}" for lv, t in stack)
        else:
            buf.append(line)

    flush()
    return sections


def chunk_file(
    path: Path,
    corpus_dir: Path,
    size: int,
    overlap: int,
    strategy: str = "heading",
) -> list[Chunk]:
    """读一个 md 文件并切分。

    fixed   —— baseline，整篇当一个 section（heading 用文件名）。
    heading —— 按标题切 section，标题路径既进 heading 字段、也作为每块 text
               的前缀，让 embedding 吃到「这块在讲哪一节」。超长 section 仍由
               split_text 按 size 兜底。碎片块（< 50 字）先不丢，是否丢弃由
               evaluate.py 的前后数字决定。
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

    if strategy == "fixed":
        return split_text(text, size, overlap, source=rel, heading=path.stem)
    if strategy != "heading":
        raise ValueError(f"未知切分策略：{strategy}")

    chunks: list[Chunk] = []
    for heading, body in _iter_sections(text, path.stem):
        for c in split_text(
            body, size, overlap, source=rel, heading=heading, respect_fences=True
        ):
            c.text = f"{heading}\n\n{c.text}"
            chunks.append(c)

    # text 加过前缀，id 按最终内容重算，免得与另一策略撞 id
    for i, c in enumerate(chunks):
        c.id = _chunk_id(rel, i, c.text)
    return chunks
