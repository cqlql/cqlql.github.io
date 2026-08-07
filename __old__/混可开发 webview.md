

## js 调 ios 需注意
不能将 ios 接口 赋变量再调用。所以下例调用将不成功

```js
webjs = window.jshomework;//将ios的jshomework赋给其他变量
webjs.selectPicture()//调用ios定义的selectPicture方法
```
