

let path = require('path');
const webpack = require('webpack');
let msg=require('./build/msg')

let webpackConfig = {
  entry: {
    weather: ["./src/weather.mccard.js"]
  },
  output:{
    publicPath: "/Areas/Mccard/Content/",
    path: 'E:\\_work\\shendupeiban\\src\\ccard.shendupeiban.com\\ccard.shendupeiban.com\\Areas\\Mccard\\Content',
    filename: "js/weather.js"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: [path.resolve("src")],
        loader: 'babel-loader'
      },
      {
        test: /\.css$/,
        use: ['style-loader','css-loader','postcss-loader'],
      }
    ]
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin(), // 压缩
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    })
  ],
}

const compiler = webpack(webpackConfig,msg);
