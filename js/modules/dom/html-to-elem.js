/**
 * Created by cql on 2017/3/24.
 */

/*
 html转对象

 html 中可能带有多个根元素，所以根据情况 返回单个元素对象，或者 HTMLCollection集合

 */
export default function htmlToElem(html) {
    let eTemp = document.createElement('div');
    eTemp.innerHTML = html;

    let chil = eTemp.children,
        length = chil.length;

    return length === 1 ? chil[0] : chil;
}