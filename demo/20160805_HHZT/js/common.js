/**
 * Created by CQL on 2016/8/8.
 */
'use strict';

var c = commonInit();

// 导航按钮
(function () {

    var eHeader = document.getElementById('header'),
        eNav, eBtnNav, navH, curr = 0, inside = false;

    c.queryElements(eHeader, 'ul,.btn-navbar', function (elems) {
        eNav = elems[0];
        eBtnNav = elems[1];
    });

    c.click(eBtnNav, function (e) {
        inside = true;
        heightInit(function () {
            if (curr) {
                close();
            }
            else {
                eNav.style.height = navH + 'px';
                curr = 1;
            }
        });

    });

    c.click(eNav, function () {
        inside = true;
    });

    c.click(document, function () {
        if (inside) {
            inside = false;
        }
        else {
            close();
        }
    });

    function close() {
        eNav.style.height = '0';
        curr = 0;
    }

    function heightInit(fn) {
        eNav.style.height = 'auto';
        navH = eNav.offsetHeight;
        eNav.style.height = '0px';
        setTimeout(fn, 10);
        heightInit = function (fn) {
            fn();
        };
    }
})();

// 搜索
(function(){
    if(!window.$||!$('#header'))return;
    var jHeader = $('#header'),
        jBtnSearch=jHeader.find('.btn-search'),
        jSearchBox=jHeader.find('.r-lay-search'),isShow=0,inside=0;

    jBtnSearch.click(function () {
        inside=1;
        if(isShow){
            hide();

        }
        else{
            jSearchBox.show();
            isShow=1;
        }


    });

    jSearchBox.click(function () {
        inside=1;
    });

    $(document).click(function () {
        if(inside){
            inside=0;
        }
        else{
            hide();
        }
    });

    function hide() {
        jSearchBox.hide();
        isShow=0;
    }

})();

// 登录 
(function () {
    if(!window.$||!$('#loginWinPopup'))return;
    var jLoginWin= $('#loginWinPopup'),
        jLoginLayer=jLoginWin.children('.login-layer'),
        inside = false;

    $('#loginWinBtn').click(function () {
        inside=true;
        jLoginWin.fadeIn();
    });

    jLoginLayer.click(function () {
        inside=true;
    });

   $(document).click(function () {
        if (inside) {
            inside = false;
        }
        else {
            close();
        }
    });

    function close() {
        jLoginWin.fadeOut();
    }
})();


function commonInit() {

    /**
     * 原型扩展
     *
     * */
    if (!String.prototype.trim) {
        String.prototype.trim = function () {
            return this.replace(/(^[\s\uFEFF]*)|(\s*$)/g, '');
        }
    }

    window.requestAnimationFrame = (function () {
        return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (callback, elem) {
                return window.setTimeout(callback, 1000 / 60);
            };
    })();
    window.cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.clearTimeout;


    var c = {};
    var common = c;

    // 移动端判断
    c.isMobile=/Android|iPhone|iPad/.test(navigator.appVersion);

    c.click = function (elem, fn) {
        if (window.addEventListener) {
            c.click = function (elem, fn) {
                elem.addEventListener('click', fn);
            };
        }
        else if (window.attachEvent) {
            c.click = function (elem, fn) {
                elem.attachEvent('onclick', fn);
            };
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

    c.hasClass = function (elem, className) {
        if (elem) return (' ' + elem.className + ' ').indexOf(' ' + className.trim() + ' ') > -1;
        return false;
    };
    c.addClass = function (elem, className) {

        if (elem.classList) {
            elem.classList.add(className);
        }
        else if (c.hasClass(elem, className) === false) {
            elem.className = ((elem.className + ' ' + className).replace(/\s{2,}/g, ' ')).trim();
        }
    };

    c.removeClass = function (elem, className) {
        if (elem) {
            if (elem.classList) {
                elem.classList.remove(className);
            }
            else {
                elem.className = (' ' + elem.className + ' ').replace(' ' + className.trim() + ' ', '');
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
    c.scopeElements = function (targetElem, listener) {
        targetElem = targetElem.nodeType === 1 ? targetElem : targetElem.parentElement
        go(targetElem);
        function go(that, child) {
            if (listener(that, child) !== false) {
                go(that.parentElement, that);
            }
        }
    };

    c.easing = {
        def: 'easeOutQuad',
        swing: function (x, t, b, c, d) {
            return common.easing[common.easing.def](x, t, b, c, d);
        },
        easeOutQuad: function (x, t, b, c, d) {
            return -c * (t /= d) * (t - 2) + b;
        }
    };

    c.EasingBuild = function (params) {
        var
            that = this,

            curParams = {},

            callback,

            stopId = null;

        function excu(params, options) {

            stopLast();

            callback = options.callback || function () {
                };

            var
                go = options.go,

                speed = options.speed === undefined ? 400 : options.speed,
                easing = options.easing === undefined ? 'swing' : options.easing,

                start = {},

                t = 0,//当前起始次数
                time = 16,//帧间隔
                d = speed / time;//总次数

            c.each(params, function (key, value) {
                if (curParams[key] === undefined) {
                    curParams[key] = 0;
                }
                start[key] = curParams[key];
            });

            run();

            function run() {
                var to = {},
                    cur;

                if (t < d) {
                    t++;

                    c.each(params, function (key, value) {
                        cur = start[key];
                        to[key] = c.easing[easing](null, t, cur, value - cur, d);
                        curParams[key] = to[key];
                    });

                    go(to);

                    stopId = requestAnimationFrame(run, time);
                }
                else {
                    go(params);

                    c.each(params, function (key, value) {
                        curParams[key] = params[key];
                    });

                    stopId = null;

                    callback();
                }
            }
        }

        function setCurParams(params) {

            for (var name in params) {
                curParams[name] = params[name];
            }
        }

        function stopLast() {

            if (stopId !== null) {
                cancelAnimationFrame(stopId);
                stopId = null;
            }
        }

        this.excu = excu;
        this.setCurParams = setCurParams;
        this.stop = function () {
            stopLast();
            callback();
        };
        this.getCurParams = function () {
            return curParams;
        };

        //setCurParams(params);
    };

    c.SwipeBase= function () {

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

    c.swipeXScroll=function (params) {
        var
            eBox = params.eBox,

            swipeLeft = params.swipeLeft,
            swipeRight = params.swipeRight,
            swipeNot = params.swipeNot,
            onstart = params.onstart,
            onmove = params.onmove,
            // onend = params.onend,

            // 记录点下的坐标
            startX, startY,

            // 实现区分滚动条
            // 0 没反映，1 x 方向，2 y 方向
            status = 0,

            isStart = false,// 是否已经开始。true表示已经开始

            // 记录多点数据
            touchesData;

        eBox.addEventListener('touchstart', function (e) {

            var touches = e.touches,
                len = touches.length;

            if (len === 1) {
                start(touches[0]);
            }
            else {
                each(len, function (i) {
                    startAgain(touches[i]);
                });
            }
        });

        eBox.addEventListener('touchmove', function (e) {
            var touches = e.touches;
            each(touches.length, function (i) {
                move(touches[i], e);
            });
        });

        eBox.addEventListener('touchend', function (e) {
            var touches = e.touches,
                changedTouches = e.changedTouches;
            if (touches.length === 0) {
                end(changedTouches[0]);
            }
            else {
                each(changedTouches.length, function (i) {
                    delete  touchesData[changedTouches[i].identifier];
                });
                each(touches.length, function (i) {
                    startAgain(touches[i], i);
                });
            }
        });

        function each(len, fn) {
            while (len--) {
                fn(len);
            }
        }

        function start(touche) {

            if (onstart() === false)return;

            startX = touche.pageX;
            startY = touche.pageY;

            status = 0;
            isStart = true;// 已经开始

            var data = {
                swipeBase: new c.SwipeBase
            };

            data.swipeBase.start(startX);


            touchesData = {};
            touchesData[touche.identifier] = data;
        }

        function startAgain(touche) {
            var id = touche.identifier;

            if (touchesData[touche.identifier]) {
                return;
            }

            var data = {
                swipeBase: new c.SwipeBase
            };

            data.swipeBase.start(touche.pageX);

            touchesData[id] = data;
        }

        function move(touche, e) {
            if (status === 0) {
                var x = touche.pageX - startX,
                    y = touche.pageY - startY;

                if (Math.abs(x) > Math.abs(y)) {
                    status = 1;
                }
                else {
                    status = 2;
                }
            }

            if (status === 1) {
                if (isStart) {
                    touchesData[touche.identifier].swipeBase.move(touche.pageX, onmove);
                }
                e.preventDefault();
            }
        }

        function end(touche) {

            if (status === 1) {

                if (isStart) {
                    touchesData[touche.identifier].swipeBase.end(swipeLeft, swipeRight, swipeNot);
                    isStart = false;
                }
            }
        }

    };

    return c;
}
