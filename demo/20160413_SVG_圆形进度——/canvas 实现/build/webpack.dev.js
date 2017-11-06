let path = require('path');
let webpack = require('webpack');
let HtmlWebpackPlugin = require('html-webpack-plugin');
let getIPAdress = require('./get-ip-adress');
function resolve(t) {
  return path.resolve(__dirname, t)
}
module.exports = {
  entry: {
    main: ["./build/dev-client.js","./src/js/report.js"]
  },

  output: {
    path: resolve('../dist'),
    pathinfo: true,
    filename: "js/[name].[hash:7].js",
    chunkFilename: 'js/[name].bundle.[hash:7].js',
  },

  // stats: "none",
  stats: {
    // 增加资源信息
    assets: true,
    // 增加子级的信息
    children: false,
    // 增加包信息（设置为 `false` 能允许较少的冗长输出）
    chunks: false,
    // 将内置模块信息增加到包信息
    chunkModules: false,
    // 增加包 和 包合并 的来源信息
    chunkOrigins: false,
    // `webpack --colors` 等同于
    colors: true,
    // 增加错误信息
    errors: true,
    // 增加错误的详细信息（就像解析日志一样）
    errorDetails: true,
    // 增加编译的哈希值
    hash: false,
    // 增加内置的模块信息
    modules: false,
    publicPath: true,
    // 增加提示
    warnings: true,
  },

  devtool: 'eval',

  plugins: [
    new HtmlWebpackPlugin({
      filename: './report.html',
      template: './src/report.html',
      chunks: ['main']
    })
  ],

module: {
  //加载器配置
  rules: [
    {
      test: /\.(js|vue)$/,
      loader: 'eslint-loader',
      enforce: 'pre',
      include: [resolve('../src'), resolve('../test')],
      options: {
        formatter: require('eslint-friendly-formatter')
      }
    },
    {
      test: /\.(css)$/,
      use: [
        'style-loader',
        {
          loader: 'css-loader',
          options: {
            sourceMap: true
          }
        },
        {
          loader: 'postcss-loader',
          options: {
            config: {
              path: './postcss.config.js'
            },
            sourceMap: 'inline'
          }
        },
      ],
    }
  ]
},

  resolve: {
    extensions: ['.js', '.vue', '.json'],
    alias: {
      'vue$': 'vue/dist/vue.esm.js',
      // '@': resolve('src'),
    }
  },

devServer: {
  contentBase: resolve('../dist'),
  compress: true,
  // host: '192.168.1.222',
  host: getIPAdress(),
  port: 3001,
  // openPage: 'http://192.168.1.222',
  inline: true,
  // hot: true,
  hotOnly: false,
  // open: true,
  // noInfo: true
  proxy: [{
    context: ["/AgentArea", "/Publisher"],
    // target: "http://o18416y562.iok.la",
    target: "http://192.168.1.194",
    // target: "http://192.168.1.222:3003",
    // target: "http://www.easy-mock.com/mock/59c46dbfe0dc663341b4084a/example",

    // /note 相当于 http://192.168.1.222:8800/note

    // 使用 pathRewrite 后： /note 相当于 http://192.168.1.222:8800
    // pathRewrite: {"^/note": ""}

    // changeOrigin: true,
    // secure: false,
    onProxyRes: function(proxyRes, req, res){
      if(proxyRes.req.path==='/Publisher/Home/login'){
        process.env.devcookie = proxyRes.headers['set-cookie']
      }
    },
    onProxyReq: function(proxyReq, req, res){
      // if(process.env.devcookie) proxyReq.setHeader('Cookie', process.env.devcookie);
      proxyReq.setHeader('Cookie', '.ASPXAUTH=47DB980C8F37CC95918231651123DC05B7DBD3B2082F17CE13FF8435836C6405550374B0C50CEEB3A7DFAE8D55323906CFBDEB8FA1DF40FAB9EC3D114EA3EB3DF69249FBD73B7EB9000AD2437399CD21B32F3BC99236DAF7C462C8216642F001; domain=192.168.1.194; expires=Wed, 08-Nov-2017 06:28:56 GMT; path=/; HttpOnly');

      // proxyReq.setHeader('Cookie','easy-mock_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI1OWM0NmRiZmUwZGM2NjMzNDFiNDA4NTIiLCJleHAiOjE1MDcyNTQ5NzUsImlkIjoiNTljNDZkYmZlMGRjNjYzMzQxYjQwODQ5IiwiaWF0IjoxNTA2MDQ1Mzc1fQ.45-Ow-W-lcq1oxIn-japLDd95lSAZMnnBuaCDhTZULA')
      // proxyReq.setHeader('Host','www.easy-mock.com')
    }
  },{
    context: ["/Content"],
    target: "http://192.168.1.222:3003"
  }]
}
}
