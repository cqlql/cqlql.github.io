
## 1 [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware) 需与 [webpack-hot-middleware](https://github.com/glenjamin/webpack-hot-middleware) 配合才会实现监听更改后刷新

## 2 每个 entry 还需导入 `webpack-hot-middleware/client?reload=true` 才能刷新

`reload=true` 表示无法热替换则强制刷新浏览器

```js
    entry:{
      page1: ['webpack-hot-middleware/client?reload=true',"./src/page1.js"],
      page2: ['webpack-hot-middleware/client?reload=true',"./src/page2.js"]
    },
    
```



## 3 热替换实现还需每个js文件加入类似如下代码

```js
// page1.js

if(module.hot) {
  module.hot.accept();
}

```

## 4 html 文件的更改刷新还需借助 eventsource-polyfill

`webpack-hot-middleware/client` 中有对 eventsource-polyfill 的调用。[官方也有说明](https://www.npmjs.com/package/webpack-hot-middleware#use-on-browsers-without-eventsource)

eventsource-polyfill 实现客户端接受服务端推送的消息

client 导入，即 entry 中配置，此处包含第2点

```js
require('eventsource-polyfill')
var hotClient = require('webpack-hot-middleware/client?noInfo=true&reload=true')

hotClient.subscribe(function (event) {
  if (event.action === 'reload') {
    window.location.reload()
  }
})
```

server：服务端通知客户端刷新

```js
compiler.plugin('compilation', function (compilation) {
  compilation.plugin('html-webpack-plugin-after-emit', function (data, cb) {
    hotMiddleware.publish({ action: 'reload' })
    cb()
  })
})

```

## 附上配置代码

```js
// dev-client.js

require('eventsource-polyfill')
var hotClient = require('webpack-hot-middleware/client?noInfo=true&reload=true')

hotClient.subscribe(function (event) {
  if (event.action === 'reload') {
    window.location.reload()
  }
})

```

```
// dev-server.js

var express = require('express')
var path = require('path')

var webpack = require('webpack')

var webpackConfig = require('./webpack.config')()

Object.keys(webpackConfig.entry).forEach(function (name) {
  webpackConfig.entry[name] = ['./dev-client'].concat(webpackConfig.entry[name])
})

var app = express()
var compiler = webpack(webpackConfig)

var devMiddleware = require('webpack-dev-middleware')(compiler, {
  publicPath: webpackConfig.output.publicPath,
  noInfo: true,
  stats: {
    colors: true
  },
})

var hotMiddleware = require('webpack-hot-middleware')(compiler)

compiler.plugin('compilation', function (compilation) {
  compilation.plugin('html-webpack-plugin-after-emit', function (data, cb) {
    hotMiddleware.publish({ action: 'reload' })
    cb()
  })
});

app.use(devMiddleware)

app.use(hotMiddleware)

app.use(express.static(path.join(__dirname, 'dist')));

var server = app.listen(8080)

```