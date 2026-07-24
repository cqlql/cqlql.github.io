---
title: useState 与 useRef
icon: code
sort: 6
---

## useState 状态

```tsx
function App() {
  const [videos, setVideos] = useState<VideoWithLoading[]>([])
}
```

## 初始化 State 的方式

### 方案一：直接初始化（推荐）

如果在组件挂载时就已经知道初始数据，直接传给 `useState`，最简单、性能最好，避免多余渲染周期。

```typescript
const [list, setList] = useState<string[]>([text]);
```

### 方案二：函数式初始化（复杂计算）

初始数据需经过复杂逻辑计算时，传入函数，它只在**初次挂载时执行一次**。

```typescript
const [list, setList] = useState<string[]>(() => {
  const initialState = prepareInitialData(text); // 仅执行一次
  return [initialState];
});
```

## setState 何时用函数式更新

函数式更新永远拿到“最新确认值”，在以下场景尤其安全：

1. **在 useCallback 里特别安全**：不需要把 state 列入依赖。

   ```tsx
   const onClick = useCallback(() => {
     setCount(prev => prev + 1);
   }, []);
   ```

2. **自动批量更新下更安全**：React 18 自动 batch 时，函数式更新结果可预期：

   ```tsx
   setCount(p => p + 1);
   setCount(p => p + 1); // 一定 +2
   ```

3. **并发模式下不会出问题**：永远拿最新确认值。

| 场景      | 推荐写法                  |
| --------- | ------------------------- |
| +1 / -1   | `prev => prev + 1`        |
| toggle    | `prev => !prev`           |
| push 数组 | `prev => [...prev, item]` |
| reset     | 直接 `setX(0)`            |
| 覆盖赋值  | 直接 `setX(newValue)`     |

> 工程实践：只要是“计算型更新”，默认写函数式，这是目前社区更主流、更稳的习惯。

## useRef 用法

### A. 访问 DOM 元素（最常见）

React 通常不直接操作 DOM，但有时必须（让输入框自动聚焦、获取滚动位置、初始化第三方插件）。

```javascript
const inputRef = useRef(null);

const handleClick = () => {
  inputRef.current.focus(); // 直接操作原生 DOM 节点
};

return <input ref={inputRef} />;
```

### B. 存储“跨渲染”的变量

组件里定义的普通变量（如 `let x = 1`），每次重新渲染都会被重置。

- `useState`：变量变了，页面跟着变（重新渲染）。
- `useRef`：变量变了，**页面不动**，但值会一直保留。

> 注意：render 阶段不要修改 `ref.current`（属于可变对象），否则并发模式下可能状态错乱。详见 [React 核心概念](./核心概念.md)。

## 相关阅读

- [React 核心概念](./核心概念.md)
- [性能优化 Hook](./性能优化hooks.md)
