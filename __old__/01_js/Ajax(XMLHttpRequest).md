- [例子说明](#例子说明)
- [xhr.responseType](#xhrresponsetype)
- [xhr.response](#xhrresponse)
- [兼容性问题](#兼容性问题)
  - [不支持 responseType、onreadystatechange](#不支持-responsetypeonreadystatechange)
  - [不支持自动转 JSON 为对象](#不支持自动转-json-为对象)

## 例子说明

```js
var xhr;
if (XMLHttpRequest) {
  // w3c标准创建方式。ie7+支持
  xhr = new XMLHttpRequest();
} else {
  // IE5,6创建方式
  xhr = new ActiveXObject("Microsoft.XMLHTTP");
}

/*
 * onreadystatechange事件 属性
 *
 * 每当AJAX对象的readyState属性改变时就会调用一次
 * readyState属性的初始值为0。表示 请求未初始化
 */
function readystatechange() {
  if (xhr.readyState === 1) {
    console.log("服务器连接已建立");
  } else if (xhr.readyState === 2) {
    console.log("请求已接收");
  } else if (xhr.readyState === 3) {
    console.log("请求处理中");
  } else if (xhr.readyState === 4) {
    /**
     * 4表示响应数据已到达浏览器端;200表示 正确的响应结果;404表示页面未找到
     *
     * 在此处 处理响应的结果
     * 调用AJAX对象的responseText属性来获取响应的文本格式数据
     * 还有一个属性 responseXML ，待测
     *
     */
    if (xhr.status === 200) {
      // 如果不指定 responseType ,默认 text 格式！！！
      var response = xhr.response;
      // console.log(xhr.responseText)
      // console.log(xhr.responseXML)

      // android 4.4以下，ajax不会根据后台响应要求自动转换 json为对象。所以只能手动转换
      if (responseType === "json" && typeof response === "string") {
        console.log(JSON.parse(response));
      } else {
        console.log(response);
      }
    } else {
      console.error(xhr);
    }
    console.log("complete");
  }
}
// 华为安卓机总是用老浏览器内核，设置 responseType 会报错
try {
  xhr.responseType = "json";
  xhr.onreadystatechange = readystatechange;
} catch (e) {
  xhr.onload = readystatechange;
}

/*
指定提交的数据格式(可选)
默认 text/plain
 
相当于form表单的enctype标签属性。但不能指定为 multipart/form-data。即使指定了也无效(变成默认的text/plain)

可设置的值，竖线后为 send 对应的值格式：
text/plain | 文本
application/json | '{ "k" : "v" }'
application/x-www-form-urlencoded | 'name=value&n2=v2'
 
值后面可指定编码格式
 */
xhr.setRequestHeader("Content-type", "application/json;charset=utf-8");

xhr.open("post", "/Default.aspx");

/*
执行提交

参数即提交的数据，如果是get方式，填写null即可

参数格式与 Content-type 对应
*/

ajaxObj.send(JSON.stringify({ data: "测试数据" }));
```

## xhr.responseType

指定响应的数据类型。  
服务器可据此作出相应处理，返回指定类型。  
浏览器会据此将数据解析成指定类型对象，可通过 xhr.response 获取

| Value         | Data type of response property | 说明                         |
| ------------- | ------------------------------ | ---------------------------- |
| ""(空字符串)  | 字符串                         | 默认值，相当于"text"         |
| "text"        |                                |
| "arraybuffer" |                                |
| "blob"        |                                |
| "document"    | Document 对象                  | 将解析成一个新的 document 树 |
| "json"        |                                |

## xhr.response

获取响应的数据，通过 responseType 指定类型

## 兼容性问题

### 不支持 responseType、onreadystatechange

**浏览器版本：**  
`AppleWebKit/534.30 Version/4.0; Android 7.0; HUAWEINXT-AL10`
华为机安卓 7.0，内置浏览器版本很低

完整的版本信息，没有 chrome 字样：
5.0 (Linux; Android 7.0; HUAWEI NXT-AL10 Build/HUAWEINXT-AL10) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30

**不支持：**

```js
xhr.responseType = "json";
```

同时 onreadystatechange 事件也有问题(只会触发一次，且 xhr.readyState 为 1)，需使用 onload 代替，目前如下解决

```js
function readystatechange() {}
try {
  xhr.responseType = "json";
  xhr.onreadystatechange = readystatechange;
} catch (e) {
  xhr.onload = readystatechange;
}
```

### 不支持自动转 JSON 为对象

明明指定了 xhr.responseType = "json"，指明后台返回 json 数据，浏览器当然可以直接转对象

**系统版本**  
`AppleWebKit/537.36 Version/1.5 Chrome/28.0.1500.94 Mobile; Android 4.3; SAMSUNG SM-G3586V`

**目前如下解决：**

```js
if (typeof response === "string") {
  success(JSON.parse(response));
} else {
  success(response);
}
```
