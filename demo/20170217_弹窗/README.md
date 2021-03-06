

# 弹窗
主要针对移动端。考虑到移动端性能问题，动画主要采用css3  

[demo](http://cqlql.github.io/demo/20170217_弹窗/dist/index.html)  

弹窗Popup模块源码：  
[js](https://github.com/cqlql/cqlql.github.io/blob/master/js/modules/popup.js)  
[css](https://github.com/cqlql/cqlql.github.io/blob/master/js/modules/popup.js)



## 1 基础弹窗：多实例，灵活定制
- 默认关闭不销毁元素
- 调用`popup.show()`之后才会初始化
- 关于设置宽度，可实例化时进行，也可通过`popup.show({width})`
- 关于自定义元素，比如加类名，可在钩子`created`中进行


### 快速使用

```js
import Popup from 'popup';
let newPopup = new Popup({
    title: '测试标题',
    content: '<p style="padding:10px">测试内容</p>',
});
```

### 实例选项
```js
var popup = Popup({

    // 标题
    // 可选
    title:'',

    // 用于填充弹窗的内容
    // 可选
    content:'',
    
    // 设置宽度
    // 可选
    width:288,

    // 点外面关闭, 是否开启
    // 可选，默认开启
    outsideClose:true,
    
    // 是否有头部导航
    // 可选，默认有
    hasTopBar:true,
    
    /// 钩子
    
    // 初始化之后调用
    // 只会执行一次
    // 方便对元素进行初始化更改，比如增加class，增加其他自定义元素
    created(){},
    
    //   关闭前调用
    // 每次关闭都会调用
    //   可选
    //   retrue false 可控制不关闭窗口
    beforeClose(){},

    // 可选
    // 显示前调用，每次popup.show()都会被调用，元素已在页面中，但未显示
    // 参数：内容根元素
    // 主要进行显示前的准备工作，比如注册事件，或者更自由的更换标题内容等
    beforeShow(rootContentElem){},

    // 关闭后并且关闭动画结束后调用
    // 主要为了一次性弹窗删除元素预留的接口
    afterClose(){}

});

// 弹窗显示
popup.show({
    // 设置宽度
    // 可选
    width:288
});

// 弹窗关闭
popup.close()


// .full-page-popup 元素
// 可在 created 中自定义操作
popup.ePopup

// .fgp-main 元素
// 可在 created 中自定义操作
popup.ePopupMain

// .fgp-bd 元素
// 可在 created 中自定义操作。可控制窗口宽度
popup.ePopupCont
```

## 2 一次性弹窗：简单直接的调用方式
- 使用基础弹窗实现  
- 关闭则销毁


### 快速使用
``` javascript
import {popup} from 'popup';

// 弹窗
let popup1 = popup({
    title: 'test标题',
    content: '<p style="padding:10px">test 内容。一次性弹窗</p>',
});

// 关窗
popup.close();
// 或者。原因见手动关窗
// popup1.close();
```

### 弹窗选项

```js
// 弹窗
let popup1 = popup({
    // 标题
    // 可选
    title:'',

    // 用于填充弹窗的内容
    // 可选
    content:'',

    // 钩子
    //   可选
    //   显示前调用，元素已在页面中，但未显示
    //   参数：内容根元素
    //   主要进行显示前的准备工作，比如注册事件，或者更自由的更换标题内容等
    beforeShow(rootContentElem){ },

    // 钩子
    //   关闭前调用
    //   可选
    //   retrue false 可控制不关闭窗口
    beforeClose(){ },

});

```

### 手动关窗
- 关闭后会删除元素  
- 考虑到不关窗多次调用情况，弹窗操作会返回当前弹窗实例，用来关掉当前弹窗，而 `popup.close` 只会关闭最新弹窗。  

```js
// 方式1
popup.close();

// 方式2。通过 popup() 返回值
popup1.close();
```

## 3 确认弹窗
- 使用基础弹窗实现  
- 简单直接的调用方式，关闭后不会被销毁，以便再次被使用  
- 不支持也不推荐 在comfirm 窗口上进行异步的加载中展示。推荐在操作项或者整个界面上进行加载中展示  
- 不关窗，多次调用，只会更改当前实例

### 快速使用
```js
import {confirmPopup} from 'popup';
// 弹窗
confirmPopup({
    title: '删除',
    des: '确认删除？',
    confirm() {
        console.log('确认触发');
    }
});

// 手动关闭
confirmPopup.close();
```
