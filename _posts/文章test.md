---
layout: none
title: 测试
date: 2015-07-12 17:10:50
---


*关于readyState。是不是一定会出现4状态。abort会是几状态？*
```javascript
if (xhr.readyState === 4) {
}
```

abort 也是4状态，abort后立即触发

##### 现象
1是请求后立即触发
2,3,4状态几乎是一并触发的，实测出现2后，怎么也无法abort了，间隔太短，或者说没有间隔，
也就是说，abort后，只会1,4两种状态
