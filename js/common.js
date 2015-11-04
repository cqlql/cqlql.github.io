
/*
* 公共js库
* author:陈桥黎
* date:2015-10-09
* 
* updateDate:2015-10-13
*   增加新功能
*/

"use strict";

window.requestAnimationFrame  = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback, element) {
            return window.setTimeout(callback, 1000/60);
        };
})();
window.cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.clearTimeout;

(function () {

    var c = {};

    /// 基础

    //#region 为定义参数处理
    //非空\未定义 情况 默认值 处理
    c.paramUn = function (value, def) {
        return value === undefined ? def : value;
    };
    //#endregion
            
    //#region class 相关

    c.hasClass = function (element,className) {
        return (' ' + element.className + ' ').indexOf(' ' +c.trim( className)+' ') > -1;
    };

    c.addClass = function (element, className) {

        if (element.classList) {
            element.classList.add(className);
        }
        else if (c.hasClass(element, className) === false) {
            element.className = c.trim((element.className + ' ' + className).replace(/\s{2,}/g, ' '));
        }
    };

    c.removeClass = function (element, className) {
        if (element.classList) {
            element.classList.remove(className);
        }
        else {
            element.className = (' ' + element.className + ' ').replace(' ' + c.trim(className) + ' ', '');
        }
    };


    // 获取后代元素
    //兼容性：所有浏览器
    c.getElementsByClassName = function (className, obj) {

        obj = obj || document;

        if (obj.getElementsByClassName) {
            return obj.getElementsByClassName(className);
        }

        return c.filtrateElementsByClassName(className, obj.getElementsByTagName("*"));
    }

    // 过滤 元素集合 根据className
    c.filtrateElementsByClassName = function (className, elements) {

        var array = new Array();

        //过滤
        for (var i = 0, len = elements.length; i < len; i++) {
            if (c.hasClass(elements[i], className)) array.push(elements[i]);
        }

        return array;
    };
    //#endregion

    //#region 去两头空格
    // \uFEFF 为出现在开头的特殊字符
    c.trim = function (str) {
        if (str.trim) return str.trim();
        return str.replace(/(^[\s\uFEFF]*)|(\s*$)/g, '');
    };
    //#endregion

    //#region 追加元素
    /*
    返回添加的元素

    单个情况 直接返回元素

    多个情况 返回元素集合
    
    */
    c.appendChildHtml = function (eBox, html) {
        var eE = document.createElement('div'),
            newChild = [],
            chils, len;

        eE.innerHTML = html;

        chils = eE.children;

        len = chils.length;

        if (len > 1) {

            for (var i = 0, that; i < len; i++) {
                that = chils[0]
                eBox.appendChild(that);
                newChild.push(that)
            }

            return newChild;
        }

        newChild = chils[0];

        eBox.appendChild(newChild);

        return newChild;
    };

    //#endregion

    //#region 紧邻同辈元素 获取
    /**
    紧邻同辈元素 获取
        获取某节点 紧邻的 上或下 单个 同辈元素节点

    @param nodeObj [node]  节点对象，一般为元素节点
    @param * prevORnext [bool] 能代表真假的任意值，默认是假，即下一个，否则上一个

    @return [node] 元素节点 或者为 null

    @compatibility 所有浏览器
    */

    c.siblingElement = function (nodeObj, prevORnext) {

        var prevORnextStr = prevORnext ? "previousSibling" : "nextSibling";

        do {
            nodeObj = nodeObj[prevORnextStr];
            if (nodeObj === null) return null;
        } while (nodeObj.nodeType !== 1)

        return nodeObj;
    };

    //#endregion

    //#region [坐标] 元素 相对 于内容窗口 
    c.offsetXY = function (elem) {
        var x = 0,
            y = 0;
        do {
            x += elem.offsetLeft;
            y += elem.offsetTop;

            elem = elem.offsetParent;
        } while (elem);
        return { top: y, left: x };
    };
    //#endregion

    //#region [坐标] 起始元素到目标元素
    /**
    起始元素到目标上级元素坐标
    @@ relativeXY
    @example
        var xy = c.relativeXY(initial, target);
    @param initial [element]  起始元素
    @param target [element] 目标元素，需是起始元素的上级，且必须为参照元素
    @return [obj] xy坐标
    @raise
        target必须为参照元素
    */

    c.relativeXY = function (initial, target) {

        var x = 0, y = 0, _target = initial;

        while (_target !== target) {
            x += _target.offsetLeft;
            y += _target.offsetTop;

            _target = _target.offsetParent;
        }

        return { x: x, y: y };
    };

    //#endregion

    //#region 事件绑定/解除

    // pc
    c.eventBind = function (target, types, listener) {
        var fnName,
            typePrefix;
        if (window.addEventListener) {

            fnName = 'addEventListener';
            typePrefix = '';
        }
        else {
            fnName = 'attachEvent';
            typePrefix = 'on';
        }


        if (typeof types === 'string') {
            //target[fnName](typePrefix + types, listener);
            target[fnName](typePrefix + types, eventFn(listener));
        }
        else {
            for (var k in types) {
                //target[fnName](typePrefix + k, types[k]);
                target[fnName](typePrefix + k, eventFn(types[k]));
            }
        }

        function eventFn(listener) {

            listener.base_date_realListener = function (e) {

                var event = {
                    pageX: e.pageX === undefined ? document.documentElement.scrollLeft + e.clientX : e.pageX
                    , pageY: e.pageY === undefined ? document.documentElement.scrollTop + e.clientY : e.pageY
                    , offsetX: e.offsetX
                    , offsetY: e.offsetY
                    , originalEvent: e
                    , target: e.target || e.srcElement
                    , preventDefault: function () {
                        if (e.cancelable) e.preventDefault();
                        else e.returnValue = false;
                    }
                    , stopPropagation: function () {
                        if (e.stopPropagation) e.stopPropagation();
                        else e.cancelBubble = true;
                    }
                };

                if (listener(event) === false) {
                    event.preventDefault();
                    event.stopPropagation();
                }

            };

            return listener.base_date_realListener;

        }

        //if (addEventListener) {
        //    target.addEventListener(types, listener);
        //}
        //else {
        //    target.attachEvent('on' + types, listener);
        //}
    };
    c.eventUnBind = function (target, types, listener) {
        //if (removeEventListener) {
        //    target.removeEventListener(types, listener);
        //}
        //else {
        //    target.detachEvent('on' + types, listener);
        //}

        var fnName,
            typePrefix;
        if (window.removeEventListener) {

            fnName = 'removeEventListener';
            typePrefix = '';
        }
        else {
            fnName = 'detachEvent';
            typePrefix = 'on';
        }


        if (typeof types === 'string') {
            target[fnName](typePrefix + types, listener.base_date_realListener);
        }
        else {
            for (var k in types) {
                target[fnName](typePrefix + k, types[k].base_date_realListener);
            }
        }
    };

    //#endregion

    //#region 速率计算
    c.Velocity = function () {

        var startTime,
            moveTimesArr = [],
            target = this;

        function getSustainTimes() {
            return (new Date()).getTime() - startTime;
        }

        //速率计时
        this.start = function () {
            moveTimesArr = [[0, 0]];
            startTime = (new Date()).getTime();
        };
        this.end = function () {
            var lastIndex = moveTimesArr.length - 1;

            if (lastIndex < 1) return 0;

            //间隔时间
            var intervalTime = getSustainTimes() - moveTimesArr[lastIndex][0];

            //有惯性情况。间隔时间
            if (intervalTime < 200) {
                // 滑动情况一般不会超过50毫秒。如果不够敏感，不应调节这里。条件end 返回的值，往小里调

                return (moveTimesArr[0][1] - moveTimesArr[lastIndex][1]) / intervalTime * 1000;
            }
                //无惯性
            else {
                return 0;
            }
        };

        this.change = function (val) {

            moveTimesArr.unshift([getSustainTimes(), val]);

            if (moveTimesArr.length > 4) moveTimesArr.length = 4;
        };
    };
    //#endregion

    //#region 减动画核心

    c.StripingReduce = function () {
        var stopId;
        this.start = function (to, fn) {
            var times = 20,
            vel = to;

            function back() {
                vel = parseFloat((vel * .8).toFixed(2));

                fn(vel);

                if (Math.abs(vel) > 0.1) stopId = setTimeout(back, times);
            }

            stopId = setTimeout(back, times);
        }

        this.stop = function () {
            clearTimeout(stopId);
        };
    };

    //#endregion

    //#region 动态动画效果
    /*
    **动态动画效果
    目标位置 随便都可以改变的动画效果
    

    /*
    *** 版本2
    //创建
    var anime = new c.changeAnime(function (v) {
        side_follow.css('top', v);
    });
    
    //停止动画
    anime.stop();
    
    //开始动画
    anime.start(100);//方式1 。只有目标位置
    anime.start(100,0);//方式2。目标位置，初始位置
    
    //取状态
    anime.getState();
    */
    c.changeAnime = function (change, rate) {

        var o = this,

            //开关。 是否进行中。true 进行中
            sw = false;

        rate = rate ? rate : .2;

        function lastExcu() {

            sw = false;
        }

        function start(to, cur) {

            function baseExcu() {

                var len = rate * (o.to - o.cur);

                o.cur += len;

                //最后一次
                if (Math.abs(o.to - o.cur) < 1) {
                    o.cur = o.to;

                    lastExcu();
                }

                change(o.cur);

                if (sw) window.requestAnimationFrame (baseExcu);
            }

            o.to = to;
            o.cur = cur ? cur : o.cur;

            if (sw) return;

            sw = true;

            window.requestAnimationFrame (baseExcu);
        }

        function stop() {
            sw = false;
        }

        this.start = start;
        this.stop = stop;
        this.cur = 0;
        this.to = 0;

        this.getState = function () {
            return sw;
        };
    };
    //#endregion

    //#region 缓动算法
    c.easing = {
        def: 'easeOutQuad',
        swing: function (x, t, b, c, d) {
            return common.easing[common.easing.def](x, t, b, c, d);
        },
        easeInQuad: function (x, t, b, c, d) {
            return c * (t /= d) * t + b;
        },
        easeOutQuad: function (x, t, b, c, d) {
            return -c * (t /= d) * (t - 2) + b;
        },
        easeInOutQuad: function (x, t, b, c, d) {
            if ((t /= d / 2) < 1) return c / 2 * t * t + b;
            return -c / 2 * ((--t) * (t - 2) - 1) + b;
        },
        easeInCubic: function (x, t, b, c, d) {
            return c * (t /= d) * t * t + b;
        },
        easeOutCubic: function (x, t, b, c, d) {
            return c * ((t = t / d - 1) * t * t + 1) + b;
        },
        easeInOutCubic: function (x, t, b, c, d) {
            if ((t /= d / 2) < 1) return c / 2 * t * t * t + b;
            return c / 2 * ((t -= 2) * t * t + 2) + b;
        },
        easeInQuart: function (x, t, b, c, d) {
            return c * (t /= d) * t * t * t + b;
        },
        easeOutQuart: function (x, t, b, c, d) {
            return -c * ((t = t / d - 1) * t * t * t - 1) + b;
        },
        easeInOutQuart: function (x, t, b, c, d) {
            if ((t /= d / 2) < 1) return c / 2 * t * t * t * t + b;
            return -c / 2 * ((t -= 2) * t * t * t - 2) + b;
        },
        easeInQuint: function (x, t, b, c, d) {
            return c * (t /= d) * t * t * t * t + b;
        },
        easeOutQuint: function (x, t, b, c, d) {
            return c * ((t = t / d - 1) * t * t * t * t + 1) + b;
        },
        easeInOutQuint: function (x, t, b, c, d) {
            if ((t /= d / 2) < 1) return c / 2 * t * t * t * t * t + b;
            return c / 2 * ((t -= 2) * t * t * t * t + 2) + b;
        },
        easeInSine: function (x, t, b, c, d) {
            return -c * Math.cos(t / d * (Math.PI / 2)) + c + b;
        },
        easeOutSine: function (x, t, b, c, d) {
            return c * Math.sin(t / d * (Math.PI / 2)) + b;
        },
        easeInOutSine: function (x, t, b, c, d) {
            return -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b;
        },
        easeInExpo: function (x, t, b, c, d) {
            return (t == 0) ? b : c * Math.pow(2, 10 * (t / d - 1)) + b;
        },
        easeOutExpo: function (x, t, b, c, d) {
            return (t == d) ? b + c : c * (-Math.pow(2, -10 * t / d) + 1) + b;
        },
        easeInOutExpo: function (x, t, b, c, d) {
            if (t == 0) return b;
            if (t == d) return b + c;
            if ((t /= d / 2) < 1) return c / 2 * Math.pow(2, 10 * (t - 1)) + b;
            return c / 2 * (-Math.pow(2, -10 * --t) + 2) + b;
        },
        easeInCirc: function (x, t, b, c, d) {
            return -c * (Math.sqrt(1 - (t /= d) * t) - 1) + b;
        },
        easeOutCirc: function (x, t, b, c, d) {
            return c * Math.sqrt(1 - (t = t / d - 1) * t) + b;
        },
        easeInOutCirc: function (x, t, b, c, d) {
            if ((t /= d / 2) < 1) return -c / 2 * (Math.sqrt(1 - t * t) - 1) + b;
            return c / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1) + b;
        },
        easeInElastic: function (x, t, b, c, d) {
            var s = 1.70158; var p = 0; var a = c;
            if (t == 0) return b; if ((t /= d) == 1) return b + c; if (!p) p = d * .3;
            if (a < Math.abs(c)) { a = c; var s = p / 4; }
            else var s = p / (2 * Math.PI) * Math.asin(c / a);
            return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
        },
        easeOutElastic: function (x, t, b, c, d) {
            var s = 1.70158; var p = 0; var a = c;
            if (t == 0) return b; if ((t /= d) == 1) return b + c; if (!p) p = d * .3;
            if (a < Math.abs(c)) { a = c; var s = p / 4; }
            else var s = p / (2 * Math.PI) * Math.asin(c / a);
            return a * Math.pow(2, -10 * t) * Math.sin((t * d - s) * (2 * Math.PI) / p) + c + b;
        },
        easeInOutElastic: function (x, t, b, c, d) {
            var s = 1.70158; var p = 0; var a = c;
            if (t == 0) return b; if ((t /= d / 2) == 2) return b + c; if (!p) p = d * (.3 * 1.5);
            if (a < Math.abs(c)) { a = c; var s = p / 4; }
            else var s = p / (2 * Math.PI) * Math.asin(c / a);
            if (t < 1) return -.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
            return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p) * .5 + c + b;
        },
        easeInBack: function (x, t, b, c, d, s) {
            if (s == undefined) s = 1.70158;
            return c * (t /= d) * t * ((s + 1) * t - s) + b;
        },
        easeOutBack: function (x, t, b, c, d, s) {
            if (s == undefined) s = 1.70158;
            return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
        },
        easeInOutBack: function (x, t, b, c, d, s) {
            if (s == undefined) s = 1.70158;
            if ((t /= d / 2) < 1) return c / 2 * (t * t * (((s *= (1.525)) + 1) * t - s)) + b;
            return c / 2 * ((t -= 2) * t * (((s *= (1.525)) + 1) * t + s) + 2) + b;
        },
        easeInBounce: function (x, t, b, c, d) {
            return c - jQuery.easing.easeOutBounce(x, d - t, 0, c, d) + b;
        },
        easeOutBounce: function (x, t, b, c, d) {
            if ((t /= d) < (1 / 2.75)) {
                return c * (7.5625 * t * t) + b;
            } else if (t < (2 / 2.75)) {
                return c * (7.5625 * (t -= (1.5 / 2.75)) * t + .75) + b;
            } else if (t < (2.5 / 2.75)) {
                return c * (7.5625 * (t -= (2.25 / 2.75)) * t + .9375) + b;
            } else {
                return c * (7.5625 * (t -= (2.625 / 2.75)) * t + .984375) + b;
            }
        },
        easeInOutBounce: function (x, t, b, c, d) {
            if (t < d / 2) return jQuery.easing.easeInBounce(x, t * 2, 0, c, d) * .5 + b;
            return jQuery.easing.easeOutBounce(x, t * 2 - d, 0, c, d) * .5 + c * .5 + b;
        }
    };
    //#endregion

    //#region 动画效果 可 自由配置

    /*

        切记，传入参数必须是number类型
        
       var a = new common.EasingBuild();
    
        a.setCurParams({
            w: 100
        });
        a.excu({
            x: 600,
            y: 90,
            w: 600
        }, {
            go: function (to) {
    
                //div1.style.left = to.x + 'px';
                //div1.style.top = to.y + 'px';
                div1.style.width = to.w + 'px';
            },
            speed: 600
        });
    
    */
    c.EasingBuild = function (params) {
        var
            that = this,

            curParams = {},

            stopId = null;

        function excu(params, options) {

            var
                go = options.go,

                speed = options.speed === undefined ? 400 : options.speed,
                easing = options.easing === undefined ? 'swing' : options.easing,
                callBack = options.callBack === undefined ? function () { } : options.callBack,

                start = {},

                t = 0,//当前起始次数
                time = 16,//帧间隔
                d = speed / time;//总次数

            stop();

            c.each(params, function (key,value) {
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

                    callBack();
                }
            }
        }

        function setCurParams(params) {

            for (var name in params) {
                curParams[name] = params[name];
            }
        }

        function stop() {
            if (stopId !== null) {
                cancelAnimationFrame(stopId);
                stopId = null;
            }
        }

        this.excu = excu;
        this.setCurParams = setCurParams;
        this.stop = stop;
        this.getCurParams = function () {
            console.log(curParams);
        };

        //setCurParams(params);
    };
    //#endregion

    //#region 拖动基础

    c.drag = 1 ?
    // pc
    function (eDrag, onMove, onDown, onUp) {
        var isIE678 = !-[1, ],
            eDom = document;

        c.eventBind(eDrag, 'mousedown', down);

        function down(e) {

            onDown(e);

            //IE678 执行捕捉 来 避免 图片文字等默认选择事件
            if (isIE678) eDrag.setCapture();

            var eveFn = {
                mousemove: function (eve) {

                    onMove({ left: eve.pageX - e.pageX, top: eve.pageY - e.pageY, event: eve });
                },
                mouseup: function () {
                    if (onUp) onUp();

                    if (isIE678) eDrag.releaseCapture();

                    c.eventUnBind(document, eveFn);//解除所有事件
                }
            };

            c.eventBind(document, eveFn);

            return false;
        }

    } :
    // 移动端
    function (eDrag, onMove, onDown, onUp) {

        var startX, startY;

        eDrag.addEventListener('touchstart', function (e) {

            var touche = e.touches[0];

            startY = touche.pageY;

            onDown(e);

        });

        eDrag.addEventListener('touchmove', function (e) {
            var touche = e.touches[0],
                moveY = touche.pageY - startY;

            onMove({ top: moveY, event: e });
        });

        eDrag.addEventListener('touchend', function (e) {
            onUp(e);
        });

    };

    //#endregion

    //#region 滚轮
    /*
    core.mouseWheel(jMainBox[0], function (e) {
        var pre;
        if (e.wheelDelta) //前120 ，后-120
            pre = e.wheelDelta > 0;
        else //firefox
            pre = e.detail < 0;
    
        if (pre) {
            //*往上滚
        } else {
            //*往下滚
        }
    
        //阻止滚动条滚动
        if (e.cancelable) e.preventDefault();
        return false;
    });
    */
    c.mouseWheel = function (dom, f) {
        if (dom.addEventListener) {
            if (dom.onmousewheel === undefined) dom.addEventListener('DOMMouseScroll', f, false);//firefox
            else dom.addEventListener('mousewheel', f, false);
        } else {
            dom.attachEvent('onmousewheel', f);//ie678
        }
    };
    c.removeMouseWheel = function (dom, f) {
        if (dom.addEventListener) {
            if (dom.onmousewheel === undefined) dom.removeEventListener('DOMMouseScroll', f, false);//firefox
            else dom.removeEventListener('mousewheel', f, false);
        } else {
            dom.detachEvent('onmousewheel', f);//ie678
        }
    };
    //#endregion

    //#region each 循环

    // 带length的集合对象、纯对象
    // fn 中 返回false 将跳出
    c.each = function (obj, fn) {
        var
            key,
            len = obj.length;

        if (len === undefined) {
            for (key in obj) {
                if (fn(key, obj[key]) === false) {
                    break;
                }
            }
        }
        else {
            for (key = 0; key < len; key++) {
                if (fn(key, obj[key], len) === false) {
                    break;
                }
            }
        }
    };

    //#endregion

    //#region 根据某后代元素(事件元素)，判断是否发生在某祖先元素范围内
    /*
   模版功能：

   function getAncestorElement(eventElem) {
       cb(eventElem);
       function cb(that) {
           if (that === eBox) {
               return;
           }
           if (that.classList.contains('m-tit')) {
               // do something
               return;
           }
           if (that.tagName === 'A' && that.parentElement.classList.contains('i-header')) {
               return;
           }
           cb(that.parentElement);
       }
   }

    */

    //#endregion

    /// 功能

    //#region 翻页
    c.pager = (function () {

        /*
        翻页基本
    
        pageData: [1, 200, 10],//当前页，数据总条数，每页显示数
        normalCssName: 'num_page',//可选
        prevCssName: 'num_page prev_page',//可选
        nextCssName: 'num_page next_page mr20',//可选
        activeCssName:'active',//可选。默认active
        noShow: true,//可选
        baseUrl: '/',//可选。默认为false。表示值为javascript:; 这种情况，pageUrl也可不选，即使选了也无效。
        pageUrl: '/page/',//可选。默认 '?page='。如果baseUrl为false，pageUrl选了也无效
        mainBtnNum: 5,//可选
        sideBtnNum: 1,//可选
        prevTxt: '«',//可选
        nextTxt: '»'//可选
    
        */
        function getHtml(params) {

            var
                //可选
                normalCssName = params.normalCssName ? params.normalCssName : '',
                prevCssName = params.prevCssName ? params.prevCssName : '',
                nextCssName = params.nextCssName ? params.nextCssName : '',
                activeCssName = params.activeCssName ? params.activeCssName : 'active',

                //是否 显示 上下 页 按钮。true 表示不显示。
                //可选。默认 false
                noShow = params.noShow ? params.noShow : false,

                //url
                //可选。 
                baseUrl = params.baseUrl ? params.baseUrl : false,//可选。默认为false。表示值为javascript:; 且pageUrl 无效。
                pageUrl = params.pageUrl ? params.pageUrl : '?page=',

                //可选
                buildBtnHref = params.buildBtnHref ? params.buildBtnHref : function (page) { return baseUrl ? baseUrl + pageUrl + page : 'javascript:;'; },

                //主要按钮 数量。..之间的按钮 包括..
                //可选 。默认5
                mainBtnNum = params.mainBtnNum ? params.mainBtnNum : 5,

                //两侧按钮数量。因为对称，只需指定一侧，且必须大于等于1。等于1 的情况就是 第一页，和最后一页
                //可选。默认1
                sideBtnNum = params.sideBtnNum ? params.sideBtnNum : 1,

                //上/下一个按钮 内容
                //可选。 
                prevTxt = params.prevTxt !== undefined ? params.prevTxt : '«',
                nextTxt = params.nextTxt !== undefined ? params.nextTxt : '»',

                //点点 按钮 内容
                //可选。 
                omitTxt = params.omitTxt ? params.omitTxt : '..',

                //当前页
                page = params.pageData[0] * 1,

                //总条数
                count = params.pageData[1] * 1,

                //每页显示数
                pageSize = params.pageData[2] * 1,

                //总页数
                pageCount = Math.ceil(count / pageSize);
            ;

            function hasCssName(targetName, cssName) {

                targetName = ' ' + targetName + ' ';
                cssName = ' ' + cssName + ' ';

                if (cssName.indexOf(targetName) > -1) return true;

                return false;
            }

            function getBtnHtml(options) {

                var tPage = options.page,
                    txt = options.txt !== undefined ? options.txt : options.page,
                    btnTagName = 'a',
                    cssName = c.trim(options.cssName + (page == tPage ? ' ' + activeCssName : '')),
                    url = buildBtnHref(tPage);

                url = 'href="' + url + '"';

                if (hasCssName('disabled', cssName) || hasCssName(activeCssName, cssName)) url = '';
                return '<' + btnTagName + ' class="' + cssName + '" ' + url + ' data-page="' + tPage + '">' + txt + '</' + btnTagName + '>'
            }

            function build() {
                var
                    prevBtn = '',
                    nextBtn = '',

                    leftSideBtn = '',
                    rightSideBtn = '',

                    mainBtn = '',

                    i;



                //不出现省略情况。即  按钮数>=总页数
                if (sideBtnNum * 2 + mainBtnNum >= pageCount) {
                    for (i = 0; i < pageCount; i++) {
                        mainBtn += getBtnHtml({
                            cssName: normalCssName,
                            page: i + 1
                        });
                    }
                }
                    //有省略情况
                else {

                    //** 两侧 按钮 html
                    for (i = 0; i < sideBtnNum; i++) {
                        leftSideBtn += getBtnHtml({
                            cssName: normalCssName,
                            page: i + 1

                        });
                    }
                    for (i = sideBtnNum; i--;) {
                        rightSideBtn += getBtnHtml({
                            cssName: normalCssName,
                            page: pageCount - i
                        });
                    }

                    //** 主要 按钮 html
                    //左边没省略情况 当然 右边就有省略 
                    if (page <= sideBtnNum + Math.ceil(mainBtnNum / 2)) {
                        for (i = 0; i < mainBtnNum - 1; i++) {
                            mainBtn += getBtnHtml({
                                cssName: normalCssName,
                                page: sideBtnNum + i + 1
                            });
                        }
                        mainBtn += getBtnHtml({
                            cssName: normalCssName,
                            txt: omitTxt,
                            page: sideBtnNum + mainBtnNum
                        });
                    }
                        //右边没省略情况 当然 左边边就有省略
                    else if (page > pageCount - sideBtnNum - Math.ceil(mainBtnNum / 2)) {
                        mainBtn += getBtnHtml({
                            cssName: normalCssName,
                            txt: omitTxt,
                            page: pageCount - sideBtnNum - mainBtnNum + 1
                        });
                        for (i = mainBtnNum - 1; i--;) {
                            mainBtn += getBtnHtml({
                                cssName: normalCssName,
                                page: pageCount - sideBtnNum - i
                            });
                        }
                    }
                        //两边都有省略
                    else {
                        mainBtn += getBtnHtml({
                            cssName: normalCssName,
                            txt: omitTxt,
                            page: page - Math.ceil(mainBtnNum / 2) + 1
                        });

                        for (i = 0; i < mainBtnNum - 2; i++) {
                            mainBtn += getBtnHtml({
                                cssName: normalCssName,
                                page: page - Math.floor((mainBtnNum - 2) / 2) + i
                            });
                        }
                        mainBtn += getBtnHtml({
                            cssName: normalCssName,
                            txt: omitTxt,
                            page: page + Math.ceil(mainBtnNum / 2) - 1
                        });
                    }
                }

                //上一页
                prevBtn = (page === 1 && noShow) ? '' : getBtnHtml({
                    cssName: prevCssName + (page == 1 ? ' disabled' : ' enable'),
                    page: page - 1,
                    txt: prevTxt
                });

                //下一页
                nextBtn = (page === pageCount && noShow) ? '' : getBtnHtml({
                    cssName: nextCssName + (page === pageCount ? ' disabled' : ' enable'),
                    page: page + 1,
                    txt: nextTxt
                });

                return prevBtn + leftSideBtn + mainBtn + rightSideBtn + nextBtn;
            }

            //** 初始
            //只有一页情况
            if (pageCount < 1) return '';

            return build();
        }

        function commonAjax(jPageBox, pageData, getData, partial) {
            if (jPageBox.length === 0) return;

            pageData.page = pageData.page * 1;
            partial = partial === 1 ? 1 : 0;

            var
                jBtns,
                jTxt,//页 输入框
                pageCount = Math.ceil(pageData.total / pageData.pageSize);

            if (pageCount <= 0) {
                jPageBox.html('');
                return;
            }
            else if (pageCount === 1) {

            }

            jPageBox.html(getHtml({
                pageData: [pageData.page + partial, pageData.total, pageData.pageSize],//当前页，数据总条数，每页显示数
                prevCssName: 'prev',//可选
                nextCssName: 'next',//可选
                sideBtnNum: 2,//可选
                prevTxt: '&lt;',//可选
                nextTxt: '&gt;'//可选
            }) + '<span>跳转到：<input type="text" class="page_input" value="' + (pageData.page + partial) + '"/></span><a href="javascript:;" class="go">GO</a>');

            jTxt = $(jPageBox[0].getElementsByTagName('input')[0]);

            jTxt.ENTER(function () {
                goPage();
            });

            jBtns = jPageBox.children().click(function () {
                var jBtn = $(this);

                if (jBtn.hasClass('go')) {
                    goPage();
                    return;
                }
                if (jBtn.hasClass('disabled') || jBtn.hasClass('active') || this.tagName === 'SPAN') return;

                if (!jBtn.hasClass('prev') && !jBtn.hasClass('next')) {
                    jBtns.eq(pageData.page).removeClass('active');
                    jBtn.addClass('active');
                }
                getData(jBtn.attr('data-page') - partial);
            });

            function goPage() {
                var num = c.trim(jTxt.val());

                if (isNaN(num)) {
                    common.msg('请输入数字');
                }
                else if (num > pageCount) {
                    common.msg('当前只有' + pageCount + '页');
                }
                else if (num == pageData.page + partial) {
                    common.msg('当前就是第' + num + '页');
                }
                else {
                    getData(num - partial);
                }
            }
        }

        return {
            getHtml: getHtml,
            commonAjax: commonAjax
        };
    })();
    //#endregion

    window.c = window.common = c;

})();
