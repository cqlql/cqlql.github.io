
## script节点引入-带编码

```html
<script type="text/javascript" charset="utf-8" src="./zh_CN.js"></script>
```

## 标签位置

挨着 body 结束标签，让页面更快展示

```html
<html>
	<head></head>
	<body>
    <p> 页面内容 <p/>
		<script src="vendor.js" charset="utf-8"></script>
		<script src="pageA.js" charset="utf-8"></script>
	</body>
</html>
```

## script 引用的js报错不会影响下一个script 执行

## 标签属性

### src

js文件路径，可以不是.js后缀。但MIME类型必须正确的。
也就是说，不管是什么文件，什么后缀，只要返回javascript的文本即可

## js 操作


### src 方式

```js
function scriptLoad ({ src, success = () => { }, error = () => { }, complete = () => { }, charset = 'utf-8' }) {
  let script = document.createElement('script')
  script.type = 'text/javascript'
  script.charset = charset
  script.src = src
  if ('onload' in script) {
    script.onload = function () {
      success()
      complete()
      script.remove()
    }
    script.onerror = function () {
      error(new Error('js 加载失败'))
      complete()
      script.remove()
    }
  } else { // ie 情况
    script.attachEvent('onreadystatechange', function () {
      if (script.readyState === 'complete' || script.readyState === 'loaded') {
        success()
        complete()
      }
    })
  }
  (document.head || document.body).appendChild(script)
}
```

### 添加js文本，以及执行机制

赋值后将立马执行

```js
var eScript = document.createElement('script');
document.getElementsByTagName('head')[0].appendChild(eScript);

eScript.text = 'alert(1);'; // 立马执行
alert(2); // 接下来执行
```

兼容性：all

两种方式赋值

```js
eScript.text = 'alert(1);'; // 兼容all
eScript.innerHTML = 'alert(1);'; //ie678不支持
```

### 未添加到文档中的script不会执行

```js
var eScript = document.createElement('script');
eScript.text = 'alert(1);'; // 不会执行
```

### 动态添加script的正确方式

**正确方式，通过 createElement直接创建script对象**

```js
var eScript = document.createElement('script');
//document.body.appendChild(eScript); // 会执行
 document.getElementsByTagName('head')[0].appendChild(eScript); // 也会执行
 eScript.text = 'alert(1);';//
```

**错误方式：通过innerHTML添加的script不会执行**

```js
el.innerHTML = '<script>alert(1);<\/script>';
```

兼容性：all

### 其他猜想

#### 外网script 操作页面，是否跨域？

先说结论：引用外网js没有来操作页面 **没有跨域问题**。

引用的js本质上相当于在页面中书写js，而且其中的路径都得相当于页面写。css刚好不同，其中的路径是相对于当前css文件来的

#### 多个相同script调用，疑虑？

只会下载一次。  
而且依次顺序执行，看来是执行多次。  
还没下好情况的相同引用，猜测也有一个公共下载，等下载好后依次通知。下好就直接使用缓存

#### 是否可以操作同一个script的src
对于同一个script标签，通过更改src属性来实现加载另一个js，没有效果。看来每个js文件都必须用一个新的script来进行加载。

但对于一个还没有设置src的script，什么时候设置都是可以的

## 查看 script、link 加载事件支持情况

查看浏览器的onload、onerror、onreadystatechange 事件支持情况, [点我](https://pie.gd/test/script-link-events/)





## 是否需要终止加载猜测
关于担心后加载的会被之前加载的覆盖，应该无需担心

理论猜测：新加一个script A，然后再新加一个script B，那么B会等待A加载并执行完成后再加载执行。所以只会跟文档顺序有关。
