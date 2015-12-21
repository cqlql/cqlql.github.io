"use strict";

window.requestAnimationFrame  = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback, elem) {
            return window.setTimeout(callback, 1000/60);
        };
})();
window.cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.clearTimeout;

(function () {

    var c = {};

    /// 基础

    //#region 浏览器判断
    c.isIE = document.documentMode;// ie7~11
    c.isEdge = navigator.appVersion.indexOf('Edge') > -1;
    
    //#endregion

    //#region 为定义参数处理
    //非空\未定义 情况 默认值 处理
    c.paramUn = function (value, def) {
        return value === undefined ? def : value;
    };
    //#endregion
            
    //#region className 操作

    c.hasClass = function (elem,className) {
        return (' ' + elem.className + ' ').indexOf(' ' +c.trim( className)+' ') > -1;
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
    
    //#endregion

    //#region css

    //#region css 前缀获取

    c.getPrefix = function () {
        var prefix = null;

        function handle() {
            var userAgent = navigator.userAgent;

            /*
            实际上，Edge浏览器较为特殊。
            比如，box-direction 这个css属性，居然是 webkit 前缀
             */

            if (document.documentMode || userAgent.indexOf('Edge') > -1) {
                prefix = 'ms';
            }
            else if (userAgent.indexOf('Firefox') > -1) {
                prefix = 'Moz';
            }
            else {
                prefix = 'webkit';
            }

        }

        return function () {
            if (prefix === null) {
                handle();
            }

            return prefix;
        };
    }();

    //#endregion 

    //#region css 加前缀
    /*

    type: 
        0 或不给, 减号连接,真正的 css属性名 
        1, 驼峰, 适用直接给style赋值
    例子
    cssTransform = c.addPrefix('transform')
    */
    c.addPrefix = function (name, is) {
        var
            original= name,
            //cssPrefixes = ["webkit", "Moz", "ms"],
            cssPrefixes = ["ms", "Moz", "webkit"],
            //cssPrefixes = [c.getPrefix()],
            style = document.body.style,
            capName, i, newName, tempCssPrefixes;

        name = name.replace(/-[\w]/g, function (match) {
            return match.substr(1).toUpperCase();
        });

        if (name in style) {
            return is ? name : original;
        }

        capName = name.charAt(0).toUpperCase() + name.substr(1),
        i = cssPrefixes.length;

        while (i--) {

            tempCssPrefixes = cssPrefixes[i];

            newName = tempCssPrefixes + capName;

            if (newName in style) {
                return is ? newName : '-' + tempCssPrefixes + '-' + original;
            }
        }
        return null;
    };

    //#endregion

    //#region css 属性名获取

    // 单例模式，取过后的属性将保存，下次节省效率
    // 参数：推荐使用 减号连接的 css属性名
    // 返回：有前缀的，js style 专用
    c.getCssName = function () {
        var obj = {};
        return function (name) {
            var styleName = obj[name];

            if (styleName===undefined) {

                if (name === 'float') {
                    styleName = obj[name] = c.getCssNameFloat();
                }
                else {
                    styleName = obj[name] = c.addPrefix(name, 1);
                }
            }
            return styleName;
        }
    }();

    //#endregion

    //#region css 值获取

    /*
    
    参数:
        name
         推荐使用原 css 属性名称
    
    */

    c.getCss = function () {

        return window.getComputedStyle ?
        function (elem, name) {

            var style = getComputedStyle(elem, null);

            return style[this.getCssName(name)];

        } : function (elem, name) {
            return elem.currentStyle[this.getCssName(name)];
        }

    }();

    //#endregion

    //#region css 值设置
    c.setCss = function (elem, name,value) {
        var style = elem.style;

        if (typeof name === 'string') {
            style[c.getCssName(name)] = value;
        }
        else {
            for (var k in name) {
                style[c.getCssName(k)] = name[k];
            }
        }
    };
    //#endregion

    //#region 取float js操作名称
    c.getCssNameFloat = function () {

        var name;

        function handle() {
            var
            arr = ['styleFloat', 'cssFloat', 'float'],
            style = document.body.style,
            i = arr.length, name;

            while (i--) {
                name = arr[i];
                if (name in style) {
                    return name;
                }
            }
        }

        return function () {
            if (!name) {
                name = handle();
            }
            return name;
        };
    }();

    //#endregion

    // #region 增加css 文本
    c.addCssTxt = function (txt) {
        var eStyle = document.createElement('style');

        if ('textContent' in eStyle) {
            eStyle.textContent = txt;
            document.head.appendChild(eStyle);
        }
        else {
            // ie678
            eStyle.setAttribute("type", "text/css");
            eStyle.styleSheet.cssText = txt;
            document.body.appendChild(eStyle);
        }
    };
    // #endregion

    //#endregion

    //#region 去两头空格
    // \uFEFF 为出现在开头的特殊字符
    c.trim = function (str) {
        if (str.trim) return str.trim();
        return str.replace(/(^[\s\uFEFF]*)|(\s*$)/g, '');
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
    var anime = new c.ChangeAnime(function (v) {
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
    c.ChangeAnime = function (change, rate) {

        var o = this,

            //开关。 是否进行中。true 进行中
            sw = false;

        rate = rate ? rate : .2;

        function lastExcu() {

            sw = false;
        }

        // 参数2 可以是任意值，12px这种也是有效的，其他非数字将视为0
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

                if (sw) window.requestAnimationFrame(baseExcu);
            }

            o.to = to;
            cur = parseFloat(cur);
            o.cur = cur ? cur : o.cur;

            if (sw) return;

            sw = true;

            window.requestAnimationFrame(baseExcu);
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

            callback,

            stopId = null;

        function excu(params, options) {
            
            stopLast();

            callback = options.callback || function () { };

            var
                go = options.go,

                speed = options.speed === undefined ? 400 : options.speed,
                easing = options.easing === undefined ? 'swing' : options.easing,

                start = {},

                t = 0,//当前起始次数
                time = 16,//帧间隔
                d = speed / time;//总次数

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
    //#endregion

    //#region 队列

    c.Queue = function () {
        var
            is = false,// 是否在队列中
            arr = [];

        this.add = function (cb) {
            //console.log('排队数' + arr.length);
            
            arr.push(cb);

            if (is) return;

            is = true;

            loop();
        };

        this.clear= function () {
            arr = [];
            is = false;
        };

        function loop() {
            //console.log('排队数' + arr.length);
            var cb = arr.shift();

            if (cb) {
                cb(loop);
            }
            else {
                is = false;
            }

        }
    };

    //#endregion

    //#region each 循环

    // 带length的集合对象 或 纯对象
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

    //#region 取滚动条隐藏距离
    c.getWindowScrollTop  = 'pageYOffset' in window ?function () {
        return pageYOffset;
    }:function () {
        return document.documentElement.scrollTop;
    };
    //#endregion

    c.ajax = function (params) {

        function onReadystatechange() {
            if (xhr.readyState === 4) {

                if (xhr.status === 200) {
                    success(xhr.responseText);
                }
                else {
                    error(xhr, xhr.status, arguments);
                }

                complete();
            }
        }

        var
            url = params.url,
            type = params.type || 'get',
            success = params.success || function () { },
            error = params.error || function () { },
            complete = params.complete || function () { },

            xhr = new XMLHttpRequest();

        xhr.addEventListener('readystatechange', onReadystatechange, false);

        xhr.open(type, url);

        xhr.send();

        return xhr;
    };
    
    // 扩展
    c.extend = function (obj) {
        var target = this;
        c.each(obj, function (k, v) {
            target[k] = v;
        });
    };

    // url 参数获取
    c.getUrlSearch = function (name) {
        var reg = new RegExp(name + '=([^&]+)'),
            match = reg.exec(location.search);

        if (match) {
            return match[1];
        }
        return match;
    };

    //#region 外链 script 增加
    c.addScript = function (src, callback) {
        var script = document.createElement('script'),
            callback = callback || function () { };

        script.src = src;
        if ('onload' in script) {
            script.onload = function () {
                callback();
            };
        }
        else {
            script.attachEvent("onreadystatechange", function () {
                if (script.readyState === "complete" || script.readyState === "loaded") {
                    callback();
                }
            });
        }
        (document.head || document.body).appendChild(script);
    }
    //#endregion


    //#region 元素获取
    // 获取后代元素
    //兼容性：所有浏览器
    c.getElementsByClassName = function (className, elem) {

        elem = elem || document;

        if (elem.getElementsByClassName) {
            return elem.getElementsByClassName(className);
        }

        return c.filtrateElementsByClassName(className, elem.getElementsByTagName("*"));
    }

    // 过滤 元素集合 根据className
    c.filtrateElementsByClassName = function (className, elems) {

        var array = new Array();

        //过滤
        for (var i = 0, len = elems.length; i < len; i++) {
            if (c.hasClass(elems[i], className)) array.push(elems[i]);
        }

        return array;
    };

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
    //#endregion

    //#region 文档处理

    // html -> elems
    c.htmlToElems = function (html) {
        var eTemp = document.createElement('div');
        eTemp.innerHTML = html;
        return eTemp.children;
    };

    //#region 追加元素
    /*
    返回添加的元素

    单个情况 直接返回元素

    多个情况 返回元素集合
    
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

    //#endregion

    //#endregion

    //#region 仿jq
    window.$ = window.jsDo = (function () {
        var deletedIds = [],
            splice = deletedIds.splice;

        function init(content) {

            if (!content) return;

            var elems;

            // html
            if (typeof content === 'string') {
                elems = c.htmlToElems(content);
            }
                // elements object
            else {
                elems = content;
            }

            var len = elems.length;

            if (len === undefined) {
                this[0] = elems;
                this.length = 1;
            }
            else {
                for (var i = 0; i < len; i++) {
                    this[i] = elems[i];
                }
                this.length = len;
            }

        }

        function elemEnhance(elems) {
            return new init(elems);
        }

        function keyBuildPrivate(name) {

            return name + '_' + elemEnhance.key
        }

        elemEnhance.fn = elemEnhance.prototype = {
            jsDo: '1',
            length:0,
            key: (Math.random() + '').substr('2'),
            each: function (fn) {
                c.each(this, fn);
                return this;
            },
            css: function (name,value) {

                if (arguments.length === 1) {
                    if (typeof name === 'string') {

                        return c.getCss(this[0], name);
                    }

                    this.each(function (i, elem) {
                        c.setCss(elem, name);
                    });
                }
                else {
                    c.setCss(this[0], name, value);
                }

                return this;

            },

            // For internal use only.
            // Behaves like an Array's method, not like a jQuery method.
            push: deletedIds.push,
            sort: deletedIds.sort,
            splice: splice
        };

        elemEnhance.extend = elemEnhance.fn.extend = c.extend;

        init.prototype = elemEnhance.fn;

        // 元素获取
        elemEnhance.fn.extend({
            prev: function () {
                return $(c.siblingElement(this[0], 'previousSibling'));
            },

            // 参数只有集合中的第一个才有效
            next: function () {
                return $(c.siblingElement(this[0]));
            }
        });

        // 文档处理
        elemEnhance.fn.extend({
            append: function (content) {
                if (typeof content === 'string') {
                    c.appendChildHtml(this[0], content);
                }
                else {
                    jsDo(content).appendTo(this[0]);
                }

                return this;
            },

            // 参数只有集合中的第一个才有效
            appendTo: function (context) {
                var
                    jElems = jsDo(context),
                    fragment,
                    len = this.length;

                if (len > 1) {
                    fragment = document.createDocumentFragment();

                    for (var i = 0, that; i < len; i++) {
                        that = this[i];
                        fragment.appendChild(that);
                    }

                    jElems[0].appendChild(fragment);
                }
                else {
                    jElems[0].appendChild(this[0]);
                }

                return this;
            }
        });

        // 数据缓存
        elemEnhance.fn.extend({
            data: function (key, value) {
                var target = this;
                if (arguments.length > 1) {

                    return this.each(function (i, elem) {
                        elem[key + elemEnhance.key] = value;
                    });
                }

                return this[0][key + elemEnhance.key];

            }
        });

        // loading
        elemEnhance.fn.extend({
            addLoading: function () {
                var name = keyBuildPrivate('stopId');
                return this.each(function (i, elem) {
                    elem[name] = setTimeout(function () {
                        c.addClass(elem, 'loading');
                    }, 400);
                });

            },
            removeLoading: function () {
                var name = keyBuildPrivate('stopId');
                return this.each(function (i, elem) {
                    clearTimeout(elem[name]);
                    c.removeClass(elem, 'loading');
                });
            }
        });

        // 动画
        elemEnhance.fn.extend({
            animate: function (params, options) {
                options = options || {};

                var animateKey = 'animate_' + this.key,
                    animateQueueKey = 'animateQueue_' + this.key;

                this.each(function () {
                    var
                        speed = options.speed,
                        callback = options.callback || function () {},
                        isQueue = options.queue,

                        elem = arguments[1],
                        easingBuild = elem[animateKey],
                        queue = elem[animateQueueKey],
                        currParams;
                    
                    // 初始化
                    if (easingBuild===undefined) {
                        easingBuild = elem[animateKey] = new c.EasingBuild();
                    }

                    // 设置初始值。同步后期更改css值
                    currParams = easingBuild.getCurParams();
                    for (var k in params) {
                        //if (currParams[k] === undefined)
                        currParams[k] = parseFloat(c.getCss(elem, k)) || 0;
                    }
                    easingBuild.setCurParams(currParams);

                    // 队列初始
                    if (queue === undefined) {
                        queue = elem[animateQueueKey] = new c.Queue();
                    }

                    if (isQueue) {
                        queue.add(function (loop) {
                            animeStart(loop);
                        });
                    }
                    else {
                        queue.clear();
                        animeStart();
                    }

                    function animeStart(cb) {
                        cb = cb || function () { };

                        easingBuild.excu(params, {
                            go: function (to) {
                                for (var k in to) {
                                    c.setCss(elem, k, to[k] + 'px');
                                }
                            },
                            speed: speed,
                            callback: function () {
                                cb();
                                callback();
                            }
                        });
                    }
                });

            }
        });

        // prop
        elemEnhance.fn.extend({
            prop: function (key,value) {
                return this.each(function (i, elem) {
                    elem[key] = value;
                });

            }
        });

        return elemEnhance;

    })();
    //#endregion
    

    window.c = window.common = c;

})();
