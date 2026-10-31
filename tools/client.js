/* 学习训练场 · 复习界面 */
;(function () {
  'use strict'

  var CARDS = JSON.parse(document.getElementById('cards-data').textContent)
  var INITIAL_STATE = JSON.parse(document.getElementById('initial-state').textContent)
  var KEY = 'llm-learning-state-v1'
  var THEME_KEY = 'llm-theme'

  // ── 日期 ────────────────────────────────────────────
  function pad(n) {
    return n < 10 ? '0' + n : '' + n
  }
  function fmt(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }
  function todayStr() {
    return fmt(new Date())
  }
  function addDays(n) {
    var d = new Date()
    d.setDate(d.getDate() + n)
    return fmt(d)
  }

  // ── 状态 ────────────────────────────────────────────
  var state = (function () {
    try {
      var raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw)
    } catch (e) {}
    return JSON.parse(JSON.stringify(INITIAL_STATE))
  })()

  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch (e) {}
  }

  function nextInterval(level, prev) {
    var streak = (prev && prev.streak) || 0
    if (level === 1) return { days: 1, streak: 0 }
    if (level === 2) return { days: 3, streak: 0 }
    var s = streak + 1
    return { days: s >= 3 ? 21 : 7, streak: s }
  }

  var today = todayStr()

  function filledCards() {
    return CARDS.filter(function (c) {
      return c.filled
    })
  }

  function dueList() {
    return filledCards()
      .filter(function (c) {
        var s = state[c.id]
        return !s || !s.due || s.due <= today
      })
      .sort(function (a, b) {
        var da = (state[a.id] && state[a.id].due) || '0000'
        var db = (state[b.id] && state[b.id].due) || '0000'
        return da < db ? -1 : da > db ? 1 : 0
      })
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  var STAGE = {
    rag: { short: 'RAG', full: '阶段一 · RAG' },
    agent: { short: 'Agent', full: '阶段二 · Agent' },
    eval: { short: '评测', full: '阶段三 · 评测' },
  }
  function stageShort(s) {
    return (STAGE[s] && STAGE[s].short) || s
  }
  function stageFull(s) {
    return (STAGE[s] && STAGE[s].full) || s
  }

  // ── 会话 ────────────────────────────────────────────
  var session = null // { cards: [], pos: 0, scores: [] }
  var flipped = false
  var view = 'review'
  var filter = 'all'
  var keyword = ''

  function startSession(cards) {
    session = { cards: cards, pos: 0, scores: [] }
    flipped = false
    showView('review')
    renderReview()
  }

  function showView(v) {
    view = v
    document.querySelectorAll('.view').forEach(function (el) {
      el.classList.toggle('active', el.dataset.view === v)
    })
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('on', b.dataset.goto === v)
    })
    if (v === 'all') renderList()
    if (v === 'review') renderReview()
    window.scrollTo({ top: 0 })
  }

  // ── 顶栏统计 ────────────────────────────────────────
  function renderStats() {
    var f = filledCards().length
    var d = dueList().length
    document.getElementById('stat-filled').innerHTML = '<b>' + f + '</b>/' + CARDS.length
    document.getElementById('stat-due').innerHTML = '今日到期 <b>' + d + '</b>'
    document.getElementById('progress-bar').style.width =
      (CARDS.length ? (f / CARDS.length) * 100 : 0) + '%'
  }

  // ── 复习视图 ────────────────────────────────────────
  function renderReview() {
    var el = document.getElementById('review-body')
    renderStats()

    if (!session) {
      var due = dueList()
      if (!due.length) {
        el.innerHTML = emptyDone()
        return
      }
      // 默认进来到期队列
      session = { cards: due, pos: 0, scores: [] }
    }

    if (session.pos >= session.cards.length) {
      el.innerHTML = sessionDone()
      return
    }

    var c = session.cards[session.pos]
    var s = state[c.id]
    var total = session.cards.length
    var num = session.pos + 1
    var head =
      '<div class="card-head">' +
      '<div class="tag"><em>' +
      stageShort(c.stage) +
      '</em>第 ' +
      esc(c.week || '-') +
      ' 周</div>' +
      (total > 1 ? '<div class="counter">' + num + ' / ' + total + '</div>' : '') +
      '</div>'

    // 未填的卡片：只给问题，不给答案
    if (!c.filled) {
      var qs = (c.questions || [])
        .map(function (q) {
          return '<li>' + esc(q) + '</li>'
        })
        .join('')
      el.innerHTML =
        '<div class="card preview">' +
        head +
        '<h1>' +
        esc(c.title) +
        '</h1>' +
        '<div class="notice">这张还没填「30 秒版」' +
        '<br><span>答案得自己写，写不出来说明还没懂。照着下面几个问题答一遍，就是这张卡的内容。</span></div>' +
        (qs
          ? '<div class="followup"><div class="answer-head">面试官会这么问</div>' +
            '<div class="prose"><ul class="qs">' +
            qs +
            '</ul></div></div>'
          : '') +
        '<div class="actions"><button class="btn" id="btn-back">返回列表</button></div>' +
        '</div>' +
        '<div class="footnote">' +
        esc(c.file) +
        '</div>'
      return
    }

    var backExtra = ''
    if (c.followup) {
      backExtra =
        '<div class="followup">' +
        '<div class="answer-head">追问预演</div>' +
        '<div class="prose">' +
        c.followup +
        '</div></div>'
    }

    el.innerHTML =
      '<div class="card' +
      (flipped ? ' flipped' : '') +
      '" id="card" tabindex="0" role="button">' +
      '<div class="face-front">' +
      head +
      '<h1>' +
      esc(c.title) +
      '</h1>' +
      '<div class="hint">先在心里答一遍，再翻开　<kbd>空格</kbd></div>' +
      '</div>' +
      '<div class="face-back">' +
      '<div class="answer-head">30 秒版</div>' +
      '<div class="prose">' +
      (c.short || '<p>（还没写）</p>') +
      '</div>' +
      backExtra +
      '<div class="actions">' +
      '<button data-score="1"><b>1</b> 没答上</button>' +
      '<button data-score="2"><b>2</b> 说清了</button>' +
      '<button data-score="3"><b>3</b> 能扛追问</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="footnote">' +
      esc(c.file) +
      (s && s.lastReview ? '　上次复习 ' + esc(s.lastReview) : '') +
      '</div>'
  }

  function emptyDone() {
    var todo = CARDS.filter(function (c) {
      return !c.filled
    }).length
    return (
      '<div class="empty">' +
      '<div class="big">今天没有到期的卡</div>' +
      '<p>' +
      (filledCards().length
        ? '间隔重复的休息日也是学习的一部分。想加练可以随机抽一张。'
        : '还没有填完的卡片。先去写一张——只填「30 秒版」那一段就够。') +
      '</p>' +
      '<div class="empty-actions">' +
      (filledCards().length
        ? '<button class="btn primary" id="btn-random">随机抽一张</button>'
        : '') +
      '<button class="btn" id="btn-all">看全部卡片' + (todo ? '（' + todo + ' 张待填）' : '') + '</button>' +
      '</div></div>'
    )
  }

  function sessionDone() {
    var n = session.scores.length
    var sum = session.scores.reduce(function (a, b) {
      return a + b
    }, 0)
    var avg = n ? (sum / n).toFixed(1) : '0'
    var weak = session.scores.filter(function (x) {
      return x === 1
    }).length
    var rest = dueList().length

    return (
      '<div class="empty">' +
      '<div class="big">这一轮结束了</div>' +
      '<p>复习 ' +
      n +
      ' 张，平均 ' +
      avg +
      ' 分' +
      (weak ? '，其中 ' + weak + ' 张没答上' : '，全部答上') +
      (rest ? '。还有 ' + rest + ' 张到期。' : '。') +
      '</p>' +
      '<div class="empty-actions">' +
      (rest ? '<button class="btn primary" id="btn-more">再来一轮</button>' : '') +
      '<button class="btn" id="btn-all">看全部卡片</button>' +
      '</div></div>'
    )
  }

  function flip() {
    if (!session || session.pos >= session.cards.length) return
    var cur = session.cards[session.pos]
    if (!cur || !cur.filled) return
    flipped = !flipped
    var card = document.getElementById('card')
    if (card) card.classList.toggle('flipped', flipped)
    if (flipped) {
      setTimeout(function () {
        var el = document.getElementById('card')
        if (!el) return
        var top = el.getBoundingClientRect().top + window.scrollY - 72
        if (top < window.scrollY) window.scrollTo({ top: top, behavior: 'smooth' })
      }, 10)
    }
  }

  function score(level) {
    if (!session || session.pos >= session.cards.length) return
    var c = session.cards[session.pos]
    if (!c || !c.filled) return
    var prev = state[c.id]
    var r = nextInterval(level, prev)

    state[c.id] = {
      due: addDays(r.days),
      level: level,
      streak: r.streak,
      times: ((prev && prev.times) || 0) + 1,
      lastReview: today,
    }
    saveState()

    session.scores.push(level)
    session.pos++
    flipped = false
    renderReview()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── 全部卡片 ────────────────────────────────────────
  function statusOf(c) {
    if (!c.filled) return { cls: 'todo', label: '待填' }
    var s = state[c.id]
    if (!s || !s.due) return { cls: 'fresh', label: '未复习' }
    if (s.due <= today) return { cls: 'due', label: '到期' }
    return { cls: 'ok', label: s.due }
  }

  function renderList() {
    var el = document.getElementById('list')
    var kw = keyword.trim().toLowerCase()

    var items = CARDS.filter(function (c) {
      if (kw && (c.title + ' ' + c.id).toLowerCase().indexOf(kw) < 0) return false
      if (filter === 'due') {
        var s = state[c.id]
        return c.filled && (!s || !s.due || s.due <= today)
      }
      if (filter === 'todo') return !c.filled
      return true
    })

    if (!items.length) {
      el.innerHTML = '<div class="empty"><p>没有匹配的卡片</p></div>'
      return
    }

    var groups = {}
    var order = []
    items.forEach(function (c) {
      if (!groups[c.stage]) {
        groups[c.stage] = []
        order.push(c.stage)
      }
      groups[c.stage].push(c)
    })

    var html = ''
    order.forEach(function (st) {
      html += '<div class="group-title">' + esc(stageFull(st)) + '</div><div class="list">'
      groups[st].forEach(function (c) {
        var stt = statusOf(c)
        var pill = c.filled
          ? c.hasNumbers
            ? '<span class="pill num">有数字</span>'
            : '<span class="pill nonum">缺数字</span>'
          : ''
        html +=
          '<div class="item' +
          (c.filled ? '' : ' todo') +
          '" data-id="' +
          esc(c.id) +
          '">' +
          '<span class="dot ' +
          stt.cls +
          '"></span>' +
          '<div class="item-body">' +
          '<div class="item-title">' +
          esc(c.title) +
          '</div>' +
          '<div class="item-meta"><span>' +
          esc(c.id) +
          '</span><span>' +
          esc(stt.label) +
          '</span></div>' +
          '</div>' +
          pill +
          '</div>'
      })
      html += '</div>'
    })

    el.innerHTML = html
  }

  // ── 事件 ────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var t = e.target

    // 自评
    var sc = t.closest('[data-score]')
    if (sc) {
      e.stopPropagation()
      score(Number(sc.dataset.score))
      return
    }

    // 卡片翻面
    var card = t.closest('#card')
    if (card) {
      if (!flipped) flip()
      return
    }

    // 列表项
    var item = t.closest('.item')
    if (item) {
      var c = CARDS.find(function (x) {
        return x.id === item.dataset.id
      })
      if (c) startSession([c])
      return
    }

    if (t.closest('#btn-back')) return showView('all')

    // 按钮
    if (t.closest('#btn-random')) {
      var f = filledCards()
      if (f.length) startSession([f[Math.floor(Math.random() * f.length)]])
      return
    }
    if (t.closest('#btn-all')) return showView('all')
    if (t.closest('#btn-more')) return startSession(dueList())

    var tab = t.closest('.tab')
    if (tab) {
      session = null
      return showView(tab.dataset.goto)
    }

    var seg = t.closest('[data-filter]')
    if (seg) {
      filter = seg.dataset.filter
      document.querySelectorAll('[data-filter]').forEach(function (b) {
        b.classList.toggle('on', b.dataset.filter === filter)
      })
      renderList()
      return
    }

    if (t.closest('#btn-theme')) {
      var cur = document.documentElement.getAttribute('data-theme')
      if (!cur) {
        cur = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      var next = cur === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch (err) {}
      return
    }

    if (t.closest('#btn-export')) {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
      var a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'review-state.json'
      a.click()
      return
    }

    if (t.closest('#btn-import')) {
      document.getElementById('file-input').click()
      return
    }

    if (t.closest('#btn-reset')) {
      if (confirm('清空所有复习记录？这个操作不可撤销。')) {
        state = {}
        saveState()
        session = null
        renderReview()
        renderList()
      }
      return
    }
  })

  document.addEventListener('input', function (e) {
    if (e.target.id === 'search-input') {
      keyword = e.target.value
      renderList()
    }
  })

  document.getElementById('file-input').addEventListener('change', function (e) {
    var file = e.target.files[0]
    if (!file) return
    var reader = new FileReader()
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result)
        state = data
        saveState()
        session = null
        renderReview()
        renderList()
        alert('已导入 ' + Object.keys(data).length + ' 条复习记录。')
      } catch (err) {
        alert('文件格式不对，需要 review-state.json。')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  })

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT') return
    if (view !== 'review' || !session) return

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (!flipped) flip()
    } else if (flipped && (e.key === '1' || e.key === '2' || e.key === '3')) {
      e.preventDefault()
      score(Number(e.key))
    }
  })

  // ── 初始化 ──────────────────────────────────────────
  try {
    var th = localStorage.getItem(THEME_KEY)
    if (th) document.documentElement.setAttribute('data-theme', th)
  } catch (e) {}

  renderStats()
  showView('review')
})()
