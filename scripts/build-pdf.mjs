#!/usr/bin/env node
/**
 * 把 dist/*.html 批量打印成 A4 PDF。
 * 依赖 Playwright（npx 可用即可），用系统自带的 Edge/Chrome 渲染，无需额外下载浏览器。
 *
 * 用法：node scripts/build-pdf.mjs
 * 输出：dist/陈桥黎-<方向>.pdf
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

if (!fs.existsSync(DIST)) {
  console.error('dist 不存在，先运行 node scripts/build-resume.mjs');
  process.exit(1);
}

const htmls = fs.readdirSync(DIST).filter((f) => f.endsWith('.html'));
if (htmls.length === 0) {
  console.error('dist 下没有 html，先运行 node scripts/build-resume.mjs');
  process.exit(1);
}

// Windows 下 npx 是 .cmd，必须显式走 shell
const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';

for (const file of htmls) {
  const base = path.basename(file, '.html');
  const out = path.join(DIST, `${base.replace(/^简历-/, '陈桥黎-')}.pdf`);
  const url = pathToFileURL(path.join(DIST, file)).href;

  execFileSync(
    npx,
    ['playwright', 'pdf', '--channel', 'msedge', '--paper-format', 'A4', url, out],
    { stdio: 'pipe', shell: isWin },
  );

  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`✓ ${path.basename(out)}  ${kb} KB`);
}

console.log('\nPDF 生成完毕 → dist/');
