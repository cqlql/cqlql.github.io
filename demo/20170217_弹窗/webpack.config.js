/*
 * html-webpack-plugin
 *
 * 实现自动加js引用
 *
 * */

let path = require('path');
const webpack = require('webpack');
let HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const extractCSS = new ExtractTextPlugin('stylesheets/[name].css');

module.exports = function (env, options) {
    return {
        entry: {
            // common:["vue","base"],
            common:["click","base"],
            main: "./src/main.js",
            // b: ["./app/entry-b1", "./app/entry-b2"]
            // main: ["./src/main.js", "./src/main2.js"]
        },

        output: {
            // publicPath: "dist/",
            path: path.resolve(__dirname, "dist"), // string
            filename: "[name].js",
            // publicPath: "/assets/", // string
        },
        plugins: [
            extractCSS,
            new HtmlWebpackPlugin({
                // filename: 'test.html',
                template: './index.html',
                chunks: ['manifest',"common",'main']
            }),
            new webpack.optimize.CommonsChunkPlugin({
                name: ['common','manifest'],
            })
        ],

        module: {
            //加载器配置
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    loader: 'babel-loader'
                },
                {
                    test: /\.(css|pcss)$/,
                    // use: ['style-loader',
                    //         'css-loader',
                    //         'postcss-loader'],
                    use: extractCSS.extract([ 'css-loader', 'postcss-loader' ]),
                }
            ]
        },
        // 分解
        resolve: {

            // 寻找模块的目录
            modules: [
                "node_modules",

                // cqlql.github.io 项目
                'E:/Dropbox/github/cqlql.github.io/js/modules',
                'E:/Dropbox/github/cqlql.github.io/css/modules'

            ],

            extensions: [".js",'.pcss'],


            // 别名
            alias: {

                // webpack -p 情况使用 mim 包
                'vue$': options.define ? 'vue/dist/vue.min.js' : 'vue/dist/vue.js'
            }


        }
    }
}