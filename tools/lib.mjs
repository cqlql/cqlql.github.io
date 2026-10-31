/**
 * 卡片解析与状态读写的公共逻辑
 * review.mjs（终端）与 build.mjs（生成 HTML）共用，避免两处判定不一致。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const CARDS_DIR = path.join(ROOT, 'cards')
export const STATE_FILE = path.join(ROOT, 'tools', 'review-state.json')

// ── 日期 ──────────────────────────────────────────────
export const todayStr = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const addDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ── 文本 ──────────────────────────────────────────────
/** 去掉 HTML 注释，压缩多余空行 */
export const clean = (s) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const PLACEHOLDER = /^（待填）$/

// ── 解析 ──────────────────────────────────────────────
export function parseCard(file) {
  const raw = fs.readFileSync(file, 'utf8')

  const fm = {}
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (fmMatch) {
    for (const line of fmMatch[1].split(/\r?\n/)) {
      const i = line.indexOf(':')
      if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  }

  const body = fmMatch ? raw.slice(fmMatch[0].length) : raw
  const chunks = body.split(/^## /m)
  const sections = {}
  for (const chunk of chunks.slice(1)) {
    const nl = chunk.indexOf('\n')
    if (nl < 0) continue
    sections[chunk.slice(0, nl).trim()] = clean(chunk.slice(nl + 1))
  }

  const h1 = (body.match(/^# (.+)$/m) || [])[1]?.trim()
  const short = sections['30 秒版'] || ''
  const followup = sections['追问预演'] || ''
  const numbers = sections['我的数字'] || ''
  const expand = sections['展开'] || ''

  const filled = Boolean(short) && !PLACEHOLDER.test(short) && short.length > 10

  return {
    id: fm.id || path.basename(file, '.md'),
    title: fm.title || h1 || path.basename(file, '.md'),
    stage: fm.stage || 'other',
    week: fm.week || '',
    file: path.relative(ROOT, file).replace(/\\/g, '/'),
    short,
    expand,
    followup,
    numbers,
    sections,
    filled,
    hasNumbers: Boolean(numbers) && !PLACEHOLDER.test(numbers) && numbers.length > 5,
  }
}

export function loadCards() {
  const out = []
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (ent.name.endsWith('.md') && !ent.name.startsWith('_')) out.push(parseCard(p))
    }
  }
  walk(CARDS_DIR)
  return out.sort((a, b) => a.file.localeCompare(b.file, 'zh'))
}

// ── 状态 ──────────────────────────────────────────────
export function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

export function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8')
}

// ── 调度：自评分数 → 下次复习间隔 ──────────────────────
export function nextInterval(level, prev) {
  const streak = prev?.streak ?? 0
  if (level === 1) return { days: 1, streak: 0 }
  if (level === 2) return { days: 3, streak: 0 }
  const s = streak + 1
  return { days: s >= 3 ? 21 : 7, streak: s }
}

/** 今天到期（含从未复习过）的已填卡片 */
export function dueCards(cards, state, today = todayStr()) {
  return cards
    .filter((c) => c.filled)
    .filter((c) => {
      const s = state[c.id]
      return !s?.due || s.due <= today
    })
    .sort((a, b) => (state[a.id]?.due || '0000').localeCompare(state[b.id]?.due || '0000'))
}
