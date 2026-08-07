
依然可模块调用，非常适用cdn情况，或多个项目共享公共静态资源

```
// 此 chunk 不打包
// 左边调用名字，如 require('vue')；右边是库的全局变量
externals: {
    vue: 'Vue'
},
```

另外两个辅助插件，避免手动添加，独立项目情况用，不适用cdn

```
// 其实就是个拷贝插件
new CopyWebpackPlugin([
    { from: 'E:/_work/node_modules/vue/dist/vue.min.js', to: './vue.min.js'},
]),

// 指定包含资源
new HtmlWebpackIncludeAssetsPlugin({
    files: ['./single_v2.html'],
    assets: ['vue.min.js'],
    // 是增加到后面还是前面，true追加到后面
    append: false
}),
```