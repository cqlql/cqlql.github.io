
## 其他
### 注释模版

#### 使用
其中中括号指明参数可选，大括号指明参数类型参数名称先写，类型在后
``` javascript
/**
 * css值获取
 * @param elem {Element}
 * @param [name] {string}
 * @return {string}
 * */
```


## DOM

### getElementsByClassName 根据className取

#### 实现
``` javascript
/**
 * 根据className取
 * @param elem {element} 某祖先元素
 * @param className {string}
 *
 * @return {array,HTMLCollection} 元素集合。旧版浏览器将返回array
 *
 * @兼容性 所有浏览器
 */
c.getElementsByClassName = function (elem, className) {
    if (elem.getElementsByClassName) return elem.getElementsByClassName(className);
    return this.filtrateElementsByClassName(className, elem.getElementsByTagName("*"));
};
```

### filtrateElementsByClassName 过滤 元素集合 根据className

#### 实现
``` javascript
/**
 * 过滤 元素集合 根据className
 * @return {array} 元素数组
 */
c.filtrateElementsByClassName = function (elems, className) {

    var array = [];

    //过滤
    for (var i = 0, len = elems.length; i < len; i++) {
        if (this.hasClass(elems[i], className)) array.push(elems[i]);
    }

    return array;
};

```

### scopeElements 元素向上范围查找
目标元素逐个往上找 实现查找范围内的所有元素，或者说是赛选某元素内的所有元素


#### 实现
``` javascript
c.scopeElements = function (targetElem, listener) {
    targetElem = targetElem.nodeType === 1 ? targetElem : targetElem.parentElement;
    go(targetElem);
    function go(that, child) {
        if (listener(that, child) !== false) {
            go(that.parentElement, that);
        }
    }
};
```

#### 使用
``` javascript
c.scopeElements(elem,function (elem) {

   if(elem===eEnd)return false;
   if(elem.tagName==='H2'){
       // do something...
       return false;
   }
   return otherFn();
});
```

### addCssTxt 增加css文本
#### 实现
``` javascript
c.addCssTxt = function (txt) {
    if ('textContent' in document.createElement('style')) {
        c.addCssTxt = function (txt) {
            var eStyle = document.createElement('style');
            eStyle.textContent = txt;
            document.head.appendChild(eStyle);
        };
    }
    else {
        // ie678
        c.addCssTxt = function (txt) {
            var eStyle = document.createElement('style');
            eStyle.setAttribute("type", "text/css");
            eStyle.styleSheet.cssText = txt;
            document.body.appendChild(eStyle);
        };
    }
    c.addCssTxt(txt);
};
```
## string
