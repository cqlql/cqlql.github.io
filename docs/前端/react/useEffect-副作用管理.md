## 计时器场景的最佳实践

不要在 Effect 里同步重置时间，而应该利用清理函数的**对称性**：

```typescript
useEffect(() => {
  if (!isRunning) return; // 声明式：如果不运行，则不执行后续逻辑

  // 1. 建立资源
  const timer = window.setInterval(() => {
    setElapsedSeconds(s => s + 1);
  }, 1000);

  // 2. 预设清理逻辑 (React 自动管理执行时机)
  return () => {
    window.clearInterval(timer); // 确保不会内存泄漏
    setElapsedSeconds(0);        // 状态切换或卸载时自动归零
  };
}, [isRunning]);
```

## 实现“组件卸载回调”

```typescript
useEffect(() => {
  // --- 挂载逻辑 ---
  console.log('组件已加载');

  return () => {
    // --- 卸载回调 ---
    console.log('组件已卸载：在这里执行清理任务');
    // 比如：window.clearInterval(timer)、socket.close() 等
  };
}, []); // 关键：空数组确保 return 只在卸载时触发
```

