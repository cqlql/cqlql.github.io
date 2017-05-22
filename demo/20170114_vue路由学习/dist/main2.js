webpackJsonp([4,5],{

/***/ 17:
/***/ function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(__dirname) {

var _vue = __webpack_require__(1);

var _vue2 = _interopRequireDefault(_vue);

var _vueRouter = __webpack_require__(0);

var _vueRouter2 = _interopRequireDefault(_vueRouter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_vue2.default.use(_vueRouter2.default);

var Home = {
    template: '\n    <div class="home">\n      <h2>Home</h2>\n      <p>hello</p>\n    </div>\n  '
};

var Parent = {
    data: function data() {
        return {
            transitionName: 'slide-left'
        };
    },

    watch: {
        '$route': function $route(to, from) {
            var toDepth = to.path.split('/').length;
            var fromDepth = from.path.split('/').length;
            this.transitionName = toDepth < fromDepth ? 'slide-right' : 'slide-left';
        }
    },
    template: '\n    <div class="parent">\n      <h2>Parent</h2>\n      <transition :name="transitionName">\n        <router-view class="child-view"></router-view>\n      </transition>\n    </div>\n  '
};

var Default = { template: '<div class="default">default</div>' };
var Foo = { template: '<div class="foo">foo</div>' };
var Bar = { template: '<div class="bar">bar</div>' };

var router = new _vueRouter2.default({
    base: __dirname,
    routes: [{ path: '/', component: Home }, { path: '/parent', component: Parent,
        children: [{ path: '', component: Default }, { path: 'foo', component: Foo }, { path: 'bar', component: Bar }]
    }]
});

new _vue2.default({
    router: router,
    template: '\n    <div id="app">\n      <h1>Transitions</h1>\n      <ul>\n        <li><router-link to="/">/</router-link></li>\n        <li><router-link to="/parent">/parent</router-link></li>\n        <li><router-link to="/parent/foo">/parent/foo</router-link></li>\n        <li><router-link to="/parent/bar">/parent/bar</router-link></li>\n      </ul>\n      <transition name="fade" mode="out-in">\n        <router-view></router-view>\n      </transition>\n    </div>\n  '
}).$mount('#app');
/* WEBPACK VAR INJECTION */}.call(exports, "/"))

/***/ }

},[17]);