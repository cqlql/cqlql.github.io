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


    let params=env?env.split(','):[];
    let dev = params[0] === 'd';
    let ios = params[1] === 'ios';
    let old=params[2] === 'old';

    return {
        entry: {


            // common:'base.pcss',
            index: ['base.css','./src/index.pcss', 'common-mobile',"./src/index.js"].concat(dev ? ["./src/index_data_.js"] : []),
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
                chunks: ['index']
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
                    use: extractCSS.extract(['css-loader','postcss-loader']),
                },
                {
                    test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
                    loader: 'url-loader',
                    query: {
                        limit: 100,//单位 字节，1千字节(kb)=1024字节(b)
                        publicPath:'../',
                        name: 'imgs/[name].[ext]'
                    }
                },
                {
                    test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
                    loader: 'url-loader',
                    query: {
                        limit: 100,
                        publicPath:'../',
                        name: 'fonts/[name].[ext]'
                    }
                }
            ]
        },
        // 分解
        resolve: {

            // 寻找模块的目录
            modules: [
                "node_modules",

                'E:/_work/Dropbox/github/modules/base-libs/css',
                'E:/_work/Dropbox/github/modules/base-libs/js',
                'E:/_work/Dropbox/github/modules/base-libs/js/dom',

// 'E:/_work/Dropbox/github/cqlql.github.io/demo/20170428_paginator/src'
            ],

            extensions: [".js"],

            alias: {
                // 'j':'./src/js',

                // webpack -p 情况使用 mim 包
                'vue$': dev ? 'vue/dist/vue.js' : 'vue/dist/vue.min.js'
            },


        }
    }
};