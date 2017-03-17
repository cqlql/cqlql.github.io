/**
 * Created by cql on 2017/3/8.
 */




let ajax={

    get({
        url,
        data,
        // contentType = params.contentType || 'application/x-www-form-urlencoded',
        dataType,
        success=()=>{},
        error=()=>{},
        complete=()=>{}

    }){

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

        xhr.open('get', url);

        //xhr.setRequestHeader("Content-type", contentType + ";charset=utf-8");

        xhr.send(null);

        return xhr;

    },
    
    post({
        url,
        data,
        // contentType = 'application/x-www-form-urlencoded',
        contentType='application/json',
        dataType,
        success=()=>{},
        error=()=>{},
        complete=()=>{}
    }){
        let
            xhr = new XMLHttpRequest();

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

        xhr.open('post', url);

        xhr.setRequestHeader("Content-type", contentType + ";charset=utf-8");

        xhr.send(JSON.stringify(data));

        return xhr;

    }

};


export default ajax;
