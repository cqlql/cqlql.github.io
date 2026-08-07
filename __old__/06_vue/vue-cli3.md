## 部分配置修改示例

```js
module.exports = {
  productionSourceMap: false,
  css: {
    extract: false,
    sourceMap: process.env.NODE_ENV !== 'production',
  },
  devServer: {
    proxy: {
      '/api': {
        target: 'http://192.168.1.183:8095',
        pathRewrite: {
          '^/api': '',
        },
      },
      '/mock': {
        target: `http://192.168.1.222:3003`,
        pathRewrite: {
          '^/mock': '',
        },
      },
      '/online': {
        target: 'https://api.shendupeiban.com',
        pathRewrite: {
          '^/online': '',
        },

        // 注意以下的自定义无法在浏览器端看到，因为是通过nodejs去请求的，而不是浏览器。所以只能在服务端看到

        // 允许服务端重定向
        followRedirects: true,
        // 重写 host。以 target 重写
        changeOrigin: true,
        // 直接修改 headers
        // headers: {
        //   Cookie: 'ASP.NET_SessionId=nwlyo2azpq3zhimw4vgz0fqo; .ASPXAUTH=',
        //   Host: '192.168.1.110:8787',
        //   Origin: 'http://192.168.1.110:8787',
        //   'Upgrade-Insecure-Requests': 1,
        //   'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'
        // }
      },
    },
  },
  chainWebpack: (config) => {
    // 去掉 eslint
    config.module.rules.delete('eslint')

    // url-loader css @
    config.resolve.alias.set('./@', path.resolve(__dirname, 'src'))

    // 修改环境变量
    config.plugin('define').tap((options) => {
      options[0]['process.env'].temp_data_handle = 'true'
      return options
    })
  },
}
```

## 一些问题

### babel.config.js 改动无效

删掉 `node_modules/.cache` 目录即可，看来是配置也被缓存了。。有点坑

```js
module.exports = {
  presets: [
    [
      '@vue/app',
      {
        useBuiltIns: false,
      },
    ],
  ],
}
```
