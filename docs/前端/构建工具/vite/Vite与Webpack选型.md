---
title: Vite 与 Webpack 选型
icon: devicon:vitejs
---

## Vite 不适合的场景

除以下情况外，普通 SPA / 后台 / H5 项目 Vite 都是首选（以 React 为例同样适用 Vue）：

1. 必须兼容 IE11（dev 环境 ESM 无法跑 IE，只能 build 后测试）。
2. 重度依赖仅 Webpack 可用、没有 Vite 替代的 loader / plugin 的老项目。
3. 老的微前端框架深度绑定 Webpack。

## 对比总结

| 项目 | CRA（Webpack） | Vite |
| --- | --- | --- |
| DevTools Open-in-Editor 按钮 | 原生可用 | 原生按钮不可用，需第三方插件（见 [React-DevTools跳转编辑器](./../react/React-DevTools跳转编辑器.md)） |
| 冷启动 | 慢 | 极快 |
| HMR 热更新 | 项目大后卡顿 | 几乎瞬时 |
| 生产构建 | 慢 | 更快 |
| 老浏览器兼容 | 开箱支持 IE | 需 legacy 插件 |
