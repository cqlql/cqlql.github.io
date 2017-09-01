let path = require('path');
let webpack = require('webpack');

let ExtractTextPlugin = require("extract-text-webpack-plugin");
let HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');
let HtmlWebpackPlugin = require('html-webpack-plugin');
// let CleanWebpackPlugin = require('clean-webpack-plugin');

let HtmlPlugin = require('./html-plugin')

module.exports = {
  output: {
    // path: path.resolve(__dirname, '../../Content'),
    publicPath: "/Areas/Mccard/Content/",
    path: path.resolve(__dirname, '../dist'),
    filename: "js/weather.js"
  },
  plugins: [
    new HtmlWebpackPlugin({
      // filename: '../Views/Home/index.cshtml',
      filename: './index.html',
      template: './src/index.html',
      chunks: ['index'],
      inlineSource: '.(js|css)$',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        minifyCSS: true
        // more options:
        // https://github.com/kangax/html-minifier#options-quick-reference
      }
    }),
    // new ExtractTextPlugin('css/[name].css'),
    // new HtmlWebpackInlineSourcePlugin(),
    // new CleanWebpackPlugin(['dist']),// 清理dist

    new webpack.optimize.UglifyJsPlugin(), // 压缩
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
    // new HtmlPlugin({options: ''})
  ],

  module: {
    //加载器配置
    rules: [{
      test: /\.css$/,
      use: ['style-loader','css-loader','postcss-loader'],
      // use: ExtractTextPlugin.extract({
      //   use: ['css-loader','postcss-loader']
      // }),
    }]
  },
  resolve: {
    alias: {
      'vue$': 'vue/dist/vue.min.js'
    }
  },
}
