let path = require('path');
let webpack = require('webpack');
let HtmlWebpackPlugin = require('html-webpack-plugin');


function resolve(p) {
  return path.resolve(__dirname, p)
}

module.exports = {

  output: {
    path: resolve('../dist'),
    pathinfo: true,

    filename: "js/[name].js"
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
      filename: './index.html',
      template: './src/index.html',
      chunks: ['common', 'index']
    }),
    new webpack.HotModuleReplacementPlugin(), // 启用 hot

  ],

  module: {
    //加载器配置
    rules: [
      // {
      //   test: /\.(js|vue)$/,
      //   loader: 'eslint-loader',
      //   enforce: 'pre',
      //   include: [resolve('../src'), resolve('../test')],
      //   options: {
      //     formatter: require('eslint-friendly-formatter')
      //   }
      // },
      {
        test: /\.(css|scss)$/,
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
    alias: {
      // 'vue$': 'vue/dist/vue.esm.js'
      'vue$': 'vue/dist/vue.js'
    }
  },

  devServer: {
    contentBase: path.resolve(__dirname, 'dist'),
    compress: true,
    // host: '192.168.1.222',
    host: '0.0.0.0',
    port: 3001,
    openPage: 'http://192.168.1.222',
    inline: true,
    hot: true,
    hotOnly: false,
    // open: true,
    // noInfo: true
    // proxy: {
    //   "/note": {
    //     target: "http://192.168.1.222:8800",
    //
    //     // /note 相当于 http://192.168.1.222:8800/note
    //     // 使用 pathRewrite 后： /note 相当于 http://192.168.1.222:8800
    //     // pathRewrite: {"^/note": ""}
    //   }
    // }
  }
}
