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
    dataType,
    success=()=>{},
    error=()=>{},
    complete=()=>{}

}) {

    let xhr = new XMLHttpRequest();

    function readystatechange() {
        if (xhr.readyState === 4) {
            // if (xhr.readyState === xhr.DONE) {

            if (xhr.status === 200) {
                // success(xhr.responseText); 如果不指定responseType，这将是默认值！！！
                let response=xhr.response;

                // android 4.4以下，ajax不会根据后台响应要求自动转换 json为对象。所以只能手动转换
                if(dataType==='json'&&typeof response==='string'){
                    success(JSON.parse(response));
                }
                else{
                    success(response);
                }

            } else {
                error(xhr, arguments);
            }

            complete();
        }
    }

    try {
        xhr.responseType = dataType;
        xhr.onreadystatechange = readystatechange;
    }
    catch( e ) {
        xhr.onload = readystatechange;
    }

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

    let xhr = createXHR({ dataType, success, error, complete });

    if(data){
        if(url.lastIndexOf("?")>-1){
            url+='&'+formData(data);
        }
        else{
            url+='?'+formData(data);
        }
    }

    xhr.open('GET', url);

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

    let xhr = createXHR({ dataType, success, error, complete });

    xhr.open('POST', url);

    xhr.setRequestHeader("Content-type", contentType + ";charset=utf-8");

    xhr.send(JSON.stringify(data));

    return xhr;
}

function ajax() {

}

ajax.get = get

export default ajax;
