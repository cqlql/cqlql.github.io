
function MyPlugin(options) {
  // Configure your plugin with options...
}

MyPlugin.prototype.apply = function(compiler) {
  compiler.plugin('compilation', function(compilation) {
    // 编译开始
    // compilation.plugin('html-webpack-plugin-before-html-processing', function(htmlPluginData, callback) {
    //   htmlPluginData.html = '@{Layout = null;}'+htmlPluginData.html;
    //   callback(null, htmlPluginData);
    // });
    compilation.plugin('html-webpack-plugin-after-html-processing', function(htmlPluginData, callback) {
      htmlPluginData.html = '@{Layout = null;}'+htmlPluginData.html.replace(/@font-face|@-webkit-keyframes|@keyframes/g, '@$&')
      callback(null, htmlPluginData);
    });
  });
};

module.exports = MyPlugin;
