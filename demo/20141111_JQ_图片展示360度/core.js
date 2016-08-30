"use strict";
var core = {}, un;

if (window.console === undefined) {
    window.console = {
        log: function () { }
    };
}

//调试
/**
 *  ie678调试 信息
 *  @param (string) htmlTxt 输出的文本。支持标签文本
 */
window.ielog = (function () {

    function css(param, elem) {
        for (var name in param) elem.style[name] = param[name];
    }

    function prepend(elem, targetElem) {
        targetElem.insertBefore(elem, targetElem.childNodes[0]);
    }

    var elem = null;
    return function (htmlTxt) {

        if (elem === null) {
            elem = document.createElement('div');
            css({
                background: '#FFC3C3',
                color: '#000',
                padding: '5px',
                position: 'fixed',
                right: '0',
                bottom: '0',
                zIndex: 999
            }, elem);
        }

        elem.innerHTML += '<p>' + htmlTxt + '</p>';

        document.body.insertBefore(elem, document.body.childNodes[0]);
    };
})();

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback, element) {
            window.setTimeout(callback, 15);
        };
})();

//#region 浏览器判断
core.isIE678 = !-[1, ];
core.isIE6 = window.navigator.userAgent.indexOf('MSIE') > -1 && !document.documentMode;
core.isIE = core.isIE6 || document.documentMode;
core.isIE67 = core.isIE6 || document.documentMode <= 7;
core.isIE6789 = core.isIE6 || document.documentMode <= 9;
core.isIEv11 = document.documentMode && document.documentMode <= 11;

core.isFireFox = navigator.userAgent.indexOf('Firefox') > -1;
core.isChrome = navigator.userAgent.indexOf('Chrome') > -1;
core.isSafari = navigator.userAgent.indexOf('Safari') > -1;//chrome + safari

//
core.is360 = (function () {
    var arr = window.navigator.userAgent.match(/Chrome\/([\d]*)/);
    return arr ? arr[1] <= 21 : false;
})();
//#endregion

core.cssPrefix = (function() {
    var prefix = '';
    
    if (core.isIE) prefix = '-ms-';
    else if (core.isChrome || core.isSafari) prefix = '-webkit-';
    else if (core.isFireFox) prefix = '-moz-';

    return prefix;
})();




//#region 页加载
/**
 *  元素完毕触发
 *  @param (function) callback 完毕后执行
 *  
 *  区别【所有资源完毕触发】
 *  兼容：所有浏览器，包括严格模式
 */
core.domLoad = function (callback) {
    if (window.addEventListener) {
        document.addEventListener("DOMContentLoaded", callback, false);
    }
    else {
        (function () {
            try {
                document.documentElement.doScroll('left');
            } catch (e) {
                setTimeout(core.domLoad, 15);
                return;
            }
            callback();
        })();
    }
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
core.mouseWheel = function (dom, f) {
    if (dom.addEventListener) {
        if (dom.onmousewheel === undefined) dom.addEventListener('DOMMouseScroll', f, false);//firefox
        else dom.addEventListener('mousewheel', f, false);
    } else {
        dom.attachEvent('onmousewheel', f);//ie678
    }
};
core.removeMouseWheel = function (dom, f) {
    if (dom.addEventListener) {
        if (dom.onmousewheel === undefined) dom.removeEventListener('DOMMouseScroll', f, false);//firefox
        else dom.removeEventListener('mousewheel', f, false);
    } else {
        dom.detachEvent('onmousewheel', f);//ie678
    }
};
//#endregion

//#region数字补位 用于数组排序
//core.numCover(1,1);//返回string类型:"01"
core.numCover = function (v, l) {
    v += '';
    for (var i = 0, len = l - v.length; i < len; i++) v = '0' + v;
    return v;
}
//#endregion

//#region 取字符串 [字节大小]
/*
中文字符两个字节，英文字符一个
*/

core.stringSize = function (s) {

    return s.length + (s.match(/[^\x00-\xff]/g) || '').length;
}
//#endregion

//#region 显示窗口高宽
core.winWH = function () {
    return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
};
//#endregion

//#region 内容窗口高宽
core.bodyWH = function () {
    return { width: document.body.clientWidth, height: document.body.clientHeight };
};
//#endregion

//#region 图片加载
/*
** 图片加载

参数--
1：图片url
2：加载完 后执行，返回当前图片dom
3：错误执行

*/
core.imgLoad = function (src, f, f2) {
    var img = new Image();
    img.onload = function () {
        f(img);
    };
    if (f2) img.onerror = f2;
    img.src = src;
};
//#endregion

//#region 图片加载2
/*
** 图片加载2
二次调用讲覆盖之前的

参数--
1：图片url
2：加载完 后执行，返回当前图片dom
3：错误执行

*/
core.imgLoad2 = (function () {
    var ready, err;
    return function (src, f, f2) {
        var img = new Image();
        ready = f;
        img.onload = function () {
            if (f === ready) ready(img);
        };
        if (f2) {
            err = f2;
            img.onerror = function () {
                if (f2 === err) err();
            };
        }
        img.src = src;
    };
})();
//#endregion

//#region 定时器执行
/*
** 定时器执行
将反复执行。通过参数1 返回 false 终止定时

特性：
timeExcu函数 的 第一次 执行 也将被计时

参数1：
反复执行的 函数。返回false 将停止反复执行

参数2：
每次执行间隔的毫秒数
*/
core.timeExcu = function (f, time) {
    if (f() === false) return;
    setTimeout(function () { core.timeExcu(f, time); }, time);
};
//#endregion

//#region 图片尺寸 就绪后执行
/*
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
core.imageSizeExcu = function (src, f) {
    var img = new Image(),
    iserror = false;

    img.onerror = function () {
        f({ w: 0, h: 0, img: img });
        iserror = true;
    };

    img.src = src;

    //返回false 将跳出 循环
    core.loopTry(function () {
        if (iserror) return false;
        if (img.complete || img.width) {

            f({ w: img.width, h: img.height, img: img });
            return false;
        }
    });
};
core.imageSize = function () {

    var loopTry = new core.loopTry_v2(),
        img = new Image();

    this.excu = function (src, f) {

        img = new Image();

        img.onerror = function () {

            f({ width: 0, height: 0 }, img);

            loopTry.stop();
        };

        img.src = src;

        //返回false 将跳出 循环
        loopTry.excu(function () {

            if (img.complete || img.width) {
                f({ width: img.width, height: img.height }, img);
                return false;
            }
        });
    };

    this.stop = function () {
        img.removeAttribute('src');
        loopTry.stop();
    };
};
//#endregion

//#region 时间转换
core.timeConvert = function () {


};
//#endregion

//#region 原生事件注册
/**
 *  原生事件注册
 *  @param (element) target 目标元素对象
 *  @param (string) type 事件名称。如 load
 *  @param (function) 注册函数
 *  @param (number)
 *  @param (object)
 */
core.onEvent = function (target, type, listener) {
    if (window.addEventListener) {
        target.addEventListener(type, listener, false);
    }
    else {
        target.attachEvent("on" + type, listener);
    }
};

//#endregion

//#region 动态加载 js
/**
 *  引入执行.js文件函数
 *  @param (string) url 要引入执行的.js文件路径
 *  @param (function) callback 可选。当引入.js文件执行完毕后执行的函数
 */
core.addScript = function (src, callback) {
    var script = document.createElement('script');

    script.src = src;
    if ('onload' in script) {
        script.onload = function () {
            if (callback) callback();
        };
    }
    else {
        script.attachEvent("onreadystatechange", function () {
            if (script.readyState === "complete" || script.readyState === "loaded") {
                if (callback) callback();
            }
        });
    }
    document.getElementsByTagName('head')[0].appendChild(script);
};
//#endregion

//#region 对象扩展


/**
 * 对象扩展
 *  @param (object\function) target 被扩展的对象
 *  @param (object) 用来扩展的对象
 */
core.extend = function () {
    /**
     *  直接扩展成员 原型
     *  也可以说是复制成员
     *  @param (object) target 要操作的对象
     *  @param (objece) obj 用来扩展的成员对象
     *  @param (boolean) replace 重名情况是否替换。true表示替换。[可选，默认true]
     */
    function extend(params) {
        var target = params.target,
            obj = params.obj,
            replace = params.obj === undefined ? true : params.obj,

            name;

        if (replace) {
            for (name in obj) {
                target[name] = obj[name];
            }
        }
        else {
            for (name in obj) {
                if (target[name] === undefined) target[name] = obj[name];
            }
        }

    }

    /**
    *  直接扩展成员 接口
    *  @param (object) target 要操作的对象[可选，默认this]
    *  @param (objece) obj 用来扩展的成员对象
    *  @param (boolean) replace 重名情况是否替换。true表示替换。[可选，默认true]
    *
    *  @param (object) target 要操作的对象[可选，默认this]
    *  @param (string) obj 成员名
    *  @param (var) value 成员项
    *
    *  @param (string) name 成员名
    *  @param (var) value 成员项
    *
    *  
    */
    var target,
        obj,
        replace;

    switch (arguments.length) {

        case 1:
            extend({
                target: this,
                obj: arguments[0]
            });
            break;
        case 2:

            if (typeof arguments[0] === 'string') {

                this[arguments[0]] = arguments[1];
            }
            else {
                extend({
                    target: arguments[0],
                    obj: arguments[1]
                });
            }
            break;

        case 3:
            if (typeof arguments[1] === 'string') {
                arguments[0][arguments[1]] = arguments[2];
            }
            else {
                extend({
                    target: arguments[0],
                    obj: arguments[1],
                    replace: arguments[2]
                });
            }

            break;


        default:

    }

};

//#endregion

//#region 取cookie
/*
取cookie

@param string name cookie名

@return string name对应的cookie值。没取到返回null
*/
core.getCookie = function (name) {
    var reg = new RegExp(name + '=([^;]*)'),
        v = reg.exec(document.cookie);
    return v ? v[1] : v;
};
//#endregion

//#region 原型扩展

//包含 className 判断
//包含 返回 true。否则 返回false
//(function () {
//    function hasCss(className) {
//        var s = this.className.split(' ');

//        for (i = s.length; i--;) if (s[i] === className) return true;

//        return false;
//    }

//    if (core.isIE678) {
//        var a = 'Div,Anchor';
//        for (var i = a.length; i--;) window['HTML' + a[i] + 'Element'].prototype.hasCss = hasCss;
//    }
//    else {
//        HTMLElement.prototype.hasCss = hasCss;
//    }

//})();


//数组 排序
//原生的 sort 不同位数。从前 开始，单个位数开始比，舍弃多余位数(需使用 字符串补位 才能正确排位)
//Array.prototype.numberSort = function () {
//    var arr = this,
//        i, j,
//        len = arr.length,
//        len2 = len - 1,
//        _temp;

//    //var _st = (new Date()).getTime();

//    for (i = 0; i < len2; i++) {
//        for (j = i + 1; j < len ; j++) {
//            if (arr[i] > arr[j]) {
//                //交换位置
//                _temp = arr[i];
//                arr[i] = arr[j];
//                arr[j] = _temp;
//            }
//        }
//    }

//    //console.log(_st);
//    //console.log((new Date()).getTime() - _st);

//    return arr;
//};

//#endregion

core.trim = function (str) {
    // 用正则表达式将前后空格  用空字符串替代。  
    return str.replace(/(^[\s\uFEFF]*)|(\s*$)/g, "");
};

core.parseJSON = function (str) {

    if (core.isIE678) str = core.trim(str).replace(/^\u9518\u5321\u8C62/, "");

    if ((/^[\s]*[{]/).test(str)) return eval('(' + str + ')');

    return eval(str);
};

//#region for循环
// function each(count, fn) {

//     for (var i = 0 ; i < count; i++) {

//         if (fn(i) === false) break;
//     }
// }
//#endregion

//#region 页面 判断
//参数2：指定字符串 后面不允许再跟其它字符。可跟一个 /
core.determinePage = function (pathname, type) {

    if (type) {
        var isIndex = location.href.match('\/' + pathname + '\/{0,1}([\\d\\D]*)');
        return isIndex === null ? false : (isIndex[1].length === 0);
    }
    else {
        return location.href.indexOf(pathname) > -1;
    }
};
//#endregion

//#region 不断循环 尝试取

/*
不断循环 尝试取
@param (function) tryFn 不断循环执行的函数，返回false 则停止循环
*/
core.loopTry = function (tryFn, time) {
    time = time === undefined ? 100 : time
    function fn() {
        if (tryFn() !== false) {
            setTimeout(fn, time);
        }
    }
    setTimeout(fn, time);
};

core.loopTry_v2 = function () {

    var stopId;
    this.excu = function (tryFn, time) {

        time = time === undefined ? 100 : time
        function fn() {
            if (tryFn() !== false) {
                stopId = setTimeout(fn, time);
            }
        }
        stopId = setTimeout(fn, time);
    };

    this.stop = function () {
        clearTimeout(stopId);
    };

};

//#endregion

//#region 第一次执行
/*
只有第一次执行
*/
core.extend('onlyOne', function () {
    var time = 0;

    function excu(fn) {
        if (time === 0) fn();
        time++;
    }

    function reset() {
        time = 0;
    }

    return { excu: excu, reset: reset };
});

//#endregion

//#region 第一次之后
/*
第一次 不执行，之后的都执行
*/
core.extend('afterOne', function () {
    var time = 0;

    function excu(fn) {

        if (time) fn();

        time++;

    }

    return excu;
});

//#endregion

//#region 有效执行
/*
指定时间内再次调用。将重新计时
实现 快速更新 情况 实现在 在最后结束后再更新


@使用举例
var validLoad = new core.validExcu();
validLoad.excu(function () { showLoad(left) },300);
*/
core.validExcu = function () {
    var timeId = null;

    function clear() {
        if (timeId) {
            clearTimeout(timeId);
            timeId = null;
        }
    }

    this.excu = function (callBack, time) {
        clear();

        timeId = setTimeout(function () {
            timeId = null;
            callBack();
        }, time || 200);
    };

    this.clear = clear;

};
//#endregion

//#region 延迟执行
/*
指定时间后执行。
可终止计时。
实现在指定时间内另外情况不需要执行，手动终止计时

默认200毫秒内

@使用举例
var delayExcu = new core.delayExcu();

delayExcu.excu(function () {alert('');});//不会发生重复调用。重复调用会删除之前的，最新的生效
delayExcu.clear();//返回bool值，true表示fn没有执行，清除成功。false，表示fn已经执行，没进行清除

常调用：
delayExcu.excu(function () {jBox.addClass('imgFullShowMove');});
if(delayExcu.clear()===false) jBox.removeClass('imgFullShowMove');
*/
core.delayExcu = function () {
    var stopId = null;

    function clear() {
        if (stopId !== null) {

            clearTimeout(stopId);

            stopId = null;

            return true;
        }
        return false;
    }

    this.excu = function (fn, time) {
        time = time === undefined ? 200 : time;
        clear();
        stopId = setTimeout(function () {
            fn();
            stopId = null;
        }, time);
    };

    this.clear = clear;
};
//#endregion

//#region 倒计时

/*

core.timing(5, function (t) {
    s.innerHTML = t;
}, function () {
    m.style.color = '#ccc';
});

*/

core.timing = function (time, loop, last) {
    loop(time);

    function excu() {
        setTimeout(function () {
            time--;

            loop(time);

            if (time === 0) {
                last();
                return;
            }

            excu();

        }, 1000);

    }

    excu();
};

//#endregion

//地址栏url 处理
core.extend('location', {

    //分离  [主要地址] 与 [#号或?号(或者?号#号都有)]
    urlSplit: function () {

        var _u, _i, _s, _str, _oStr;
        _u = location.href;
        _i = _u.indexOf('#');
        _s = _u.indexOf('?');

        if (_i < 0) {

            //都没有情况
            if (_s < 0) {
                _str = _u;
                _oStr = '';
            }
                //只有 [?号]情况
            else {
                _str = _u.substring(0, _s);
                _oStr = _u.substring(_s);
            }
        }
        else if (_s < 0) {

            //只有 [#号]情况
            _str = _u.substring(0, _i);
            _oStr = _u.substring(_i);
        }
        else {

            //都有情况
            if (_i < _s) {
                _str = _u.substring(0, _i);
                _oStr = _u.substring(_i);
            }
            else {
                _str = _u.substring(0, _s);
                _oStr = _u.substring(_s);
            }
        }

        return [_str, _oStr];
    }

});

//#region 常用正则

//使用举例：core.email_reg.test(val)

//邮箱正则
core.email_reg = /^(\w)+(\.\w+)*@(\w)+((\.\w+)+)$/;
core.mobile_reg = /^1[\d]{10}$/;
//#endregion

//速率计算
core.velocity = function () {

    var startTime,
        moveTimesArr = [],
        target = this;


    function getSustainTimes() {
        return (new Date()).getTime() - startTime;
    }

    //速率计时
    this.start = function () {
        moveTimesArr = [];
        startTime = (new Date()).getTime();
    };
    this.end = function () {

        if (!moveTimesArr[1]) return 0;

        //间隔时间
        var intervalTime = getSustainTimes() - moveTimesArr[1][0];

        //有惯性情况
        if (intervalTime < 50) {
            return (moveTimesArr[0][1] - moveTimesArr[1][1]) / intervalTime * 1000;
        }
            //无惯性
        else {
            return 0;
        }
    };

    this.change = function (val) {
        moveTimesArr.unshift([getSustainTimes(), val]);
        moveTimesArr.length = 2;
    };
};
