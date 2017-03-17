/*
 * 使用webpack 2
 *
 * */

const path = require('path');
const webpack = require('webpack');

module.exports = function (env, options) {
    return {
        entry: {
            common: "vue",

            annual_meeting: "./src/annual_meeting.js",

            balloon: "./src/balloon.js",
            lantern: "./src/lantern.js",

            random: "./src/random.js",
            random_annual_meeting: "./src/random_annual_meeting.js",
            random_han: "./src/random_han.js",
            roulette: "./src/roulette.js",
            roulette_6: "./src/roulette_6.js",
            roulette_12: "./src/roulette_12.js",
            roulette_12zodiac: "./src/roulette_12zodiac.js"
        },

        output: {
            path: path.resolve(__dirname, "dist"), // string
            filename: "[name].js",
        },

        module: {
            //加载器配置
            rules: [
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
                name: 'common',
            })


        ],
        // 分解
        resolve: {

            // 寻找模块的目录
            modules: [
                "node_modules",

                // cqlql.github.io 项目
                path.join(__dirname, "../../js/modules"),
                // path.join(__dirname, "../../js/libr"),

            ],

            extensions: [".js"],

            // 别名
            alias: {
                'vue$': options.define ? 'vue/dist/vue.min.js' : 'vue/dist/vue.js'
            }
        }
    }
};
