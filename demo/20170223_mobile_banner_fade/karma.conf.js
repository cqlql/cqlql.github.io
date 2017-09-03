let path = require('path')

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
              path.resolve(__dirname, 'src'),
              path.resolve(__dirname,'test')
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
    browsers: ['Chrome'/*, 'PhantomJS'*/],
  })
}
