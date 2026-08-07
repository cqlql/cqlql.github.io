## webpack4 中的问题修复记录：

### css 提取问题，会有一个空的 js 包

问题原因跟 optimization 抽离原理有关：将 css 相关的 js 合并到一个 js 里面，然后由 MiniCssExtractPlugin 抽离，会剩下一个空的 js 包文件

## 问题

- 某 js，通过 `process.env.NODE_ENV !== 'production'` + `require` 控制导入，但在其内部使用 webpackChunkName 注释魔法，与其它 production 模块同 webpackChunkName，它们会打包到一起吗？
  - 经测试不会
