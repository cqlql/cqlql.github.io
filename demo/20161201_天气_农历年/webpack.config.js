let path = require('path');
let merge = require('webpack-merge');
let webpack = require('webpack');
// var FriendlyErrorsPlugin = require('friendly-errors-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin');

function resolve(p) {
  return path.resolve(__dirname, p)
}

module.exports = function (env) {

  let params = env ? env.split(',') : []
  let dev = params[0] !== 'p'

  let conf = dev ? require('./build/webpack.dev') : require('./build/webpack.prod')

  return merge(conf, {
    entry: {
      // common:['vue'],
      index: ["./src/index.js"]
    },

    output: {
      filename: "js/weather.js",
      chunkFilename: 'js/[name].bundle.js',
    },

    plugins: [
      // new webpack.optimize.CommonsChunkPlugin({
      //     name: ['common'],
      // }),
      new webpack.NoEmitOnErrorsPlugin(),
      // new CleanWebpackPlugin([resolve('dist')]),
      // new FriendlyErrorsPlugin()
    ],

    module: {
      rules: [
        {
          test: /\.js$/,
          include: [resolve("src")],
          loader: 'babel-loader'
        },

        {
          test: /\.vue$/,
          loader: 'vue-loader',
          options: {
            loaders: {
              js: {
                loader: 'babel-loader',
                include: [
                  resolve("src")
                ],
              }
            }
          }
        },
      ]
    },
    resolve: {
      modules: [
        resolve("../../node_modules"),
        'E:\\github'
      ],

      extensions: [".js"],
    }
  })
}

