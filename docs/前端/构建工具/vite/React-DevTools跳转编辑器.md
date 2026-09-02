---
title: React DevTools 跳转编辑器
icon: mdi:open-in-new
sort: 10
---

## 问题现象

Vite + React 项目中，浏览器 React DevTools 面板里组件右上角的 **Open in Editor** 按钮大多是灰色禁用状态，点不了直接跳 VSCode。

而 CRA（Webpack）项目里这个按钮原生可用，容易让人误以为是 Vite 的缺陷。

## 根本原因

**不是 Vite 做不到，是 React 官方 DevTools 没有适配 Vite 的打开编辑器接口。**

- Vite 本身提供了 `/__open-in-editor` 接口，专门用来打开编辑器，Vue DevTools 就用的这套机制，Vue 项目下开箱即用。
- React DevTools 的跳转逻辑依赖 Webpack 的 `react-dev-utils/errorOverlayMiddleware` 那套，没有对接 Vite 的接口。

## 解决方案

### code-inspector-plugin（推荐）

按住快捷键点击页面 DOM 元素，直接跳到 VSCode 对应文件 + 行号，绕开 React DevTools 那个失效按钮。React / Vue 都支持。

```bash
npm i code-inspector-plugin -D
```

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'

export default defineConfig({
  plugins: [
    react(),
    codeInspectorPlugin({
      bundler: 'vite',
    }),
  ],
})
```

- Windows：`Alt + Shift + 点击页面元素`
- Mac：`Option + Shift + 点击页面元素`
- 只在 `npm run dev` 开发环境生效，生产构建自动关闭

## 其他调试手段（无需插件）

1. **VSCode 内置 JS Debugger**：直接在 VSCode 打断点，启动 Chrome 调试，不需要浏览器点组件跳转。
2. **Sources 面板**：浏览器 F12 → Sources，Vite 开发环境下可看到完整 `src/**/*.tsx` 源码，可直接断点。
3. **别名跳转**：确保 `tsconfig.json` 配置了 `baseUrl` + `paths`，否则 VSCode 内部跳转别名文件会失效。

## Vite 不适合 React 的场景

除以下情况外，普通 SPA / 后台 / H5 项目 Vite + React 都是首选：

1. 必须兼容 IE11（dev 环境 ESM 无法跑 IE，只能 build 后测试）。
2. 重度依赖仅 Webpack 可用、没有 Vite 替代的 loader / plugin 的老项目。
3. 老的微前端框架深度绑定 Webpack。

## 对比总结

| 项目 | CRA（Webpack） | Vite + React |
| --- | --- | --- |
| DevTools Open-in-Editor 按钮 | 原生可用 | 原生按钮不可用，需第三方插件 |
| 冷启动 | 慢 | 极快 |
| HMR 热更新 | 项目大后卡顿 | 几乎瞬时 |
| 生产构建 | 慢 | 更快 |
| 老浏览器兼容 | 开箱支持 IE | 需 legacy 插件 |
