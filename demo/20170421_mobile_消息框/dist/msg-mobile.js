/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _msgMobile = __webpack_require__(2);

__webpack_require__(4);

window.simpleMsg = _msgMobile.simpleMsg;

(0, _msgMobile.simpleMsg)('消息123！！');

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', { value: true });

var corejs = __webpack_require__(3);

function debugMsg() {
  debugMsg.removeElem();
  debugMsg.html += '<p>' + [].join.call(arguments, ' ') + '</p>';

  debugMsg.$el = corejs.htmlToElems('<div style="\nposition: fixed;\ntop: 0;\nleft: 0;right:0;\nfont-size: 16px;\nbackground-color: #eee;\nz-index: 999;\npadding: 36px 6px 6px;\nopacity: .8;\nmax-height:50%;\noverflow: auto;\n    "><i style="\npadding: 6px;\nwidth: 20px;\nheight: 20px;\nbackground-color: red;\ncolor: #fff;\nposition: fixed;\nright: 5px;\ntop: 5px;\nfont-style: normal;\ntext-align: center;\n    font-size: 22px;\n    line-height: 1;\n    ">\u2716</i>' + debugMsg.html + '</div>')[0];

  corejs.click(debugMsg.$el.children[0], function () {
    debugMsg.close();
  });
  // debugMsg.$el.children[0].onclick = function () {
  //     debugMsg.$el.innerHTML=123;
  // debugMsg.close();
  // };

  document.body.appendChild(debugMsg.$el);

  // 滚动到底部
  debugMsg.$el.scrollTop = debugMsg.$el.scrollHeight;
}
debugMsg.html = '';
debugMsg.close = function () {
  this.removeElem();
  this.html = '';
};
debugMsg.removeElem = function () {
  this.$el && this.$el.remove();
  this.$el = null;
};

function simpleMsg(msgCont) {

  var msg = document.createElement('div');
  msg.className = 'simple-msg';
  msg.textContent = msgCont;
  document.body.appendChild(msg);

  msg.addEventListener("transitionend", function () {
    msg.remove();
  });
  msg.addEventListener("webkitTransitionEnd", function () {
    msg.remove();
  });

  setTimeout(function () {
    msg.classList.add('hide');
  }, 1200);
}

/**
 * Created by cql on 2017/4/21.
 */

exports.dMsg = debugMsg;
exports.simpleMsg = simpleMsg;

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', { value: true });

/**
 * Created by cql on 2017/3/14.
 */

var isIOS = navigator.appVersion.indexOf('Mac OS') > -1;
var isMobileIOS = /iPad|iPhone/.test(navigator.userAgent);
var isAndroid = /Android/.test(navigator.userAgent);
var isWX = /micromessenger/i.test(navigator.userAgent);

// js 调用执行 设备 接口
/*
 @example
 c.deviceCallback(['contact', 'jumppointsCallback'], 'jumppoints', data[curIndex].id);// 都带参
 c.deviceCallback(['contact', 'thisLevelCallback'], 'goBack:0');// 不带参
 c.deviceCallback(['answer', 'uploadPicture'], 'uploadPictureShort:' + iArr[0] + '_' + iArr[1]); // 只给ios带参
 */
/*export function deviceCallback() {
    if (isAndroid) {
        deviceCallback = function (aName, iName, str) {
            if (str === undefined) {
                window[aName[0]][aName[1]]();
            }
            else {
                window[aName[0]][aName[1]](str);
            }
        };
    }
    else if (isIOS) {
        deviceCallback = function (aName, iName, str) {
            if (iName === undefined) return;

            if (str === undefined) window.location.href = iName;
            else window.location.href = iName + ':' + encodeURIComponent(str);
        };
    }

    deviceCallback(...arguments);
}*/

/**.
 * android 版本获取
 *
 * @return {string|null} 返会此格式的'4.4'字符串 | 非android设备返会null
 * */

/**
 * 公共的必须初始化的小功能 - 全端适用
 *
 * Created by cql on 2017/4/24.
 */

/**
 * 原型扩展
 * */
if (!String.prototype.trim) {
    String.prototype.trim = function () {
        return this.replace(/(^[\s\uFEFF]*)|(\s*$)/g, '');
    };
}
if (!Element.prototype.remove) {
    Element.prototype.remove = function () {
        this.parentNode.removeChild(this);
    };
}

/**
 * ios 移动端 解决 css active 不生效问题
 *
 * */
if (isMobileIOS) {
    document.body.ontouchstart = function () {};
}

/**
 * Created by cql on 2017/1/6.
 */

// 计算坐标
// 点与点相加
function Figure() {
    this.start = function (x, y) {
        this.prevX = x;
        this.prevY = y;
    };

    this.move = function (x, y, fn) {
        fn(x - this.prevX, y - this.prevY);

        this.prevX = x;
        this.prevY = y;
    };
}

/**
 * 更基础的拖动
 *
 * 针对pc鼠标事件实现
 *
 * 兼容性：ie9+
 *
 *
 *
 * @param onDown 可通过 return false 阻止拖动发送
 *
 */
function drag(_ref) {
    var eDrag = _ref.eDrag,
        onMove = _ref.onMove,
        _ref$onDown = _ref.onDown,
        onDown = _ref$onDown === undefined ? function () {} : _ref$onDown,
        _ref$onUp = _ref.onUp,
        onUp = _ref$onUp === undefined ? function () {} : _ref$onUp;

    eDrag.addEventListener('mousedown', down);

    function down(e) {

        if (onDown(e) === false) return;

        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);

        function mousemove(e) {
            onMove(e);
        }

        function mouseup() {
            onUp();

            //解除所有事件
            document.removeEventListener('mousemove', mousemove);
            document.removeEventListener('mouseup', mouseup);
        }
    }
}

/*
 * click
 * pc+移动端都适用。 对移动端有优化
 * 兼容性：ie9+
 * */
function click(elem, fn) {

    /*function getAndroidVersion() {
        let v;
        let r = navigator.userAgent.match(/Android (\d.\d)/);
        v = r && r[1];
         getAndroidVersion = function () {
            return v;
        };
         return v;
    }*/

    // if ((getAndroidVersion() && getAndroidVersion() < 4.4) || /iPad|iPhone/.test(navigator.userAgent)) {
    // 鉴于华为手机的奇葩性质，Android 7 依然click高亮。。。
    if (/Android|iPad|iPhone/.test(navigator.userAgent)) {
        click = function click(elem, fn) {
            var touchcancel = void 0;

            elem.addEventListener('touchend', touchend, true);
            elem.addEventListener('touchstart', touchstart, true);
            elem.addEventListener('touchmove', touchmove, true);

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
    } else {
        click = function click(elem, fn) {
            elem.addEventListener('click', fn);
            return function () {
                elem.removeEventListener('click', fn);
            };
        };
    }

    click(elem, fn);
}

exports.Figure = Figure;
exports.drag = drag;
exports.click = click;

/***/ }),
/* 4 */
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ })
/******/ ]);