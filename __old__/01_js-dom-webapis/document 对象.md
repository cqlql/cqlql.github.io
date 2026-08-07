
## 直接操作 title 标签值

```js
console.log(document.title) // 读。String 类型

document.title = "*" + document.title; // 设置

```
**兼容性：**
ie9及以上。ie6~8估计得直接取到title标签进行操作了


## 页面加载状态 document.readyState

只读属性

返回值：字符串。

1. "loading"：页面加载进行中
2. "interactive"：DOM对象可以操作了，此时图片视频未加载
3. "complete"：页面已完全加载（此时图片视频都已加载完毕）

兼容性：  
opera没有interactive状态。只有loading、complete状态  
ie6\7\8\9只有 点 刷新按钮 才有loading状态。通过URL重新加载页面 直接进入假的interactive状态(不可以操作DOM),
所以只有在 点 刷新按钮 才能 实现DOMContentLoaded事件  
chrome\fox没问题

