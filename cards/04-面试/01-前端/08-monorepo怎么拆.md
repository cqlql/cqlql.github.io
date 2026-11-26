---
id: fe-08
title: monorepo 为什么这么拆
stage: fe
week:
---

# monorepo 为什么这么拆

## 30 秒版

因为三端的表单与报表内核完全一致，只有壳和 UI 库不同。所以拆成 form-core 管类型与解析、common-ui 管 PC 组件、common-ui-mobile 管移动组件，业务应用只依赖内核、不依赖彼此。复制一份代码改三处，是最贵的方案。

## 展开

- 三个备选和为什么不用：复制代码（改三处，必然不同步）、发 npm 包（发版和联调成本高，内部包不值得）、单仓多包（选了这条）
- 工具分工：pnpm workspace 管依赖与链接，turbo 管构建缓存与任务编排，changeset 管版本与发布
- 代价：仓库变大、构建要配缓存、新人要先理解包边界

## 我的数字

- 4 个应用 + 9 个内部包
- `packages/effects`：common-ui / common-ui-mobile / directives / hooks；`packages/`：form-core / api-utils / data-utils / types / utils

## 追问预演

- **Q**：为什么不直接发 npm 包？
  **A**：内部包只有这四个应用用，发版、装包、联调都要多一轮。workspace 直接链接源码，改完立刻生效，等稳定且要被外部用时再发。
- **Q**：构建慢怎么办？
  **A**：turbo 按依赖图编排任务，命中缓存就不重跑。改一个应用不会全量重建。

## 参考

- 面试准备.md 四 · 前端深挖 8
