'use strict';


var base = require('base');
var string = require('string');

var c = function (elem) {

    return {
        css: function () {
            if (arguments.length === 1) {
                return c.getCss(elem, arguments[0]);
            }
            else {
                return c.setCss(elem, arguments[0], arguments[0]);
            }
        }
    };
};

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

    if (elem.getElementsByClassName) {
        return elem.getElementsByClassName(className);
    }

    return this.filtrateElementsByClassName(className, elem.getElementsByTagName("*"));
};

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

// 紧邻同辈元素 获取
/**
 获取某节点 紧邻的 上或下 单个 同辈元素节点

 @param node 节点对象，一般为元素节点
 @param isPrev * [bool] 能代表真假的任意值，默认是假，即下一个，否则上一个

 @return [node] 元素节点 或者为 null

 @compatibility 所有浏览器
 */
c.siblingElement = function (node, isPrev) {

    var str = isPrev ? "previousSibling" : "nextSibling";

    do {
        node = node[str];
        if (node === null) return null;
    } while (node.nodeType !== 1);

    return node;
};

// 元素查找 目标元素逐个往上找 实现查找范围内的所有元素，或者说是赛选某元素内的所有元素
/**
 使用
 dom.scopeElements(selection.anchorNode,function (elem) {

    if(elem===eEnd)return false;
    if(elem.tagName==='H2'){
        // do something...
        return false;
    }
    return otherFn();
 });
 */
c.scopeElements = function (targetElem, listener) {
    targetElem = targetElem.nodeType === 1 ? targetElem : targetElem.parentElement
    go(targetElem);
    function go(that, child) {
        if (listener(that, child) !== false) {
            go(that.parentElement, that);
        }
    }
};

/*
 * 元素查询
 *
 * id，className，tagName 包含着三种选择
 * */
c.queryElements = function (rootElem, names, callback) {
    var name,
        resultElems = [],
        nameIds = {},
        test;

    if (typeof names === 'string') names = names.split(',');

    setName();

    go(rootElem.children);

    callback(resultElems);

    function go(childs) {
        var nameId = '';
        for (var i = 0, len = childs.length, elem; i < len; i++) {
            elem = childs[i];

            if (!name) {
                return false;
            }
            nameId = nameIds[name];
            if (!nameId) {
                nameId = nameIds[name] = '';
            }

            if (test(elem)) {

                resultElems.push(elem);
                resultElems[name + nameId] = elem;

                nameIds[name]++;

                setName();
            }

            go(elem.children);
        }

    }

    function setName() {
        name = names.shift();

        if (name) {
            var lName = name.substr(0, 1),
                rName = name.substr(1);
            if (lName === '.') {
                test = function (elem) {
                    return c.hasClass(elem, rName);
                };
            }
            else if (lName === '#') {
                test = function (elem) {
                    return elem.id === rName;
                };
            }
            else {
                test = function (elem) {
                    // html标签 tagName 大写，但svg标签 tagName 小写
                    return elem.tagName.toUpperCase() === name.toUpperCase();
                };
            }
        }
    }
};

c.hasClass = function (elem, className) {
    if (elem.classList) {
        c.hasClass = function (elem, className) {
            return elem.classList.contains(className);
        };
    }
    else {
        c.hasClass = function (elem, className) {
            return (' ' + elem.className + ' ').indexOf(' ' + className.trim() + ' ') > -1;
        }
    }
    c.hasClass(elem, className);
};
c.addClass = function (elem, className) {
    if (elem.classList) {
        c.addClass = function (elem, className) {
            elem.classList.add(className);
        };
    }
    else {
        c.addClass = function (elem, className) {
            if (c.hasClass(elem, className) === false) {
                elem.className = c.trim((elem.className + ' ' + className).replace(/\s{2,}/g, ' '));
            }
        };
    }
    c.addClass(elem, className);
};
c.removeClass = function (elem, className) {
    if (elem.classList) {
        c.removeClass = function (elem, className) {
            elem.classList.remove(className);
        }
    }
    else {
        c.removeClass = function (elem, className) {
            elem.className = (' ' + elem.className + ' ').replace(' ' + c.trim(className) + ' ', '');
        }
    }
    c.addClass(elem, className);
};

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

/**
 * 取css名称 （已集成在 getRightCssName 中）
 *
 * 此处只是加了缓存机制，核心还是 getRightCssName
 *
 * @param cssPropertyName {string} 减号方式的css名称
 * @return {Array} 数组中有两个值，第一个是 减号风格，第二个是驼峰。如果不支持此属性，返回null
 *
 * */
// c.getCssName = function (cssPropertyName) {
//     // 如果有直接返回
//     var propertyName = c.getCssName[cssPropertyName];
//     if (propertyName) return propertyName;
//     propertyName = c.getRightCssName(cssPropertyName);
//
//     return propertyName;
// };

/**
 * 取float style操作名称
 *
 * 现在 ie7\8\9\chrome 都支持 直接float
 * firefox现在也支持float
 * opera也用了webkit内核
 * ie6基本退出
 * 所以，这里的兼容性封装似乎变得没必要了
 * */
c.getStyleFloat = function () {
    var
        arr = ['styleFloat', 'cssFloat', 'float'],
        style = document.body.style,
        i = arr.length, name;

    while (i--) {
        name = arr[i];
        if (name in style) {
            c.getStyleFloat = new Function('return "' + name + '";');
            return name;
        }
    }
};

/**
 * 设置css
 *
 * @param elem
 * @param name {string,object} 可以是键值集合
 * @param [value] {string,object} 可不带
 * */
c.setCss = function (elem, name, value) {
    var style = elem.style;

    if (typeof name === 'string') {
        style[c.getCssName(name)[1]] = value;
    }
    else {
        for (var k in name) {
            style[c.getCssName(k)[1]] = name[k];
        }
    }
};

/**
 * css值获取
 * @param elem {Element}
 * @param name
 * @return {string}
 * */
c.getCss = function (elem, name) {

    if (window.getComputedStyle) {
        c.getCss = function (elem, name) {

            var style = getComputedStyle(elem, null);
            return style[this.getCssName(name)[0]];

        };
    }
    else {
        c.getCss = function (elem, name) {
            return elem.currentStyle[this.getCssName(name)[0]];
        };
    }

    return c.getCss(elem, name);
};

/**
 * 增加css文本
 * */
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

/**
 * calssName 开关
 * */
c.toggleForClassName = function (elem, className) {
    var classList = elem.classList;
    if (classList.contains(className)) {
        classList.remove(className);
    }
    else {
        classList.add(className);
    }
};

// html -> elem
/*
 html转对象，返回一个新div，html是此div对象的内容
 */
c.htmlToElem = function (html) {
    var eTemp = document.createElement('div');
    eTemp.innerHTML = html;
    return eTemp;
};
// html -> elems
c.htmlToElems = function (html) {
    return this.htmlToElem(html).children;
};

// html -> 节点对象  可以是文本节点任意组合，也可以是文本
c.htmlToNodes = function (html) {
    var elem = document.createElement('div');
    elem.innerHTML = html;
    return elem.childNodes;
};


// HTMLCollection,NodeList,array,html -> fragment
/*
 @param (HTMLCollection,NodeList,array,string) HTMLCollection,NodeList集合，或者元素数组，可以是多个。最上级html可以是文本标签组合，可以多个
 @regurn (array) 第一个是片段，第二个是多个节点的数组
 @兼容性 不支持ie67，ie67没有HTMLCollection,NodeList。如果要支持，需HTMLCollection,NodeList转数组

 */
c.toFragment = function (newItems) {
    var fragment = document.createDocumentFragment(),
        elems = [];

    if (typeof newItems === 'string') {
        newItems = this.htmlToNodes(newItems);
    }

    // 单个元素情况
    if (newItems.length === undefined || newItems.nodeType === 3) {
        newItems = [newItems];
    }

    if (newItems.constructor === HTMLCollection || newItems.constructor === NodeList) {
        // HTMLCollection 集合情况。此集合特性将取一个就会少一个
        for (var i = 0, that, len = newItems.length; i < len; i++) {
            that = newItems[0];
            fragment.appendChild(that);
            elems.push(that);
        }
    } else {
        // 此处考虑了类似jq集合情况
        base.each(newItems, function (i, that) {
            fragment.appendChild(that);
        });
        elems = newItems;
    }

    return [fragment, elems];
};

/// node处理。比如 增加、删除、移动文档位置 等等

// 紧邻元素之后插入
/*
 @param (element) item 位置元素。将紧邻此元素之后追加
 @param (HTMLCollection,NodeList,array,string) newItems 追加的元素，可以是多个。html可以标签文本随意组合

 @return (array) 新加的节点集合
 */
c.insertAfter = function (item, newItems) {
    var params = this.toFragment(newItems);
    elementInsertAfter(item, params[0]);
    return params[1];

    function elementInsertAfter(item, newItem) {
        var next = c.siblingElement(item);

        if (next) {
            item.parentNode.insertBefore(newItem, next);
        } else {
            item.parentNode.appendChild(newItem);
        }
    }
};

c.insertBefore = function (item, newItems) {
    var params = this.toFragment(newItems);
    item.parentNode.insertBefore(params[0], item);
    return params[1];
};

// 追加元素
/*
 @return array,element 返回添加的元素，单个情况 直接返回元素，多个情况 返回元素集合
 */
c.appendChildHtml = function (eBox, html) {
    var
        fragment,
        newChild = [],
        chils, len;

    chils = this.htmlToElems(html);

    len = chils.length;

    if (len > 1) {
        fragment = document.createDocumentFragment();

        for (var i = 0, that; i < len; i++) {
            that = chils[0];
            fragment.appendChild(that);
            newChild.push(that);
        }

        eBox.appendChild(fragment);

        return newChild;

    }
    newChild = chils[0];

    eBox.appendChild(newChild);

    return newChild;
};

// 追加元素2，全功能
/*
 内部之后追加，参数2支持节点集合、数组、html字符串，详见 this.toFragment
 */
c.appendChild = function (eBox, newItems) {
    var params = this.toFragment(newItems);

    eBox.appendChild(params[0]);
    return params[1];
};

// 内部开始处插入。支持内部节点前插入
c.prependChild = function (eBox, newItems) {
    var params = this.toFragment(newItems),
        chils = eBox.childNodes;

    if (chils.length) {
        eBox.insertBefore(params[0], chils[0]);
    }
    else {
        eBox.appendChild(params[0]);
    }

    return params[1];
};

// 元素删除
c.removeNode = function (node) {
    if ('remove' in node) {
        node.remove();
    } else {
        node.parentNode.removeChild(node);
    }
};

// 事件
// 以后会使用原型支持
c.bind = function (elem, type, listener) {
    // elem.addEventListener(type,listener,useCapture);
    // elem.addEventListener(type, listener);
    if (window.addEventListener) {
        c.bind = function (elem, type, listener) {
            console.log(type);
            elem.addEventListener(type, listener);
        }
    }
    else {
        c.bind = function (elem, type, listener) {
            elem.attachEvent('on' + type, listener);
        }
    }

    c.bind(elem, type, listener);
};

// 删除事件
c.unbind = function () {

};

// click
c.click = function (elem, listener) {
    c.bind(elem, 'click', listener);
};

/*
* 适用于pc、移动端的click事件
*
* @return {Function} 返回用来删除当前绑定的函数
* */
c.click = function (elem, fn) {

    if ((this.getAndroidVersion() && this.getAndroidVersion() < 4.4) || c.isIOSMobile) {
        c.click = function (elem, fn) {
            var touchcancel;
            elem.addEventListener('touchend', touchend);
            elem.addEventListener('touchstart', touchstart);
            elem.addEventListener('touchmove', touchmove);

            function touchend(e) {
                if (touchcancel) return;
                fn.call(this, e);
            }

            function touchstart() {
                touchcancel = false;
            }

            function touchmove() {
                touchcancel = true;
            }

            return function () {
                elem.removeEventListener('touchend', touchend);
                elem.removeEventListener('touchstart', touchstart);
                elem.removeEventListener('touchmove', touchmove);
            };
        };

    }
    else if(window.addEventListener){
        c.click = function (elem, fn) {
            elem.addEventListener('click', fn);
            return function () {
                elem.removeEventListener('click', fn);
            };
        }
    }
    else if(window.attachEvent){
        c.click = function (elem, fn) {
            elem.attachEvent('onclick', fn);
            return function () {
                elem.detachEvent('onclick', fn);
            };
        }
    }

    c.click(elem, fn);
};


/**
 起始元素到目标上级元素坐标
 @@ relativeXY
 @example
 var xy = c.relativeXY(initial, target);
 @param initial [element]  起始元素
 @param target [element]* 目标元素，需是起始元素的上级，且必须为参照元素。默认是body(body即使position:static，也是定位参考元素，ie67例外，是html)。
 @return [obj] xy坐标
 @raise
 target必须为参照元素
 */
c.relativeXY = function (initial, target) {
    var x = 0, y = 0,
        _target = initial;
    target = target || document.body;

    while (_target !== target) {
        x += _target.offsetLeft;
        y += _target.offsetTop;

        _target = _target.offsetParent;
    }

    return {x: x, y: y};
};

/// 图片相关 ///

/**
 * 图片尺寸 就绪后执行
 * 此时 图片只在加载中，但尺寸已就绪
 *
 * 参数：
 * 1、图片url
 * 2、就绪后 执行的函数。传入一个参数，格式：{w:0,h:0,img:img}
 *
 *
 * 兼容性：所有
 */
c.imgSizeExcu = function (src, f, err) {
    var img = new Image(),
        iserror = false;

    img.onerror = function () {
        err && err(img);
        iserror = true;
    };

    img.src = src;

    //返回false 将跳出 循环
    tryExcu();

    function tryExcu() {
        if (iserror) return;
        if (img.complete || img.width) {
            f(img);
            return;
        }

        setTimeout(tryExcu, 100)
    }

};

// 图片唯一加载
/*
 再次调用，将清理上一次用此方法加载的图片调用
 对于一些超时加载，依然会触发完成事件，而且可能后于当前有用加载触发，所以需清理
 */
c.ImgUniqueLoad = function () {
    /*
     属性事件，未发生前可更改设置清除。
     兼容性：包括ie6的所有
     */

    var lastImg;

    function stop() {
        if (lastImg) lastImg.onload = null;
        lastImg = undefined;
    }

    //每次执行都将清除上一次加载
    this.excu = function (src, ready, err) {

        var img = new Image();

        stop();

        img.onload = function () {
            ready({
                width: img.width,
                height: img.height,
                img: img
            });

            lastImg = undefined;// 图片加载好后清除占用。因为此变量只存储未加载好的图片
        };
        if (err) img.onerror = function () {
            err({});
        };

        img.src = src;

        lastImg = img;
    };

    this.stop = stop;
};

//图片整体 完全显示 居中
c.imgCenter = function (imgw, imgh, boxw, boxh) {
    var imgWH = imgw / imgh,
        boxWH = boxw / boxh,
        x = 0, y = 0, w, h;

    if (imgWH > boxWH) {
        // 图片宽 比 窗口宽 大时

        w = boxw;
        h = boxw / imgWH;

        y = (boxh - h) / 2;
    }
    else {

        w = boxh * imgWH;
        h = boxh;

        x = (boxw - w) / 2;
    }

    return {
        x: x, y: y, w: w, h: h
    }
};
// 图片铺满显示。其实就是  c.imgCenter 中判断的反转
c.imgFullCenter = function (imgw, imgh, boxw, boxh) {
    var imgWH = imgw / imgh,
        boxWH = boxw / boxh,
        x = 0, y = 0, w, h;

    if (imgWH > boxWH) {
        // 图片宽 比 窗口宽 大时

        w = boxh * imgWH;
        h = boxh;

        x = (boxw - w) / 2;
    }
    else {
        w = boxw;
        h = boxw / imgWH;

        y = (boxh - h) / 2;
    }

    return {
        x: x, y: y, w: w, h: h
    }
};

/// ///

/**
 * 切换 单选
 * @param [className] 状态css名，默认active
 *
 * switchSelect.select
 * @param eItem 变化按钮
 * @param [goOn] 切换后回调。可因参数3，没成功切换(点击已选项)，也会执行。不给值将只是简单的样式状态改变
 * @param [must] 改变参数2，可改为一定执行
 * */
c.SwitchSelect = function (className) {

    var currItem = document.createElement('div');

    className = className ? className : 'active';

    this.select = function (eItem, goOn, must) {

        if (currItem !== eItem || must) {
            c.removeClass(currItem, 'active');
            c.addClass(eItem, 'active');

            currItem = eItem;

            goOn && goOn();
        }
    };

    this.getCurr = function () {
        return currItem;
    };
};

// 多选 切换
c.Multiselect = function (className) {
    className = className ? className : 'active';

    var selectData = {},
        index = 0;

    this.select = function (elem, goOn, must) {
        var id = elem.getAttribute('data-id'),isSelect;

        if (id === null) {
            elem.setAttribute('data-id', index);
            id = index;
            index++;
        }

        if (c.hasClass(elem, className)) {
            c.removeClass(elem, className);
            delete selectData[id];
        }
        else {
            c.addClass(elem, className);
            selectData[id] = elem;
            isSelect=1;
        }
        if(isSelect || must){
            goOn && goOn();
        }
    };
};

module.exports = c;

