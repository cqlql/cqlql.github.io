

## webpack 代理 devServer.proxy 无法使用 easy-mock 问题解决

手动增加可访问的 cookie、host 请求头信息

```js
devServer: {
  contentBase: path.resolve(__dirname, 'dist'),
  host: '192.168.1.222',
  port: 3001,
  inline: true,
  hot: true,
  hotOnly: false,
  proxy: {
    "/Publisher": {
      target: "http://www.easy-mock.com/mock/59c46dbfe0dc663341b4084a/example",

      onProxyRes: function(proxyRes, req, res){
      },
      onProxyReq: function(proxyReq, req, res){
        proxyReq.setHeader('Cookie','Cookie:easy-mock_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI1OWM0NmRiZmUwZGM2NjMzNDFiNDA4NTIiLCJleHAiOjE1MDcyNTQ5NzUsImlkIjoiNTljNDZkYmZlMGRjNjYzMzQxYjQwODQ5IiwiaWF0IjoxNTA2MDQ1Mzc1fQ.45-Ow-W-lcq1oxIn-japLDd95lSAZMnnBuaCDhTZULA')
        proxyReq.setHeader('Host','www.easy-mock.com')
      }
    }
  }
}
```

