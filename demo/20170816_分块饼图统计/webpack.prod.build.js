const fs = require('fs-extra')
let path = require('path')
let webpack = require('webpack')

let HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin')
let HtmlWebpackPlugin = require('html-webpack-plugin')

let CleanPlugin = require('../../build/clean-plugin')

let baseConf = require('./webpack.base')
let merge = require('webpack-merge')

function resolve (p) {
  return path.resolve(__dirname, p)
}

let isDemo = 1

if (isDemo) {
  baseConf.entry.main.push('./src/test-data') // 增加测试数据js
} else {
  // baseConf.output.path = 'E:\\__admin\\Desktop' // 更改输出路径
}

let conf = {
  plugins: [
    new HtmlWebpackPlugin({
      filename: isDemo ? './index.html' : './chart-pie.html',
      template: './src/index.html',
      chunks: ['main'],
      inlineSource: '.(css|js)$',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        minifyCSS: true,
        minifyJS: true
        // more options:
        // https://github.com/kangax/html-minifier#options-quick-reference
      }
    }),
    new HtmlWebpackInlineSourcePlugin(),
    new webpack.optimize.UglifyJsPlugin(), // 压缩
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
    new webpack.LoaderOptionsPlugin({ // 设置所有loader，压缩css等
      minimize: true
    }),
    // new HtmlPlugin({options: ''}),
    new CleanPlugin({
      before: [resolve('dist')],
      after: [resolve('dist/css'), resolve('dist/js')]
    }),
    new webpack.HashedModuleIdsPlugin({
      hashDigestLength: 7
    })
  ]
}

webpack(merge(baseConf, conf), function (err, stats) {
  const info = stats.toString({
    colors: true
  })

  console.log(info)
  err && console.log(err)

  fs.removeSync(path.resolve(baseConf.output.path, './css'))
  fs.removeSync(path.resolve(baseConf.output.path, './js'))
})
