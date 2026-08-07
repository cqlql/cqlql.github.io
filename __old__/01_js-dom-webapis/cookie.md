- [新增/修改 操作](#新增修改-操作)
- [参数 path](#参数-path)
- [删](#删)
- [查](#查)
- [服务端可写 cookie](#服务端可写-cookie)

[Document.cookie - Web API 接口 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/Document/cookie)

与当前网址关联

## 新增/修改 操作

一次只能操作一个键值

```js
// 新增/修改
document.cookie =
  "succmsg=helloword;expires=Mon, 16 Jan 2012 20:30:11 UTC;path=/;domain=b.com";
// 新增/修改-动态过期时间
document.cookie =
  "succmsg=helloword;expires=" +
  new Date().toUTCString() +
  ";path=/;domain=b.com";

// 值设置为空字符串
document.cookie = "succmsg=";
// ie6视这种cookie是没有key情况

// 设置没有 key 的 cookie
document.cookie = "bar";
// 加上之前设置的，console.log(document.cookie) 将返回：
// "bar; succmsg=helloword;"
```

**中文字符值注意事项：**

避免中文字符无效情况，使用 encodeURIComponent 转码，转码后不管什么字符都不会错：
转码例子：

```js
document.cookie =
  "test=" + encodeURIComponent("值") + ";path=/enterprise/company";
```

## 参数 path

设置后，只有访问相应地址才能取到值

默认 `;path=/` 当前网站的任何子地址都可访问

## 删

不管是会话还是持久 cookie，只要将 expires 设置为过期，都将被删除

```js
document.cookie = "test=1;path=/";
var d = new Date();
d.setDate(d.getDate() - 1);
document.cookie = "test=(随便，最好不为空);expires=" + d + ";path=/"; //执行删除
```

删除必须的是相同的 path。不管上级下级关系，反正只删除 path 值完全相等情况。  
目前还不清楚跟 domain 什么关系，待测

## 查

将返回所有 cookie，键值对，分号+空格隔开

没有任何 cookie 将值将返回**空字符串**

```js
console.log(document.cookie);
// FG=1; PSTM=1529373406; BD_CK_SAM=1; PSINO=6
```

简单封装，取指定 key 的 cookie

```js
// 没有值情况 返回null
function getCookie(name) {
  var reg = new RegExp(name + "=([^;]*)"),
    v = reg.exec(document.cookie);
  return v ? v[1] : v;
}
```

## 服务端可写 cookie

至少满足二级域名相同，设置 `xhrFields: { withCredentials: true }` 即可

```js
$.ajax({
  url: "http://uc.lwk.com/company/getid/?name=湖南旅美美旅行社有限公司",
  xhrFields: { withCredentials: true },
  // crossDomain: true,
  success(data) {
    console.log(data);
  },
});
```
