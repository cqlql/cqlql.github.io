- [高宽指定、变形情况](#高宽指定变形情况)
- [绘制图形轮廓 stroke](#绘制图形轮廓-stroke)
- [经验 - 饼图统计，线末端转折](#经验---饼图统计线末端转折)
- [经验 - 统计，画轴，画网格，实现](#经验---统计画轴画网格实现)
- [经验 - 画笔效果，实现](#经验---画笔效果实现)
- [画线](#画线)
  - [1px 看是去有 2px](#1px-看是去有-2px)
- [canvas.drawImage](#canvasdrawimage)
  - [语法：](#语法)
  - [兼容问题：](#兼容问题)
- [画圆 画弧](#画圆-画弧)
  - [MDN 文档参考](#mdn-文档参考)
  - [画圆弧线条。实现进度条](#画圆弧线条实现进度条)
- [toBlob](#toblob)
- [裁图实现](#裁图实现)
- [toDataURL - base64](#todataurl---base64)

## 高宽指定、变形情况

style ：拉伸尺寸  
标签属性：像素尺寸

指定 css width height 将是拉伸放大 canvas，并未改变 canvas 本质高宽。比如我画一个圆 ctx.arc(300, 150, 20, 0, 2 \* Math.PI); 如果是放大 2 倍，那么可以 xy 参数就会是 600,300 的位置了。要改变本质高宽须通过设置标签属性

## 绘制图形轮廓 stroke

## 经验 - 饼图统计，线末端转折

根据线所在圆的角度判断即可

## 经验 - 统计，画轴，画网格，实现

其实只算出刻度数据即可

x 轴，算 y 刻度

y 轴，算 x 刻度

然后再根据刻度数据画轴，画网格，数据与视图分离

## 经验 - 画笔效果，实现

首先是移动轨迹的所有点。也就是监听移动事件，这里可以知道移动轨迹的所有点。

然后用 lineTo 连接即可。

边触发边连接

```js
// 此处代码来自 wechat 小程序
function touchstart(e) {
  let touch = e.changedTouches[0]
  startX = touch.x * dpr
  startY = touch.y * dpr
  ctx.moveTo(startX, startY)
}
function touchmove(e) {
  let touch = e.changedTouches[0]
  currentX = touch.x * dpr
  currentY = touch.y * dpr

  ctx.lineTo(currentX, currentY)

  ctx.stroke()
}
```

## 画线

### 1px 看是去有 2px

画线的坐标参数，是从两个像素之间开始算的，由于抗锯齿，所以看上去是 2px

**坐标起始位置，0 位置**：canvas 边框内边边缘

所以要画出 1px 的线，需要给坐标加 0.5。下例将画出紧贴内边(真正的 0 起始)1px 的线

```js
ctx.beginPath()
let y = 0.5
ctx.moveTo(0, y)
ctx.lineTo(300, y)
ctx.stroke()
```

## canvas.drawImage

提供直接绘制图片的功能，支持直接写其他 canvas

### 语法：

canvas.drawImage(image, dx, dy)

### 兼容问题：

**浏览器：** Android webkit 53.30 v4.0

**image 参数**

- 是另一个 canvas，则必须加到页面才能成功绘制。
- 是 img 元素，src 是 base 64，好像也无法绘制(待确定)

## 画圆 画弧

### MDN 文档参考

[线条、填充样式颜色 API](https://developer.mozilla.org/zh-CN/docs/Web/API/Canvas_API/Tutorial/Applying_styles_and_colors)

[圆弧 API](https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/arc)

### 画圆弧线条。实现进度条

```js
var canvas = document.getElementById('canvas')
var ctx = canvas.getContext('2d')
ctx.strokeStyle = 'red'
ctx.lineWidth = 6
ctx.lineCap = 'round' // 末端样式
ctx.beginPath()
// 右边x轴开始画，也就是参数所示，画的起始点是 x100, y50
// 参数依次是：圆心x, 圆心y, r, 起始弧度, 结束弧度, 默认顺时针
ctx.arc(50, 50, 50, 0.3 * Math.PI, 1.6 * Math.PI)
ctx.stroke()
```

## toBlob

转 blob 后可直接上传到服务器

更多见 [h5 文件系统 FileSystem API](index.html#/1/29)

## 裁图实现

```js
let cvs = document.createElement('canvas')
let ctx = cvs.getContext('2d')
// 裁图选择框大小
cvs.width = selectRectWdith
cvs.height = selectRectHeight
// 裁图，x, y 参数用来隐藏左上区域
ctx.drawImage(img, -10, -40)
```

## toDataURL - base64

```js
img.src = canvas.toDataURL()
```
