## tooltip 提示框浮层（可以跟随鼠标）

[tooltip 文档](https://echarts.apache.org/zh/option.html#tooltip)

也可在具体的 series 中单独配置

```js
myChart.setOption({
  series: [
    {
      tooltip: {
        formatter: '{a}<br />{b}: {c}',
      },
    },
  ],
})
```

## 饼图

### 控制饼图半径大小 - radius

[文档 pie.radius](https://echarts.apache.org/zh/option.html#series-pie.radius)

```js
option = {
  series: [
    {
      name: 'Access From',
      type: 'pie',
      radius: '100%',

      // 也可是数组：控制内外圆半径
      // radius: ['60%', '90%'],

      data: [
        { value: 1048, name: 'Search Engine' },
        { value: 735, name: 'Direct' },
        { value: 580, name: 'Email' },
        { value: 484, name: 'Union Ads' },
        { value: 300, name: 'Video Ads' },
      ],
    },
  ],
}
```
