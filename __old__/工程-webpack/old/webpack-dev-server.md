
## 代理

开发用。实现无需本机部署服务端环境，使用其他服务端接口


```
devServer: {
  proxy: {
    "/note": {
      // /note 相当于请求 http://192.168.1.222:8800/note
      target: "http://192.168.1.222:8800"
      
      // 使用 pathRewrite 后： /note 相当于请求 http://192.168.1.222:8800
      pathRewrite: {"^/note" : ""},
      
      // 设置Host头，部分特殊服务器情况使用
      onProxyReq: function(proxyReq, req, res){
          proxyReq.setHeader('Host','parent.shendupeiban.com')
      }
    }
  }
}

```

## Node API

webpack.config.js 必须根目录

```
require('webpack-dev-server/bin/webpack-dev-server');

```