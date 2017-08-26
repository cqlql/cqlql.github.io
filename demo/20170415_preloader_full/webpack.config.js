let path = require('path');
let merge = require('webpack-merge');

module.exports = function (env) {

  let params = env ? env.split(',') : []
  let dev = params[0] !== 'p'

  let conf = dev?require('./build/dev.conf'):require('./build/prod.conf')

  return merge(conf,{  entry:{
    index: ["./src/index.js"]
  },

    output: {
      path: path.resolve(__dirname,'dist'),
      filename: "js/[name].js"
    },

    module: {
      //加载器配置
      rules: [
        {
          test: /\.js$/,
          include: [path.resolve(__dirname, "src")],
          loader: 'babel-loader'
        }
      ]
    },
    resolve: {

      // 寻找模块的目录
      modules: [
        path.resolve(__dirname, "../../node_modules"),
        'E:\\github'
      ],

      extensions: [".js"],
    }})
}

