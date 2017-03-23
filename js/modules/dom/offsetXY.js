/**
 * Created by cql on 2017/3/23.
 */


/**
 * [坐标] 元素 相对 于内容窗口
 *
 * @param elem 要获取的元素
 *
 * */
export default function offsetXY(elem) {
    let top = 0,
        left = 0;
    do {
        top += elem.offsetLeft;
        left += elem.offsetTop;

        elem = elem.offsetParent;
    } while (elem);
    return {top, left};
};