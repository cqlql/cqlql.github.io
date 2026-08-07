
## html 转图片

借助 svg

```js
export default function (elm, cvs, img) {
  let div = document.createElement('div')
  div.innerHTML = `<svg ref="svg" viewBox="0 0 2016 1428">
    <foreignObject width="2016" height="1428">${elm.outerHTML}</foreignObject>
  </svg>`
  let svg = div.children[0]

  // let img = new Image()
  // img.style.position = 'relative'
  // document.body.appendChild(img)
  svg.children[0].innerHTML = elm.outerHTML
  let ctx = cvs.getContext('2d')
  let d = (new XMLSerializer()).serializeToString(svg)
  // 数据流，字符串形式
  img.src = 'data:image/svg+xml;charset=utf-8,' + d
  img.width = 2016
  // img.width = 1008
  img.height = 1428

  img.onload = function () {
    cvs.width = img.width
    cvs.height = img.height
    ctx.drawImage(img, 0, 0)
  }
}

```

## btoa 字符串转 base64

```js
let d = (new XMLSerializer()).serializeToString(svg)
d = btoa(d)
img.src = 'data:image/svg+xml;base64,' + d
```

## web 图片数据形式种类

```js
// 数据流，字符串形式
img.src = 'data:image/svg+xml;charset=utf-8,' + d
// base 64
img.src = 'data:image/svg+xml;base64,' + d
// 其他几种图片类型
// data:image/jpeg;base64,
// data:image/png;base64,
// data:image/gif;base64,
```

## 弹窗

```js
// 确认窗，将挂起，点确认或者取消才会执行
if (confirm("确实要删除吗")) { }
```

## 页面地址-url

浏览器地址栏中的地址操作


### location.search 读取

没有情况(只有一个`?`也视为没有)：空字符串  


有：将包括?

### location.search 设置

可以不加 `?`

### href 跳转执行后，后面的 js 还会执行吗？
会执行。所有js 执行完成后 再href跳转

js 报错影响是否影响 href 跳转？正常机制：
- href 之上，不会跳转
- href 之下，会跳转

## 浏览器跳转

```js
// 直接替换当前页面
location.href = '//baidu.com'
```

## 设备像素比 window.devicePixelRatio

如果是2，则是 1个像素点放了1/2像素的内容。
即 2个物理分辨率 = 1个逻辑分辨率

canvas 画图模糊情况使用

## 安卓浏览器兼容性判断
不应判断android系统版本，跟系统版本无关，跟内置浏览器版本有关

## 图片本地预览

方式1

```js
var fileReader = new FileReader();
// 文件读取 完后触发
fileReader.onload = function (e) {
    img.src = e.target.result;
}
// 文件读取为 DataURL，base64
fileReader.readAsDataURL(document.getElementById('file').files[0]);

```