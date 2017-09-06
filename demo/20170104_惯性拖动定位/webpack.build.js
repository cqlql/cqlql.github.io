const fs = require('fs-extra');
const path = require('path');
let webpack = require('webpack');
let HtmlWebpackPlugin = require('html-webpack-plugin');
let conf = require('./webpack.config')('p')

conf.output.path = path.resolve('assets')
conf.plugins[0] = new HtmlWebpackPlugin({
  filename: './chart-pie.html',
  template: './src/index.html',
  chunks: ['index'],
  inlineSource: '.(js|css)$',
  minify:{
    removeComments: true,
    collapseWhitespace: true,
    removeAttributeQuotes: true,
    minifyCSS: true
    // more options:
    // https://github.com/kangax/html-minifier#options-quick-reference
  }
})

webpack(conf,function (err, stats) {

  const info = stats.toString({
    colors: true
  });

  console.log(info)

  fs.removeSync(path.resolve(conf.output.path,'./css'))
  fs.removeSync(path.resolve(conf.output.path,'./js'))
})
