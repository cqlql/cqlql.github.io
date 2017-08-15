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
    let params = env ? env.split(',') : []
    let dev = params[0] !== 'p';

    let outputPath = path.resolve(__dirname, "dist")
    return {
        entry: {
            common: ['vue'],
            main: ['css-base/dist/base.css',"./src/happywheel.css", "./src/happywheel.js"].concat(dev?["./src/happywheel_data_.js"]:[])
        },

        output: {
            path:outputPath, // string
            filename: "js/[name].js",
        },
        plugins: [
            extractCSS,

            new HtmlWebpackPlugin({
                filename: 'happywheel.html',
                template: './src/happywheel.html',
                chunks: ['manifest', 'common', 'main']
            }),
            new webpack.optimize.CommonsChunkPlugin({
                name: ['common'],
            }),
        ],

        module: {
            //加载器配置
            rules: [
                {
                    test: /\.js$/,
                    include: [
                        path.resolve(__dirname, "src")
                    ],
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
                path.resolve(__dirname,'../../node_modules'),
                'E:\\_work\\sd_umd_modules',
                'E:\\github',
                'E:\\github\\css-base\\dist'
            ],

            extensions: [".js"],

            // 别名
            alias: {
                // webpack -p 情况使用 mim 包
                'vue$': 'vue/dist/vue.min.js',
                // 'vue$': dev ?  'vue/dist/vue.js':'vue/dist/vue.min.js'
            }
        },

        devServer: {
            contentBase: outputPath,
            compress: true,
            host:'192.168.1.222',
            port: 3006,
            // hot:true
        }
    }
};
