---
title: useEffect 基础
icon: mdi:refresh
sort: 5
---

## 依赖数组的比较机制

React 依赖数组比较的是：

```
Object.is(旧值, 新值)
```

函数比较的是引用地址。

## 只加载一次

```jsx
function App() {
  const loadVideos = () => {
    setLoading(true)
    fetchVideos()
      .then((data) => {
        setVideos(data)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadVideos()
  }, [])
}
```

### 更规范的写法（配合 useCallback）

如果以后打算把函数放进依赖数组，建议用 `useCallback` 包裹，保证引用稳定、不会死循环、ESLint 不警告：

```jsx
const loadVideos = useCallback(() => {
  setLoading(true)
  fetchVideos()
    .then((data) => {
      setVideos(data)
      setError(null)
    })
    .catch((e) => setError(e.message))
    .finally(() => setLoading(false))
}, [])

useEffect(() => {
  loadVideos()
}, [loadVideos])
```

## 相关阅读

- [useEffect 清理函数（副作用管理）](./useEffect-副作用管理.md)
- [Effect 中禁止同步 setState](./useEffect-同步setState警告.md)
- [React 核心概念](./核心概念.md)
