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
/******/ 	return __webpack_require__(__webpack_require__.s = 26);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

// Thank's IE8 for his funny defineProperty
module.exports = !__webpack_require__(3)(function(){
  return Object.defineProperty({}, 'a', {get: function(){ return 7; }}).a != 7;
});

/***/ }),
/* 1 */
/***/ (function(module, exports) {

module.exports = function(it){
  return typeof it === 'object' ? it !== null : typeof it === 'function';
};

/***/ }),
/* 2 */
/***/ (function(module, exports) {

var core = module.exports = {version: '2.4.0'};
if(typeof __e == 'number')__e = core; // eslint-disable-line no-undef

/***/ }),
/* 3 */
/***/ (function(module, exports) {

module.exports = function(exec){
  try {
    return !!exec();
  } catch(e){
    return true;
  }
};

/***/ }),
/* 4 */
/***/ (function(module, exports) {

// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
var global = module.exports = typeof window != 'undefined' && window.Math == Math
  ? window : typeof self != 'undefined' && self.Math == Math ? self : Function('return this')();
if(typeof __g == 'number')__g = global; // eslint-disable-line no-undef

/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

var anObject       = __webpack_require__(12)
  , IE8_DOM_DEFINE = __webpack_require__(17)
  , toPrimitive    = __webpack_require__(19)
  , dP             = Object.defineProperty;

exports.f = __webpack_require__(0) ? Object.defineProperty : function defineProperty(O, P, Attributes){
  anObject(O);
  P = toPrimitive(P, true);
  anObject(Attributes);
  if(IE8_DOM_DEFINE)try {
    return dP(O, P, Attributes);
  } catch(e){ /* empty */ }
  if('get' in Attributes || 'set' in Attributes)throw TypeError('Accessors not supported!');
  if('value' in Attributes)O[P] = Attributes.value;
  return O;
};

/***/ }),
/* 6 */
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),
/* 7 */
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _popup = __webpack_require__(25);

var _popup2 = _interopRequireDefault(_popup);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var newPopup = new _popup2.default({
    title: 'test标题',
    hasTopBar: false,
    content: '<p style="padding:10px">基础弹窗，多实例，可复用</p>'
});

baseNew.addEventListener('click', function () {
    newPopup.show();
});

disposable.addEventListener('click', function () {
    var popup1 = (0, _popup.popup)({
        title: '测试标题',
        content: '<p style="padding:10px">test 内容。一次性弹窗<a>再次弹窗</a></p>',
        beforeShow: function beforeShow(rElem) {
            rElem.querySelector('a').addEventListener('click', function () {

                (0, _popup.popup)({
                    title: '第二次标题',
                    content: '<p style="padding:10px">第二次弹窗<a>关闭第一次</a><p style="padding: 10px">多加点内容</p>',
                    beforeShow: function beforeShow(rElem) {
                        rElem.querySelector('a').addEventListener('click', function () {

                            if (this.innerHTML === '关闭现在') {
                                _popup.popup.close();
                            } else {
                                popup1.close();
                                this.innerHTML = '关闭现在';
                            }
                        });
                    }
                });
            });
        }
    });
});

var id = 0;
confirmbtn.addEventListener('click', function () {
    (0, _popup.confirmPopup)({
        title: '删除',
        des: '确认删除？(次数' + id++ + ')',
        confirm: function confirm() {
            console.log('确认触发');
        }
    });
});

/***/ }),
/* 9 */
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(20);
var $Object = __webpack_require__(2).Object;
module.exports = function defineProperty(it, key, desc){
  return $Object.defineProperty(it, key, desc);
};

/***/ }),
/* 11 */
/***/ (function(module, exports) {

module.exports = function(it){
  if(typeof it != 'function')throw TypeError(it + ' is not a function!');
  return it;
};

/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(1);
module.exports = function(it){
  if(!isObject(it))throw TypeError(it + ' is not an object!');
  return it;
};

/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

// optional / simple context binding
var aFunction = __webpack_require__(11);
module.exports = function(fn, that, length){
  aFunction(fn);
  if(that === undefined)return fn;
  switch(length){
    case 1: return function(a){
      return fn.call(that, a);
    };
    case 2: return function(a, b){
      return fn.call(that, a, b);
    };
    case 3: return function(a, b, c){
      return fn.call(that, a, b, c);
    };
  }
  return function(/* ...args */){
    return fn.apply(that, arguments);
  };
};

/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(1)
  , document = __webpack_require__(4).document
  // in old IE typeof document.createElement is 'object'
  , is = isObject(document) && isObject(document.createElement);
module.exports = function(it){
  return is ? document.createElement(it) : {};
};

/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

var global    = __webpack_require__(4)
  , core      = __webpack_require__(2)
  , ctx       = __webpack_require__(13)
  , hide      = __webpack_require__(16)
  , PROTOTYPE = 'prototype';

var $export = function(type, name, source){
  var IS_FORCED = type & $export.F
    , IS_GLOBAL = type & $export.G
    , IS_STATIC = type & $export.S
    , IS_PROTO  = type & $export.P
    , IS_BIND   = type & $export.B
    , IS_WRAP   = type & $export.W
    , exports   = IS_GLOBAL ? core : core[name] || (core[name] = {})
    , expProto  = exports[PROTOTYPE]
    , target    = IS_GLOBAL ? global : IS_STATIC ? global[name] : (global[name] || {})[PROTOTYPE]
    , key, own, out;
  if(IS_GLOBAL)source = name;
  for(key in source){
    // contains in native
    own = !IS_FORCED && target && target[key] !== undefined;
    if(own && key in exports)continue;
    // export native or passed
    out = own ? target[key] : source[key];
    // prevent global pollution for namespaces
    exports[key] = IS_GLOBAL && typeof target[key] != 'function' ? source[key]
    // bind timers to global for call from export context
    : IS_BIND && own ? ctx(out, global)
    // wrap global constructors for prevent change them in library
    : IS_WRAP && target[key] == out ? (function(C){
      var F = function(a, b, c){
        if(this instanceof C){
          switch(arguments.length){
            case 0: return new C;
            case 1: return new C(a);
            case 2: return new C(a, b);
          } return new C(a, b, c);
        } return C.apply(this, arguments);
      };
      F[PROTOTYPE] = C[PROTOTYPE];
      return F;
    // make static versions for prototype methods
    })(out) : IS_PROTO && typeof out == 'function' ? ctx(Function.call, out) : out;
    // export proto methods to core.%CONSTRUCTOR%.methods.%NAME%
    if(IS_PROTO){
      (exports.virtual || (exports.virtual = {}))[key] = out;
      // export proto methods to core.%CONSTRUCTOR%.prototype.%NAME%
      if(type & $export.R && expProto && !expProto[key])hide(expProto, key, out);
    }
  }
};
// type bitmap
$export.F = 1;   // forced
$export.G = 2;   // global
$export.S = 4;   // static
$export.P = 8;   // proto
$export.B = 16;  // bind
$export.W = 32;  // wrap
$export.U = 64;  // safe
$export.R = 128; // real proto method for `library` 
module.exports = $export;

/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

var dP         = __webpack_require__(5)
  , createDesc = __webpack_require__(18);
module.exports = __webpack_require__(0) ? function(object, key, value){
  return dP.f(object, key, createDesc(1, value));
} : function(object, key, value){
  object[key] = value;
  return object;
};

/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = !__webpack_require__(0) && !__webpack_require__(3)(function(){
  return Object.defineProperty(__webpack_require__(14)('div'), 'a', {get: function(){ return 7; }}).a != 7;
});

/***/ }),
/* 18 */
/***/ (function(module, exports) {

module.exports = function(bitmap, value){
  return {
    enumerable  : !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable    : !(bitmap & 4),
    value       : value
  };
};

/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

// 7.1.1 ToPrimitive(input [, PreferredType])
var isObject = __webpack_require__(1);
// instead of the ES6 spec version, we didn't implement @@toPrimitive case
// and the second argument - flag - preferred type is a string
module.exports = function(it, S){
  if(!isObject(it))return it;
  var fn, val;
  if(S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it)))return val;
  if(typeof (fn = it.valueOf) == 'function' && !isObject(val = fn.call(it)))return val;
  if(!S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it)))return val;
  throw TypeError("Can't convert object to primitive value");
};

/***/ }),
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

var $export = __webpack_require__(15);
// 19.1.2.4 / 15.2.3.6 Object.defineProperty(O, P, Attributes)
$export($export.S + $export.F * !__webpack_require__(0), 'Object', {defineProperty: __webpack_require__(5).f});

/***/ }),
/* 21 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = { "default": __webpack_require__(10), __esModule: true };

/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

exports.default = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _defineProperty = __webpack_require__(21);

var _defineProperty2 = _interopRequireDefault(_defineProperty);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      (0, _defineProperty2.default)(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

/***/ }),
/* 24 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = click;
function click(elem, fn) {

    function getAndroidVersion() {
        var v = void 0;
        var r = navigator.userAgent.match(/Android (\d.\d)/);
        v = r && r[1];

        getAndroidVersion = function getAndroidVersion() {
            return v;
        };

        return v;
    }

    if (getAndroidVersion() && getAndroidVersion() < 4.4 || /iPad|iPhone/.test(navigator.userAgent)) {
        exports.default = click = function click(elem, fn) {
            var touchcancel = void 0;

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
    } else {
        exports.default = click = function click(elem, fn) {
            elem.addEventListener('click', fn);
            return function () {
                elem.removeEventListener('click', fn);
            };
        };
    }

    click(elem, fn);
}

/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});

var _classCallCheck2 = __webpack_require__(22);

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = __webpack_require__(23);

var _createClass3 = _interopRequireDefault(_createClass2);

exports.popup = popup;
exports.confirmPopup = confirmPopup;

var _click = __webpack_require__(24);

var _click2 = _interopRequireDefault(_click);

__webpack_require__(9);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Popup = function () {
    function Popup() {
        var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
            _ref$title = _ref.title,
            title = _ref$title === undefined ? '' : _ref$title,
            _ref$content = _ref.content,
            content = _ref$content === undefined ? '' : _ref$content,
            _ref$outsideClose = _ref.outsideClose,
            outsideClose = _ref$outsideClose === undefined ? true : _ref$outsideClose,
            _ref$hasTopBar = _ref.hasTopBar,
            hasTopBar = _ref$hasTopBar === undefined ? true : _ref$hasTopBar,
            _ref$created = _ref.created,
            created = _ref$created === undefined ? function () {} : _ref$created,
            _ref$beforeShow = _ref.beforeShow,
            beforeShow = _ref$beforeShow === undefined ? function () {} : _ref$beforeShow,
            _ref$beforeClose = _ref.beforeClose,
            beforeClose = _ref$beforeClose === undefined ? function () {} : _ref$beforeClose,
            _ref$afterClose = _ref.afterClose,
            afterClose = _ref$afterClose === undefined ? function () {} : _ref$afterClose;

        (0, _classCallCheck3.default)(this, Popup);


        this.title = title;
        this.content = content;
        this.outsideClose = outsideClose;
        this.hasTopBar = hasTopBar;
        this.created = created;
        this.beforeShow = beforeShow;
        this.beforeClose = beforeClose;
        this.afterClose = afterClose;

        this.no = false;
    }

    (0, _createClass3.default)(Popup, [{
        key: 'init',
        value: function init() {
            var _this = this;

            this.init = function () {};

            var html = '<div class="full-page-popup">\n    <div class="fgp-bg"></div>\n    <div class="fgp-main">\n        <div class="fgp-bd">\n            ' + (this.hasTopBar ? '<div class="fgp-top-bar"><div class="tit">' + this.title + '</div><b class="close">✖</b></div>' : '') + '\n            <div class="fgp-cont">' + this.content + '</div>\n        </div>\n    </div>\n</div>';

            var template = document.createElement('div');
            template.innerHTML = html;

            this.ePopup = template.children[0];
            this.ePopupMain = this.ePopup.children[1];

            document.body.appendChild(this.ePopup);

            (0, _click2.default)(this.ePopupMain, function (e) {
                var classList = e.target.classList;
                if (classList.contains('close')) {

                    _this.close();
                } else if (_this.outsideClose && classList.contains('fgp-main')) {

                    _this.close();
                }
            });

            this.created();
        }
    }, {
        key: 'show',
        value: function show() {
            var _this2 = this;

            this.init();

            this.beforeShow(this.ePopupMain);

            setTimeout(function () {
                _this2.ePopup.classList.add('show');
            }, 0);
        }
    }, {
        key: 'close',
        value: function close() {
            var _this3 = this;

            if (this.no || this.beforeClose()) return;
            this.no = true;

            this.ePopup.classList.remove('show');
            setTimeout(function () {
                _this3.no = false;
                _this3.afterClose(_this3.ePopup);
            }, 300);
        }
    }]);
    return Popup;
}();

function popup(_ref2) {
    var title = _ref2.title,
        content = _ref2.content,
        _ref2$beforeShow = _ref2.beforeShow,
        beforeShow = _ref2$beforeShow === undefined ? function () {} : _ref2$beforeShow,
        _ref2$beforeClose = _ref2.beforeClose,
        beforeClose = _ref2$beforeClose === undefined ? function () {} : _ref2$beforeClose;


    var newPopup = new Popup({
        title: title,
        content: content,
        beforeShow: beforeShow,
        beforeClose: beforeClose,
        afterClose: function afterClose(rootElem) {
            rootElem.remove();
        }
    });

    newPopup.show();

    popup.close = function () {
        newPopup.close();
    };

    return newPopup;
}

popup.close = function () {};

function confirmPopup(_ref3) {
    var title = _ref3.title,
        des = _ref3.des,
        _ref3$confirm = _ref3.confirm,
        confirm = _ref3$confirm === undefined ? function () {} : _ref3$confirm,
        _ref3$cancel = _ref3.cancel,
        cancel = _ref3$cancel === undefined ? function () {} : _ref3$cancel;


    var popup = void 0,
        eTitle = void 0,
        eDes = void 0,
        gConfirm = confirm,
        gCancel = cancel;

    function init(rootElem) {
        init = function init() {};
        console.log('init');
        eTitle = rootElem.querySelector('.tit');
        eDes = rootElem.querySelector('.des');

        (0, _click2.default)(rootElem.querySelector('.btns'), function (e) {

            var classList = e.target.classList;
            if (classList.contains('sure-btn')) {
                gConfirm();
            } else if (classList.contains('cancel-btn')) {
                popup.close();
            }
        });
    }

    exports.confirmPopup = confirmPopup = function confirmPopup(_ref4) {
        var title = _ref4.title,
            des = _ref4.des,
            _ref4$confirm = _ref4.confirm,
            confirm = _ref4$confirm === undefined ? function () {} : _ref4$confirm,
            _ref4$cancel = _ref4.cancel,
            cancel = _ref4$cancel === undefined ? function () {} : _ref4$cancel;

        gConfirm = confirm;
        gCancel = cancel;

        eTitle.textContent = title;
        eDes.textContent = des;

        popup.show();
    };
    popup = new Popup({

        title: title,
        content: '<div class="confirm-box">\n<div class="des">' + des + '</div>\n<div class="btns">\n    <a class="button sure-btn" href="javascript:;">\u786E\u8BA4</a>\n    <a class="button cancel-btn" href="javascript:;">\u53D6\u6D88</a>\n</div>\n</div>',
        beforeShow: function beforeShow(rootElem) {
            init(rootElem);
        }

    });

    confirmPopup.close = function () {
        popup.close();
    };

    popup.show();
}

confirmPopup.close = function () {};

exports.default = Popup;

/***/ }),
/* 26 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(6);
__webpack_require__(7);
module.exports = __webpack_require__(8);


/***/ })
/******/ ]);