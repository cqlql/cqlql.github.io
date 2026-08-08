---
title: SourceMap 与 devtool
icon: mdi:map-marker
sort: 1
---

# SourceMap 与 devtool

webpack 通过 `devtool` 控制是否以及如何生成 SourceMap，方便开发时调试、生产时定位问题。

```js
module.exports = {
  devtool: false,        // 不开启
  devtool: 'source-map', // 开启，生成独立 .map 文件
}
```

[官网 devtool 详解](https://webpack.js.org/configuration/devtool/)

## 常用选项对比

| 值 | 构建速度 | 重建速度 | 生产可用 | 说明 |
|----|---------|---------|---------|------|
| `false` | 最快 | 最快 | ✅ | 不生成 SourceMap |
| `eval` | 快 | 最快 | ❌ | 用 eval 包裹，无列映射，仅适合开发 |
| `eval-source-map` | 慢 | 快 | ❌ | 每个模块 eval，含完整映射，开发体验好 |
| `cheap-module-source-map` | 中等 | 快 | ⚠️ | 无列映射、含 loader 转换前源码，推荐开发 |
| `source-map` | 慢 | 慢 | ✅ | 生成独立 .map，最完整 |
| `hidden-source-map` | 慢 | 慢 | ✅ | 生成 .map 但不追加引用注释，用于错误监控平台 |
| `nosources-source-map` | 慢 | 慢 | ✅ | 有行列但无源码内容，避免源码泄露 |

## 推荐配置

```js
module.exports = {
  // 开发环境：兼顾速度与可读性
  devtool: 'eval-cheap-module-source-map',

  // 生产环境：保留完整映射但单独上传到监控平台
  // devtool: 'hidden-source-map',
}
```

## 注意事项

- `source-map` 类选项会拖慢生产构建，若构建产物对外发布，优先用 `hidden-source-map` 并只把 `.map` 传给错误监控服务。
- 浏览器默认不会下载 `.map`，仅在 DevTools 打开时才请求，因此生产开启 `source-map` 一般不会额外增加用户流量。
- 开发服务器（devServer）下不要使用 `[chunkhash]` 作为文件名，否则热更新会报错。
