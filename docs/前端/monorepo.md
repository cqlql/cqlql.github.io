---
title: Monorepo
sort: 84
---

# Monorepo 简介
## 什么是 Monorepo
- 单仓库管理多个项目/模块
- 可以共享库、复用代码

## 优势
- 多应用共享组件/工具
- 统一依赖管理
- 增量构建提升 CI/CD 效率

## 常用工具
- 前端：
  - [NX](https://nx.dev/docs/getting-started/intro)（推荐）
  - Turborepo
  - pnpm workspace
- 后端/全栈：
  - Nx + NestJS
  - Lerna（老牌工具）

## 项目结构示例
my-monorepo/
├─ apps/ # 应用
├─ libs/ # 共享库
├─ package.json
└─ nx.json

## 注意事项
- 路径别名统一
- CI/CD 任务尽量增量执行
- 共享库和应用分层清晰

## 劣势以及如何解决

| 问题             | 缓解方式                            |
| ---------------- | ----------------------------------- |
| 仓库大、clone 慢 | sparse-checkout、CI 分支裁剪        |
| 构建耗时长       | 使用增量构建工具（Turborepo、Nx）   |
| 权限控制难       | 可通过 CI 限制目录或使用 Git 子模块 |
| 版本控制复杂     | 使用 Changesets、Lerna 独立版本模式 |

**总结：** 对于中大型项目、组件库、多模块系统，**Monorepo 明显更有优势**，劣势基本都可以通过工具缓解。



