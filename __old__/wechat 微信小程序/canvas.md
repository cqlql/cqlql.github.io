[canvas](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html)

以下是 taro 例子

```html
<template>
  <div> <canvas type="2d" id="canvas" style="width: 300px; height: 300px"></canvas> </div>
</template>

<script lang="ts" setup>
  import { useReady } from '@tarojs/taro'
  useReady(() => {
    wx.createSelectorQuery()
      .select('#canvas')
      .fields(
        {
          node: true,
        },
        function (res) {
          console.log(res)
        },
      )
      .exec()
  })
</script>
```
