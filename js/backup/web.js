'use strict';

var c={};

// url 参数获取
c.getUrlSearch = function (name) {
    var reg = new RegExp(name + '=([^&]+)'),
        match = reg.exec(location.search);

    if (match) {
        return match[1];
    }
    return match;
};

module.exports=c;
