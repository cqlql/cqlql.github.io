
实现

```
document.createElement("header");
// 此操作便能使 header 变成真正的标签。注意，生成的标签默认是inline
```

使用

```html
<!--[if lte IE 8]>
(function () {
	var a = ['header', 'section', 'footer', 'aside'];
	for (var i = a.length; i--;) document.createElement(a[i]);
})();
<![endif]-->
```