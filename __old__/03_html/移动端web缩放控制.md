
## 简单介绍

完整

```html
<meta name="viewport" content="height=device-height,width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no" /> 

```

常用

```html
<meta content="width=device-width,initial-scale=1,user-scalable=no" name="viewport"/>
```

**width,height**
指定视区的逻辑宽度和高度。假如大于浏览器显示区的逻辑高宽，内容将放大指定倍数来显示。小于情况将等于浏览器显示区逻辑高宽。
值可以是具体的像素值；
也可以是一些特殊字指令符，比如device-width、device-heigh，如果不给，默认值就是这两个


经测试width、height可以不指定。将等于浏览器显示区的逻辑高宽

## ios9以下系统同时展示两个webview有bug，高宽超出


当页面中同时放两个webview时，指定`width=device-width`，将大于webview的逻辑宽度，像是设备的逻辑宽度来算。  
**解决：** 去掉width，或者指定为0即可，即如下所示
```
<meta content="initial-scale=1,user-scalable=no" name="viewport"/>
或者
<meta content="width=0,initial-scale=1,user-scalable=no" name="viewport"/>
```
20170720更新：  
不到万不得已，不去掉width，也不指定为0，否则ios10会出现 ios click 300ms延迟。  其他低版本未测，没有手机。。

