## 兼容性

ie 11 才开始支持，这种情况使用 `element.getAttribute(name)` 代替

## js 设置

js 设置操作将直接同步到标签上。可直接通过调试工具在标签上看到

```
<div id="item" data-index="1"></div>

<script>
    item.dataset.index=2;
</script>
```

## js 获取

```js
console.log(item.dataset.index)
```

## 关于大小写问题

只能小写获取。也就是说，标签属性名尽量小写。

```js
document.body = `<a href="javascript:;"  data-qNo="' + qNo + '" data-index="' + i + '">' + qNo + '1</a>`

console.log(btn.dataset.qno)
```
