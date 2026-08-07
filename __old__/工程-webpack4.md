

## 代码拆分
Since version 4 the `CommonsChunkPlugin` was removed in favor of `optimization.splitChunks` and `optimization.runtimeChunk` options. Here is how the new flow works.

https://webpack.js.org/plugins/split-chunks-plugin

## css 分离 使用 mini-css-extract-plugin

[mini-css-extract-plugin 文档](https://webpack.js.org/plugins/mini-css-extract-plugin)

## entry 也能指定文件夹

```js
entry: {
  // 将为 index.js 新建v3文件夹，
  'v3/index': ['./src/v3/index.pcss',"./src/v3/index.js"],
}
```

但自动生成的引用路径可能会多一层，所以直接使用output指定会更好

```js
output: {
  path: path.resolve(__dirname, "dist/v3"), // string
  filename: "[name].js",
},
```

## build 代码不压缩
方便检查编译代码

```js
let webpackConfig = {
  mode: 'none', // 不压缩代码
  output: {
    pathinfo: true // 模块标注路径信息
  }
}
```

## exclude include 同时用,exclude优先级更高

```js
{
  test: /\.js$/,
  include: [ 'E:/_work/template-vue/src' ],
  exclude: [ 'E:/_work/src/libs/iview-pro' ],       
  use: [ { loader: 'babel-loader', options: [Object] } ]
}
```

## webpack babel polyfill 开启按需兼容后 promise 依然报错问题

虽然已经按需 polyfill，但如果 src 中没使用 promise，但 node_modules 中有使用, 不支持 promise 的浏览器还是会报错，
比如动态 import() 就有对 promise 的使用，所以这里手动引入
当然，正式项目肯定会用 promise，所以这种情况可以忽略

```js
// 手动导入
import 'core-js/modules/es6.promise.js'
```