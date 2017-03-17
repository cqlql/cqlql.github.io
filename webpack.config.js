/*
 * 使用webpack 2
 *
 * */

let path = require('path');
const webpack = require('webpack');
let HtmlWebpackPlugin = require('html-webpack-plugin');
let ExtractTextPlugin = require("extract-text-webpack-plugin");
const extractCSS = new ExtractTextPlugin({
    filename: 'css/[name].css'

});

module.exports = function (env, options) {

    let dev = !options.define;

    return {
        entry: {
            common: ['vue', 'base.pcss'],
            main: ["./src/main.pcss", "./src/main.js"]
        },

        output: {
            publicPath: "dist/",
            path: path.resolve(__dirname, "dist"), // string
            filename: "[name].js",
            // publicPath: "/assets/", // string
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
                    test: /\.vue$/,
                    loader: 'vue-loader',
                    options: {

                        loaders: {
                            pcss: 'style-loader!css-loader!postcss-loader' // <style lang="sass">
                        }
                    }
                },
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    loader: 'babel-loader'
                },
                {
                    test: /\.(css|sass|pcss)$/,
                    use: [
                        'style-loader',
                        'css-loader?importLoaders=1',
                        'postcss-loader'+(dev?'?sourceMap=inline':'')
                    ],
                    // 分离css
                    // use: ExtractTextPlugin.extract({
                    //     fallback:'style-loader',
                    //
                    //     use: ['css-loader?importLoaders=1', 'postcss-loader'+(dev?'?sourceMap=inline':'')]
                    // })
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
                'E:/Dropbox/github/cqlql.github.io/js/modules'

            ],

            extensions: [".js"],

            // 别名
            alias: {


                // webpack -p 情况使用 mim 包
                'vue$': dev ?  'vue/dist/vue.js':'vue/dist/vue.min.js'


            }
        },

        // E:/Dropbox/github/node_modules/.bin/webpack-dev-server.cmd
        devServer: {
            contentBase: path.join(__dirname, "./"),
            compress: true,
            port: 9000,
            // hot:true
        }
    }
}

0 && {
    //插件项
    plugins: [
        new ExtractTextPlugin("style.css"),
        new webpack.optimize.CommonsChunkPlugin('common.js'),

        // new HtmlWebpackPlugin({
        //     template: path.join(projectPath, 'index.html'),
        // })
    ],
    //页面入口文件配置
    entry: {

        main: path.join(projectPath, 'src/main.js'),
        // test: path.join(projectPath, 'test.js'),
    },
    //入口文件输出配置
    output: {
        path: path.join(projectPath, 'dist'),
        filename: '[name].js'
    },
    module: {
        //加载器配置
        loaders: [

            {
                test: /\.vue$/,
                loader: 'vue-loader'
            },
            {
                test: /\.(css|pcss)$/,
                // loader:ExtractTextPlugin.extract("style-loader", "css-loader?importLoaders=1","postcss-loader")
                loaders: [
                    'style-loader',
                    'css-loader?importLoaders=1',
                    'postcss-loader'
                ]
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader'
            },
            {
                test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
                loader: 'url-loader',
                query: {
                    limit: 1000,
                    name: './dist/img/[name].[hash:7].[ext]'
                }
            }
        ]
    },

    // 将css代码抽离成单个文件
    // vue: {
    //     loaders: {
    //         css: ExtractTextPlugin.extract("css"),
    //         // you can also include <style lang="less"> or other langauges
    //         postcss: ExtractTextPlugin.extract("css!postcss")
    //     }
    // },

};