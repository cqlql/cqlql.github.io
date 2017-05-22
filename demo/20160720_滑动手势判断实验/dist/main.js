/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
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
/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };
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
/******/ 	return __webpack_require__(__webpack_require__.s = 4);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _dragBaseMobile = __webpack_require__(1);

var _dragBaseMobile2 = _interopRequireDefault(_dragBaseMobile);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var startX = void 0,
    startY = void 0,
    onlyOne = 1;

(0, _dragBaseMobile2.default)({
    eDrag: document,
    onMove: function onMove(e) {

        if (onlyOne) {
            var touche = e.touches[0];
            var moveX = touche.pageX,
                moveY = touche.pageY;

            var xlen = moveX - startX,
                ylen = moveY - startY;

            if (Math.abs(Math.atan(ylen / xlen) > 1.2)) {}

            onlyOne = 0;
        }
    },
    onDown: function onDown(e) {},
    onStart: function onStart(e) {
        var touche = e.touches[0];


        startX = touche.pageX;
        startY = touche.pageY;

        onlyOne = 1;
    },
    onEnd: function onEnd(e) {}
});

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = dragBaseMobile;
function dragBaseMobile(_ref) {
    var eDrag = _ref.eDrag,
        onMove = _ref.onMove,
        _ref$onStart = _ref.onStart,
        onStart = _ref$onStart === undefined ? function () {} : _ref$onStart,
        _ref$onDown = _ref.onDown,
        onDown = _ref$onDown === undefined ? function () {} : _ref$onDown,
        _ref$onEnd = _ref.onEnd,
        onEnd = _ref$onEnd === undefined ? function () {} : _ref$onEnd;


    var isStart = false;

    eDrag.addEventListener('touchstart', function (e) {
        if (onDown(e) === false) {
            isStart = false;
            return;
        }
        isStart = true;

        onStart(e);
    });

    eDrag.addEventListener('touchmove', function (e) {
        if (isStart === false) return;

        onMove(e);
    });

    eDrag.addEventListener('touchend', function (e) {
        if (isStart === false) return;

        var touches = e.touches;

        if (touches.length === 0) {
            onEnd();
        } else {
            onStart(e);
        }
    });
}

/***/ }),
/* 2 */,
/* 3 */,
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(0);


/***/ })
/******/ ]);