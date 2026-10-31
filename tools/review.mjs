#!/usr/bin/env node
/**
 * 抽题自测 —— 按遗忘曲线挑今天该复习的卡片
 *
 * 用法：
 *   node tools/review.mjs              抽 3 张到期卡片
 *   node tools/review.mjs --n=5        抽 5 张
 *   node tools/review.mjs --all        无视到期时间，随机抽
 *   node tools/review.mjs --list       看所有卡的状态（进度条）
 *   node tools/review.mjs --due        只看今天有几张到期
 *   node tools/review.mjs --card=rag-02  单独复习某一张
 *   node tools/review.mjs --reset      清空复习记录（重来）
 *
 * 状态存在 tools/review-state.json，跟着 git 一起提交，换机器能续上。
 */

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CARDS_DIR = path.join(ROOT, 'cards')
const STATE_FILE = path.join(ROOT, 'tools', 'review-state.json')

// ── 颜色 ──────────────────────────────────────────────
const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s))
const dim = paint('2')
const bold = paint('1')
const green = paint('32')
const yellow = paint('33')
const red = paint('31')
const cyan = paint('36')

// ── 工具函数 ──────────────────────────────────────────
const todayStr = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const addDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const daysBetween = (a, b) => {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

/** 去掉 HTML 注释，压缩多余空行 */
const clean = (s) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

// ── 解析卡片 ──────────────────────────────────────────
function parseCard(file) {
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

  // 「已填」判定：30 秒版不是占位符，且有实质内容
  const placeholder = /^（待填）$/
  const filled = Boolean(short) && !placeholder.test(short) && short.length > 10

  return {
    id: fm.id || path.basename(file, '.md'),
    title: fm.title || h1 || path.basename(file, '.md'),
    stage: fm.stage || 'other',
    week: fm.week || '',
    file: path.relative(ROOT, file),
    short,
    followup,
    numbers,
    filled,
    hasNumbers: Boolean(numbers) && !placeholder.test(numbers) && numbers.length > 5,
  }
}

function loadCards() {
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

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8')
}

// ── 调度：自评分数 → 下次复习间隔 ──────────────────────
function nextInterval(level, prev) {
  const streak = prev?.streak ?? 0
  if (level === 1) return { days: 1, streak: 0 }
  if (level === 2) return { days: 3, streak: 0 }
  // level 3：连续答对才拉长
  const s = streak + 1
  return { days: s >= 3 ? 21 : 7, streak: s }
}

// ── 参数 ─────────────────────────────────────────────
function parseArgs(argv) {
  const opt = { mode: 'review', n: 3, card: null }
  for (const a of argv) {
    if (a === '--list') opt.mode = 'list'
    else if (a === '--due') opt.mode = 'due'
    else if (a === '--all') opt.mode = 'all'
    else if (a === '--reset') opt.mode = 'reset'
    else if (a.startsWith('--n=')) opt.n = Math.max(1, parseInt(a.slice(4), 10) || 3)
    else if (a.startsWith('--card=')) {
      opt.mode = 'card'
      opt.card = a.slice(7)
    } else if (a === '--help' || a === '-h') opt.mode = 'help'
  }
  return opt
}

// ── 输出 ─────────────────────────────────────────────
function printList(cards, state) {
  const today = todayStr()
  const filled = cards.filter((c) => c.filled)
  const withNums = filled.filter((c) => c.hasNumbers)
  const due = filled.filter((c) => {
    const s = state[c.id]
    return !s?.due || s.due <= today
  })

  console.log()
  console.log(bold(`  学习进度  ${filled.length}/${cards.length} 张已填`))
  console.log(dim(`  其中带「我的数字」：${withNums.length} 张    今天到期：${due.length} 张`))
  console.log()

  let stage = null
  for (const c of cards) {
    if (c.stage !== stage) {
      stage = c.stage
      console.log(dim(`  ── ${stage} ──`))
    }
    const s = state[c.id]
    let flag
    if (!c.filled) flag = dim('○ 待填')
    else if (!s?.due) flag = yellow('● 未复习')
    else if (s.due <= today) flag = red('● 到期')
    else flag = green(`○ ${s.due} 后`)

    const numFlag = c.filled ? (c.hasNumbers ? green('数') : red('缺')) : ' '
    const title = c.filled ? c.title : dim(c.title)
    console.log(`  ${numFlag} ${flag}  ${dim(c.id.padEnd(9))} ${title}`)
  }
  console.log()
  console.log(dim('  「数」= 有我的数字   「缺」= 我的数字还没填（面试会问穿）'))
  console.log()
}

function printDue(cards, state) {
  const today = todayStr()
  const due = cards.filter((c) => {
    if (!c.filled) return false
    const s = state[c.id]
    return !s?.due || s.due <= today
  })
  const unfilled = cards.filter((c) => !c.filled)
  console.log()
  console.log(`  今天到期：${bold(String(due.length))} 张    还没写：${dim(String(unfilled.length))} 张`)
  if (due.length) console.log(dim(`  最该看的：${due.slice(0, 3).map((c) => c.title).join(' / ')}`))
  console.log()
}

// ── 交互复习 ─────────────────────────────────────────
async function runReview(picked, state, rl) {
  const scores = []

  for (let i = 0; i < picked.length; i++) {
    const c = picked[i]
    const s = state[c.id] || {}

    console.log()
    console.log(dim('─'.repeat(64)))
    console.log(`${dim(`[${i + 1}/${picked.length}]`)} ${bold(c.title)}  ${dim(c.id)}`)
    if (s.due) console.log(dim(`  上次：${s.lastReview || '-'}  第 ${(s.times || 0) + 1} 次复习`))
    console.log()

    let buf = ''
    while (true) {
      const ans = await rl.question(dim('  在心里答完，按回车看答案（q 退出）  '))
      if (ans.trim().toLowerCase() === 'q') return { scores, quit: true }
      break
    }

    console.log()
    console.log(cyan('  ▸ 30 秒版'))
    console.log(
      c.short
        .split('\n')
        .map((l) => '    ' + l)
        .join('\n')
    )

    if (c.followup) {
      console.log()
      console.log(cyan('  ▸ 追问预演'))
      console.log(
        c.followup
          .split('\n')
          .map((l) => '    ' + l)
          .join('\n')
      )
    }

    console.log()
    console.log(dim(`  文件：${c.file}`))

    let level = 0
    while (!level) {
      const a = (await rl.question(dim('  自评  1 没答上 / 2 说清了 / 3 能扛追问 / s 跳过  '))).trim()
      if (a === '1' || a === '2' || a === '3') level = Number(a)
      else if (a === 's' || a === '') {
        console.log(dim('  跳过，明天再来'))
        level = 1
      }
    }

    const { days, streak } = nextInterval(level, s)
    state[c.id] = {
      due: addDays(days),
      level,
      streak,
      times: (s.times || 0) + 1,
      lastReview: todayStr(),
    }
    saveState(state)
    scores.push(level)

    const msg = level === 1 ? red('1 分') : level === 2 ? yellow('2 分') : green('3 分')
    console.log(`  → ${msg}  ${days} 天后再看（${state[c.id].due}）`)
  }

  return { scores, quit: false }
}

// ── 主流程 ───────────────────────────────────────────
async function main() {
  const opt = parseArgs(process.argv.slice(2))

  if (opt.mode === 'help') {
    console.log(`
  ${bold('抽题自测')} —— 按遗忘曲线挑今天该复习的卡片

  ${cyan('node tools/review.mjs')}              抽 3 张到期卡片
  ${cyan('node tools/review.mjs --n=5')}        抽 5 张
  ${cyan('node tools/review.mjs --all')}        无视到期，随机抽
  ${cyan('node tools/review.mjs --list')}       看所有卡状态（进度条）
  ${cyan('node tools/review.mjs --due')}        只看今天几张到期
  ${cyan('node tools/review.mjs --card=rag-02')} 单独复习某一张
  ${cyan('node tools/review.mjs --reset')}      清空复习记录

  自评：1 没答上（明天） / 2 说清了（3 天后） / 3 能扛追问（7 天后，连对三次转 21 天）
`)
    return
  }

  if (opt.mode === 'reset') {
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE)
    console.log('  已清空复习记录。')
    return
  }

  const cards = loadCards()
  const state = loadState()

  if (!cards.length) {
    console.log('  cards/ 下没有卡片。')
    return
  }

  if (opt.mode === 'list') return printList(cards, state)
  if (opt.mode === 'due') return printDue(cards, state)

  const today = todayStr()
  const filled = cards.filter((c) => c.filled)

  if (!filled.length) {
    console.log()
    console.log('  还没有填完的卡片，抽不出题。')
    console.log(dim('  先挑一张，把「30 秒版」用自己话写完（哪怕只有 3 句）。'))
    console.log(dim(`  卡片在：${path.relative(process.cwd(), CARDS_DIR)}`))
    console.log()
    return
  }

  let picked
  if (opt.mode === 'card') {
    const target = cards.find((c) => c.id === opt.card || c.file.includes(opt.card))
    if (!target) {
      console.log(`  找不到卡片：${opt.card}`)
      return
    }
    if (!target.filled) {
      console.log(`  ${target.id} 还没填「30 秒版」，先写再抽。`)
      return
    }
    picked = [target]
  } else if (opt.mode === 'all') {
    picked = [...filled].sort(() => Math.random() - 0.5).slice(0, opt.n)
  } else {
    const due = filled
      .filter((c) => {
        const s = state[c.id]
        return !s?.due || s.due <= today
      })
      .sort((a, b) => (state[a.id]?.due || '0000').localeCompare(state[b.id]?.due || '0000'))

    if (!due.length) {
      const next = filled
        .map((c) => state[c.id]?.due)
        .filter(Boolean)
        .sort()[0]
      console.log()
      console.log(`  今天没有到期的卡${next ? `，下次是 ${bold(next)}` : ''}。`)
      console.log(dim(`  已填 ${filled.length}/${cards.length} 张。可以去写新卡，或用 --all 随机抽。`))
      console.log()
      return
    }
    picked = due.slice(0, opt.n)
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  try {
    const { scores, quit } = await runReview(picked, state, rl)

    console.log()
    console.log(dim('─'.repeat(64)))
    if (quit) {
      console.log('  中途退出，已复习的已保存。')
    } else {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      const weak = picked.filter((c) => state[c.id]?.level === 1).length
      console.log(
        `  复习 ${bold(String(scores.length))} 张，平均 ${bold(avg.toFixed(1))} 分` +
          (weak ? `，${red(String(weak) + ' 张没答上')}` : green('，全部答上'))
      )
      if (weak) console.log(dim('  1 分的卡明天会再出现。答不上的，回去改「30 秒版」，别硬背。'))
      const rest = filled.filter((c) => {
        const s = state[c.id]
        return s?.due && s.due <= today
      }).length
      if (rest) console.log(dim(`  今天还有 ${rest} 张到期，可以再来一轮。`))
    }
    console.log()
  } catch (e) {
    if (e?.code !== 'ERR_USE_AFTER_CLOSE') throw e
    console.log('\n  已退出。')
  } finally {
    rl.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
