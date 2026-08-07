
# input file

[<input type="file"\> | MDN](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/Input/file)

## js 动态选择实现
为了避免问题，动态文件选择最好 append 到 文档中

iPhone 微信浏览器因为没有增加到文档，click 方法无效

```js
export default function (onSelect, accept) {
  let file = document.createElement('input')
  file.type = 'file'
  file.accept = accept

  // 移动端 file 元素最好加到页面中
  file.style.display = 'none'
  document.body.appendChild(file)

  file.onchange = onSelect
  file.click()
}

```

## multiple 属性 - 多选

```html
<input type="file" multiple/>
```

## accept 属性 - 文件类型

[MIME 类型 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Basics_of_HTTP/MIME_types)

常用：
文件后缀|MIME|说明
-|-|-
.doc|application/msword|chrome 不支持
.docx|application/vnd.openxmlformats-officedocument.wordprocessingml.document|chrome 不支持
.rtf|application/rtf|
.xls|application/vnd.ms-excel	application/x-excel|
.xlsx|application/vnd.openxmlformats-officedocument.spreadsheetml.sheet|
.ppt|application/vnd.ms-powerpoint|
.pptx|application/vnd.openxmlformats-officedocument.presentationml.presentation|
.pps|application/vnd.ms-powerpoint|
.ppsx|application/vnd.openxmlformats-officedocument.presentationml.slideshow|
.pdf|application/pdf|
.swf|application/x-shockwave-flash|
.dll|application/x-msdownload|
.exe|application/octet-stream|
.msi|application/octet-stream|
.chm|application/octet-stream|
.cab|application/octet-stream|
.ocx|application/octet-stream|
.rar|application/octet-stream|
.tar|application/x-tar|
.tgz|application/x-compressed|
.zip|application/x-zip-compressed|
.z|application/x-compress|
.wav|audio/wav|
.wma|audio/x-ms-wma|
.wmv|video/x-ms-wmv|
.mp3 .mp2 .mpe .mpeg .mpg|audio/mpeg|
.rm|application/vnd.rn-realmedia|
.mid .midi .rmi|audio/mid|
.bmp|image/bmp|
.gif|image/gif|
.png|image/png|
.tif .tiff|image/tiff|
.jpe .jpeg .jpg|image/jpeg|
.txt| text/plain|
.xml|text/xml|
.html|text/html|
.css|text/css|
.js|text/javascript|
.mht .mhtml|message/rfc822|

### 所有类型

使用 `*`

```html
<input type="file" accept="image/*">
```

### 多种指定类型

`,` 隔开

```html
<input type="file" accept="image/gif,image/bmp">
```

### js 获取 accept

```js
document.querySelector('input[type=file]').accept
```
