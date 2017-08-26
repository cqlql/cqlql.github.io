// let path = require('path');
let webpack = require('webpack');
let HtmlWebpackPlugin = require('html-webpack-plugin');
let ExtractTextPlugin = require("extract-text-webpack-plugin");
let HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');
// let CleanWebpackPlugin = require('clean-webpack-plugin');

module.exports = {
  plugins: [
    new HtmlWebpackPlugin({
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
    new ExtractTextPlugin('css/[name].css'),
    new HtmlWebpackInlineSourcePlugin(),
    // new CleanWebpackPlugin(['dist']),// 清理dist

    new webpack.optimize.UglifyJsPlugin(), // 压缩
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
  ],

  module: {
    //加载器配置
    rules: [{
      test: /\.css$/,
      use: ExtractTextPlugin.extract({
        use: ['css-loader','postcss-loader']
      }),
    }]
  }
}
