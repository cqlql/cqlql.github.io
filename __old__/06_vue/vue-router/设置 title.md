
vue router 设置 title

```js
// 路由全局钩子
router.beforeEach((to, from, next) => {
  document.title = to.meta.title
  next()
})


// 路由定义
{
    path: '',
    component: Home,
    name: 'home',
    meta: {title: 'Home'}
}
```