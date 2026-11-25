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


@dataclass
class _Section:
    """标题切分的中间产物：path 是完整标题路径，line 是自己那行标题，body 是正文。"""

    path: str
    line: str
    body: str


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


def _iter_sections(text: str, fallback: str) -> list[_Section]:
    """按标题层级切成 _Section（完整标题路径 / 本节标题行 / 正文）。

    代码块内的 `#` 不算标题。文件开头、第一个标题之前的内容，path 用 fallback（文件名）兜底。
    """
    sections: list[_Section] = []
    stack: list[tuple[int, str]] = []
    buf: list[str] = []
    heading = ""
    heading_line = ""
    in_fence = False

    def flush() -> None:
        body = "".join(buf).strip()
        if body:
            sections.append(_Section(path=heading or fallback, line=heading_line, body=body))
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
            heading_line = f"{'#' * level} {title}"
            heading = " / ".join(f"{'#' * lv} {t}" for lv, t in stack)
        else:
            buf.append(line)

    flush()
    return sections


def _merge_short_sections(
    sections: list[_Section], min_chars: int, max_chars: int
) -> list[_Section]:
    """短 section 向前合并：正文 < min_chars 才并，且并进前一块后不超过 max_chars。

    规则写死三条，改之前先想清楚为什么：
    1. **只向前并**：前一块是同一文件里上一节，语义上通常就是它的补充说明；
       文件第一段没有前一块，保持原样（合并后顺序会乱，不值得为一个开头短节特判）。
    2. **被并节的标题行保留在正文里**：embedding 仍能看到「这一小段讲的是哪个子标题」，
       只是不再单独成一个块。
    3. **合并后不超过 max_chars（= CHUNK_SIZE）**：超过就会在 split_text 里再被切开，
       短块只是从「独立碎片」变成「下一块的开头碎片」，没解决问题。
    """
    if min_chars <= 0:
        return sections

    out: list[_Section] = []
    for s in sections:
        if out and len(s.body) < min_chars:
            prev = out[-1]
            merged_body = prev.body + "\n\n" + (f"{s.line}\n\n" if s.line else "") + s.body
            if len(merged_body) <= max_chars:
                out[-1] = _Section(path=prev.path, line=prev.line, body=merged_body)
                continue
        out.append(s)
    return out


def chunk_file(
    path: Path,
    corpus_dir: Path,
    size: int,
    overlap: int,
    strategy: str = "heading",
    merge_min_chars: int = 0,
) -> list[Chunk]:
    """读一个 md 文件并切分。

    fixed   —— baseline，整篇当一个 section（heading 用文件名）。
    heading —— 按标题切 section，标题路径既进 heading 字段、也作为每块 text
               的前缀，让 embedding 吃到「这块在讲哪一节」。超长 section 仍由
               split_text 按 size 兜底。短 section 按 `merge_min_chars` 向前合并
               （0 = 不合并，baseline）；碎片块是否该丢由 evaluate.py 的前后数字决定。
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
    sections = _iter_sections(text, path.stem)
    sections = _merge_short_sections(sections, merge_min_chars, max_chars=size)
    for section in sections:
        for c in split_text(
            section.body, size, overlap, source=rel, heading=section.path, respect_fences=True
        ):
            c.text = f"{section.path}\n\n{c.text}"
            chunks.append(c)

    # text 加过前缀，id 按最终内容重算，免得与另一策略撞 id
    for i, c in enumerate(chunks):
        c.id = _chunk_id(rel, i, c.text)
    return chunks
