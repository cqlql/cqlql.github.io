---
title: Effect 中禁止同步 setState
icon: mdi:alert-outline
sort: 7
---

## Effect 中禁止同步 setState（Cascading Renders 警告）

这个 ESLint 规则（通常属于 `eslint-plugin-react-compiler` 或 React 官方严格检查）主要解决 **React 渲染性能浪费** 与 **难以追踪的状态死循环（Cascading Renders / Render Cascades）** 问题。

> 简而言之：它是在保护你的应用**不要做“无用功”**。

---

## 1. 什么是级联渲染（Cascading Renders）？

React 的核心工作流是：**数据变更 (State) → 触发 Render → 提交更新到 DOM → 执行 useEffect**。

如果在 `useEffect` 的**函数体内部直接同步调用了 `setState`**，会发生以下情况：

```
1. 初次渲染 (Render 1) 
   👇
2. 组件挂载到 DOM
   👇
3. 执行 useEffect()
   👇
4. useEffect 里面同步执行了 setState() ❌
   👇
5. React 发现状态变了，立刻放弃/废弃当前的渲染逻辑，
   或者紧接着强行触发第二次渲染 (Render 2)
```

这种 **“刚渲染完，因为 Effect 里的同步 setState 又不得不立刻再渲染一遍”** 的现象，就叫 **级联渲染（Cascading Renders）**。

---

## 2. 这个规则究竟在防止什么问题？

### ① 防止 UI 闪烁与无意义的性能开销

- **问题：** 组件复杂时，Render 1 先算了一遍 DOM 并画在屏幕上，紧接着 Effect 触发了 Render 2。用户可能看到页面内容“闪”了一下，或者在大数据量时明显卡顿。
- **规则的做法：** 强制开发者思考——这个 `setState` 真的需要放在 Effect 里同步执行吗？还是可以在事件回调（如 `onClick`）中直接处理？

### ② 避免隐蔽的无限循环（Infinite Loop）

如果 Effect 里直接 `setState`，且该状态又被放进了 Effect 的依赖数组：

```tsx
useEffect(() => {
  setCount(count + 1); // 同步 setState
}, [count]); // count 变了再次触发 Effect -> 无限循环 crash
```

严格限制 Effect 内的同步 `setState`，可以在编译阶段直接切断这种低级错误的发生。

### ③ 纠正对 Effect 的滥用（React 官方最想解决的问题）

很多开发者习惯把 `useEffect` 当作“状态同步脚本”来用：

```tsx
// ❌ 坏习惯：用 Effect 根据 stateA 算 stateB
useEffect(() => {
  setFullName(firstName + ' ' + lastName);
}, [firstName, lastName]);
```

上面这种写法会导致 **2 次渲染**！而 React 官方推荐的做法是**直接在渲染期间计算**，完全不需要 `setState`：

```tsx
// ✅ 好习惯：渲染期间直接计算，0 额外渲染成本
const fullName = firstName + ' ' + lastName;
```

---

## 3. 为什么异步请求（fetch）也会触发这个警告？

你可能会纳闷：*“我明明在 `fetchTargetPosition` 里面写的是 `await` 异步请求，为什么它还觉得我是同步调用？”*

这是因为 Lint 规则只做**静态语法分析**：

```tsx
useEffect(() => {
  fetchTargetPosition(); // 👈 在 Lint 看来，这是一个直接暴露在 Effect 顶级作用域的普通函数调用！
}, []);
```

Lint 无法在静态代码分析阶段 100% 确定 `fetchTargetPosition()` 内部究竟是**立刻同步调用了 `setState`** 还是**等网络请求回来后再调用**。为了安全起见，它会要求你把异步逻辑**显式包裹**在 Effect 内部的异步函数中，或者明确处理异步链路。

**正确写法：在 Effect 内部声明 `async` 函数并调用：**

```tsx
useEffect(() => {
  async function fetchTargetPosition() {
    const data = await fetch('/api/position');
    setState(data); // 异步回来后再 setState，不会触发同步级联渲染警告
  }
  fetchTargetPosition();
}, []);
```

---

## 总结口诀

> **Effect 的本质是“与外部系统同步”，而不是“衍生组件内部状态”。**

- 如果一个状态可以通过现有的 `props` 或 `state` 计算出来 → **不要写 setState，直接计算**。
- 如果要在用户点击/交互时改变状态 → **放在事件回调（Event Handler）里，不要放在 Effect 里**。
- 如果确实是发起网络请求、监听 WebSocket 等异步行为 → **在 Effect 内部声明 `async` 函数并调用**。

## 相关阅读

- [useEffect 基础](./useEffect基础.md)
- [useEffect 副作用与清理](./useEffect-副作用管理.md)
