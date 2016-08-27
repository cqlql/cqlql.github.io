'use strict';


/**
 * 原型扩展
 * */
(function () {
    if (!String.prototype.trim) {
        String.prototype.trim = function () {
            return this.replace(/(^[\s\uFEFF]*)|(\s*$)/g, '');
        }
    }

    if(!Element.prototype.remove){
        Element.prototype.remove=function () {
            this.parentNode.removeChild(this);
        };
    }
})();



var c = {};

// 去两头空格
// \uFEFF 为出现在开头的特殊字符
/*
 **
 * 原生的trim不能去掉特殊字符，比如BOM
 * */
c.trim = function (str) {
    return str.replace(/(^[\s\u200B\uFEFF]*)|([\s\u200B]*$)/g, '');
};

// 类型获取
/*
 @六种基本类型：number string boolean function object array

 @这些类型也能获取[ie678不支持这些]：
 HTMLCollection、HTMLDocument、HTMLTitleElement、HTMLHtmlElement
 这些类型使用typeof 将返回 object

 */
c.getType = function (v) {

    var typeStr = typeof v,
        fullTypeStr;

    if (typeStr === 'object') {
        fullTypeStr = ({}).toString.call(v);
        return /\[object ([^\]]+)\]/.exec(fullTypeStr)[1].toLowerCase();
    } else {
        return typeStr;
    }
};

/**
 each循環
 带length的集合对象 或 纯对象
 fn 中 返回false 将跳出
 */
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


/**
 * 间隔循环
 * @param total 支持小数，小数算一次，但会立即执行
 * */
c.loopInterval = function (callback, total, time) {
    var i = total || 0;
    time = time || 100;
    function fn() {

        if (i < 1) {
            if (i > 0) {
                callback(total)
            }
            return;
        }

        setTimeout(function () {
            callback(total - i);

            i--;

            fn();
        }, time);

    }

    fn();

};

/*
 实现位数不够进行前面补0

 params number[number,string] 要补位的数字
 params targetLen 目标总长度

 return [string] 即使是不需要更改的数字，最终都会返回string类型
 */
c.placeHolder = function (number, targetLen) {
    number = number.toString();

    var length = number.length;

    if (length < targetLen) number = (new Array(targetLen - length + 1)).join('0') + number;

    return number;
};

// 尝试执行，不断尝试，直到fn返回 true(可以是任何可转为true的类型)
/*
 *
 * 当然，也可以使用如下模式

 function tryExcu() {
 if(is1){
 // do
 return;
 }
 if(is2){
 // do
 return;
 }
 setTimeout(tryExcu,10)
 }

 * */
c.tryExcu = function (fn) {
    if (fn() === false) return;

    setTimeout(function () {
        c.tryExcu(fn)
    }, 10);
};

/**
 * 取最大值

 方式1，number数组
 getMax([1,5,12,10])

 方式2，支持 对象
 getMax([{
 value: 1
 },
 value: 12
 }, {
 value: 10
 }],
 'value')

 * */
c.getMax = function (data, key) {
    var curr = data[0];
    if (key) {
        for (var i = 1, len = data.length, d; i < len; i++) {
            d = data[i];
            if (d[key] > curr[key]) {
                curr = d;
            }
        }
    }
    else {
        for (var i = 1, len = data.length, d; i < len; i++) {
            var d = data[i];
            if (d > curr) {
                curr = d;
            }
        }
    }

    return curr;
};

/**
 * 达到指定数量后统一执行
 *
 * @param {number} count 需要达到的次数
 *
 * timeReadyExcu.excu(d,key)
 * @param {number,string} key 将根据此键值找到传入的数据
 *
 * example
 var timeReadyExcu =new TimeReadyExcu(2);

 timeReadyExcu.excu({d1:'testdata'},'key1',init);
 timeReadyExcu.excu({d2:'testdata'},'key2',init);

 function init(allData) {
        var d1=data['key1'],
            d2=data['key2'];
        console.log(allData);
     }
 *
 * */
c.TimeReadyExcu = function (count) {
    var i = 0,
        allData = {};
    this.excu = function (d, key, init) {
        i++;
        allData[key] = d;

        if (i === count)init(allData);
    };
};

module.exports = c;
