/**
 * Created by cql on 2017/3/24.
 */

/*
 html转对象

 返回 NodeCollection集合

 */
export default function htmlToNodes(html) {
    let eTemp = document.createElement('div');
    eTemp.innerHTML = html;

    return eTemp.childNodes;
}