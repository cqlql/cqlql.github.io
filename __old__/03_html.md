- [HTML 元素参考](#html-%E5%85%83%E7%B4%A0%E5%8F%82%E8%80%83)
- [form 表单](#form-%E8%A1%A8%E5%8D%95)
  - [输入控件 disabled 后将不会提交到后台](#%E8%BE%93%E5%85%A5%E6%8E%A7%E4%BB%B6-disabled-%E5%90%8E%E5%B0%86%E4%B8%8D%E4%BC%9A%E6%8F%90%E4%BA%A4%E5%88%B0%E5%90%8E%E5%8F%B0)
  - [表单提交 name 属性](#%E8%A1%A8%E5%8D%95%E6%8F%90%E4%BA%A4-name-%E5%B1%9E%E6%80%A7)
- [其他](#%E5%85%B6%E4%BB%96)
  - [页面中的 flash](#%E9%A1%B5%E9%9D%A2%E4%B8%AD%E7%9A%84-flash)
## HTML 元素参考

[HTML 元素参考 - HTML（超文本标记语言） | MDN](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element)


## form 表单

### 输入控件 disabled 后将不会提交到后台

兼容性：ie6+

### 表单提交 name 属性

form 表单提交会把所有拥有 name 属性的的 input 的 value 提交给服务器。当然 input[type="button"] 除外，即使有 name 属性，也会过滤掉

```html
<form action="http://baidu.com/s" method="get">
 <input type="text" name="wd" value="张三">
 <input type="button" name="bt_save" value="测试值">
 <input type="submit">
</form>
```

## 其他

### 页面中的 flash

改变 display、position 都将重置 flash组件
