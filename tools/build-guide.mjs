/**
 * 把《AI Agent Skills 学习与面试指南》md 生成离线 HTML 讲义。
 * 用法：node tools/build-guide.mjs
 * 改了原文 md 后重跑本脚本即可，不要手改生成的 HTML。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'AI-Agent-Skills-学习与面试指南.md')
const OUT = path.join(ROOT, '手册', 'AI-Agent-Skills-学习与面试指南.html')

// ── 行内与块级渲染 ─────────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function inline(s) {
  let t = esc(s)
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  return t
}

function renderTable(rows) {
  const cells = rows.map((r) =>
    r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
  )
  const head = cells[0] || []
  return (
    '<table><thead><tr>' +
    head.map((c) => `<th>${inline(c)}</th>`).join('') +
    '</tr></thead><tbody>' +
    cells.slice(2).map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
    '</tbody></table>'
  )
}

function renderQuote(lines) {
  let out = '<blockquote>'
  let j = 0
  while (j < lines.length) {
    const l = lines[j]
    if (/^\d+\.\s+/.test(l)) {
      const items = []
      while (j < lines.length && /^\d+\.\s+/.test(lines[j])) {
        items.push(lines[j++].replace(/^\d+\.\s+/, ''))
      }
      out += '<ol>' + items.map((x) => `<li>${inline(x)}</li>`).join('') + '</ol>'
    } else if (l.trim()) {
      out += `<p>${inline(l)}</p>`
      j++
    } else {
      j++
    }
  }
  return out + '</blockquote>'
}

// ── 主解析 ────────────────────────────────────────────
function parse(md) {
  const lines = md.split(/\r?\n/)
  const out = []
  const toc = []
  let n = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    // 标题
    const h = line.match(/^(#{1,4})\s+(.+)$/)
    if (h) {
      const level = h[1].length
      const text = h[2].trim()
      const id = 's' + ++n
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`)
      if (level === 2 || level === 3) toc.push({ level, id, text })
      i++
      if (level === 1) {
        out.push(
          '<div class="status">' +
          '<span class="tag">原文完整版 · 8 章</span>' +
          '<span class="tag blue">阅读讲义</span>' +
          '<span>复习抽题用 <a href="../index.html">导航页</a> 里的《AI Agent Skills 复习手册》。</span>' +
          '</div>'
        )
      }
      continue
    }

    // 分隔线
    if (/^---\s*$/.test(line)) { out.push('<hr>'); i++; continue }

    // 代码块
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim() || 'text'
      const buf = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++])
      i++
      out.push(
        `<pre><code class="language-${esc(lang)}">${esc(buf.join('\n'))}</code>` +
        '<button class="copy" type="button">复制</button></pre>'
      )
      continue
    }

    // 自测题的参考答案 → 折叠
    if (/^参考答案：/.test(line)) {
      const text = line.replace(/^参考答案：/, '').trim()
      out.push(`<details class="answer"><summary>参考答案</summary><p>${inline(text)}</p></details>`)
      i++
      continue
    }

    // 引用块（文首状态行是文档治理元信息，不进阅读版 HTML）
    if (/^>\s?/.test(line)) {
      const buf = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i++].replace(/^>\s?/, ''))
      }
      if (/^状态：/.test(buf[0] || '')) continue
      out.push(renderQuote(buf))
      continue
    }

    // 表格
    if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) {
      const rows = []
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++])
      out.push(renderTable(rows))
      continue
    }

    // 无序列表
    if (/^\s*[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length) {
        const l = lines[i]
        if (/^\s*[-*]\s+/.test(l)) { items.push(l.replace(/^\s*[-*]\s+/, '')); i++ }
        else if (/^\s{2,}\S/.test(l) && items.length) { items[items.length - 1] += ' ' + l.trim(); i++ }
        else break
      }
      out.push('<ul>' + items.map((x) => `<li>${inline(x)}</li>`).join('') + '</ul>')
      continue
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*\d+\.\s+/, ''))
      }
      out.push('<ol>' + items.map((x) => `<li>${inline(x)}</li>`).join('') + '</ol>')
      continue
    }

    // 段落
    const para = []
    while (
      i < lines.length && lines[i].trim() &&
      !/^#{1,4}\s/.test(lines[i]) && !/^---\s*$/.test(lines[i]) &&
      !/^```/.test(lines[i]) && !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\|/.test(lines[i]) && !/^参考答案：/.test(lines[i])
    ) {
      para.push(lines[i++].trim())
    }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`)
  }

  return { body: out.join('\n'), toc }
}

// ── 页面模板 ─────────────────────────────────────────
const CSS = `
:root{
  --bg:#ffffff; --fg:#1d1d1b; --muted:#66665f; --faint:#8a8a82;
  --line:#e4e4df; --panel:#f7f7f4; --panel2:#f0f0ec;
  --accent:#185fa5; --accent-bg:#e6f1fb; --accent-line:#b5d4f4;
  --ok:#0f6e56; --ok-bg:#e1f5ee; --ok-line:#9fe1cb;
  --warn:#a32d2d; --warn-bg:#fcebeb; --warn-line:#f7c1c1;
  --amber:#854f0b; --amber-bg:#faeeda;
  --mono:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
}
html[data-theme="dark"]{
  --bg:#1c1c1a; --fg:#ecece6; --muted:#a8a89f; --faint:#7e7e76;
  --line:#383833; --panel:#262624; --panel2:#2e2e2a;
  --accent:#85b7eb; --accent-bg:#12283f; --accent-line:#2a4a6b;
  --ok:#5dcaa5; --ok-bg:#0d2c23; --ok-line:#1d5a45;
  --warn:#f09595; --warn-bg:#3a1b1b; --warn-line:#6d3030;
  --amber:#fac775; --amber-bg:#3a2c12;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--sans);font-size:15px;line-height:1.75;-webkit-font-smoothing:antialiased}
#progress{position:fixed;top:0;left:0;height:2px;width:0;background:var(--accent);z-index:50;transition:width .1s linear}
.wrap{display:flex;max-width:1240px;margin:0 auto;gap:38px;padding:0 24px}
aside{width:226px;flex:0 0 226px;position:sticky;top:0;height:100vh;overflow-y:auto;padding:30px 0 40px;border-right:1px solid var(--line)}
main{flex:1;min-width:0;max-width:830px;padding:36px 0 100px}
.brand{font-size:12px;color:var(--faint);letter-spacing:.06em;margin-bottom:14px}
aside a{display:block;color:var(--muted);text-decoration:none;font-size:13px;padding:5px 10px;border-left:2px solid transparent;border-radius:0 5px 5px 0;transition:.15s}
aside a:hover{color:var(--fg);background:var(--panel)}
aside a.on{color:var(--accent);border-left-color:var(--accent);background:var(--accent-bg);font-weight:500}
aside a.lv3{padding-left:22px;font-size:12px;color:var(--faint)}
aside a.lv3.on{color:var(--accent)}
.toolrow{display:flex;gap:8px;margin-top:22px;flex-wrap:wrap;align-items:center}
button{font-family:inherit;font-size:12px;color:var(--muted);background:transparent;border:0.5px solid var(--line);border-radius:7px;padding:5px 10px;cursor:pointer;transition:.15s}
button:hover{color:var(--fg);border-color:var(--muted);background:var(--panel)}
.backlink{font-size:12px;color:var(--muted);text-decoration:none;border:0.5px solid var(--line);border-radius:7px;padding:5px 10px;transition:.15s}
.backlink:hover{color:var(--accent);border-color:var(--accent-line);background:var(--accent-bg)}
h1{font-size:29px;line-height:1.3;font-weight:600;margin:0 0 10px;letter-spacing:-.01em;scroll-margin-top:20px}
h2{font-size:21px;font-weight:600;margin:52px 0 16px;padding-top:14px;border-top:1px solid var(--line);scroll-margin-top:20px}
h3{font-size:16px;font-weight:600;margin:28px 0 10px;scroll-margin-top:20px}
h4{font-size:14px;font-weight:600;margin:20px 0 8px;color:var(--accent)}
p{margin:0 0 14px}
ul,ol{margin:0 0 14px;padding-left:22px}
li{margin-bottom:6px}
a{color:var(--accent)}
code{font-family:var(--mono);font-size:.88em;background:var(--panel2);padding:1px 5px;border-radius:4px;word-break:break-word}
pre{background:var(--panel);border:0.5px solid var(--line);border-radius:10px;padding:14px 16px;overflow-x:auto;font-family:var(--mono);font-size:12.5px;line-height:1.65;margin:0 0 16px;position:relative}
pre code{background:none;padding:0;font-size:inherit}
blockquote{border-left:3px solid var(--accent);background:var(--accent-bg);padding:12px 16px;border-radius:0 9px 9px 0;margin:0 0 20px;font-size:14px}
blockquote p:last-child,blockquote ol:last-child{margin-bottom:0}
blockquote ol{margin-bottom:8px}
hr{border:0;border-top:1px solid var(--line);margin:42px 0}
.status{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12.5px;background:var(--panel);border:0.5px solid var(--line);border-radius:9px;padding:10px 14px;margin:0 0 22px;color:var(--muted)}
.tag{font-size:11px;padding:2px 8px;border-radius:5px;background:var(--ok-bg);color:var(--ok);border:0.5px solid var(--ok-line);white-space:nowrap}
.tag.blue{background:var(--accent-bg);color:var(--accent);border-color:var(--accent-line)}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin:0 0 18px}
th,td{text-align:left;padding:9px 11px;border-bottom:0.5px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:500;background:var(--panel)}
td code{font-size:12px}
details{background:var(--panel);border:0.5px solid var(--line);border-radius:9px;padding:10px 14px;margin:0 0 12px}
summary{cursor:pointer;font-size:13px;font-weight:500;color:var(--accent)}
details[open] summary{margin-bottom:8px}
details > :last-child{margin-bottom:0}
details.answer p{font-size:13.5px}
.copy{position:absolute;top:8px;right:8px;font-size:11px;padding:3px 8px;background:var(--bg);opacity:0;transition:.15s}
pre:hover .copy{opacity:1}
footer{margin-top:56px;padding-top:18px;border-top:1px solid var(--line);font-size:12.5px;color:var(--faint)}
#totop{position:fixed;right:22px;bottom:22px;background:var(--bg);border:0.5px solid var(--line);border-radius:8px;padding:7px 11px;font-size:12px;display:none;z-index:40}
@media(max-width:860px){
  .wrap{display:block;padding:0 18px}
  aside{position:static;width:auto;height:auto;border-right:0;border-bottom:1px solid var(--line);padding:18px 0 12px}
  aside nav{display:flex;flex-wrap:wrap;gap:2px}
  aside a{display:inline-block;border-left:0;border-bottom:2px solid transparent;border-radius:5px;padding:4px 9px}
  aside a.lv3{display:none}
  aside a.on{border-left:0;border-bottom-color:var(--accent)}
  .brand{margin-bottom:8px}
  .toolrow{margin-top:12px}
  main{padding:24px 0 70px;max-width:none}
  h1{font-size:24px}
  h2{font-size:19px;margin-top:38px}
  table{display:block;overflow-x:auto}
}
@media print{
  aside,#progress,#totop,.copy,.toolrow{display:none!important}
  .wrap{display:block;padding:0}
  main{max-width:none;padding:0}
  body{font-size:11pt}
  h2{page-break-after:avoid}
  pre,blockquote,table{page-break-inside:avoid}
  details{display:block}
  details > p{display:block}
}
`

const JS = `
(function(){
  var root=document.documentElement;
  var store={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},
             set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
  if(store.get('skills-guide-theme')==='dark'){root.setAttribute('data-theme','dark')}
  var btn=document.getElementById('themeBtn');
  function syncTheme(){btn.textContent=root.getAttribute('data-theme')==='dark'?'切换浅色':'切换深色'}
  syncTheme();
  btn.addEventListener('click',function(){
    var next=root.getAttribute('data-theme')==='dark'?'light':'dark';
    root.setAttribute('data-theme',next);store.set('skills-guide-theme',next);syncTheme();
  });

  var links=[].slice.call(document.querySelectorAll('#toc a'));
  var sections=links.map(function(a){return document.querySelector(a.getAttribute('href'))}).filter(Boolean);
  function setActive(id){links.forEach(function(a){a.classList.toggle('on',a.getAttribute('href')==='#'+id)})}
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(en){if(en.isIntersecting){setActive(en.target.id);store.set('skills-guide-last','#'+en.target.id)}});
    },{rootMargin:'-10% 0px -70% 0px',threshold:0});
    sections.forEach(function(s){io.observe(s)});
  }
  links.forEach(function(a){a.addEventListener('click',function(){setActive(a.getAttribute('href').slice(1))})});

  var jumpBtn=document.getElementById('jumpBtn');
  var last=store.get('skills-guide-last');
  if(last&&document.querySelector(last)){
    var target=document.querySelector('#toc a[href="'+last+'"]');
    jumpBtn.style.display='inline-block';
    jumpBtn.textContent='回到上次 · '+(target?target.textContent.replace(/^\\d+\\s*/,''):'');
    jumpBtn.addEventListener('click',function(){document.querySelector(last).scrollIntoView({behavior:'smooth'})});
  }

  document.querySelectorAll('.copy').forEach(function(b){
    b.addEventListener('click',function(){
      var code=b.parentNode.querySelector('code');if(!code)return;
      var text=code.textContent;
      function done(){var old=b.textContent;b.textContent='已复制';setTimeout(function(){b.textContent=old},1400)}
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done,function(){fallback()});
      }else{fallback()}
      function fallback(){
        var ta=document.createElement('textarea');ta.value=text;ta.style.position='absolute';ta.style.left='-9999px';
        document.body.appendChild(ta);ta.select();
        try{document.execCommand('copy');done()}catch(e){b.textContent='请手动复制'}
        document.body.removeChild(ta);
      }
    });
  });

  var prog=document.getElementById('progress');
  var totop=document.getElementById('totop');
  function onScroll(){
    var h=document.documentElement.scrollHeight-window.innerHeight;
    prog.style.width=(h>0?(window.scrollY/h*100):0)+'%';
    totop.style.display=window.scrollY>500?'block':'none';
  }
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  totop.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
})();
`

// ── 生成 ─────────────────────────────────────────────
const { body, toc } = parse(fs.readFileSync(SRC, 'utf8'))
const tocHtml = toc
  .map((x) => `<a class="lv${x.level}" href="#${x.id}">${inline(x.text)}</a>`)
  .join('\n')

const page = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Agent Skills 学习与面试指南 · 完整讲义</title>
<style>${CSS}</style>
</head>
<body>
<div id="progress"></div>
<div class="wrap">
<aside>
  <div class="brand">learning · 完整讲义</div>
  <nav id="toc">
${tocHtml}
  </nav>
  <div class="toolrow">
    <button id="themeBtn" type="button">切换深色</button>
    <button id="jumpBtn" type="button" style="display:none">回到上次</button>
    <a class="backlink" href="../index.html">← 导航页</a>
  </div>
</aside>
<main>
${body}
<footer>
  本页由 <code>AI-Agent-Skills-学习与面试指南.md</code> 生成（<code>tools/build-guide.mjs</code>）。改原文后重跑脚本，别手改本文件。<br>
  单文件、不联网、不依赖 CDN。主题与阅读位置存在本机浏览器。
</footer>
</main>
</div>
<button id="totop" type="button">回到顶部</button>
<script>${JS}</script>
</body>
</html>
`

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, page, 'utf8')
console.log(`已生成 ${path.relative(ROOT, OUT)}（${toc.length} 个目录项，${(page.length / 1024).toFixed(1)} KB）`)

// --open：生成后用系统默认程序打开（路径含中文，交给 node 处理，bat 里不必写中文路径）
if (process.argv.includes('--open')) {
  const { spawn } = await import('node:child_process')
  spawn('explorer.exe', [OUT], { detached: true, stdio: 'ignore' }).unref()
}
