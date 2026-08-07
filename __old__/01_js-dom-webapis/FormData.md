
https://developer.mozilla.org/zh-CN/docs/Web/API/FormData

创建与使用

```js

// 创建方案1：创建一个空的FormData对象
var formdata = new FormData()
// 用 append 方法增加数据
formdata.append("name", "诸葛亮")
formdata.append("blog", "http://www.cnblogs.com")
formdata.append("file", document.getElementById('fileToUpload').files[0]) // 文件

// 创建方案2：通过 form 元素初始创建
var formobj =  document.getElementById("form")
var formdata = new FormData(formobj)
// 同样可用 append 方法
formdata.append("name", "司马懿")

// ajax 使用
var xhr = new XMLHttpRequest()
xhr.open('post', '/file')
xhr.send(formdata)
```

参数1 相同，多次 append 依然有效