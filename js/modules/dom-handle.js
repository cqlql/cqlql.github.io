/**
 * dom操作汇总
 *
 * Created by cql on 2017/4/1.
 *
 *
 *
 */


import {} from 'common';

import addCssText from 'dom/add-css-text';

import addScript from 'dom/add-script';

import autoPrefix from 'dom/autoprefix';

import click from 'dom/click';

// import clickVue from 'dom/click-vue';

import htmlToElems from 'dom/html-to-elems';
import htmlToNodes from 'dom/html-to-nodes';

import imgsComplete from 'dom/imgs-complete';

import imgsLoader from 'dom/imgs-loader';

import scopeElements from 'dom/scope-elements';



/**
 * 转 DocumentFragment
 *
 * Created by cql on 2017/4/1.
 *
 *
 * @param newitems 元素集合,支持单个元素,可以是装载元素的数组,或者是jq对象，或者 HTMLCollection
 *                 这里没兼容html字符串是考虑到 node 和 elem 情况
 * @param cb 循环回调，每处理一个元素便回调一次，传入索引
 *
 * */
export function toFragment(newitems, cb = () => {
}) {
    let df = document.createDocumentFragment();
    let newCount = newitems.length;

    ///// 0 单个元素情况，直接返回
    if (newCount === undefined) {
        df.appendChild(newitems);
        cb(0, newitems);
        return df;
    }

    ///// 1 先处理第一个，识别 HTMLCollection 与 数组、jq对象
    let getItem = function (i) {
        return newitems[i]
    };
    let item = newitems[0];
    df.appendChild(item);
    cb(0, item);

    // HTMLCollection 情况
    if (newitems.length < newCount) {
        getItem = function () {
            return newitems[0]
        }
    }

    ///// 2 处理剩下的
    for (let i = 1; i < newCount; i++) {
        let item = getItem(i);
        df.appendChild(item);
        cb(i, item);
    }

    return df;
}


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
 * 图片尺寸 就绪 回调
 * 此时 图片只在加载中，但尺寸已就绪
 *
 * 参数：
 * 1、图片url
 * 2、就绪后 执行的函数。传入一个参数，格式：{w:0,h:0,img:img}
 *
 *
 * 兼容性：所有
 */
export function imgSizeComplete(src, f, err) {
    var img = new Image(),
        iserror = false;

    function tryExcu() {
        if (iserror) return;
        if (img.complete || img.width) {
            f(img);
            return;
        }

        setTimeout(tryExcu, 100)
    }

    img.onerror = function () {
        err && err(img);
        iserror = true;
    };

    img.src = src;

    tryExcu();
}

/**
 * 快捷键
 * ctrl+? 两键组合
 * ctrl+shift+? 三键组合
 *
 * 未实现
 * ctrl+alt+? 三键组合
 *
 * */
export function shortcutKey({
                                elem,
                                ctrl = () => {
                                },
                                ctrlShift = () => {
                                }
                            }) {
    let ctrlDown = false,
        shiftDown = false;

    elem.addEventListener('keydown', function (e) {

        if (e.keyCode === 17) {
            ctrlDown = true;
        }
        else if (e.keyCode === 16) {
            if (ctrlDown) {
                shiftDown = true;
            }
        }
        else {

            if (ctrlDown) {

                if (shiftDown) {
                    if (ctrlShift(e.keyCode) === false) {
                        e.preventDefault();
                    }
                }
                else if (ctrl(e.keyCode) === false) {
                    e.preventDefault();
                }


            }
        }
    });

    elem.addEventListener('keyup', function (e) {
        if (e.keyCode === 17) {
            ctrlDown = false;
        }
        else if (e.keyCode === 16) {
            shiftDown = false;
        }
    });

}

//#region 元素 className 操作
function hasClass(elem, className) {
    if (elem.classList) {
        hasClass = function (elem, className) {
            return elem.classList.contains(className);
        };
    }
    else {
        hasClass = function (elem, className) {
            return (' ' + elem.className + ' ').indexOf(' ' + className.trim() + ' ') > -1;
        }
    }
    return hasClass(elem, className);
}
function addClass(elem, className) {
    if (elem.classList) {
        addClass = function (elem, className) {
            elem.classList.add(className);
        };
    }
    else {
        addClass = function (elem, className) {
            if (hasClass(elem, className) === false) {
                elem.className = ((elem.className + ' ' + className).replace(/\s{2,}/g, ' ')).trim();
            }
        };
    }
    addClass(elem, className);
}
function removeClass(elem, className) {
    if (elem.classList) {
        removeClass = function (elem, className) {
            elem.classList.remove(className);
        }
    }
    else {
        removeClass = function (elem, className) {
            elem.className = (' ' + elem.className + ' ').replace(' ' + className.trim() + ' ', '');
        }
    }
    removeClass(elem, className);
}

//#endregion

//#region 取元素
/**
 * 紧邻同辈元素 获取
 * 获取某节点 紧邻的 上或下 单个 同辈元素节点

 @param node 节点对象，一般为元素节点
 @param isPrev * [bool] 能代表真假的任意值，默认是假，即下一个，否则上一个

 @return [node] 元素节点 或者为 null

 @compatibility 所有浏览器
 */
function siblingElement(node, isPrev) {

    var str = isPrev ? "previousSibling" : "nextSibling";

    do {
        node = node[str];
        if (node === null) return null;
    } while (node.nodeType !== 1);

    return node;
}

export function nextElementSibling(elem) {
    return elem.nextElementSibling;
}

/**
 * 元素查询
 *
 * id，className，tagName 包含着三种选择
 *
 * names 的顺序，需与文档元素同步
 * */
/*

 // 支持同名
 queryElements(eToolBar,'.name,.name',function (elems) {
 elmA = elems['.name'];
 elmB = elems['.name1'];
 });

 */
export function queryElements(rootElem, names, callback) {
    var name,
        resultElems = [],
        nameIds = {},
        test;

    if (typeof names === 'string') names = names.split(',');

    setName();

    go(rootElem.children);

    callback(resultElems);

    function go(childs) {

        var nameId = '';
        for (var i = 0, len = childs.length, elem; i < len; i++) {
            elem = childs[i];

            if (!name) {
                return false;
            }
            nameId = nameIds[name];
            if (!nameId) {
                nameId = nameIds[name] = '';
            }

            if (test(elem)) {

                resultElems.push(elem);
                resultElems[name + nameId] = elem;

                nameIds[name]++;

                setName();
            }

            go(elem.children);
        }

    }

    function setName() {
        name = names.shift();

        if (name) {
            var lName = name.substr(0, 1),
                rName = name.substr(1);
            if (lName === '.') {
                test = function (elem) {
                    return hasClass(elem, rName);
                };
            }
            else if (lName === '#') {
                test = function (elem) {
                    return elem.id === rName;
                };
            }
            else {
                test = function (elem) {
                    // html标签 tagName 大写，但svg标签 tagName 小写
                    return elem.tagName.toUpperCase() === name.toUpperCase();
                };
            }
        }
    }
}

//#endregion


///// node处理。比如 增加、删除、移动文档位置 等等

// 紧邻元素之后插入
/**
 *
 * 紧邻元素之后插入
 @param (element) item 位置元素。将紧邻此元素之后追加
 @param (HTMLCollection,NodeList,array,string) newItems 追加的元素，可以是多个。html可以标签文本随意组合

 @return (array) 新加的节点集合
 */
export function insertAfter(item, newItems) {
    var params = toFragment(newItems);

    elementInsertAfter(item, params);
    return params[1];

    function elementInsertAfter(item, newItem) {
        var next = nextElementSibling(item);

        if (next) {
            item.parentNode.insertBefore(newItem, next);
        } else {
            item.parentNode.appendChild(newItem);
        }
    }
}

export function insertBefore(item, newItems) {
    var params = toFragment(newItems);
    item.parentNode.insertBefore(params[0], item);
    return params[1];
}

/////
export function each(obj, fn) {
    var
        key,
        len = obj.length;

    if (len === undefined) {
        for (key in obj) {
            if (fn(key, obj[key]) === false) {
                break;
            }
        }
    }
    else {
        for (key = 0; key < len; key++) {
            if (fn(key, obj[key], len) === false) {
                break;
            }
        }
    }
}

//#region 仿Jq
/**
 * 仿jq链式调用
 *
 * @param elems html 文本、单个元素、元素集合
 *
 *
 **/
function Dom(elems) {

    // html
    if (typeof elems === 'string') {
        elems = htmlToElems(elems);
    }

    let count = elems.length;

    ///// 0 单个元素情况，直接返回
    if (count === undefined) {
        this[0] = elems;
        this.length = 0;
        return;
    }

    ///// 1 处理剩下的
    for (let i = 0; i < count; i++) {
        this[i] = elems[i];
    }
    this.length = count;
}

Dom.prototype = {
    next(){
        return new Dom(nextElementSibling(this[0]));
    },
    each(cb){
        for (let i = 0, len = this.length, elem; i < len; i++) {
            elem = this[i];
            if (cb.call(elem, i, elem) === false)break;
        }
        return this;
    },
    hasClass(className){

        return hasClass(this[0], className);
    },

    addClass(className){
        return addClass(this[0], className);
    },
    removeClass(className){
        return removeClass(this[0], className);
    }
};


function dom(elem) {
    return new Dom(elem);
}
//#endregion

export {
    addCssText,
    addScript,
    click,
    scopeElements,
    htmlToElems,htmlToNodes,
    autoPrefix,
    dom as $
}

