const fs = require('fs-extra')



function CleanPlugin(options) {
  this.options = options
}

CleanPlugin.prototype.apply = function(compiler) {
  compiler.plugin('compile', params => {
    (this.options.before || []).forEach(path => {
      fs.removeSync(path)
    })
  });
  compiler.plugin('done', params => {
    (this.options.after || []).forEach(path => {
      fs.removeSync(path)
    })
  });
};

module.exports = CleanPlugin;
