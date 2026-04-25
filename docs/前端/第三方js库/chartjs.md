## 高宽比限制

```js
const config = {
  type: 'bar',
  data: data,
  options: {
    //  是否保持高宽比，false 不保值
    maintainAspectRatio: false,
    // 保持高宽比，值为 w/h 比例值
    // aspectRatio: 100 / (15 * 2),
  },
}
```

## bar 宽度

```js
const config = {
  type: 'bar',
  data: data,
  options: {
    /* 
    设置 bar 宽度
    barThickness barPercentage 属性二选一
    */
    barThickness: 10, // 具体值
    barPercentage: 0.5, // 比例值
  },
}
```

[参考文档](https://qa.1r1g.com/sf/ask/2183222191/)
