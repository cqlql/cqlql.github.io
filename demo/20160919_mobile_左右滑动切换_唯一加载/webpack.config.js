/*
 * extract-text-webpack-plugin
 * 此处结合了 html-webpack-plugin。能很完美的生成对于的css文件引用
 *
 * */

let path = require('path');
const webpack = require('webpack');
let HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const extractCSS = new ExtractTextPlugin('css/[name].css');


module.exports = function (env, options) {
    return {
        entry: {

            baseCss:'base.pcss',
            mainCss:'main.pcss',
            // common:'base.pcss',
            main: ["main.js"]
        },

        output: {
            path: path.resolve(__dirname, "dist"), // string
            filename: "[name].js",
        },
        plugins: [
            extractCSS,

            new HtmlWebpackPlugin({
                filename: 'index.html',
                template: './src/index.html',
                // chunks: ['common','main']
                chunks: ['baseCss','mainCss','main']
            }),
            // new webpack.optimize.CommonsChunkPlugin({
            //     name: ['common'],
            // }),

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
                    use: extractCSS.extract(['css-loader','postcss-loader']),
                },
                {
                    test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
                    loader: 'url-loader',
                    query: {
                        limit: 100,//单位 字节，1千字节(kb)=1024字节(b)
                        publicPath:'../',
                        name: 'imgs/[name].[hash:7].[ext]'
                    }
                },
                {
                    test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
                    loader: 'url-loader',
                    query: {
                        limit: 100,
                        publicPath:'../',
                        name: 'fonts/[name].[hash:7].[ext]'
                    }
                }
            ]
        },
        // 分解
        resolve: {

            // 寻找模块的目录
            modules: [
                "node_modules",

                'E:/_work/Dropbox/github/cqlql.github.io/libr',


                // cqlql.github.io 项目
                'E:/_work/Dropbox/github/cqlql.github.io/js/modules',
                'E:/_work/Dropbox/github/cqlql.github.io/css/modules',

'E:/_work/Dropbox/github/cqlql.github.io/demo/20160919_mobile_左右滑动切换_唯一加载/src'
            ],

            extensions: [".js"],


        }
    }
};