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


            // common:'base.pcss',
            'msg-mobile':['./src/simple-msg.js']
        },

        output: {
            path: path.resolve(__dirname, "dist"), // string
            filename: "[name].js",
        },
        plugins: [
            extractCSS,

            new HtmlWebpackPlugin({
                filename: 'simple-msg.html',
                template: './src/simple-msg.html',
                // chunks: ['common','main']
                // chunks: ['./src/simple-msg.js']
                chunks:['msg-mobile']

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

                    use: ExtractTextPlugin.extract({
                        fallback: 'style-loader',
                        use: [{
                            loader: 'css-loader',
                            options: {
                                import: false,
                                alias: {
                                    // "../imgs": "E:\\_work\\mobile_webview\\smallpitch\\src\\imgs"
                                    // "../imgs/": "../../imgs/"
                                },
                                importLoaders: 1,
                                sourceMap: true,

                            }
                        }, {
                            loader: 'postcss-loader',
                            options: {
                                sourceMap: 'inline',
                                // syntax: require('postcss-scss'),
                                // plugins: [
                                //     require('postcss-import')({
                                //         path: ['E:/_work/Dropbox/github/modules/base-libs/css']
                                //     }),
                                // ]
                                plugins: [
                                    // require('postcss-cssnext')({
                                    // browsers:["last 10 versions",'Firefox < 20','ie 10']
                                    // autoprefixer:{
                                    //   remove: false
                                    // }
                                    // }),
                                    // require('postcss-smart-import')({
                                    //     path: ['E:/_work/mobile_webview/smallpitch.webview/src/modules/base-libs/css']
                                    // }),
                                    // require('postcss-inline-comment'),
                                    require('postcss-calc'),
                                    require('postcss-apply'),
                                    require('autoprefixer')({
                                        remove: false
                                    }),
                                    require('postcss-custom-properties'),
                                    require('postcss-nested'),
                                    require('postcss-css-variables'),
                                ]
                            }
                        }]
                    })
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

                'e:\\github'

// 'E:/_work/Dropbox/github/cqlql.github.io/demo/20170428_paginator/src'
            ],

            extensions: [".js"],


        }
    }
};