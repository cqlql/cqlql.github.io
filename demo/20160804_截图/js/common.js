/**
 * Created by SD01 on 2016/8/15.
 */

'use strict';

(function () {

    /**
     * 原型扩展
     * */
    (function () {
        if (!String.prototype.trim) {
            String.prototype.trim = function () {
                return this.replace(/(^[\s\uFEFF]*)|(\s*$)/g, '');
            }
        }

        if (!Element.prototype.remove) {
            Element.prototype.remove = function () {
                this.parentNode.removeChild(this);
            };
        }
    })();

    window.c = {};


    // 系统判断
    c.isMobile = /Android|iPhone|iPad/.test(navigator.appVersion);
    c.isIOSMobile = /iPhone|iPad/.test(navigator.appVersion);
    // c.isIOS = navigator.appVersion.indexOf('Mac OS') > -1;
    // c.isAndroid = navigator.appVersion.indexOf('Android') > -1;
    c.isWX = /micromessenger/i.test(navigator.appVersion);

// 取安卓版本
    c.getAndroidVersion = function () {
        var v;
        return function () {

            if (v === undefined) {
                var r = window.navigator.userAgent.match(/Android (\d.\d)/);
                v = r && r[1];
            }

            return v;
        };
    }();

    // click 重写。解决 1、4.4以下webview 原始click灰色；2、ios原始click问题
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
        else {
            c.click = function (elem, fn) {
                elem.addEventListener('click', fn);
                return function () {
                    elem.removeEventListener('click', fn);
                };
            }
        }

        c.click(elem, fn);
    };


    c.each = function (obj, fn) {
        var
            key,
            len = obj && obj.length;

        if (len === undefined) {
            for (key in obj) {
                if (fn(key, obj[key]) === false) {
                    break;
                }
            }
        } else {
            for (key = 0; key < len; key++) {
                if (fn(key, obj[key], len) === false) {
                    break;
                }
            }
        }
    };

    c.queryElements = function (rootElem, names, callback) {
        var name,
            resultElems = [],
            test;

        if (typeof names === 'string') names = names.split(',');

        setName();

        go(rootElem.children);

        callback(resultElems);

        function go(childs) {

            c.each(childs, function (i, elem) {
                if (!name) {
                    return false;
                }

                if (test(elem)) {
                    setName();

                    resultElems.push(elem);
                }

                go(elem.children);

            });
        }

        function setName() {
            name = names.shift();

            if (name) {
                if (name.substr(0, 1) === '.') {
                    test = function (elem) {
                        return c.hasClass(elem, name.substr(1));
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
        if (elem) return (' ' + elem.className + ' ').indexOf(' ' + className.trim() + ' ') > -1;
        return false;
    };
    c.addClass = function (elem, className) {

        if (elem.classList) {
            elem.classList.add(className);
        }
        else if (c.hasClass(elem, className) === false) {
            elem.className = c.trim((elem.className + ' ' + className).replace(/\s{2,}/g, ' '));
        }
    };

    c.removeClass = function (elem, className) {
        if (elem.classList) {
            elem.classList.remove(className);
        }
        else {
            elem.className = (' ' + elem.className + ' ').replace(' ' + c.trim(className) + ' ', '');
        }
    };

    c.toPercent = function (num) {
        return (num + '00').replace(/\.([\d]{2})/, '$1.') * 1;
    };


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

    c.scopeElements = function (targetElem, listener) {
        go(targetElem);
        function go(that) {
            if (listener(that) !== false) {
                go(that.parentElement);
            }
        }
    };

    c.getLetter = function (index) {
        index *= 1;
        return String.fromCharCode(65 + index);
    };
    c.letterToIndex = function (letter) {
        return letter.charCodeAt() - 65;
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

    c.insertBefore = function (item, newItems) {
        var params = this.toFragment(newItems);
        item.parentNode.insertBefore(params[0], item);
        return params[1];
    };

    c.htmlToNodes = function (html) {
        var elem = document.createElement('div');
        elem.innerHTML = html;
        return elem.childNodes;
    };

    c.getRightCssName = function (cssPropertyName) {
        var
            firstLetter = cssPropertyName[0],
            firstLetterUpper = firstLetter.toUpperCase(),
            cssPrefixes = ["ms" + firstLetterUpper, "Moz" + firstLetterUpper, "webkit" + firstLetterUpper, firstLetter],
            cssPrefixesReal = ["-ms-", "-Moz-", "-webkit-", ''],
            style = document.body.style,
            name = c.toStyleName(cssPropertyName).substr(1);

        for (var i = cssPrefixes.length, newName; i--;) {
            newName = cssPrefixes[i] + name;

            if (newName in style) {
                return [cssPrefixesReal[i] + cssPropertyName, newName];
            }
        }
        return [];
    };

    c.toStyleName = function (cssPropertyName) {
        return cssPropertyName.replace(/-\w/g, function (d) {
            return d[1].toUpperCase();
        });
    };

    /// 图片相关 ////////////////

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


})();