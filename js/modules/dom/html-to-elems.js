/**
 * Created by cql on 2017/3/24.
 */

/*
 html转对象

 返回 HTMLCollection集合

 */
export default function htmlToElems(html) {
    let eTemp = document.createElement('div');
    eTemp.innerHTML = html;

    return eTemp.children;
}