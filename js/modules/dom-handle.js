/**
 * dom操作汇总
 *
 * Created by cql on 2017/4/1.
 *
 *
 *
 */


import addCssText from 'dom/add-css-text';

import addScript from 'dom/add-script';

import autoPrefix from 'dom/autoprefix';

import click from 'dom/click';

// import clickVue from 'dom/click-vue';

import htmlToElems from 'dom/html-to-elems';

import imgsComplete from 'dom/imgs-complete';

import imgsLoader from 'dom/imgs-loader';

// import offsetXY from 'dom/offset-X-Y';

import scopeElements from 'dom/scope-elements';


/**
 * [坐标] 元素 相对 于内容窗口
 * 避免对body设置fixed，否则可能不准确
 *
 * @param elem 要获取的元素
 *
 * Created by cql on 2017/3/23.
 *
 * v1.0.1
 * 新增对fixed支持
 *
 * */
export function offsetXY(elem) {
    let top = 0,
        left = 0;

    if (elem === document) {
        return {top, left};
    }

    do {
        top += elem.offsetTop;
        left += elem.offsetLeft;

        let pre = elem;
        elem = elem.offsetParent;
        // 处理对fixed支持。由于fixed元素offsetParent直接就返回null，所以tagName取到的是自身。非fixed元素只有到body后才会返回null
        if (elem === null) {
            if (pre.tagName !== 'BODY') {
                top += getWindowScrollTop();
                left += getWindowScrollLeft();
            }
            break;
        }

    } while (true);

    return {top, left};
}

/**
 * 获取滚动条Top，浏览器窗口滚动条
 *
 * 兼容性：包括ie6的所有浏览器
 * */
export function getWindowScrollTop() {
    getWindowScrollTop = 'pageYOffset' in window ? function () {
        return pageYOffset;
    } : function () {
        return document.documentElement.scrollTop;
    };
    return getWindowScrollTop();
}


/**
 * 获取滚动条Top，浏览器窗口滚动条
 *
 * 兼容性：包括ie6的所有浏览器
 * */
export function getWindowScrollLeft() {
    getWindowScrollLeft = 'pageXOffset' in window ? function () {
        return pageXOffset;
    } : function () {
        return document.documentElement.scrollLeft;
    };
    return getWindowScrollLeft();
}


export {
    addCssText,
    addScript,
    click,
    scopeElements
}

