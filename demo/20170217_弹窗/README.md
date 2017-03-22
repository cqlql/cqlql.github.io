
# 弹窗
主要针对移动端。考虑到移动端性能问题，动画主要采用css3


## 1 基础弹窗，多实例，可定制 [demo](https://baidu.com/)
``` javascript
var popup = Popup({

    // 标题
    // 可选
    title:'',

    // 用于填充弹窗的内容
    // 可选
    content:'',

    // 点外面关闭, 是否开启
    // 可选，默认开启
    outsideClose:true,

    /// 钩子
    // 关闭前调用
    // 可选
    // retrue false 可控制不关闭窗口
    beforeClose(){},

    //   可选
    //   显示前调用，元素已在页面中，但未显示
    //   参数：内容根元素
    //   主要进行显示前的准备工作，比如注册事件，或者更自由的更换标题内容等
    beforeShow(rootContentElem){},

    // 关闭后并且关闭动画结束后调用
    // 主要为了一次性弹窗删除元素预留的接口
    afterClose(){}

});

// 弹窗显示
popup.show();

// 弹窗关闭
popup.close()
```

## 2 一次性弹窗：简单直接的调用方式 [demo](https://baidu.com/)

``` javascript
// 弹窗
popup({
    // 标题
    // 可选
    title:'',

    // 用于填充弹窗的内容
    // 可选
    content:'',

    /// 钩子
    //   可选
    //   显示前调用，元素已在页面中，但未显示
    //   参数：内容根元素
    //   主要进行显示前的准备工作，比如注册事件，或者更自由的更换标题内容等
    beforeShow(rootContentElem){ },

    /// 钩子
    // 关闭前调用
    // 可选
    // retrue false 可控制不关闭窗口
    beforeClose(){ },

});


// 关窗
// 关闭后会删除元素
popup.close();
```

## 3 确认弹窗
以基础多实例弹窗实现  
简单直接的调用方式，关闭后不会被销毁，以便再次被使用  
不支持也不推荐 在comfirm 窗口上进行异步的加载中展示。推荐在操作项或者整个界面上进行加载中展示

``` javascript
confirmPopup({
    title: '删除',
    des: '确认删除？',
    confirm() {
        console.log('确认触发');
    }
});
```
