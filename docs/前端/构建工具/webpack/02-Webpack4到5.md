---
title: Webpack4 到 Webpack5
icon: mdi:swap-horizontal
sort: 2
---

# Webpack4 到 Webpack5

梳理从 Webpack4 迁移到 Webpack5 时的核心变化与常见问题。

## 代码拆分：CommonsChunkPlugin → splitChunks

Webpack4 起移除了 `CommonsChunkPlugin`，改用 `optimization.splitChunks` 与 `optimization.runtimeChunk`。

```js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all', // 对同步和异步 chunk 都做拆分
    },
    runtimeChunk: 'single', // 抽离 runtime，避免 vendor 因 runtime 变化而失效缓存
  },
}
```

[split-chunks-plugin 文档](https://webpack.js.org/plugins/split-chunks-plugin)

## CSS 提取：mini-css-extract-plugin

```js
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = {
  plugins: [new MiniCssExtractPlugin({ filename: 'css/[name].[contenthash].css' })],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
}
```

[mini-css-extract-plugin 文档](https://webpack.js.org/plugins/mini-css-extract-plugin)

### Webpack5 中的空 JS 包问题

Webpack4 中抽离 CSS 后常残留一个空的 JS 包，原因在于 `optimization` 抽离逻辑把 CSS 相关 JS 合并后再由插件抽离，剩下一个空壳。Webpack5 结合 `runtimeChunk` 与 `splitChunks` 后该问题基本消失；若仍出现，检查是否手动指定了多余的 entry。

## 不压缩构建产物（便于排查）

```js
module.exports = {
  mode: 'none',            // none：不压缩、不优化
  output: { pathinfo: true }, // 在模块上标注路径信息
}
```

## include / exclude 同时使用时

`exclude` 优先级高于 `include`。下面的配置中，即便 `include` 包含 `iview-pro`，它仍会被排除：

```js
{
  test: /\.js$/,
  include: ['E:/_work/template-vue/src'],
  exclude: ['E:/_work/src/libs/iview-pro'],
  use: ['babel-loader'],
}
```

## babel polyfill 与动态 import 的坑

按需 polyfill 后，如果 `src` 中未直接使用 `Promise`，但 `node_modules` 中动态 `import()` 用到了，低版本浏览器仍会报错。可手动补充：

```js
import 'core-js/modules/es6.promise.js'
```

> 正式项目一般会直接使用 `Promise`，通常可忽略。

## 关于魔法注释与 NODE_ENV 控制导入

通过 `process.env.NODE_ENV !== 'production'` + `require` 控制导入，并在内部使用 `webpackChunkName` 注释魔法时：

- 若某模块与其他 production 模块使用相同 `webpackChunkName`，**不会**被打包到一起（经测试）。
- 使用 `output.chunkFilename` 才能让 `webpackChunkName` 注释魔法生效：

```js
module.exports = {
  output: {
    chunkFilename: 'js/[name].bundle.js',
  },
}
```

- `babel-loader` 需保留注释（`comments: true` 或省略该配置），否则注释魔法被压缩掉而失效。
