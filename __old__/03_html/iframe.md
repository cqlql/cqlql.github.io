
## iframe 与 form 的 target 属性

表单提交后，响应结果将在指定的 iframe 中显示。这是另一种异步刷新方式

```html
<form action="Handler.ashx" target="uploadResponse">
  <iframe name="uploadResponse"></iframe>
</form>

```

## js 操作

```js
// 对象创建
var iframe = document.createElement("iframe");

// 包含 iframe 的页面中：取 iframe 中的 window 对象
iframe.contentWindow // 
window.frames["uploadResponse"];// 通过 name 属性, 索引也行

// iframe 中：取包含 iframe 的 windows 对象
var parentWindow = window.parent;
```

