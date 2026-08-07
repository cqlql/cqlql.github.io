- [文件上传](#文件上传)
- [文件读取](#文件读取)
- [base64](#base64)
- [blob 获取](#blob-获取)
  - [atob + Uint8Array 方式 (base64 转 blob)](#atob--uint8array-方式-base64-转-blob)
  - [canvas.toBlob 方式](#canvastoblob-方式)
- [blob 转 file](#blob-转-file)
- [base64 转 blob(二进制)](#base64-转-blob二进制)
- [浏览器打开 blob/file (也可实现下载)](#浏览器打开-blobfile-也可实现下载)
- [img 使用 blob/file](#img-使用-blobfile)
- [文件下载](#文件下载)

## 文件上传

兼容性：ie10+

```js
// 通过 input file 获取文件
// input file 可以选多个，所以返回 files
var file = document.getElementById('file1').files[0]

// FormData 模拟表单数据
// https://developer.mozilla.org/zh-CN/docs/Web/API/FormData/Using_FormData_Objects
fd = new FormData()
fd.append('file', file)

// 文件大小
// file.size

// 文件名
// oFile.name // "Fiddler2.7z"

// 文件类型
// file.type
// 类型过滤
var fileFilter = /^(image\/bmp|image\/gif|image\/jpeg|image\/png|image\/tiff)$/i
if (!fileFilter.test(file.type)) {
}

// ajax
var xhr = new XMLHttpRequest()
// 进度条
xhr.upload.addEventListener('progress', function (e) {
  // 是否可以取到 进度数据
  if (e.lengthComputable) {
    console.log(e.loaded / e.total)
  }
})
// 完成后触发
xhr.addEventListener('load', uploadFinish)
// 错误触发
xhr.addEventListener('error', uploadError)
// 终止触发
xhr.addEventListener('abort', uploadAbort)

// 上传
xhr.open('post', '/file')
xhr.send(fd)
```

## 文件读取

https://developer.mozilla.org/zh-CN/docs/Web/API/FileReader

```js
// 图片预览示例

var fileReader = new FileReader()
// 文件读取 完后触发
fileReader.onload = function (e) {
  img.src = e.target.result
}
// 文件读取为 DataURL，base64
fileReader.readAsDataURL(document.getElementById('file').files[0])
```

## base64

1. 通过 FileReader 读取文件得到

```js
var myfile = document.getElementById('myfile').files[0]
var fileRead = new FileReader()
fileRead.readAsDataURL(myfile)
fileRead.onload = function (e) {
  console.log(e)
  var base64 = e.target.result
  console.log(base64)
  var img = new Image()
  img.src = base64
  document.getElementsByTagName('body')[0].appendChild(img)
}
```

2. 通过 canvas.toDataURL

## blob 获取

**blob 可直接进行 ajax 文件上传，无需转 file**

### atob + Uint8Array 方式 (base64 转 blob)

参考网址: [DataURL, Blob, File, Image 之间的关系与转换 - CSDN 博客](https://blog.csdn.net/hahahhahahahha123456/article/details/80605836)

```js
function dataURLToBlob(dataurl) {
  var arr = dataurl.split(',')
  var mime = arr[0].match(/:(.*?);/)[1]
  var bstr = atob(arr[1])
  var n = bstr.length
  var u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}
```

### canvas.toBlob 方式

[HTMLCanvasElement - Web API 接口 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement)

```js
var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
var ctx = canvas.getContext('2d')
var img = new Image()
img.onload = function () {
  ctx.drawImage(img, 0, 0)
  canvas.toBlob((blob) => {
    console.log(blob)
  })
}
img.src = '/img/bd_logo1.png'
```

## blob 转 file

必须带中括号

```js
var file = new File([blob], 'test.png', { type: blob.type })
```

## base64 转 blob(二进制)

```js
/**
 * base64文件格式转换为2进制
 *
 * @param  {[String]} data dataURL 的格式为 “data:image/png;base64,****”,逗号之前都是一些说明性的文字，我们只需要逗号之后的就行了
 * @param  {[String]} mime [description]
 * @return {[blob]}      [description]
 */
export default function (data, mime) {
  data = data.split(',')[1]
  data = window.atob(data)
  var ia = new Uint8Array(data.length)
  for (var i = 0; i < data.length; i++) {
    ia[i] = data.charCodeAt(i)
  }
  // canvas.toDataURL 返回的默认格式就是 image/png
  return new Blob([ia], {
    type: mime,
  })
}
```

## 浏览器打开 blob/file (也可实现下载)

[createObjectURL MDN 文档](https://developer.mozilla.org/en-us/docs/Web/API/URL/createObjectURL)

```js
window.open(URL.createObjectURL(blob)) // createObjectURL 也支持 file
```

## img 使用 blob/file

```js
img.src = URL.createObjectURL(blob)
```

## 文件下载

```js
// 方式1：兼容性较好
export default function download(file) {
  var a = document.createElement('a')
  a.download = file.name

  // 1 file 对象保存到本地
  a.href = URL.createObjectURL(file)
  // 2 直接将文本保存到本地
  // a.href = URL.createObjectURL(new Blob(['文本内容文本内容文本内容文本内容']))
  // 3 非 text/html 类型的文件链接
  // a.href = 'http://e.xstt5.com/e/DownSys/doaction.php

  document.body.appendChild(a)
  a.click()
  a.remove()
}

// 方式2：有些浏览器会覆盖当前页
location.href = URL.createObjectURL(blob)

// 方式3：会出现闪屏
window.open(URL.createObjectURL(blob))

// 方式4：iframe ?? 待测试
```

