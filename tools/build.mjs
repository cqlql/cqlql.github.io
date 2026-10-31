#!/usr/bin/env node
/**
 * 把 cards/*.md 编译成单文件 dist/index.html
 * 双击即可打开，不需要服务器、不需要联网。
 *
 *   node tools/build.mjs
 *
 * 改完卡片跑一次即可。样式在 tools/client.css，逻辑在 tools/client.js。
 */

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, loadCards, loadState } from './lib.mjs'

const DIST = path.join(ROOT, 'dist')
const OUT = path.join(DIST, 'index.html')

// ── 极简 Markdown → HTML（只覆盖卡片里用到的语法）────────
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function inlineMd(s) {
  let t = escHtml(s)
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  return t
}

const renderItem = (parts) => `<li>${parts.map(inlineMd).join('<br>')}</li>`

function renderTable(rows) {
  const cells = rows.map((r) =>
    r
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim())
  )
  const head = cells[0] || []
  const body = cells.slice(2)
  return (
    '<table><thead><tr>' +
    head.map((c) => `<th>${inlineMd(c)}</th>`).join('') +
    '</tr></thead><tbody>' +
    body.map((r) => '<tr>' + r.map((c) => `<td>${inlineMd(c)}</td>`).join('') + '</tr>').join('') +
    '</tbody></table>'
  )
}

function mdToHtml(md) {
  if (!md) return ''
  const lines = md.split('\n')
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    // 引用块
    if (/^>\s?/.test(line)) {
      const buf = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      out.push(`<blockquote><p>${inlineMd(buf.join(' '))}</p></blockquote>`)
      continue
    }

    // 表格
    if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) {
      const rows = []
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i])
        i++
      }
      out.push(renderTable(rows))
      continue
    }

    // 无序列表
    if (/^\s*[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length) {
        const l = lines[i]
        if (/^\s*[-*]\s+/.test(l)) {
          items.push([l.replace(/^\s*[-*]\s+/, '')])
          i++
        } else if (/^\s{2,}\S/.test(l) && items.length) {
          items[items.length - 1].push(l.trim())
          i++
        } else break
      }
      out.push('<ul>' + items.map(renderItem).join('') + '</ul>')
      continue
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push([lines[i].replace(/^\s*\d+\.\s+/, '')])
        i++
      }
      out.push('<ol>' + items.map(renderItem).join('') + '</ol>')
      continue
    }

    // 段落
    const para = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\|/.test(lines[i])
    ) {
      para.push(lines[i].trim())
      i++
    }
    if (para.length) out.push(`<p>${inlineMd(para.join(' '))}</p>`)
  }

  return out.join('\n')
}

// ── 组装 ─────────────────────────────────────────────
const safeJson = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c')

const cards = loadCards()
const state = loadState()
const filled = cards.filter((c) => c.filled).length

const payload = cards.map((c) => ({
  id: c.id,
  title: c.title,
  stage: c.stage,
  week: c.week,
  file: c.file,
  filled: c.filled,
  hasNumbers: c.hasNumbers,
  short: mdToHtml(c.short),
  followup: mdToHtml(c.followup),
  // 未填的卡片也能点开看「面试官会问什么」
  questions: (c.followup.match(/^-\s*\*\*Q\*\*[:：]\s*(.+)$/gm) || []).map((l) =>
    l.replace(/^-\s*\*\*Q\*\*[:：]\s*/, '').trim()
  ),
}))

const css = fs.readFileSync(path.join(ROOT, 'tools', 'client.css'), 'utf8')
const js = fs.readFileSync(path.join(ROOT, 'tools', 'client.js'), 'utf8')

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>大模型应用 · 学习训练场</title>
<style>
${css}
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-inner">
    <div class="brand">学习训练场 <span>· 大模型应用</span></div>
    <div class="topbar-spacer"></div>
    <div class="stat" id="stat-filled"></div>
    <div class="stat" id="stat-due"></div>
    <button class="icon-btn" id="btn-theme" title="切换深浅色" aria-label="切换深浅色">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <circle cx="12" cy="12" r="4.2"/>
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>
      </svg>
    </button>
  </div>
  <div class="progress-line"><i id="progress-bar" style="width:0"></i></div>
</div>

<main>
  <div class="tabs">
    <button class="tab on" data-goto="review">今日复习</button>
    <button class="tab" data-goto="all">全部卡片</button>
  </div>

  <section class="view active" data-view="review">
    <div id="review-body"></div>
  </section>

  <section class="view" data-view="all">
    <div class="toolbar">
      <div class="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
        </svg>
        <input id="search-input" type="search" placeholder="搜索标题或编号" autocomplete="off">
      </div>
      <div class="seg">
        <button data-filter="all" class="on">全部</button>
        <button data-filter="due">到期</button>
        <button data-filter="todo">待填</button>
      </div>
    </div>
    <div id="list"></div>
    <div class="footnote">
      改卡片：编辑 cards/ 下的 md，然后运行 node tools/build.mjs 重新生成
      <br><br>
      <button class="btn" id="btn-export">导出记录</button>
      <button class="btn" id="btn-import">导入记录</button>
      <button class="btn" id="btn-reset">清空记录</button>
      <input type="file" id="file-input" accept="application/json,.json" hidden>
      <br><br>
      ${filled} 张已填 · ${cards.length} 张卡
    </div>
  </section>
</main>

<script type="application/json" id="cards-data">${safeJson(payload)}</script>
<script type="application/json" id="initial-state">${safeJson(state)}</script>
<script>
${js}
</script>
</body>
</html>
`

fs.mkdirSync(DIST, { recursive: true })
fs.writeFileSync(OUT, html, 'utf8')

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0)
console.log(`  已生成 dist/index.html　${kb} KB`)
console.log(`  卡片 ${cards.length} 张，已填 ${filled} 张　双击打开即可复习`)
