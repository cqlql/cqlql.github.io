/*
 * extract-text-webpack-plugin
 * 此处结合了 html-webpack-plugin。能很完美的生成对于的css文件引用
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
            // main.js main2.js 中require的css将合并成一个 main.css
            // 甚至可以引入css
            main: ["./src/main.js", "./src/main2.js"]
        },

        output: {
            path: path.resolve(__dirname, "dist"), // string
            filename: "[name].js",
        },
        plugins: [
            extractCSS,

            new HtmlWebpackPlugin({
                filename: 'test.html',
                template: './test.html',
                chunks: ['manifest','main']
            }),
            new webpack.optimize.CommonsChunkPlugin({
                name: ['common', 'manifest'],
            }),

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
                    //     'css-loader',
                    //     'postcss-loader'],
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

            extensions: [".js"],


        }
    }
};