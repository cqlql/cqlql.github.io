[官方文档](https://router.vuejs.org/zh-cn/)

## 简单示例

```js
import Vue from "vue";
import VueRouter from "vue-router";

// 很久没用 router 写代码是，总是忘记这一步。。。
Vue.use(VueRouter);

const Foo = { template: "<div>foo</div>" };
const Bar = { template: "<div>bar</div>" };

const routes = [
  { path: "/foo", component: Foo },
  { path: "/bar", component: Bar },
];

const router = new VueRouter({
  routes,
});

/* eslint-disable no-new */
new Vue({
  el: "#app",
  router,
  // 根实例用可实现替换绑定的元素
  template: `<div>
    <h1>Hello App!</h1>
    <p>
      <!-- 使用 router-link 组件来导航. -->
      <!-- 通过传入 \`to\` 属性指定链接. -->
      <!-- <router-link> 默认会被渲染成一个 \`<a>\` 标签 -->
      <router-link to="/foo">Go to Foo</router-link>
      <router-link to="/bar">Go to Bar</router-link>
    </p>
    <!-- 路由出口 -->
    <!-- 路由匹配到的组件将渲染在这里 -->
    <router-view></router-view>
  </div></div>
`,
});
```

## 微信浏览器浏览历史支持带井号链接

左上角的返回箭头也支持浏览井号历史

所以能很好支持 vue-router
