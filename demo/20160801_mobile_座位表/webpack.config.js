let path = require('path');
let webpack = require('webpack');
let HtmlWebpackPlugin = require('html-webpack-plugin');
let ExtractTextPlugin = require("extract-text-webpack-plugin");
let HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');
// let CleanWebpackPlugin = require('clean-webpack-plugin');

module.exports = function (env, options) {

  let params = env ? env.split(',') : []
  let dev = params[0] !== 'p'

  let outputPath = path.resolve(__dirname, "dist")

  return {
    entry:{
      index: ["./src/js/index.js", "./src/js/data.js"]
    },

    output: {
      path: outputPath,
      filename: "js/[name].js"
    },
    devtool: 'eval',
    plugins: [
      new HtmlWebpackPlugin({
        filename: './index.html',
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
      new HtmlWebpackInlineSourcePlugin()
    ].concat(dev?[]:[
      new webpack.optimize.UglifyJsPlugin({
        uglifyOptions:{
          mangle: {
            eval:true
          }

        }
      }),
      new webpack.DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify('production')
        }
      }),
      new webpack.LoaderOptionsPlugin({ // 设置所有loader，压缩css等
        minimize: true
      })
    ]),

    module: {
      //加载器配置
      rules: [
        {
          test: /\.js$/,
          // exclude: /node_modules/,
          include: [
            path.resolve(__dirname, "src"),
          ],
          loader: 'babel-loader',
          options: {
            "presets": ["env"],
            "plugins": ["transform-runtime", "syntax-dynamic-import"],
          }
        }, {
          test: /\.css$/,
          use:['style-loader', 'css-loader', 'postcss-loader']
        }, {
          test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
          loader: 'url-loader',
          query: {
            limit: 10000,//单位 字节，1千字节(kb)=1024字节(b)
            // path: '/',
            // publicPath: '../',
            name: "[name].[ext]"
          }
        },
      ]
    },
    resolve: {

      // 寻找模块的目录
      modules: [
        path.resolve(__dirname, "../../node_modules"),
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
