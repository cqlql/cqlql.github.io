'use strict'

var c={};

// JSON处理
c.JSON = {
    // 对象转换为 json数据。解决低端浏览器不支持JSON.stringify
    stringify: function(obj) {
        var data = '',
            getType = c.getType;

        if (getType(obj) === 'object') {
            fn(obj);
            data = '{' + data.substr(0, data.length - 1) + '}';
        } else {
            arrayFn(obj);
            data = '[' + data.substr(0, data.length - 1) + ']';
        }

        return data;

        function fn(obj) {
            var val;
            var type;
            for (var key in obj) {

                val = obj[key];
                type = getType(val);

                if (type === 'object') {
                    data += '"' + key + '":{';
                    fn(val);
                    data = data.substr(0, data.length - 1);
                    data += '},';

                } else if (type === 'array') {
                    data += '"' + key + '":[';
                    arrayFn(val);
                    data = data.substr(0, data.length - 1);
                    data += '],';
                } else {
                    data += '"' + key.replace(/"/g, '\\"') + '":"' + val.replace(/"/g, '\\"') + '",';
                }
            }
        }

        function arrayFn(obj) {
            var val;
            var type;
            for (var key in obj) {

                val = obj[key];
                type = getType(val);

                if (type === 'object') {
                    data += '{';
                    fn(val);
                    data = data.substr(0, data.length - 1);
                    data += '},';
                } else if (type === 'array') {
                    data += '[';
                    arrayFn(val);
                    data = data.substr(0, data.length - 1);
                    data += '],';
                } else {
                    data += '"' + val.replace(/"/g, '\\"') + '",';
                }
            }

        }

    },
    parse: function(str) {

        if(JSON){
            return JSON.parse(str);
        }

    }
    // 对象转表单数据
    ,
    formData: function(obj) {
        var data = '',
            getType = c.getType;

        fn(obj);

        return data.substr(1);

        function fn(obj, name) {

            for (var key in obj) {

                var val = obj[key];
                var type = getType(val);
                var newName = name ? name + '[' + key + ']' : key;
                if (type === 'array' || type === 'object') {
                    fn(val, newName);
                } else {
                    data += '&' + newName + '=' + encodeURIComponent(val);
                }
            }
        }
    }
};



module.exports = c.JSON;