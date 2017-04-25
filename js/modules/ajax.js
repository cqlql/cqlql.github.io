/**
 * Created by cql on 2017/3/8.
 */

function formData(obj) {
    var data = '';

    fn(obj);

    return data.substr(1);

    function fn(obj, name) {

        for (var key in obj) {

            var val = obj[key];
            var newName = name ? name + '[' + key + ']' : key;
            if (val instanceof  Array || val instanceof Object) {
                fn(val, newName);
            } else {
                data += '&' + newName + '=' + encodeURIComponent(val);
            }
        }
    }
}



function createXHR({
                  // contentType = params.contentType || 'application/x-www-form-urlencoded',
                  dataType='json',
                  success=()=>{},
                  error=()=>{},
                  complete=()=>{}

              }) {

    let xhr = new XMLHttpRequest();

    xhr.responseType=dataType;

    xhr.addEventListener('readystatechange', function () {
        if (xhr.readyState === 4) {

            if (xhr.status === 200) {
                // success(xhr.responseText); 如果不指定responseType，这将是默认值！！！
                success(xhr.response);

            } else {
                error(xhr, xhr.status, arguments);
            }

            complete();
        }
    }, false);

    return xhr;
}

export function get({
                        url,

                        // json对象，将被转成 url 参数，支持后代成员
                        data,

                        // 告诉服务器将发送的数据类型, post才有
                        // contentType = 'application/json',

                        // 指定服务器响应的数据类型
                        dataType='json',

                        success=()=>{},
                        error=()=>{},
                        complete=()=>{}

                    }) {

    let xhr=createXHR(arguments[0]);

    if(data){
        if(url.lastIndexOf("?")>-1){
            url+='&'+formData(data);
        }
        else{
            url+='?'+formData(data);
        }
    }

    xhr.open('get', url);

    //xhr.setRequestHeader("Content-type", contentType + ";charset=utf-8");

    xhr.send(null);

    return xhr;
}

export function post({
                  url,
                  data,
                  contentType = 'application/json',
                  dataType ='json',
                  success=()=>{},
                  error=()=>{},
                  complete=()=>{}

              }) {

    let xhr=createXHR(arguments[0]);

    xhr.open('post', url);

    xhr.setRequestHeader("Content-type", contentType + ";charset=utf-8");

    xhr.send(JSON.stringify(data));

    return xhr;
}

let ajax={
    get,
    post
};


export default ajax;
