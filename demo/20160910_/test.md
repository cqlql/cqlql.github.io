
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
### css名称转换 (弃用)
已合并在getRightCssName中
``` javascript
/**
 * css名称转换    (已合并在getRightCssName中)
 * css中的属性名转为可直接操作style的属性名
 * 其实就是 减号连接 转为 驼峰
 * @param cssPropertyName {string} 减号方式的css名称
 * */
// c.toStyleName = function (cssPropertyName) {
//     return cssPropertyName.replace(/-\w/g, function (d) {
//         return d[1].toUpperCase();
//     });
// };

```

### 取css正确名称

#### 实现
``` javascript
/**
 * 取css正确名称
 * 自动加前缀
 * 可用 box-flex 进行测试
 *
 * @param cssPropertyName {string} 减号方式的css名称
 * @return {Array} 数组中有两个值，第一个是 减号风格，第二个是驼峰。如果不支持此属性，返回null
 *
 * */
c.getRightCssName = function (cssPropertyName) {
    // 如果有直接返回
    var propertyName = c.getRightCssName[cssPropertyName];
    if (propertyName !== undefined) return propertyName;

    var
        firstLetter = cssPropertyName[0],
        firstLetterUpper = firstLetter.toUpperCase(),
        cssPrefixes = ["ms" + firstLetterUpper, "Moz" + firstLetterUpper, "webkit" + firstLetterUpper, firstLetter],
        cssPrefixesReal = ["-ms-", "-Moz-", "-webkit-", ''],
        style = document.body.style,
        // css名称转换
        name = cssPropertyName.replace(/-\w/g, function (d) {
            return d[1].toUpperCase();
        }).substr(1);

    for (var i = cssPrefixes.length, newName; i--;) {
        newName = cssPrefixes[i] + name;

        if (newName in style) {
            propertyName = [cssPrefixesReal[i] + cssPropertyName, newName];
            break;
        }
    }

    propertyName = propertyName || null;

    c.getRightCssName[cssPropertyName] = propertyName;

    return propertyName;
};

```



## 基础功能

### 速率计算，目前滑动使用

#### 实现
``` javascript
// 代替 Velocity 的新方式
c.SwipeBase=function () {

    var prevXData, toX, i;

    this.start = function (x) {
        i = 0;
        prevXData = {};
        prevXData[i] = x;
    };

    this.move = function (x, excu) {
        i++;
        prevXData[i] = x;
        excu(x - prevXData[i - 1]);
    };
    this.end = function (swipeLeft, swipeRight, swipeNot) {

        if (i) {
            if (i < 2) {
                i++;
                prevXData[i] = prevXData[i - 1];
            }

            var toX = prevXData[i] - prevXData[i - 2];

            var s = 10;// 此处调节敏感度
            if (toX > s) {
                // 右滑动
                swipeRight();
            }
            else if (toX < -s) {
                // 左滑动
                swipeLeft();
            }
            else {
                // 未发送滑动，但有移动
                swipeNot();
            }

        }
        else {
            // 不小心模拟了click事件
            // move根本就没触发情况
        }
    };
};
```
## string
