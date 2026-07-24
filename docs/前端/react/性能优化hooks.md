---
title: 性能优化 Hook
icon: bolt
sort: 4
---

React 性能优化的核心是——**减少不必要的重新渲染**。下面的 Hook 都是为此服务的工具。

## useCallback 缓存函数引用

```
const fn = useCallback(() => {
  console.log("hello")
}, [])
```

React 会：第一次 render 创建函数；以后只要依赖不变，就复用之前那个函数引用。于是 `fn === 上一次的 fn` 为 `true`。

作用：

- **引用稳定性**
- **减少不必要的子组件渲染**（需配合 `React.memo` 子组件）

### 不使用 useCallback 的问题

```jsx
function Parent() {
  const [count, setCount] = useState(0)
  const handleClick = () => { console.log("clicked") }
  return <Child onClick={handleClick} />
}
```

每次 `count` 改变：Parent 重新 render → `handleClick` 新建 → Child 认为 props 变了 → Child 重新渲染。即使 Child 用了 `React.memo` 也没用。用 `useCallback` 包裹后，只要依赖不变就复用同一引用。

> 用一句话理解 React：**性能优化的核心是减少不必要的重新渲染**，useCallback 只是这个体系里的一个工具。
>
> 通俗比喻：不使用 useCallback，每次 render 都给子组件一张“新的名片”；使用 useCallback，只要信息没变就一直给同一张名片。React 只认“是不是同一张名片”。

### FAQ：loadVideos 重复定义有影响吗？

> 一般情况下**没有任何实际影响**。每次 render 重新定义函数是 React 的正常行为，JS 创建函数成本极低，不会产生额外渲染，也不会触发 useEffect。
>
> `useCallback` 主要不是为了“避免重复定义”，而是优化**引用稳定性**与**减少不必要的子组件渲染**。

## useMemo 记住计算结果

核心作用：**记住一个复杂计算的结果，直到依赖项发生变化**。类似于 Vue 的计算属性。

```javascript
const memoizedValue = useMemo(() => {
  return computeHugeData(list);
}, [list]); // 只有 list 变了，才会重新计算
```

### 什么时候该用？（别滥用！）

给每个变量都套 `useMemo` 反而**降低**性能，因为它本身也有存储和比对依赖项的开销。

- **推荐：** 昂贵的计算（数千条数据处理、复杂正则、大量循环转换）；引用相等性（把对象传给 `React.memo` 子组件时，用 `useMemo` 固定对象地址）。
- **不推荐：** 简单数字加减、字符串拼接；仅仅是怕变量被重新创建（除非它作为其他 hook 的依赖）。

> 官方推荐：先写清晰直观的代码，**只在性能瓶颈明显时**才用 memo / useCallback。

## React.memo 缓存组件

如果说 `useMemo` 缓存**计算结果**，那么 `React.memo` 缓存**整个组件**。

```javascript
import { memo } from 'react';

const MyComponent = memo(function MyComponent(props) {
  return <div>{props.title}</div>;
});
```

- 后续父组件渲染时，React 对 `props` 进行**浅比较**。
- `props` 没变：跳过渲染，复用上一次结果；`props` 变了：重新执行。

### 为什么需要它？

React 默认行为：只要父组件重新渲染，子组件无论 props 有没有变化都会跟着重渲染。子组件很重或数量很多（长列表）时，冗余渲染会导致掉帧。

### “浅比较”的陷阱

`React.memo` 默认只比较基本类型。如果传递了**对象、数组或函数**，每次父组件渲染都会生成新引用（地址不同），导致缓存失效。

> 这就是 `useMemo` / `useCallback` 与 `React.memo` 配合使用的时刻：用 `useCallback` 包装传给子组件的**函数**，用 `useMemo` 包装传给子组件的**对象/数组**。

### 什么时候该用？

- **推荐：** 纯展示型组件、配置复杂的图表、接受大量 props 且频繁位于重绘区域的组件、子组件数量非常多（列表/表格）、props 稳定（搭配 useCallback / useMemo）。
- **不推荐：** 逻辑极简单的组件（如只渲染一个 `<span>`），包裹 `memo` 的额外开销可能比直接重渲染还大。

## useMemo vs. useCallback

| 钩子            | 记住的是什么？     | 典型用途                                           |
| --------------- | ------------------ | -------------------------------------------------- |
| **useMemo**     | **值**（计算结果） | 避免复杂运算、数据转换、过滤。                     |
| **useCallback** | **函数本身**       | 避免函数引用变化导致子组件不必要的重复渲染。       |

`useCallback` 本质是 `useMemo` 的语法糖，专门用于函数。

## React.memo vs useMemo

| 特性     | React.memo           | useMemo                              |
| -------- | -------------------- | ------------------------------------ |
| 类型     | 高阶组件 (HOC)       | React Hook                          |
| 作用对象 | **组件**             | **任何逻辑值**（计算结果、对象等）  |
| 原理     | 比较 props 是否变化  | 比较依赖项是否变化                   |
| 目的     | 避免组件不必要的重绘 | 避免昂贵的计算重复运行               |

## 相关阅读

- [React 核心概念](./核心概念.md)
- [useState 与 useRef](./useState-useRef.md)
- [useEffect 基础](./useEffect基础.md)
