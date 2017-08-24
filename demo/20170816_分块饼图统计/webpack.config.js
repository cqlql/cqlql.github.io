let path = require('path');
let webpack = require('webpack');
let HtmlWebpackPlugin = require('html-webpack-plugin');
let ExtractTextPlugin = require("extract-text-webpack-plugin");
let HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');
// let CleanWebpackPlugin = require('clean-webpack-plugin');

module.exports = function (env, options) {

  let params = env ? env.split(',') : []
  let dev = params[0] !== 'p'

  let outputPath = path.resolve(__dirname, dev?"dist":'assets')

  return {
    entry:{
      index: ["./src/index.js"].concat(dev?"./src/test-data.js":[])
    },

    output: {
      path: outputPath,
      filename: "js/[name].js"
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: dev?'./index.html':'./chart-pie.html',
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
      }),
      new ExtractTextPlugin('css/[name].css'),
      new HtmlWebpackInlineSourcePlugin(),
      // new webpack.NamedModulesPlugin(),
      // new webpack.optimize.CommonsChunkPlugin({
      //     name: ['common', 'manifest'],
      // }),

      // new CleanWebpackPlugin(['dist']),// 清理dist
      // new webpack.HotModuleReplacementPlugin(), // 启用 HMR

    ],

    module: {
      //加载器配置
      rules: [
        {
          test: /\.js$/,
          // exclude: /node_modules/,
          include: [
            path.resolve(__dirname, "src"),
            'E:\\github\\cqlql.github.io\\modules'
          ],
          loader: 'babel-loader',
          options: {
            "presets": ["env"],
            "plugins": ["transform-runtime", "syntax-dynamic-import"],
          }
        }, {
          test: /\.css$/,
          use: ExtractTextPlugin.extract({
            // fallback: 'style-loader',
            use: [{
              loader: 'css-loader',
              options: {
                importLoaders: 1,
                sourceMap: true,
                url: false
              }
            }, {
              loader: 'postcss-loader',
              options: {
                plugins: [
                  require('autoprefixer')({
                    remove: false
                  }),
                ]
              }
            }]
          }),
        }
      ]
    },
    resolve: {

      // 寻找模块的目录
      modules: [
        path.resolve(__dirname, "../../node_modules")
        // "node_modules"
      ],

      extensions: [".js"],

      // 别名
      alias: {}
    },

    devServer: {
      contentBase: outputPath,
      compress: true,
      host: '192.168.1.222',
      port: 1234,
      hot: false
    }
  }
}
