let path = require('path')
function resolve(p) {
  return path.resolve(__dirname, p)
}
module.exports = function(config) {
  config.set({
    frameworks: ['mocha','chai-dom','chai'],
    files: [
      './test/*.js'
    ],
    preprocessors: {
      './test/*.js':['webpack', 'sourcemap']
    },
    webpack:{
      module: {
        //加载器配置
        rules: [
          {
            test: /\.js$/,
            include:[
              resolve('src'),
              resolve('test')
            ],
            // exclude: /node_modules/,
            loader: 'babel-loader',
            options: {
              "presets": [
                "env"
              ],
              "plugins": [
                "transform-runtime"
              ]
            }
          }
        ]
      },
      devtool: 'inline-source-map'
    },
    webpackMiddleware: {
      noInfo: true
    },
    reporters: ["spec"],
    browsers: ['Chrome'/*, 'PhantomJS'*/],
    plugins: [
      "karma-webpack",
      "karma-chai",
      "karma-chai-dom",
      "karma-spec-reporter",
      "karma-sourcemap-loader",
      "karma-mocha",
      "karma-chrome-launcher"
    ],
  })
}
