---
title: React DevTools 跳转编辑器
icon: mdi:open-in-new
sort: 8
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

## 相关

- Vite 与 Webpack 的选型对比见 [前端/构建工具/vite/Vite与Webpack选型](./../构建工具/vite/Vite与Webpack选型.md)
