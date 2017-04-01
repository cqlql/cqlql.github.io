/**
 * Created by cql on 2017/3/31.
 */

/**
 * 外链 script 增加
 * */
export default function addScript(src, callback=()=>{}) {
    let script = document.createElement('script');

    script.src = src;
    if ('onload' in script) {
        script.onload = function () {
            callback();
        };
    }
    else {
        script.attachEvent("onreadystatechange", function () {
            if (script.readyState === "complete" || script.readyState === "loaded") {
                callback();
            }
        });
    }
    (document.head || document.body).appendChild(script);
}

