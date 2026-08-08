---
title: URL 解析
---

## URL

https://developer.mozilla.org/zh-CN/docs/Web/API/Window/URL

```js
new window.URL('http://baidu.com') // 返回一个与 location 差不多对象
```

## URLSearchParams

```js
let obj = { param1: 'something', param2: 'somethingelse', param3: 'another' }
obj['param4'] = 'yetanother'
const url = new URL(`your_url.com`)
url.search = new URLSearchParams(obj)
const response = await fetch(url)

new URLSearchParams(obj).toString()
// OUT: param1=something&param2=somethingelse&param3=another&param4=yetanother
```
