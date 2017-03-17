
/*
* 使用webpack 2
*
* */

let path = require('path');
const webpack = require('webpack');


module.exports = function (env,options) {

    return {
        entry: {
            main: "./main.js",
        },

        output: {
            path: path.resolve(__dirname, "dist"), // string
            filename: "[name].js",
        },
        plugins: [
            // new webpack.optimize.CommonsChunkPlugin({
            //     name:'common'
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
                    test: /\.(css|sass|pcss)$/,
                    loaders: [
                        'style-loader',
                        'css-loader?importLoaders=1',
                        'postcss-loader'
                    ]
                },
            ]
        },
        // 分解
        resolve:{

            // 寻找模块的目录
            modules: [
                "node_modules",
                path.join(__dirname, "../../js/modules"),// cqlql.github.io 项目

            ],

            extensions: [".js"],

            // 别名
            alias: {
                'vue$': options.define?'vue/dist/vue.min.js':'vue/dist/vue.js'
            }
        }
    };

};
