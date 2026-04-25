## h 函数对注册组件无效

**注：传字符串参数时才无效。**

之前直接 `h('el-button')` 即可。现在需要借助 `resolveComponent` 函数，像这样：`h(resolveComponent('el-button'))`
