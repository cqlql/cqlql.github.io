webpackJsonp([0,5],{

/***/ 13:
/***/ function(module, exports, __webpack_require__) {

var __vue_exports__, __vue_options__
var __vue_styles__ = {}

/* styles */
__webpack_require__(20)

/* script */
__vue_exports__ = __webpack_require__(21)

/* template */
var __vue_template__ = __webpack_require__(22)
__vue_options__ = __vue_exports__ = __vue_exports__ || {}
if (
  typeof __vue_exports__.default === "object" ||
  typeof __vue_exports__.default === "function"
) {
if (Object.keys(__vue_exports__).some(function (key) { return key !== "default" && key !== "__esModule" })) {console.error("named exports are not supported in *.vue files.")}
__vue_options__ = __vue_exports__ = __vue_exports__.default
}
if (typeof __vue_options__ === "function") {
  __vue_options__ = __vue_options__.options
}
__vue_options__.__file = "E:\\Dropbox\\github\\cqlql.github.io\\demo\\20170114_vue路由学习\\src\\foo.vue"
__vue_options__.render = __vue_template__.render
__vue_options__.staticRenderFns = __vue_template__.staticRenderFns

/* hot reload */
if (false) {(function () {
  var hotAPI = require("vue-loader/node_modules/vue-hot-reload-api")
  hotAPI.install(require("vue"), false)
  if (!hotAPI.compatible) return
  module.hot.accept()
  if (!module.hot.data) {
    hotAPI.createRecord("data-v-18140e26", __vue_options__)
  } else {
    hotAPI.reload("data-v-18140e26", __vue_options__)
  }
})()}
if (__vue_options__.functional) {console.error("[vue-loader] foo.vue: functional components are not supported and should be defined in plain js files using render functions.")}

module.exports = __vue_exports__


/***/ },

/***/ 19:
/***/ function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(2)();
// imports


// module
exports.push([module.i, "\nbody{\n}\n", ""]);

// exports


/***/ },

/***/ 20:
/***/ function(module, exports, __webpack_require__) {

// style-loader: Adds some css to the DOM by adding a <style> tag

// load the styles
var content = __webpack_require__(19);
if(typeof content === 'string') content = [[module.i, content, '']];
// add the styles to the DOM
var update = __webpack_require__(3)(content, {});
if(content.locals) module.exports = content.locals;
// Hot Module Replacement
if(false) {
	// When the styles change, update the <style> tags
	if(!content.locals) {
		module.hot.accept("!!./../../../../node_modules/.0.25.0@css-loader/index.js!./../../../../node_modules/.9.9.5@vue-loader/lib/style-rewriter.js?id=data-v-18140e26!./../../../../node_modules/.9.9.5@vue-loader/lib/selector.js?type=styles&index=0!./foo.vue", function() {
			var newContent = require("!!./../../../../node_modules/.0.25.0@css-loader/index.js!./../../../../node_modules/.9.9.5@vue-loader/lib/style-rewriter.js?id=data-v-18140e26!./../../../../node_modules/.9.9.5@vue-loader/lib/selector.js?type=styles&index=0!./foo.vue");
			if(typeof newContent === 'string') newContent = [[module.id, newContent, '']];
			update(newContent);
		});
	}
	// When the module is disposed, remove the <style> tags
	module.hot.dispose(function() { update(); });
}

/***/ },

/***/ 21:
/***/ function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = {
    data: function data() {
        return {
            msg: 'hello vue'
        };
    },

    components: {},
    beforeRouteEnter: function beforeRouteEnter(to, from, next) {
        console.log(to, from);
    },
    beforeRouteLeave: function beforeRouteLeave(to, from, next) {}
};

/***/ },

/***/ 22:
/***/ function(module, exports, __webpack_require__) {

module.exports={render:function (){var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;
  return _vm._m(0)
},staticRenderFns: [function (){var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;
  return _c('div', [_c('div', [_vm._v("foo++1")])])
}]}
if (false) {
  module.hot.accept()
  if (module.hot.data) {
     require("vue-loader/node_modules/vue-hot-reload-api").rerender("data-v-18140e26", module.exports)
  }
}

/***/ }

});