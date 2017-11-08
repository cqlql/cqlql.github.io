/* dev 用。因为使用的是默认的 devServer */
let path = require('path');
let HtmlWebpackPlugin = require('html-webpack-plugin');
let getIPAdress = require('../../build/get-ip-adress')
let baseConf = require('./webpack.base')
let merge = require('webpack-merge')

baseConf.entry.main.push('./src/test-data') // 增加测试数据js

let conf = {
    plugins: [
        new HtmlWebpackPlugin({
            filename: './index.html',
            template: './src/index.html',
            chunks: ['main']
        }),
    ],
    devServer: {
        contentBase: path.resolve(__dirname, 'dist'),
        compress: true,
        // host: '192.168.1.222',
        host: getIPAdress(),
        port: 3002,
        // openPage: 'http://192.168.1.222',
        inline: true
      }
}

module.exports = merge(baseConf, conf)
