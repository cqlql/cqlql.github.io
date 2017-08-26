let path = require('path');
let webpack = require('webpack');
let HtmlWebpackPlugin = require('html-webpack-plugin');

let baseConf = require('../webpack.config')()

module.exports = {

  output:{
    pathinfo: true
  },

  devtool: 'eval-cheap-module-source-map',

  plugins: [
    new HtmlWebpackPlugin({
      filename: './index.html',
      template: './src/index.html',
      chunks: ['index']
    }),
    new webpack.HotModuleReplacementPlugin(), // 启用 HMR

  ],

  module: {
    //加载器配置
    rules: [{
        test: /\.css$/,
        use: [{
          loader: 'style-loader'
        }, {
          loader: 'css-loader',
          options: {
            importLoaders: 1,
            sourceMap: true
          }
        }, {
          loader: 'postcss-loader',
          options: {
            config: {
              path: '../../postcss.config.js'
            },
            sourceMap: 'inline',
          }
        }],
      }
    ]
  },

  devServer: {
    contentBase:  baseConf.output.path,
    compress: true,
    host: '192.168.1.222',
    port: 3001,
    hot: false,
    open: true
  }

}
