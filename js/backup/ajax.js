'use strict';



var json=require('json');

var c = {};

c.ajax = function (params) {

    var
        url = params.url,
        data = params.data || null, // post 方法才有参数
        type = params.type || 'get',
        success = params.success || function () {
            },
        error = params.error || function () {
            },
        complete = params.complete || function () {
            },

        xhr = new XMLHttpRequest();

    xhr.addEventListener('readystatechange', onReadystatechange, false);

    xhr.open(type, url);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded;charset=utf-8");
    //xhr.setRequestHeader("Content-type", "application/json");

    //xhr.send(data);
    //xhr.send(JSON.stringify({content:'xxx'}));
    xhr.send(buildFormData(data));

    return xhr;

    function buildFormData(jsonData) {

        var data = '';

        fn(jsonData);

        return data.substr(1);

        function fn(obj, name) {

            for (var key in obj) {

                var val = obj[key];
                var type = getType(val);
                var newName = name ? name + '[' + key + ']' : key;
                console.log(type);
                if (type === 'array' || type === 'object') {
                    fn(val, newName);
                } else {
                    data += '&' + newName + '=' + val;
                }
            }
        }

        function getType(v) {

            var typeStr = typeof v,
                fullTypeStr;

            if (typeStr === 'object') {
                fullTypeStr = ({}).toString.call(v);
                return /\[object ([^\]]+)\]/.exec(fullTypeStr)[1].toLowerCase();
            } else {
                return typeStr;
            }
        }

    }

    function onReadystatechange() {
        if (xhr.readyState === 4) {

            if (xhr.status === 200) {
                success(xhr.responseText);
            } else {
                error(xhr, xhr.status, arguments);
            }

            complete();
        }
    }
};

c.post = function (params) {

    var
        url = params.url,
        data = params.data || null,
        contentType = params.contentType || 'application/x-www-form-urlencoded',
        dataType=params.dataType||'json',
        success = params.success || function () {
            },
        error = params.error || function () {
            },
        complete = params.complete || function () {
            },

        xhr = new XMLHttpRequest();

    xhr.responseType=dataType;

    xhr.addEventListener('readystatechange', onReadystatechange, false);

    xhr.open('post', url);

    xhr.setRequestHeader("Content-type", contentType + ";charset=utf-8");

    xhr.send(dataStringify(data));

    return xhr;

    function onReadystatechange() {
        if (xhr.readyState === 4) {

            if (xhr.status === 200) {
                // success(xhr.responseText); 如果不指定responseType，这将是默认值！！！
                success(xhr.response);

            } else {
                error(xhr, xhr.status, arguments);
            }

            complete();
        }
    }

    function dataStringify(data) {
        var buildFormData = json.formData;
        if (data) {
            if (contentType.toLowerCase() === 'application/json') {
                data = JSON.stringify(data);
            } else {
                data = buildFormData(data);
            }
        }

        return data;
    }
};

c.get = function (params) {

    var
        url = params.url,
        data = params.data,
    //contentType = params.contentType || 'application/x-www-form-urlencoded',
        dataType=params.dataType||'json',
        success = params.success || function () {
            },
        error = params.error || function () {
            },
        complete = params.complete || function () {
            },

        xhr = new XMLHttpRequest();

    xhr.responseType=dataType;


    xhr.addEventListener('readystatechange', onReadystatechange, false);

    xhr.open('get', url + dataStringify(data));

    //xhr.setRequestHeader("Content-type", contentType + ";charset=utf-8");

    xhr.send(null);

    return xhr;

    function onReadystatechange() {
        if (xhr.readyState === 4) {

            if (xhr.status === 200) {
                success(xhr.response);
            } else {
                error(xhr, xhr.status, arguments);
            }

            complete();
        }
    }

    function dataStringify(data) {
        var buildFormData = json.formData;
        if (data) {
            data = '?' + buildFormData(data);
        } else {
            data = '';
        }

        return data;
    }
};

module.exports = c;