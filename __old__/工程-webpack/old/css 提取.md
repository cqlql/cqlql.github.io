
[官方文档介绍](https://webpack.js.org/loaders/css-loader/#extract)


简单三步

```js
// 1
let ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
  plugins: [
    // 2
    new ExtractTextPlugin('css/[name].css'),
  ],
  module:{
    rules:[{
      test: /\.(css|pcss)$/,
      // 3
      use: ExtractTextPlugin.extract({
      
        // 超有用，不要漏了。
        // 解决某些地方没法提取问题
        // 比如异步 vue 单文件中 js(import) 方式导入的 css，外界的配置没法提取，又不能像 style 方式那样对待，最终无效。此方式便能解决
        fallback: 'style-loader',
        
        use: ['css-loader?sourceMap=true', 'postcss-loader?sourceMap=inline']
      })
    }]
  }
}
```

## 不提取

```js
module.exports = {
  module:{
    rules:[{
      test: /\.(css|pcss)$/,
      // 不提取
      use: ['style-loader','css-loader?sourceMap=true', 'postcss-loader?sourceMap=inline']
    }]
  }
}
```