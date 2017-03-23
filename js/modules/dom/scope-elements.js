/**
 * Created by cql on 2017/3/23.
 */

// 元素查找 目标元素逐个往上找 实现查找范围内的所有元素，或者说是赛选某元素内的所有元素
/**
 使用
 scopeElements(selection.anchorNode,function (elem) {

    if(elem===eEnd)return false;
    if(elem.tagName==='H2'){
        // do something...
        return false;
    }
    return otherFn();
 });
 */
export default function scopeElements(targetElem, listener) {
    targetElem = targetElem.nodeType === 1 ? targetElem : targetElem.parentElement;
    go(targetElem);
    function go(that, child) {
        if (listener(that, child) !== false) {
            go(that.parentElement, that);
        }
    }
}