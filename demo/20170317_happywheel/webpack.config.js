/*
 * extract-text-webpack-plugin
 * 此处结合了 html-webpack-plugin。能很完美的生成对于的css文件引用
 *
 * */

let path = require('path');
const webpack = require('webpack');
let HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const extractCSS = new ExtractTextPlugin({
    filename: 'css/[name].css'

});

module.exports = function (env, options) {
    let dev=!options.define;
    return {
        entry: {
            common: ['base.pcss'],
            main: ["./src/main.pcss", "./src/main.js"]
        },

        output: {
            path: path.resolve(__dirname, "dist"), // string
            filename: "js/[name].js",
        },
        plugins: [
            extractCSS,


            new HtmlWebpackPlugin({
                filename: 'view.html',
                template: './src/view.html',
                chunks: ['manifest', 'common', 'main']
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
                    exclude: /node_modules|libr/,
                    loader: 'babel-loader'
                },
                {
                    test: /\.(css|pcss)$/,
                    use: ExtractTextPlugin.extract({
                        fallback:'style-loader',

                        use: ['css-loader?importLoaders=1', 'postcss-loader'+(dev?'?sourceMap=inline':'')]
                    })



                },
                {
                    test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
                    loader: 'url-loader',
                    query: {
                        limit: 100,//单位 字节，1千字节(kb)=1024字节(b)
                        publicPath: '../',
                        name: 'imgs/[name].[ext]'
                    }
                },
                {
                    test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
                    loader: 'url-loader',
                    query: {
                        limit: 100,
                        publicPath: '../',
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

                'E:/Dropbox/github/cqlql.github.io/js/libr',


                // cqlql.github.io 项目
                'E:/Dropbox/github/cqlql.github.io/js/modules',
                'E:/Dropbox/github/cqlql.github.io/css/modules',


            ],

            extensions: [".js"],

            // 别名
            alias: {


                // webpack -p 情况使用 mim 包
                'vue$': dev ?  'vue/dist/vue.js':'vue/dist/vue.min.js'


            }


        }
    }
};