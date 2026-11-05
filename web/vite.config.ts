import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 本文件在 Node 里执行，但项目没引 @types/node（见 tsconfig 的说明），
// 所以只声明这里用到的那一个成员。
declare const process: { env: Record<string, string | undefined> }

// ops ui 默认 7788，但**被占用会自动递增**（同机的 suikouji ops 也用 7788）。
// 开发时用 OPS_UI_PORT 对齐实际端口，例如：OPS_UI_PORT=7789 npm run dev
const opsUIPort = process.env.OPS_UI_PORT ?? '7788'

/**
 * 构建时往 dist/ 里补一个 .gitkeep。
 *
 * 为什么需要它：`emptyOutDir: true` 会把整个 dist/ 清空 —— 包括仓库里那个占位文件。
 * 于是它**永远提交不上去**，而 Go 侧是 `//go:embed all:web/dist`：
 * 目录**不存在**时编译直接失败（`pattern all:web/dist: no matching files found`），
 * 全新 clone 之后 `go build ./...` 会当场炸掉。
 *
 * 用 emitFile 而不是 fs.writeFile：走 Rollup 的产物通道，不需要 @types/node。
 */
function keepDistPlaceholder() {
  return {
    name: 'keep-dist-placeholder',
    generateBundle(this: { emitFile: (f: unknown) => void }) {
      this.emitFile({
        type: 'asset',
        fileName: '.gitkeep',
        source:
          '# 这个文件只是为了让 web/dist/ 存在于仓库里。\n' +
          '# Go 用 //go:embed all:web/dist 把前端产物打进二进制，而 embed 在目录\n' +
          '# **不存在**时会直接编译失败。有了它，未构建前端时仍能编译，\n' +
          '# 页面会给出「前端可能还没构建」而不是白屏。\n' +
          '#\n' +
          '# 由 vite.config.ts 在每次构建后自动重建 —— emptyOutDir 会把它删掉。\n' +
          '# 真实产物（index.html / assets/）都在 .gitignore 里，不进 Git。\n',
      })
    },
  }
}

// 产物固定输出到 dist/：Go 侧 `//go:embed all:web/dist` 就是按这个路径找的。
//
// dev 模式把 /api 代理到本机 ops ui（默认 7788）：浏览器看到的是同源请求，
// 前端不必为「开发时跨域、生产时同源」写两套逻辑（那两套逻辑迟早会漂移）。
//
// ⚠️ 端口 5175，不是 wsl-manager 的 5174、也不是 console 的 5173 ——
//    三个前端要能同时开。后端 7788 不是独占的：wsl-manager 是 8788，
//    suikouji ops 也用 7788，所以 `ops ui` 被占时会自动往后递增；
//    dev 时若它换了端口，用 OPS_UI_PORT 让这里的代理跟过去。
export default defineConfig({
  plugins: [react(), keepDistPlaceholder()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 产物要能被 http.FileServer 直接托管，别做成单文件内联 ——
    // 内联会让「构建产物缺失」表现为一个语法错误的 HTML，比 404 难查得多。
    assetsInlineLimit: 4096,
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${opsUIPort}`,
        changeOrigin: true,
      },
    },
  },
})
