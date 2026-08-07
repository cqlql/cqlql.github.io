## js
### 关于body清空

可以这样清空body，这种方式ie678不支持

```js
document.body = document.createElement('body');
```

其实跟这样效率差别不大，所有浏览器支持

```js
document.body.innerHTML ='';
```

## css

### background 设置满屏背景

兼容性：包括ie6的所有

### 默认css

默认有margin属性，但margin各浏览器不同

兼容性：包括ie6的所有
