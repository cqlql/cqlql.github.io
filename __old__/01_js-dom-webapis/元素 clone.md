
## 使用 document.importNode

[document.importNode - Web API 接口 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/Document/importNode)

```
var node = document.importNode(externalNode, deep);
```

**疑问？**

事件绑定是否也被 clone

**兼容性：**

ie9+

并且，参数`deep`(深度克隆) ie都不支持

## 其实还可使用 innerHTML、outerHTML 进行 clone 
