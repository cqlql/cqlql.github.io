'use strict';

var c={};

// 去两头空格
// \uFEFF 为出现在开头的特殊字符
c.trim = function (str) {
    if (str.trim) return str.trim();
    return str.replace(/(^[\s\uFEFF]*)|(\s*$)/g, '');
};


module.exports=c;


