[History - Web API 接口参考 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/History)

```js
// 历史记录情况触发
window.addEventListener(
  'popstate',
  function (e) {
    var state = e.state // 参数1
    document.title = e.title // 参数2
  },
  false,
)

history.pushState({ page: 1 }, 'title 1', '?page=1')
history.pushState({ page: 2 }, 'title 2', '?page=2')
history.replaceState({ page: 3 }, 'title 3', '?page=3')

// 触发 popstate 事件
history.back()
history.back()
history.go(2)
```
