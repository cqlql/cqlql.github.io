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
/******/ ({

/***/ 0:
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__("NHnr9FP");


/***/ }),

/***/ "01/3CJY":
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__("fIDrEJd");
module.exports = function (it) {
  if (!isObject(it)) throw TypeError(it + ' is not an object!');
  return it;
};


/***/ }),

/***/ "065Xluj":
/***/ (function(module, exports, __webpack_require__) {

var $export = __webpack_require__("4fHpZR0");
// 19.1.2.4 / 15.2.3.6 Object.defineProperty(O, P, Attributes)
$export($export.S + $export.F * !__webpack_require__("zyEjo53"), 'Object', { defineProperty: __webpack_require__("UMAzxmK").f });


/***/ }),

/***/ "4fHpZR0":
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__("uyt/Pvt");
var core = __webpack_require__("mA0FS94");
var ctx = __webpack_require__("O6l937Z");
var hide = __webpack_require__("UobZWub");
var PROTOTYPE = 'prototype';

var $export = function (type, name, source) {
  var IS_FORCED = type & $export.F;
  var IS_GLOBAL = type & $export.G;
  var IS_STATIC = type & $export.S;
  var IS_PROTO = type & $export.P;
  var IS_BIND = type & $export.B;
  var IS_WRAP = type & $export.W;
  var exports = IS_GLOBAL ? core : core[name] || (core[name] = {});
  var expProto = exports[PROTOTYPE];
  var target = IS_GLOBAL ? global : IS_STATIC ? global[name] : (global[name] || {})[PROTOTYPE];
  var key, own, out;
  if (IS_GLOBAL) source = name;
  for (key in source) {
    // contains in native
    own = !IS_FORCED && target && target[key] !== undefined;
    if (own && key in exports) continue;
    // export native or passed
    out = own ? target[key] : source[key];
    // prevent global pollution for namespaces
    exports[key] = IS_GLOBAL && typeof target[key] != 'function' ? source[key]
    // bind timers to global for call from export context
    : IS_BIND && own ? ctx(out, global)
    // wrap global constructors for prevent change them in library
    : IS_WRAP && target[key] == out ? (function (C) {
      var F = function (a, b, c) {
        if (this instanceof C) {
          switch (arguments.length) {
            case 0: return new C();
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
    if (IS_PROTO) {
      (exports.virtual || (exports.virtual = {}))[key] = out;
      // export proto methods to core.%CONSTRUCTOR%.prototype.%NAME%
      if (type & $export.R && expProto && !expProto[key]) hide(expProto, key, out);
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

/***/ "5MyzPDD":
/***/ (function(module, exports, __webpack_require__) {

module.exports = !__webpack_require__("zyEjo53") && !__webpack_require__("n2RUbYI")(function () {
  return Object.defineProperty(__webpack_require__("xSNO2vI")('div'), 'a', { get: function () { return 7; } }).a != 7;
});


/***/ }),

/***/ "5s0rBII":
/***/ (function(module, exports) {

/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
// css base code, injected by the css-loader
module.exports = function(useSourceMap) {
	var list = [];

	// return the list of modules as css string
	list.toString = function toString() {
		return this.map(function (item) {
			var content = cssWithMappingToString(item, useSourceMap);
			if(item[2]) {
				return "@media " + item[2] + "{" + content + "}";
			} else {
				return content;
			}
		}).join("");
	};

	// import a list of modules into the list
	list.i = function(modules, mediaQuery) {
		if(typeof modules === "string")
			modules = [[null, modules, ""]];
		var alreadyImportedModules = {};
		for(var i = 0; i < this.length; i++) {
			var id = this[i][0];
			if(typeof id === "number")
				alreadyImportedModules[id] = true;
		}
		for(i = 0; i < modules.length; i++) {
			var item = modules[i];
			// skip already imported module
			// this implementation is not 100% perfect for weird media query combinations
			//  when a module is imported multiple times with different media queries.
			//  I hope this will never occur (Hey this way we have smaller bundles)
			if(typeof item[0] !== "number" || !alreadyImportedModules[item[0]]) {
				if(mediaQuery && !item[2]) {
					item[2] = mediaQuery;
				} else if(mediaQuery) {
					item[2] = "(" + item[2] + ") and (" + mediaQuery + ")";
				}
				list.push(item);
			}
		}
	};
	return list;
};

function cssWithMappingToString(item, useSourceMap) {
	var content = item[1] || '';
	var cssMapping = item[3];
	if (!cssMapping) {
		return content;
	}

	if (useSourceMap && typeof btoa === 'function') {
		var sourceMapping = toComment(cssMapping);
		var sourceURLs = cssMapping.sources.map(function (source) {
			return '/*# sourceURL=' + cssMapping.sourceRoot + source + ' */'
		});

		return [content].concat(sourceURLs).concat([sourceMapping]).join('\n');
	}

	return [content].join('\n');
}

// Adapted from convert-source-map (MIT)
function toComment(sourceMap) {
	// eslint-disable-next-line no-undef
	var base64 = btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap))));
	var data = 'sourceMappingURL=data:application/json;charset=utf-8;base64,' + base64;

	return '/*# ' + data + ' */';
}


/***/ }),

/***/ "ENb6ADg":
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__("065Xluj");
var $Object = __webpack_require__("mA0FS94").Object;
module.exports = function defineProperty(it, key, desc) {
  return $Object.defineProperty(it, key, desc);
};


/***/ }),

/***/ "EhjEjbK":
/***/ (function(module, exports, __webpack_require__) {

/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

var stylesInDom = {};

var	memoize = function (fn) {
	var memo;

	return function () {
		if (typeof memo === "undefined") memo = fn.apply(this, arguments);
		return memo;
	};
};

var isOldIE = memoize(function () {
	// Test for IE <= 9 as proposed by Browserhacks
	// @see http://browserhacks.com/#hack-e71d8692f65334173fee715c222cb805
	// Tests for existence of standard globals is to allow style-loader
	// to operate correctly into non-standard environments
	// @see https://github.com/webpack-contrib/style-loader/issues/177
	return window && document && document.all && !window.atob;
});

var getElement = (function (fn) {
	var memo = {};

	return function(selector) {
		if (typeof memo[selector] === "undefined") {
			var styleTarget = fn.call(this, selector);
			// Special case to return head of iframe instead of iframe itself
			if (styleTarget instanceof window.HTMLIFrameElement) {
				try {
					// This will throw an exception if access to iframe is blocked
					// due to cross-origin restrictions
					styleTarget = styleTarget.contentDocument.head;
				} catch(e) {
					styleTarget = null;
				}
			}
			memo[selector] = styleTarget;
		}
		return memo[selector]
	};
})(function (target) {
	return document.querySelector(target)
});

var singleton = null;
var	singletonCounter = 0;
var	stylesInsertedAtTop = [];

var	fixUrls = __webpack_require__("eslx7z2");

module.exports = function(list, options) {
	if (typeof DEBUG !== "undefined" && DEBUG) {
		if (typeof document !== "object") throw new Error("The style-loader cannot be used in a non-browser environment");
	}

	options = options || {};

	options.attrs = typeof options.attrs === "object" ? options.attrs : {};

	// Force single-tag solution on IE6-9, which has a hard limit on the # of <style>
	// tags it will allow on a page
	if (!options.singleton) options.singleton = isOldIE();

	// By default, add <style> tags to the <head> element
	if (!options.insertInto) options.insertInto = "head";

	// By default, add <style> tags to the bottom of the target
	if (!options.insertAt) options.insertAt = "bottom";

	var styles = listToStyles(list, options);

	addStylesToDom(styles, options);

	return function update (newList) {
		var mayRemove = [];

		for (var i = 0; i < styles.length; i++) {
			var item = styles[i];
			var domStyle = stylesInDom[item.id];

			domStyle.refs--;
			mayRemove.push(domStyle);
		}

		if(newList) {
			var newStyles = listToStyles(newList, options);
			addStylesToDom(newStyles, options);
		}

		for (var i = 0; i < mayRemove.length; i++) {
			var domStyle = mayRemove[i];

			if(domStyle.refs === 0) {
				for (var j = 0; j < domStyle.parts.length; j++) domStyle.parts[j]();

				delete stylesInDom[domStyle.id];
			}
		}
	};
};

function addStylesToDom (styles, options) {
	for (var i = 0; i < styles.length; i++) {
		var item = styles[i];
		var domStyle = stylesInDom[item.id];

		if(domStyle) {
			domStyle.refs++;

			for(var j = 0; j < domStyle.parts.length; j++) {
				domStyle.parts[j](item.parts[j]);
			}

			for(; j < item.parts.length; j++) {
				domStyle.parts.push(addStyle(item.parts[j], options));
			}
		} else {
			var parts = [];

			for(var j = 0; j < item.parts.length; j++) {
				parts.push(addStyle(item.parts[j], options));
			}

			stylesInDom[item.id] = {id: item.id, refs: 1, parts: parts};
		}
	}
}

function listToStyles (list, options) {
	var styles = [];
	var newStyles = {};

	for (var i = 0; i < list.length; i++) {
		var item = list[i];
		var id = options.base ? item[0] + options.base : item[0];
		var css = item[1];
		var media = item[2];
		var sourceMap = item[3];
		var part = {css: css, media: media, sourceMap: sourceMap};

		if(!newStyles[id]) styles.push(newStyles[id] = {id: id, parts: [part]});
		else newStyles[id].parts.push(part);
	}

	return styles;
}

function insertStyleElement (options, style) {
	var target = getElement(options.insertInto)

	if (!target) {
		throw new Error("Couldn't find a style target. This probably means that the value for the 'insertInto' parameter is invalid.");
	}

	var lastStyleElementInsertedAtTop = stylesInsertedAtTop[stylesInsertedAtTop.length - 1];

	if (options.insertAt === "top") {
		if (!lastStyleElementInsertedAtTop) {
			target.insertBefore(style, target.firstChild);
		} else if (lastStyleElementInsertedAtTop.nextSibling) {
			target.insertBefore(style, lastStyleElementInsertedAtTop.nextSibling);
		} else {
			target.appendChild(style);
		}
		stylesInsertedAtTop.push(style);
	} else if (options.insertAt === "bottom") {
		target.appendChild(style);
	} else if (typeof options.insertAt === "object" && options.insertAt.before) {
		var nextSibling = getElement(options.insertInto + " " + options.insertAt.before);
		target.insertBefore(style, nextSibling);
	} else {
		throw new Error("[Style Loader]\n\n Invalid value for parameter 'insertAt' ('options.insertAt') found.\n Must be 'top', 'bottom', or Object.\n (https://github.com/webpack-contrib/style-loader#insertat)\n");
	}
}

function removeStyleElement (style) {
	if (style.parentNode === null) return false;
	style.parentNode.removeChild(style);

	var idx = stylesInsertedAtTop.indexOf(style);
	if(idx >= 0) {
		stylesInsertedAtTop.splice(idx, 1);
	}
}

function createStyleElement (options) {
	var style = document.createElement("style");

	options.attrs.type = "text/css";

	addAttrs(style, options.attrs);
	insertStyleElement(options, style);

	return style;
}

function createLinkElement (options) {
	var link = document.createElement("link");

	options.attrs.type = "text/css";
	options.attrs.rel = "stylesheet";

	addAttrs(link, options.attrs);
	insertStyleElement(options, link);

	return link;
}

function addAttrs (el, attrs) {
	Object.keys(attrs).forEach(function (key) {
		el.setAttribute(key, attrs[key]);
	});
}

function addStyle (obj, options) {
	var style, update, remove, result;

	// If a transform function was defined, run it on the css
	if (options.transform && obj.css) {
	    result = options.transform(obj.css);

	    if (result) {
	    	// If transform returns a value, use that instead of the original css.
	    	// This allows running runtime transformations on the css.
	    	obj.css = result;
	    } else {
	    	// If the transform function returns a falsy value, don't add this css.
	    	// This allows conditional loading of css
	    	return function() {
	    		// noop
	    	};
	    }
	}

	if (options.singleton) {
		var styleIndex = singletonCounter++;

		style = singleton || (singleton = createStyleElement(options));

		update = applyToSingletonTag.bind(null, style, styleIndex, false);
		remove = applyToSingletonTag.bind(null, style, styleIndex, true);

	} else if (
		obj.sourceMap &&
		typeof URL === "function" &&
		typeof URL.createObjectURL === "function" &&
		typeof URL.revokeObjectURL === "function" &&
		typeof Blob === "function" &&
		typeof btoa === "function"
	) {
		style = createLinkElement(options);
		update = updateLink.bind(null, style, options);
		remove = function () {
			removeStyleElement(style);

			if(style.href) URL.revokeObjectURL(style.href);
		};
	} else {
		style = createStyleElement(options);
		update = applyToTag.bind(null, style);
		remove = function () {
			removeStyleElement(style);
		};
	}

	update(obj);

	return function updateStyle (newObj) {
		if (newObj) {
			if (
				newObj.css === obj.css &&
				newObj.media === obj.media &&
				newObj.sourceMap === obj.sourceMap
			) {
				return;
			}

			update(obj = newObj);
		} else {
			remove();
		}
	};
}

var replaceText = (function () {
	var textStore = [];

	return function (index, replacement) {
		textStore[index] = replacement;

		return textStore.filter(Boolean).join('\n');
	};
})();

function applyToSingletonTag (style, index, remove, obj) {
	var css = remove ? "" : obj.css;

	if (style.styleSheet) {
		style.styleSheet.cssText = replaceText(index, css);
	} else {
		var cssNode = document.createTextNode(css);
		var childNodes = style.childNodes;

		if (childNodes[index]) style.removeChild(childNodes[index]);

		if (childNodes.length) {
			style.insertBefore(cssNode, childNodes[index]);
		} else {
			style.appendChild(cssNode);
		}
	}
}

function applyToTag (style, obj) {
	var css = obj.css;
	var media = obj.media;

	if(media) {
		style.setAttribute("media", media)
	}

	if(style.styleSheet) {
		style.styleSheet.cssText = css;
	} else {
		while(style.firstChild) {
			style.removeChild(style.firstChild);
		}

		style.appendChild(document.createTextNode(css));
	}
}

function updateLink (link, options, obj) {
	var css = obj.css;
	var sourceMap = obj.sourceMap;

	/*
		If convertToAbsoluteUrls isn't defined, but sourcemaps are enabled
		and there is no publicPath defined then lets turn convertToAbsoluteUrls
		on by default.  Otherwise default to the convertToAbsoluteUrls option
		directly
	*/
	var autoFixUrls = options.convertToAbsoluteUrls === undefined && sourceMap;

	if (options.convertToAbsoluteUrls || autoFixUrls) {
		css = fixUrls(css);
	}

	if (sourceMap) {
		// http://stackoverflow.com/a/26603875
		css += "\n/*# sourceMappingURL=data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))) + " */";
	}

	var blob = new Blob([css], { type: "text/css" });

	var oldSrc = link.href;

	link.href = URL.createObjectURL(blob);

	if(oldSrc) URL.revokeObjectURL(oldSrc);
}


/***/ }),

/***/ "NHnr9FP":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _popup = __webpack_require__("iYMWwWb");

var _popup2 = _interopRequireDefault(_popup);

var _popupSingle = __webpack_require__("uRGtLni");

var _popupSingle2 = _interopRequireDefault(_popupSingle);

var _msgSimple = __webpack_require__("ZeQdGsu");

var _msgSimple2 = _interopRequireDefault(_msgSimple);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/// demo1
var newPopup = new _popup2.default({
  title: 'test标题',
  content: '<p style="padding:10px">基础弹窗，多实例，可复用基础弹窗</p>',
  keepLive: true,
  created: function created() {
    console.log('窗口元素被添加');
  }
}); /* eslint-disable */

document.getElementById('pop').addEventListener('click', function () {
  newPopup.show();
});

/// demo2
document.getElementById('popSingle').addEventListener('click', function () {
  (0, _popupSingle2.default)({
    content: '<p style="padding:10px">基础弹窗，多实例，可复用基础弹窗</p>'
  });
});

document.getElementById('msgSimple').addEventListener('click', function () {
  (0, _msgSimple2.default)('消息');
});

/***/ }),

/***/ "O6l937Z":
/***/ (function(module, exports, __webpack_require__) {

// optional / simple context binding
var aFunction = __webpack_require__("cfJgHTg");
module.exports = function (fn, that, length) {
  aFunction(fn);
  if (that === undefined) return fn;
  switch (length) {
    case 1: return function (a) {
      return fn.call(that, a);
    };
    case 2: return function (a, b) {
      return fn.call(that, a, b);
    };
    case 3: return function (a, b, c) {
      return fn.call(that, a, b, c);
    };
  }
  return function (/* ...args */) {
    return fn.apply(that, arguments);
  };
};


/***/ }),

/***/ "Ok72PYw":
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__("5s0rBII")(true);
// imports


// module
exports.push([module.i, ".msg-simple{position:fixed;left:50%;bottom:10%;-webkit-transform:translateX(-50%);transform:translateX(-50%);color:#fff;background-color:rgba(0,0,0,.6);padding:4px 10px;font-size:14px;line-height:1.2;max-width:86%;overflow:hidden;text-overflow:ellipsis;pointer-events:none;-webkit-transition:opacity .3s ease;transition:opacity .3s ease;z-index:9}.msg-simple.hide{opacity:0}", "", {"version":3,"sources":["E:/_work/projects-small-scale/projects/20171201_popup/src/modules/popup/msg-simple.css"],"names":[],"mappings":"AACA,YACE,eAAgB,AAChB,SAAU,AACV,WAAY,AACZ,mCAA4B,AAA5B,2BAA4B,AAE5B,WAAY,AACZ,gCAAqC,AACrC,iBAAkB,AAClB,eAAgB,AAChB,gBAAiB,AAEjB,cAAe,AACf,gBAAiB,AACjB,uBAAwB,AAExB,oBAAqB,AACrB,oCAA6B,AAA7B,4BAA6B,AAC7B,SAAW,CACZ,AAED,iBACE,SAAW,CACZ","file":"msg-simple.css","sourcesContent":["/* 简单消息 */\n.msg-simple {\n  position: fixed;\n  left: 50%;\n  bottom: 10%;\n  transform: translateX(-50%);\n\n  color: #fff;\n  background-color: rgba(0, 0, 0, 0.6);\n  padding: 4px 10px;\n  font-size: 14px;\n  line-height: 1.2;\n\n  max-width: 86%;\n  overflow: hidden;\n  text-overflow: ellipsis;\n\n  pointer-events: none;\n  transition:opacity 0.3s ease;\n  z-index: 9;\n}\n\n.msg-simple.hide {\n  opacity: 0;\n}\n\n"],"sourceRoot":""}]);

// exports


/***/ }),

/***/ "P1/s2ds":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

exports.default = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

/***/ }),

/***/ "UMAzxmK":
/***/ (function(module, exports, __webpack_require__) {

var anObject = __webpack_require__("01/3CJY");
var IE8_DOM_DEFINE = __webpack_require__("5MyzPDD");
var toPrimitive = __webpack_require__("sUInTBS");
var dP = Object.defineProperty;

exports.f = __webpack_require__("zyEjo53") ? Object.defineProperty : function defineProperty(O, P, Attributes) {
  anObject(O);
  P = toPrimitive(P, true);
  anObject(Attributes);
  if (IE8_DOM_DEFINE) try {
    return dP(O, P, Attributes);
  } catch (e) { /* empty */ }
  if ('get' in Attributes || 'set' in Attributes) throw TypeError('Accessors not supported!');
  if ('value' in Attributes) O[P] = Attributes.value;
  return O;
};


/***/ }),

/***/ "UobZWub":
/***/ (function(module, exports, __webpack_require__) {

var dP = __webpack_require__("UMAzxmK");
var createDesc = __webpack_require__("rb4lN77");
module.exports = __webpack_require__("zyEjo53") ? function (object, key, value) {
  return dP.f(object, key, createDesc(1, value));
} : function (object, key, value) {
  object[key] = value;
  return object;
};


/***/ }),

/***/ "ZeQdGsu":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = simpleMsg;

__webpack_require__("o65FtsA");

function simpleMsg(msgCont) {
  var el = document.createElement('div');
  el.className = 'msg-simple';
  el.textContent = msgCont;
  document.body.appendChild(el);
  var classList = el.classList;

  classList.add('hide');
  setTimeout(function () {
    classList.remove('hide');
    setTimeout(function () {
      classList.add('hide');
    }, 1200);
  }, 0);
}

/***/ }),

/***/ "azXBIjt":
/***/ (function(module, exports, __webpack_require__) {

// style-loader: Adds some css to the DOM by adding a <style> tag

// load the styles
var content = __webpack_require__("hn6NbO2");
if(typeof content === 'string') content = [[module.i, content, '']];
// Prepare cssTransformation
var transform;

var options = {"hmr":true}
options.transform = transform
// add the styles to the DOM
var update = __webpack_require__("EhjEjbK")(content, options);
if(content.locals) module.exports = content.locals;
// Hot Module Replacement
if(false) {
	// When the styles change, update the <style> tags
	if(!content.locals) {
		module.hot.accept("!!../../../../../node_modules/_css-loader@0.28.7@css-loader/index.js?sourceMap=true!../../../../../node_modules/_postcss-loader@2.0.8@postcss-loader/lib/index.js?sourceMap=inline!./popup.css", function() {
			var newContent = require("!!../../../../../node_modules/_css-loader@0.28.7@css-loader/index.js?sourceMap=true!../../../../../node_modules/_postcss-loader@2.0.8@postcss-loader/lib/index.js?sourceMap=inline!./popup.css");
			if(typeof newContent === 'string') newContent = [[module.id, newContent, '']];
			update(newContent);
		});
	}
	// When the module is disposed, remove the <style> tags
	module.hot.dispose(function() { update(); });
}

/***/ }),

/***/ "bOiCKno":
/***/ (function(module, exports, __webpack_require__) {

module.exports = { "default": __webpack_require__("ENb6ADg"), __esModule: true };

/***/ }),

/***/ "cfJgHTg":
/***/ (function(module, exports) {

module.exports = function (it) {
  if (typeof it != 'function') throw TypeError(it + ' is not a function!');
  return it;
};


/***/ }),

/***/ "ecxji9p":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _device = __webpack_require__("url4Zzm");

window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame || function (callback) {
  return window.setTimeout(callback, 1000 / 60);
}; /**
    * 公共的必须初始化的小功能 - 全端适用
    *
    * Created by cql on 2017/4/24.
    */

window.cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.clearTimeout;

/**
 * 原型扩展
 * */
if (!String.prototype.trim) {
  /* eslint-disable no-extend-native */
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
if (_device.isMobileIOS) {
  document.body.ontouchstart = function () {};
}

/***/ }),

/***/ "eslx7z2":
/***/ (function(module, exports) {


/**
 * When source maps are enabled, `style-loader` uses a link element with a data-uri to
 * embed the css on the page. This breaks all relative urls because now they are relative to a
 * bundle instead of the current page.
 *
 * One solution is to only use full urls, but that may be impossible.
 *
 * Instead, this function "fixes" the relative urls to be absolute according to the current page location.
 *
 * A rudimentary test suite is located at `test/fixUrls.js` and can be run via the `npm test` command.
 *
 */

module.exports = function (css) {
  // get current location
  var location = typeof window !== "undefined" && window.location;

  if (!location) {
    throw new Error("fixUrls requires window.location");
  }

	// blank or null?
	if (!css || typeof css !== "string") {
	  return css;
  }

  var baseUrl = location.protocol + "//" + location.host;
  var currentDir = baseUrl + location.pathname.replace(/\/[^\/]*$/, "/");

	// convert each url(...)
	/*
	This regular expression is just a way to recursively match brackets within
	a string.

	 /url\s*\(  = Match on the word "url" with any whitespace after it and then a parens
	   (  = Start a capturing group
	     (?:  = Start a non-capturing group
	         [^)(]  = Match anything that isn't a parentheses
	         |  = OR
	         \(  = Match a start parentheses
	             (?:  = Start another non-capturing groups
	                 [^)(]+  = Match anything that isn't a parentheses
	                 |  = OR
	                 \(  = Match a start parentheses
	                     [^)(]*  = Match anything that isn't a parentheses
	                 \)  = Match a end parentheses
	             )  = End Group
              *\) = Match anything and then a close parens
          )  = Close non-capturing group
          *  = Match anything
       )  = Close capturing group
	 \)  = Match a close parens

	 /gi  = Get all matches, not the first.  Be case insensitive.
	 */
	var fixedCss = css.replace(/url\s*\(((?:[^)(]|\((?:[^)(]+|\([^)(]*\))*\))*)\)/gi, function(fullMatch, origUrl) {
		// strip quotes (if they exist)
		var unquotedOrigUrl = origUrl
			.trim()
			.replace(/^"(.*)"$/, function(o, $1){ return $1; })
			.replace(/^'(.*)'$/, function(o, $1){ return $1; });

		// already a full url? no change
		if (/^(#|data:|http:\/\/|https:\/\/|file:\/\/\/)/i.test(unquotedOrigUrl)) {
		  return fullMatch;
		}

		// convert the url to a full url
		var newUrl;

		if (unquotedOrigUrl.indexOf("//") === 0) {
		  	//TODO: should we add protocol?
			newUrl = unquotedOrigUrl;
		} else if (unquotedOrigUrl.indexOf("/") === 0) {
			// path should be relative to the base url
			newUrl = baseUrl + unquotedOrigUrl; // already starts with '/'
		} else {
			// path should be relative to current directory
			newUrl = currentDir + unquotedOrigUrl.replace(/^\.\//, ""); // Strip leading './'
		}

		// send back the fixed url(...)
		return "url(" + JSON.stringify(newUrl) + ")";
	});

	// send back the fixed css
	return fixedCss;
};


/***/ }),

/***/ "fIDrEJd":
/***/ (function(module, exports) {

module.exports = function (it) {
  return typeof it === 'object' ? it !== null : typeof it === 'function';
};


/***/ }),

/***/ "fQEH7ev":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _defineProperty = __webpack_require__("bOiCKno");

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

/***/ "hn6NbO2":
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__("5s0rBII")(true);
// imports


// module
exports.push([module.i, ".popup-full-page{position:fixed;top:0;left:0;right:0;bottom:0;z-index:8}.popup-full-page .pfg-bg{background-color:#000;opacity:.4}.popup-full-page .pfg-bg,.popup-full-page .pfg-main{position:absolute;top:0;left:0;right:0;bottom:0}.popup-full-page .pfg-bd{position:absolute;top:50%;left:50%;background-color:#fff;-webkit-transform:translate(-50%,-50%);transform:translate(-50%,-50%);max-width:100%;max-height:80%;overflow:auto;-webkit-box-shadow:0 0 5px #525252;box-shadow:0 0 5px #525252}.popup-full-page .pfg-top-bar{height:28px;background-color:#f1f1f1;position:relative}.popup-full-page .pfg-top-bar .tit{padding:4px 0 0 6px;font-size:16px}.popup-full-page .pfg-top-bar .close{position:absolute;right:0;top:0;height:100%;width:28px;text-align:center;font-size:20px;line-height:1.2;cursor:pointer}.popup-full-page .pfg-top-bar .close:active,.popup-full-page .pfg-top-bar .close:hover{background-color:#f64c59;color:#fff}.popup-full-page.anime-active .pfg-bg,.popup-full-page.anime-active .pfg-main{-webkit-transition:.3s ease;transition:.3s ease;-webkit-transition-property:opacity,-webkit-transform;transition-property:opacity,-webkit-transform;transition-property:opacity,transform;transition-property:opacity,transform,-webkit-transform}.popup-full-page.hide .pfg-bg{opacity:0}.popup-full-page.hide .pfg-main{opacity:0;-webkit-transform:scale(.8);transform:scale(.8)}.popup-full-page.none{display:none}", "", {"version":3,"sources":["E:/_work/projects-small-scale/projects/20171201_popup/src/modules/popup/popup.css"],"names":[],"mappings":"AAAA,iBAEE,eAAgB,AAChB,MAAO,AACP,OAAQ,AACR,QAAS,AACT,SAAU,AACV,SAAW,CA+EZ,AA7EC,yBAME,sBAAuB,AACvB,UAAY,CACb,AACD,oDARE,kBAAmB,AACnB,MAAO,AACP,OAAQ,AACR,QAAS,AACT,QAAU,CAUX,AAED,yBACE,kBAAmB,AACnB,QAAS,AACT,SAAU,AACV,sBAAuB,AACvB,uCAAgC,AAAhC,+BAAgC,AAChC,eAAgB,AAChB,eAAgB,AAChB,cAAe,AACf,mCAA4B,AAA5B,0BAA4B,CAC7B,AAED,8BACE,YAAa,AACb,yBAA0B,AAC1B,iBAAmB,CAwBpB,AAtBC,mCACE,oBAAqB,AACrB,cAAgB,CACjB,AAED,qCACE,kBAAmB,AACnB,QAAS,AACT,MAAO,AACP,YAAa,AACb,WAAY,AACZ,kBAAmB,AACnB,eAAgB,AAChB,gBAAiB,AAEjB,cAAgB,CAMjB,AAJC,uFACE,yBAA0B,AAC1B,UAAY,CACb,AAIH,8EAEE,4BAAsB,AAAtB,oBAAsB,AACtB,sDAAuC,AAAvC,8CAAuC,AAAvC,sCAAuC,AAAvC,uDAAuC,CACxC,AAGD,8BACE,SAAW,CACZ,AACD,gCACE,UAAW,AACX,4BAAyB,AAAzB,mBAAyB,CAC1B,AAEH,sBACE,YAAc,CACf","file":"popup.css","sourcesContent":[".popup-full-page {\n\n  position: fixed;\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  z-index: 8;\n\n  .pfg-bg {\n    position: absolute;\n    top: 0;\n    left: 0;\n    right: 0;\n    bottom: 0;\n    background-color: #000;\n    opacity: .4;\n  }\n  .pfg-main {\n    position: absolute;\n    top: 0;\n    left: 0;\n    right: 0;\n    bottom: 0;\n  }\n\n  .pfg-bd {\n    position: absolute;\n    top: 50%;\n    left: 50%;\n    background-color: #fff;\n    transform: translate(-50%,-50%);\n    max-width: 100%;\n    max-height: 80%;\n    overflow: auto;\n    box-shadow: 0 0 5px #525252;\n  }\n\n  .pfg-top-bar {\n    height: 28px;\n    background-color: #f1f1f1;\n    position: relative;\n\n    .tit {\n      padding: 4px 0 0 6px;\n      font-size: 16px;\n    }\n\n    .close {\n      position: absolute;\n      right: 0;\n      top: 0;\n      height: 100%;\n      width: 28px;\n      text-align: center;\n      font-size: 20px;\n      line-height: 1.2;\n\n      cursor: pointer;\n\n      &:active, &:hover {\n        background-color: #f64c59;\n        color: #fff;\n      }\n    }\n  }\n  &.anime-active{\n    .pfg-bg,\n    .pfg-main {\n      transition: 0.3s ease;\n      transition-property: opacity,transform;\n    }\n  }\n  &.hide {\n    .pfg-bg {\n      opacity: 0;\n    }\n    .pfg-main {\n      opacity: 0;\n      transform: scale(.8, .8);\n    }\n  }\n  &.none {\n    display: none;\n  }\n\n}\n"],"sourceRoot":""}]);

// exports


/***/ }),

/***/ "iYMWwWb":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = __webpack_require__("P1/s2ds");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = __webpack_require__("fQEH7ev");

var _createClass3 = _interopRequireDefault(_createClass2);

__webpack_require__("azXBIjt");

__webpack_require__("ecxji9p");

var _click = __webpack_require__("y75VF3y");

var _click2 = _interopRequireDefault(_click);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 *
 * @param outsideClose 点背景关闭。默认开启
 * @param beforeClose 通过 return false 可阻止关闭
 * @param keepLive 是否缓存
 * */
var Popup = function () {
  function Popup() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$title = _ref.title,
        title = _ref$title === undefined ? '' : _ref$title,
        _ref$content = _ref.content,
        content = _ref$content === undefined ? '' : _ref$content,
        width = _ref.width,
        _ref$outsideClose = _ref.outsideClose,
        outsideClose = _ref$outsideClose === undefined ? true : _ref$outsideClose,
        hasTopBar = _ref.hasTopBar,
        keepLive = _ref.keepLive,
        _ref$created = _ref.created,
        created = _ref$created === undefined ? function () {} : _ref$created,
        _ref$beforeClose = _ref.beforeClose,
        beforeClose = _ref$beforeClose === undefined ? function () {} : _ref$beforeClose;

    (0, _classCallCheck3.default)(this, Popup);

    this.title = title;
    this.content = content;
    this.outsideClose = outsideClose;
    this.width = width;
    this.hasTopBar = hasTopBar;
    this.keepLive = keepLive;
    this.created = created; // 此处可绑定 vue 实例。元素被添加到文档中时调用
    // this.beforeShow = beforeShow
    this.beforeClose = beforeClose;
    // this.afterClose = afterClose

    this.elemRoot = null; // 根元素
    this.elemMain = null; // 居中内容的上一层
    this.elemCont = null; // 内容层，可控制窗口宽度
    this.closing = false; // 禁止操作 开关。关闭动画进行中标识
    this.isLive = false; // 是否被缓存
  }

  (0, _createClass3.default)(Popup, [{
    key: 'init',
    value: function init() {
      var _this = this;

      var width = this.width;

      var html = '<div class="popup-full-page none hide" style="' + (width ? width + 'px' : 'auto') + '">\n    <div class="pfg-bg"></div>\n    <div class="pfg-main">\n        <div class="pfg-bd">\n            ' + (this.hasTopBar ? '<div class="pfg-top-bar"><div class="tit">' + this.title + '</div><b class="close">✖</b></div>' : '') + '\n            <div class="pfg-cont">' + this.content + '</div>\n        </div>\n    </div>\n</div>';

      var template = document.createElement('div');
      template.innerHTML = html;

      this.elemRoot = template.children[0];
      this.elemMain = this.elemRoot.children[1];
      this.elemCont = this.elemMain.children[0];

      document.body.appendChild(this.elemRoot);

      // 关闭处理
      (0, _click2.default)(this.elemMain, function (e) {
        var classList = e.target.classList;
        if (classList.contains('close')) {
          // 关闭按钮关闭
          _this.close();
        } else if (_this.outsideClose && classList.contains('pfg-main')) {
          // 点外面关闭
          _this.close();
        }
      });
      this.created();
    }
  }, {
    key: 'show',
    value: function show() {
      if (this.isLive === false) this.init();
      this.isLive = true;

      this.animeEnter();
    }
  }, {
    key: 'close',
    value: function close() {
      var _this2 = this;

      if (this.closing || this.beforeClose()) return;
      this.closing = true;

      this.animeLeave(function () {
        _this2.closing = false;
        if (!_this2.keepLive) {
          _this2.elemRoot.remove();
          _this2.isLive = false;
        }
      });
    }
  }, {
    key: 'animeEnter',
    value: function animeEnter() {
      var _this3 = this;

      var elemRoot = this.elemRoot;
      var classList = elemRoot.classList;

      classList.remove('none');
      setTimeout(function () {
        classList.add('anime-active');
        classList.remove('hide');
        _this3.bindAnimeEnd(elemRoot, function () {
          classList.remove('anime-active');
        });
      }, 0);
    }
  }, {
    key: 'animeLeave',
    value: function animeLeave(cb) {
      var elemRoot = this.elemRoot;
      var classList = elemRoot.classList;

      classList.add('anime-active');
      classList.add('hide');
      this.bindAnimeEnd(elemRoot, function () {
        classList.remove('anime-active');
        classList.add('none');
        cb();
      });
    }
  }, {
    key: 'bindAnimeEnd',
    value: function bindAnimeEnd(elem, cb) {
      var transitionend = function transitionend() {
        elem.removeEventListener('transitionend', transitionend);
        elem.removeEventListener('webkitTransitionEnd', transitionend);
        cb();
      };
      console.log(elem);
      elem.addEventListener('transitionend', transitionend);
      elem.addEventListener('webkitTransitionEnd', transitionend);
    }
  }]);
  return Popup;
}();

exports.default = Popup;

/***/ }),

/***/ "mA0FS94":
/***/ (function(module, exports) {

var core = module.exports = { version: '2.5.1' };
if (typeof __e == 'number') __e = core; // eslint-disable-line no-undef


/***/ }),

/***/ "n2RUbYI":
/***/ (function(module, exports) {

module.exports = function (exec) {
  try {
    return !!exec();
  } catch (e) {
    return true;
  }
};


/***/ }),

/***/ "o65FtsA":
/***/ (function(module, exports, __webpack_require__) {

// style-loader: Adds some css to the DOM by adding a <style> tag

// load the styles
var content = __webpack_require__("Ok72PYw");
if(typeof content === 'string') content = [[module.i, content, '']];
// Prepare cssTransformation
var transform;

var options = {"hmr":true}
options.transform = transform
// add the styles to the DOM
var update = __webpack_require__("EhjEjbK")(content, options);
if(content.locals) module.exports = content.locals;
// Hot Module Replacement
if(false) {
	// When the styles change, update the <style> tags
	if(!content.locals) {
		module.hot.accept("!!../../../../../node_modules/_css-loader@0.28.7@css-loader/index.js?sourceMap=true!../../../../../node_modules/_postcss-loader@2.0.8@postcss-loader/lib/index.js?sourceMap=inline!./msg-simple.css", function() {
			var newContent = require("!!../../../../../node_modules/_css-loader@0.28.7@css-loader/index.js?sourceMap=true!../../../../../node_modules/_postcss-loader@2.0.8@postcss-loader/lib/index.js?sourceMap=inline!./msg-simple.css");
			if(typeof newContent === 'string') newContent = [[module.id, newContent, '']];
			update(newContent);
		});
	}
	// When the module is disposed, remove the <style> tags
	module.hot.dispose(function() { update(); });
}

/***/ }),

/***/ "rb4lN77":
/***/ (function(module, exports) {

module.exports = function (bitmap, value) {
  return {
    enumerable: !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable: !(bitmap & 4),
    value: value
  };
};


/***/ }),

/***/ "sUInTBS":
/***/ (function(module, exports, __webpack_require__) {

// 7.1.1 ToPrimitive(input [, PreferredType])
var isObject = __webpack_require__("fIDrEJd");
// instead of the ES6 spec version, we didn't implement @@toPrimitive case
// and the second argument - flag - preferred type is a string
module.exports = function (it, S) {
  if (!isObject(it)) return it;
  var fn, val;
  if (S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it))) return val;
  if (typeof (fn = it.valueOf) == 'function' && !isObject(val = fn.call(it))) return val;
  if (!S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it))) return val;
  throw TypeError("Can't convert object to primitive value");
};


/***/ }),

/***/ "uRGtLni":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _popup = __webpack_require__("iYMWwWb");

var _popup2 = _interopRequireDefault(_popup);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function popup(_ref) {
  var title = _ref.title,
      width = _ref.width,
      content = _ref.content,
      hasTopBar = _ref.hasTopBar,
      beforeClose = _ref.beforeClose;

  var newPopup = new _popup2.default({
    title: title,
    width: width,
    content: content,
    hasTopBar: hasTopBar,
    beforeClose: beforeClose
  });

  newPopup.show();

  popup.close = function () {
    newPopup.close();
  };

  return newPopup;
}

// 避免还没调用过弹窗，此时弹窗未初始首先调用close报错
/**
 * 弹窗单实例
 * */

popup.close = function () {};

exports.default = popup;

/***/ }),

/***/ "url4Zzm":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getAndroidVersion = getAndroidVersion;
/**
 * Created by cql on 2017/3/14.
 */

var isIOS = exports.isIOS = navigator.appVersion.indexOf('Mac OS') > -1;
var isMobileIOS = exports.isMobileIOS = /iPad|iPhone/.test(navigator.userAgent);
var isAndroid = exports.isAndroid = /Android/.test(navigator.userAgent);
var isWX = exports.isWX = /micromessenger/i.test(navigator.userAgent);

/**
 * android 版本获取
 *
 * @return {string|null} 返会此格式的'4.4'字符串 | 非android设备返会null
 * */
var androidVersion = void 0;
function getAndroidVersion() {
  if (androidVersion === undefined) {
    var r = navigator.userAgent.match(/Android (\d.\d)/);
    androidVersion = r && r[1];
    return androidVersion;
  }
  return androidVersion;
}

/***/ }),

/***/ "uyt/Pvt":
/***/ (function(module, exports) {

// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
var global = module.exports = typeof window != 'undefined' && window.Math == Math
  ? window : typeof self != 'undefined' && self.Math == Math ? self
  // eslint-disable-next-line no-new-func
  : Function('return this')();
if (typeof __g == 'number') __g = global; // eslint-disable-line no-undef


/***/ }),

/***/ "xSNO2vI":
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__("fIDrEJd");
var document = __webpack_require__("uyt/Pvt").document;
// typeof document.createElement is 'object' in old IE
var is = isObject(document) && isObject(document.createElement);
module.exports = function (it) {
  return is ? document.createElement(it) : {};
};


/***/ }),

/***/ "y75VF3y":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = click;
/*
 * click
 * pc+移动端都适用。 对移动端有优化
 * 兼容性：ie9+
 * */
/* eslint-disable */
function click(elem, fn) {
  // 鉴于华为手机的奇葩性质，Android 7 依然click高亮。。。
  if (/Android|iPad|iPhone/.test(navigator.userAgent)) {

    // document.addEventListener('click', e => {
    //   let {target} = e
    //   // 解决 a 标签点击跳转延迟
    //   if (target.tagName === 'A') {
    //     let {href} = target
    //     if (href) {
    //       location.href = href
    //       e.preventDefault()
    //     }
    //   }
    // })
    console.log(123);
    exports.default = click = function click(elem, fn) {
      var touchdown = void 0;
      var touchcancel = void 0;

      elem.addEventListener('touchstart', touchstart, true);
      elem.addEventListener('touchmove', touchmove, true);
      elem.addEventListener('touchend', touchend, true);

      function touchend(e) {
        if (touchcancel) return;
        if (touchdown) fn.call(this, e);
        touchdown = touchcancel = false;
      }

      function touchstart() {
        touchdown = true;
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

  return click(elem, fn);
}

/***/ }),

/***/ "zyEjo53":
/***/ (function(module, exports, __webpack_require__) {

// Thank's IE8 for his funny defineProperty
module.exports = !__webpack_require__("n2RUbYI")(function () {
  return Object.defineProperty({}, 'a', { get: function () { return 7; } }).a != 7;
});


/***/ })

/******/ });