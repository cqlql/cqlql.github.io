#!/usr/bin/env node
/**
 * 把简历 Markdown 转成打印友好的 HTML。
 * 只支持简历里用到的语法，不追求通用 Markdown 兼容。
 *
 * 用法：node scripts/build-resume.mjs
 * 输出：dist/<原名>.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

const FILES = [
  '简历-前端开发.md',
  '简历-Java后端.md',
  '简历-全栈开发.md',
  '简历-AI应用.md',
  '简历-大模型应用.md',
];

/** 行内：粗体、代码、链接、尖括号链接 */
function inline(text) {
  let s = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // <https://...> 自动链接
  s = s.replace(/&lt;(https?:\/\/[^\s]+?)&gt;/g, '<a href="$1">$1</a>');
  // [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // `code`
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // **bold**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s;
}

function isTableRow(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function parseTable(lines, start) {
  const rows = [];
  let i = start;
  while (i < lines.length && isTableRow(lines[i])) {
    rows.push(lines[i].trim());
    i += 1;
  }
  if (rows.length < 2) return null;

  const cells = (row) =>
    row
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());

  const head = cells(rows[0]);
  const body = rows.slice(2).map(cells);

  const html =
    '<table><thead><tr>' +
    head.map((c) => `<th>${inline(c)}</th>`).join('') +
    '</tr></thead><tbody>' +
    body
      .map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>')
      .join('') +
    '</tbody></table>';

  return { html, next: i };
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let listType = null; // 'ul' | 'ol'

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (line === '') {
      closeList();
      i += 1;
      continue;
    }

    // 分隔线
    if (/^---+$/.test(line)) {
      closeList();
      out.push('<hr>');
      i += 1;
      continue;
    }

    // 标题
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // 引用
    if (line.startsWith('>')) {
      closeList();
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    // 表格
    if (isTableRow(line)) {
      const t = parseTable(lines, i);
      if (t) {
        closeList();
        out.push(t.html);
        i = t.next;
        continue;
      }
    }

    // 无序列表
    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (listType !== 'ul') {
        closeList();
        out.push('<ul>');
        listType = 'ul';
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      i += 1;
      continue;
    }

    // 有序列表
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      if (listType !== 'ol') {
        closeList();
        out.push('<ol>');
        listType = 'ol';
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      i += 1;
      continue;
    }

    // 段落
    closeList();
    out.push(`<p>${inline(line)}</p>`);
    i += 1;
  }

  closeList();
  return out.join('\n');
}

const CSS = `
  @page { size: A4; margin: 14mm 15mm 12mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    font-family: "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif;
    font-size: 10.2pt;
    line-height: 1.66;
    color: #1a1a1a;
  }
  h1 {
    font-size: 20pt;
    font-weight: 700;
    margin: 0 0 5px;
    letter-spacing: 1px;
    text-align: center;
  }
  h1 + p {
    text-align: center;
    font-size: 11pt;
    color: #1f3a5f;
    margin: 0 0 3px;
    font-weight: 600;
  }
  h1 + p + p {
    text-align: center;
    font-size: 9.3pt;
    color: #555;
    margin: 0 0 2px;
  }
  h1 + p + p + p {
    text-align: center;
    font-size: 9.3pt;
    color: #555;
    margin: 0 0 6px;
  }
  h2 {
    font-size: 12.5pt;
    font-weight: 700;
    color: #1f3a5f;
    margin: 14px 0 8px;
    padding-bottom: 3px;
    border-bottom: 1.2px solid #1f3a5f;
    break-after: avoid;
  }
  h3 {
    font-size: 11pt;
    font-weight: 700;
    margin: 12px 0 4px;
    color: #12314f;
    padding-left: 7px;
    border-left: 3px solid #1f3a5f;
    break-after: avoid;
  }
  h4 { font-size: 10.2pt; margin: 8px 0 3px; break-after: avoid; }
  p { margin: 0 0 4px; }
  ul, ol { margin: 3px 0 6px; padding-left: 21px; }
  li { margin: 0 0 3px; break-inside: avoid; }
  li > strong:first-child { color: #111; }
  hr { display: none; }
  a { color: #1a4f8a; text-decoration: none; }
  code {
    font-family: Consolas, "Courier New", monospace;
    font-size: 9.4pt;
    background: #f2f4f7;
    padding: 0 3px;
    border-radius: 2px;
  }
  strong { font-weight: 700; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 5px 0 8px;
    font-size: 9.4pt;
    break-inside: avoid;
  }
  th, td {
    border: 1px solid #d8dde3;
    padding: 3px 6px;
    text-align: left;
    vertical-align: top;
  }
  th { background: #f2f5f9; font-weight: 700; }
  blockquote {
    margin: 4px 0 6px;
    padding: 5px 9px;
    background: #f7f9fb;
    border-left: 3px solid #b9c6d6;
    color: #333;
    font-size: 9.6pt;
  }
  blockquote p { margin: 0; }
`;

fs.mkdirSync(OUT, { recursive: true });

let built = 0;
for (const file of FILES) {
  const src = path.join(ROOT, file);
  if (!fs.existsSync(src)) {
    console.warn(`跳过（不存在）：${file}`);
    continue;
  }
  const md = fs.readFileSync(src, 'utf8');
  const body = mdToHtml(md);
  const name = path.basename(file, '.md');
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${name}</title>
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
  fs.writeFileSync(path.join(OUT, `${name}.html`), html, 'utf8');
  built += 1;
  console.log(`✓ ${name}.html`);
}

console.log(`\n共生成 ${built} 个 HTML → ${OUT}`);
