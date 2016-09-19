'use strict';

var c = {};

c.each = function (obj, fn) {
    var
        key,
        len = obj && obj.length;

    if (len === undefined) {
        for (key in obj) {
            if (fn(key, obj[key]) === false) {
                break;
            }
        }
    } else {
        for (key = 0; key < len; key++) {
            if (fn(key, obj[key], len) === false) {
                break;
            }
        }
    }
};

c.hasClass = function (elem, className) {
    if (elem.classList) {
        c.hasClass = function (elem, className) {
            return elem.classList.contains(className);
        };
    }
    else {
        c.hasClass = function (elem, className) {
            return (' ' + elem.className + ' ').indexOf(' ' + className.trim() + ' ') > -1;
        }

    }
    return c.hasClass(elem, className);
};
c.addClass = function (elem, className) {
    if (elem.classList) {
        c.addClass = function (elem, className) {
            elem.classList.add(className);
        };
    }
    else {
        c.addClass = function (elem, className) {
            if (c.hasClass(elem, className) === false) {
                elem.className = c.trim((elem.className + ' ' + className).replace(/\s{2,}/g, ' '));
            }
        };
    }
    c.addClass(elem, className);
};
c.removeClass = function (elem, className) {
    if (elem.classList) {
        c.removeClass = function (elem, className) {
            elem.classList.remove(className);
        }
    }
    else {
        c.removeClass = function (elem, className) {
            elem.className = (' ' + elem.className + ' ').replace(' ' + c.trim(className) + ' ', '');
        }
    }
    c.removeClass(elem, className);
};

c.htmlToNodes = function (html) {
    var elem = document.createElement('div');
    elem.innerHTML = html;
    return elem.childNodes;
};
// html -> elem
/*
 html转对象，返回一个新div，html是此div对象的内容
 */
c.htmlToElem = function (html) {
    var eTemp = document.createElement('div');
    eTemp.innerHTML = html;
    return eTemp;
};
// html -> elems
c.htmlToElems = function (html) {
    return this.htmlToElem(html).children;
};

c.relativeXY = function (initial, target) {
    var x = 0, y = 0,
        _target = initial;
    target = target || document.body;

    while (_target !== target) {
        x += _target.offsetLeft;
        y += _target.offsetTop;

        _target = _target.offsetParent;
    }

    return {x: x, y: y};
};

// 内部开始处插入。支持内部节点前插入
c.prependChild = function (eBox, newItems) {
    var params = this.toFragment(newItems),
        chils = eBox.childNodes;

    if (chils.length) {
        eBox.insertBefore(params[0], chils[0]);
    }
    else {
        eBox.appendChild(params[0]);
    }

    return params[1];
};

c.toFragment = function (newItems) {
    var fragment = document.createDocumentFragment(),
        elems = [];

    if (typeof newItems === 'string') {
        newItems = this.htmlToNodes(newItems);
    }

    // 单个元素情况
    if (newItems.length === undefined || newItems.nodeType === 3) {
        newItems = [newItems];
    }

    if (newItems.constructor === HTMLCollection || newItems.constructor === NodeList) {
        // HTMLCollection 集合情况。此集合特性将取一个就会少一个
        for (var i = 0, that, len = newItems.length; i < len; i++) {
            that = newItems[0];
            fragment.appendChild(that);
            elems.push(that);
        }
    } else {
        // 此处考虑了类似jq集合情况
        c.each(newItems, function (i, that) {
            fragment.appendChild(that);
        });
        elems = newItems;
    }

    return [fragment, elems];
};

c.SwitchSelect = function (className) {

    var currItem = document.createElement('div');

    className = className ? className : 'active';

    this.select = function (eItem, goOn, must) {

        if (currItem !== eItem || must) {
            c.removeClass(currItem, 'active');
            c.addClass(eItem, 'active');

            currItem = eItem;

            goOn && goOn();
        }
    };

    this.getCurr = function () {
        return currItem;
    };
};
c.Multiselect = function (className) {
    className = className ? className : 'active';

    var selectData = {},
        index = 0;

    this.select = function (elem, goOn, must) {
        var id = elem.getAttribute('data-id'),isSelect;

        if (id === null) {
            elem.setAttribute('data-id', index);
            id = index;
            index++;
        }

        if (c.hasClass(elem, className)) {
            c.removeClass(elem, className);
            delete selectData[id];
        }
        else {
            c.addClass(elem, className);
            selectData[id] = elem;
            isSelect=1;
        }
        if(isSelect || must){
            goOn && goOn();
        }
    };
    
    this.eachSelect=function (cb) {
        for(var k in selectData){
            cb(selectData[k]);
        }
    };
};

c.scopeElements = function (targetElem, listener) {
    targetElem = targetElem.nodeType === 1 ? targetElem : targetElem.parentElement
    go(targetElem);
    function go(that, child) {
        if (listener(that, child) !== false) {
            go(that.parentElement, that);
        }
    }
};

c.setCss = function (elem, name, value) {
    var style = elem.style;

    if (typeof name === 'string') {
        style[c.getRightCssName(name)[1]] = value;
    }
    else {
        for (var k in name) {
            style[c.getRightCssName(k)[1]] = name[k];
        }
    }
};
c.getCss = function (elem, name) {

    if (window.getComputedStyle) {
        c.getCss = function (elem, name) {

            var style = getComputedStyle(elem, null);
            return style[c.getRightCssName(name)[0]];

        };
    }
    else {
        c.getCss = function (elem, name) {
            return elem.currentStyle[c.getRightCssName(name)[0]];
        };
    }

    return c.getCss(elem, name);
};
c.getRightCssName = function (cssPropertyName) {
    // 如果有直接返回
    var propertyName = c.getRightCssName[cssPropertyName];
    if (propertyName !== undefined) return propertyName;

    var
        firstLetter = cssPropertyName[0],
        firstLetterUpper = firstLetter.toUpperCase(),
        cssPrefixes = ["ms" + firstLetterUpper, "Moz" + firstLetterUpper, "webkit" + firstLetterUpper, firstLetter],
        cssPrefixesReal = ["-ms-", "-Moz-", "-webkit-", ''],
        style = document.body.style,
        // css名称转换
        name = cssPropertyName.replace(/-\w/g, function (d) {
            return d[1].toUpperCase();
        }).substr(1);

    for (var i = cssPrefixes.length, newName; i--;) {
        newName = cssPrefixes[i] + name;

        if (newName in style) {
            propertyName = [cssPrefixesReal[i] + cssPropertyName, newName];
            break;
        }
    }

    propertyName = propertyName || null;

    c.getRightCssName[cssPropertyName] = propertyName;

    return propertyName;
};

module.exports = c;


