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
const extractCSS = new ExtractTextPlugin('css/[name].css');

module.exports = function (env, options) {

    return {
        entry: {
            main: ["css-base/dist/base.css","./src/main.pcss","./src/main.js"]
        },

        output: {
            path: path.resolve(__dirname, "dist"), // string
            filename: "[name].js",
        },
        plugins: [
            extractCSS,
            new HtmlWebpackPlugin({
                // filename: 'test.html',
                template: './src/index.html',
                chunks: ['main']
            })
        ],

        module: {
            //加载器配置
            rules: [
                {
                    test: /\.js$/,
                    include:[path.resolve(__dirname, "src")],
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
            ]
        },
        // 分解
        resolve: {

            // 寻找模块的目录
            modules: [
                "node_modules",
                'E:\\github'
            ],

            extensions: [".js"],

            // 别名
            alias: {

            }


        }
    }
}