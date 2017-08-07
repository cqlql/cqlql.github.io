/**
 * Created by cql on 2016/11/15.
 */

module.exports = {
  plugins: [
    // require('postcss-cssnext')({
      // browsers:["last 10 versions",'Firefox < 20','ie 10']
      // autoprefixer:{
      //   remove: false
      // }
    // }),
    require('postcss-smart-import')({
      path: ['E:/_work/mobile_webview/smallpitch.webview/src/modules/base-libs/css']
    }),
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

