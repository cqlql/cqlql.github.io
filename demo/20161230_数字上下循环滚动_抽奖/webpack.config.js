

/*
* 使用webpack 2
*
* */

let path = require('path');
const webpack = require('webpack');
let HtmlWebpackPlugin = require('html-webpack-plugin');
let ExtractTextPlugin = require("extract-text-webpack-plugin")


module.exports = {
    entry: {
        main: "./main.js",
        // b: ["./app/entry-b1", "./app/entry-b2"]
    },

    output: {
        path: path.resolve(__dirname, "dist"), // string
        filename: "[name].js",
        // publicPath: "/assets/", // string
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
                exclude: /node_modules/,
                loader: 'babel-loader'
            },
            {
                test: /\.(css|sass|pcss)$/,
                // loader:ExtractTextPlugin.extract("style-loader", "css-loader?importLoaders=1","postcss-loader")
                loaders: [
                    'style-loader',
                    'css-loader?importLoaders=1',
                    'postcss-loader'
                ]
            }
        ]
    },
    resolve: {
        // root: __dirname, //绝对路径

        // 此处是为了精简调用。否则将直接require路径，如 require('../module/flicker.js')
        // 此路径跟 是相对于webpack 工作跟目录，跟root没关系
        alias: {

            'vue$': 'vue/dist/vue.js',
            'vue.min$': 'vue/dist/vue.min.js'

        }
    }
};

