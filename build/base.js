let path = require('path');

module.exports = {
  entry:{
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
  }
};
