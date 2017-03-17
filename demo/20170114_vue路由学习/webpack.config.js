/*
 * 使用webpack 2
 *
 * */

const path = require('path');
const webpack = require('webpack');

module.exports = function (env, options) {
    return {
        entry: {
            common: ["vue-router"],
            vue:'vue',
            main:'main',
            // main2:'main2'
        },


        output: {
            publicPath: "dist/",
            path: path.resolve(__dirname, "dist"), // string
            filename: "[name].js",
            // filename: '[chunkhash].[name].js',
        },

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
                    exclude: /node_modules|libr/,
                    loader: 'babel-loader'
                },
                {
                    test: /\.(css|sass|pcss)$/,
                    loaders: [
                        'style-loader',
                        'css-loader?importLoaders=1',
                        'postcss-loader'
                    ]
                },
            ]
        },

        plugins: [
            new webpack.optimize.CommonsChunkPlugin({
                // name: 'common',
                names: ['vue','common','manifest'] // Specify the common bundle's name.
            })


        ],
        // 分解
        resolve: {

            // 寻找模块的目录
            modules: [
                "node_modules",


                // cqlql.github.io 项目
                "E:/Dropbox/github/cqlql.github.io/js/modules",
                "E:/Dropbox/github/cqlql.github.io/js/libr",

                './src'

            ],

            extensions: [".js"],

            // 别名
            alias: {
                'vue$': options.define ? 'vue/dist/vue.min.js' : 'vue/dist/vue.js',
                'vue-router$': options.define ? 'vue-router/dist/vue-router.min.js' : 'vue-router/dist/vue-router.js'
            }
        }
    }
};
