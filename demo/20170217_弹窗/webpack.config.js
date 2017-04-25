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
    let dev=!options.define;
    return {
        entry: {
            // common:["vue","base"],
            main: ["base.pcss","./src/main.pcss","./src/main.js"]
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
                template: './src/index.html',
                chunks: ['main']
            }),
            // new webpack.optimize.CommonsChunkPlugin({
            //     // name: ['common','manifest'],
            //     name: ['common'],
            // })
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
                        fallback:'style-loader',

                        use: ['css-loader?importLoaders=1', 'postcss-loader'+(dev?'?sourceMap=inline':'')]
                    })
                },
            ]
        },
        // 分解
        resolve: {

            // 寻找模块的目录
            modules: [
                "node_modules",

                // cqlql.github.io 项目
                'E:/_work/Dropbox/github/cqlql.github.io/libr',
                'E:/_work/Dropbox/github/cqlql.github.io/js/modules',
                // 'E:/Dropbox/github/cqlql.github.io/js/modules/dom',
                'E:/_work/Dropbox/github/cqlql.github.io/css/modules'
            ],

            extensions: [".js",'.pcss'],


            // 别名
            alias: {
                // webpack -p 情况使用 mim 包
                'vue$': dev ?  'vue/dist/vue.js':'vue/dist/vue.min.js'
            }


        }
    }
}