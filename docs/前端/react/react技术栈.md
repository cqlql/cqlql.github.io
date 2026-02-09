# react技术栈

## react状态管理选择

### [Redux Toolkit | Redux Toolkit](https://redux-toolkit.js.org/)

中大型项目

标准姿势：Redux Toolkit + RTK Query

企业级项目依然是首选之一

### ⭐[Zustand](https://zustand-demo.pmnd.rs/)

非常流行

中小项目

新项目的首选

### 🔥 React Query（TanStack Query）

> 严格来说 **不是状态管理库**，但**现在几乎必用**

**管理的是：**

- 接口数据
- 缓存
- loading / error
- 自动重试、刷新

```
useQuery({
  queryKey: ['user'],
  queryFn: fetchUser
})
```

📌 **结论**：
 👉 **API 数据 = React Query，已经是事实标准**

### 一句话选型建议（很实用）

🔹 新项目 / 中小项目

```
React 内置 + Zustand + React Query
```

🔹 中大型 / 后期会变复杂

```
Redux Toolkit + RTK Query
```

🔹 只想写得爽

```
Zustand
```

## react 主流路由

`react-router`（准确说是 `react-router-dom`）