---
title: Promise
icon: mdi:autorenew
sort: 18
---

## 多个 `await` 同一个 Promise

本质就是“多个等待者共享同一个结果”，Promise 一完成，**所有等待者一起被唤醒**。

```javascript
// 定义一个异步任务（只执行一次）
const fetchData = new Promise((resolve) => {
    console.log("--- 开始执行耗时操作 (仅此一次) ---");
    setTimeout(() => resolve({ data: "这是共享的数据" }), 2000);
});

// 等待者 A
async function waiterA() {
    console.log("等待者 A 开始等待...");
    const result = await fetchData;
    console.log("等待者 A 拿到结果:", result.data);
}

// 等待者 B
async function waiterB() {
    console.log("等待者 B 开始等待...");
    const result = await fetchData;
    console.log("等待者 B 拿到结果:", result.data);
}

// 同时启动
waiterA();
waiterB();
```

