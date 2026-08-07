
## 元素对象的 style 属性

### 传统方式操作 style

#### 兼容性
包括 ie6 的所有

#### 设置

```js
// 比较直接的方式
// 需处理减号风格。使用驼峰
// 1
elem.style.color = 'red';
// 2
var style = elem.style;
style.backgroundColor = 'red';

// 使用 cssText
// 无需处理减号
// 会覆盖之前的，可使用加等
elem.style.cssText += 'font-size:16px;';

```

#### 获取

直接css属性、cssText

如果没有设置返回 空字符串。
设置了获取，将直接返回设置时的字符串


#### 猜想：是否可以直接赋对象？

答案是不行

```js
// 错误例子
elem.style = {
    color: 'red',
    backgroundColor: 'red'
}
```

#### 前缀问题

```
style.webkitAnimation
style.MozAnimation
style.msAnimation
上例中
Webkit 首字母大小写均可
Moz 首字母必须大写
ms 首字母必须小写
提醒：css语法中的属性名称是不区分大小写的，如-MOz-columns: 3 200px;
```

### 新方式操作 style

支持 ie9+

无需处理减号风格，而且只能用 css 原风格

#### 设置 - setProperty

示例

```js
elem.style.setProperty("color", "red", "important");
elem.style.setProperty('background-color', 'red');
```

#### 获取 – getPropertyValue

只能获取内联css，即 style 标签属性内的 css

没有返回 空字符串

```js
elem.style.getPropertyValue('background-color') // 'rgb(51, 51, 51)'
```

#### 删除 - removeProperty

有返回值，返回删除的值

```html
<div style="width:10px" id="elem"></div>
<script>
console.log(elem.style.removeProperty('width')) // '10px'
</script>

```

#### 判断是否使用 important 优先级 - getPropertyPriority

返回值：string  
有，返回 `important` 字符串; 没有，返回空字符串

```html
<div style="width:10px!important;height:20px" id="elem"></div>
<script>
  console.log(elem.style.getPropertyPriority('width')) // 'important'
  console.log(elem.style.getPropertyPriority('height')) // ''
</script>
```

#### 内联css个数 – length

```html
<div style="width:10px;height:20px" id="elem"></div>
<script>
  console.log(elem.style.length) // 2
</script>
```

#### 可操作索引

```html
<div style="width:10px;height:20px" id="elem"></div>
<script>
  console.log(elem.style[0]) // 'width'
</script>
```

#### 兼容性
ie9+、chrome、firefox  
ie9极不稳定。iphone ios8  似乎不支持，慎用


### ie专属，ie6 ~ ie11
需处理减号分隔符
 
```js
el.style.setAttribute('backgroundColor', 'red');
```

兼容性：
所有ie。包括ie11

## style 元素

### 操作

#### innerHTML 方式
支持的浏览器：ie9+、Firefox、Safari、Chrome、Opera

设置读取操作都行。

直接操作style元素的innerHTML即可。且不需要设置type特性。
当然，动态创建情况，需把style元素增加到文档中才会生效。

ie678只支持读取，设置操作将报错

#### textContent方式
支持的浏览器：ie9+、Firefox、Safari、Chrome、Opera

跟innerHTML一样，设置读取都行

ie678压根没这个属性

#### styleElem.styleSheet.cssText IE独有方式

解决 ie6~8 兼容问题

**设置**

```js
eStyle.styleSheet.cssText = 'div{color:red}';
```

**可读取**

可获取任意style标签的值

```js
console.log(document.getElementsByTagName('style')[0].styleSheet.cssText);
```


**必须设置 type属性，否则不生效**  
而且 eStyle.styleSheet 将获取到 null 值

```js
eStyle.setAttribute("type", "text/css");//此属性不设也生效
```

**兼容性**：  
ie6~8专用，ie9~10也支持，ie11不支持

**例子：**

```js
var eStyle = document.createElement('style');
eStyle.setAttribute("type", "text/css");// 必须设置
eStyle.styleSheet.cssText = '#test{color:red;}';
document.getElementsByTagName('head')[0].appendChild(eStyle);
```

#### 兼容所有示例

```js
function addCssText (txt) {
  let eStyle = document.createElement('style')

  if ('textContent' in eStyle) {
    eStyle.textContent = txt
    document.head.appendChild(eStyle)
  } else {
    // ie678
    eStyle.setAttribute('type', 'text/css')
    eStyle.styleSheet.cssText = txt
    document.body.appendChild(eStyle)
  }
}
```


### 动态创建注意
#### 位置 
js创建的style元素可增加到任意位置，body，head 等都将生效，建议增加到head标签

所有浏览器都如此

#### 生效
需增加到文档中
所有浏览器都如此

### 关于 jq 的 html 方法
并非简单的 innerHTML。对 style 有特别处理，使其生效。(会将style元素插入head中的)

## 全能取css值

### 高级 - getComputedStyle
外部样式表、内部样式表、内联样式，transition 过程中，都能被获取到

只能取，不能设置

```js
var s = window.getComputedStyle(el)
// 伪类元素
var s = window.getComputedStyle(el, '::after')

// 取值的三种方式
console.log(
  s['background-color']
  s.getPropertyValue('background-color'),
  s.backgroundColor,
)

// 常用写法
window.getComputedStyle(el)['background-color']
```

#### 兼容性：ie9+，chrome，firefox

### ie6 ~ 9

#### 取操作

```js
var ieStyle = eTest1.currentStyle;
console.log(ieStyle.backgroundColor); // ie6 ~ 8
console.log(ieStyle.getPropertyValue('background-color')); // 只有ie9
```

#### 写操作 尝试

```js
// 同样也报不允许错误
ieStyle.backgroundColor = 'red';
ieStyle.setProperty('background-color','red');
```


## className 操作

### 直接操作 className 属性

#### 增删改查

```js
console.log(eB.className); // 直接通过元素操作
```

### 关于className中包含多个空格 影响

#### className 属性的影响

取值影响: 不管类名中包含多少空格，取值时也会如实取过来


```html
<div class="   banner-show    test   " id="fadeDemo">

info.innerHTML = fadeDemo.className.match(/ /g).length; // 10

```

兼容性：所有

#### 对getElementsByClassName的没有影响
不管是 

```html
<div class="   banner-show    test   ">
```

还是

```js
document.getElementsByClassName('                    banner-show')
```

getElementsByClassName 都会忽略掉多余的空格，视为正常的书写，也就是程序最终视为这样：

```html
<div class="banner-show test"> 
```

```js
document.getElementsByClassName('banner-show')
```

兼容性：支持getElementsByClassName的浏览器都是如此

### 操作 className 新方式 - classList

兼容性：ie10+

判断是否包含某类名  
一次只能判断一个类名，貌似jq的hasClass也是如此

```js
var isActive = document.getElementById("mySwitch").classList.contains("mui-active");
```

增加class

```js
//添加mui-active类，打开开关
ele.classList.add('mui-active');
```

删除class

```js
//删除mui-active类，关闭开关
ele.classList.remove('mui-active');
```

自动增删class

```js
//也可以直接使用toggle方法自动处理打开或关闭
ele.classList.toggle('mui-active');
```
