/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.l = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };

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

/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};

/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 8);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ },
/* 1 */
/***/ function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

"use strict";


var _dragBase = __webpack_require__(7);

var _dragBase2 = _interopRequireDefault(_dragBase);

var _offsetxy = __webpack_require__(5);

var _offsetxy2 = _interopRequireDefault(_offsetxy);

var _scopeElements = __webpack_require__(6);

var _scopeElements2 = _interopRequireDefault(_scopeElements);

var _htmlToElems = __webpack_require__(4);

var _htmlToElems2 = _interopRequireDefault(_htmlToElems);

var _ExcuInterval = __webpack_require__(3);

var _ExcuInterval2 = _interopRequireDefault(_ExcuInterval);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function DragExchange(eBox) {
    function range(_ref) {
        var x = _ref.x,
            y = _ref.y,
            w = _ref.w,
            h = _ref.h,
            colsNum = _ref.colsNum,
            rowsNum = _ref.rowsNum,
            margin = _ref.margin;


        var col = Math.ceil(x / w),
            row = Math.ceil(y / h);

        if (margin) {

            var offsetX = x % w,
                offsetY = y % h;

            if (offsetX < margin.left || offsetX > w - margin.right || offsetY < margin.top || offsetY > h - margin.bottom) {

                return -1;
            }
        }

        if (col > colsNum || row > rowsNum) {

            return -1;
        }

        return (row - 1) * colsNum + col - 1;
    }

    function dragRecognition(_ref2) {
        var eDrag = _ref2.eDrag,
            _onDown = _ref2.onDown,
            onStart = _ref2.onStart,
            _onMove = _ref2.onMove,
            _onUp = _ref2.onUp;


        var startX = void 0,
            startY = void 0,
            downEvent = void 0,
            isStart = false;

        (0, _dragBase2.default)({
            eDrag: eBox,
            onMove: function onMove(e) {

                if (!isStart) {
                    var lenX = e.pageX - startX,
                        lenY = e.pageY - startY;

                    if (Math.abs(lenX) > 2 || Math.abs(lenY) > 2) {
                        isStart = onStart(downEvent) === false ? false : true;
                    }
                }

                if (isStart) {
                    _onMove(e);
                }
            },
            onDown: function onDown(e) {
                if (_onDown(e) === false) return false;

                isStart = false;

                startX = e.pageX;
                startY = e.pageY;

                downEvent = e;
            },
            onUp: function onUp() {
                if (isStart) _onUp();
            }
        });
    }

    var rowsNum = void 0,
        colsNum = void 0;
}

var eBox = document.querySelector('.drag-box');
var dragExchange = new DragExchange(eBox);

eBox.addEventListener('click', function (e) {
    if (e.target.classList.contains('del')) {
        dragExchange.delItem(e.target.parentElement.parentElement.dataset.index);
    }
});

add.addEventListener('click', function () {
    dragExchange.addItems((0, _htmlToElems2.default)('\n    <div class="drag-item">\n        <div class="drag-item-cont">\n            <a href="javascript:console.log(\'\u53EF\u70B9\u51FB\');">text11111</a> <a class="del" title="\u5220\u9664" href="javascript:;">X</a>\n        </div>        \n    </div>\n    <div class="drag-item">\n        <div class="drag-item-cont">\n            <a href="javascript:console.log(\'\u53EF\u70B9\u51FB\');">text222222222222222</a> <a class="del" title="\u5220\u9664" href="javascript:;">X</a>       \n        </div>\n    </div>'));
});

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = ExcuInterval;
function ExcuInterval() {
    var status = 0;
    this.excu = function (fn, time) {
        if (status) return;
        status = 1;
        setTimeout(function () {
            fn();
            status = 0;
        }, time);
    };
}

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = htmlToElems;
function htmlToElems(html) {
  var eTemp = document.createElement('div');
  eTemp.innerHTML = html;

  return eTemp.children;
}

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = offsetXY;
function offsetXY(elem) {
    var top = 0,
        left = 0;
    do {
        top += elem.offsetTop;
        left += elem.offsetLeft;

        elem = elem.offsetParent;
    } while (elem);
    return { top: top, left: left };
};

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = scopeElements;
function scopeElements(targetElem, listener) {
    targetElem = targetElem.nodeType === 1 ? targetElem : targetElem.parentElement;
    go(targetElem);
    function go(that, child) {
        if (listener(that, child) !== false) {
            go(that.parentElement, that);
        }
    }
}

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Figure = Figure;
exports.default = drag;
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

            document.removeEventListener('mousemove', mousemove);
            document.removeEventListener('mouseup', mouseup);
        }
    }
}

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

__webpack_require__(0);
__webpack_require__(1);
module.exports = __webpack_require__(2);


/***/ }
/******/ ]);