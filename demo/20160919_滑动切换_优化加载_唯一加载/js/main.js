/**
 * Created by cql on 2016/9/19.
 */

var c = (function () {
    var c = {};

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
        c.hasClass(elem, className);
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
        c.addClass(elem, className);
    };

    /*
     * 元素查询
     *
     * id，className，tagName 包含着三种选择
     * */
    c.queryElements = function (rootElem, names, callback) {
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
                        return c.hasClass(elem, rName);
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
    };


    /**
     * 取css正确名称
     * 自动加前缀
     * 可用 box-flex 进行测试
     *
     * @param cssPropertyName {string} 减号方式的css名称
     * @return {Array} 数组中有两个值，第一个是 减号风格，第二个是驼峰。如果不支持此属性，返回null
     *
     * */
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

    // 代替 Velocity 的新方式
    c.SwipeBase = function () {

        var prevXData, toX, i;

        this.start = function (x) {
            i = 0;
            prevXData = {};
            prevXData[i] = x;
        };

        this.move = function (x, excu) {
            i++;
            prevXData[i] = x;
            excu(x - prevXData[i - 1]);
        };
        this.end = function (swipeLeft, swipeRight, swipeNot) {

            if (i) {
                if (i < 2) {
                    i++;
                    prevXData[i] = prevXData[i - 1];
                }

                var toX = prevXData[i] - prevXData[i - 2];

                var s = 10;// 此处调节敏感度
                if (toX > s) {
                    // 右滑动
                    swipeRight();
                }
                else if (toX < -s) {
                    // 左滑动
                    swipeLeft();
                }
                else {
                    // 未发送滑动，但有移动
                    swipeNot();
                }

            }
            else {
                // 不小心模拟了click事件
                // move根本就没触发情况
            }
        };
    };


    return c;
})();

c.swipeXScroll = function (params) {
    var
        eBox = params.eBox,

        swipeLeft = params.swipeLeft,
        swipeRight = params.swipeRight,
        swipeNot = params.swipeNot,

        onstart = params.onstart,
        onmove = params.onmove,
        onend = params.onend || function () {
            },

        // 记录点下的坐标。目前此处主要用来区分滚动情况
        startX, startY,

        // 实现区分滚动条
        // 0 没反映，1 x 方向，2 y 方向
        status = 0,

        isStart = false,// 是否已经开始。true表示已经开始

        swipeBase = new c.SwipeBase;


    eBox.addEventListener('touchstart', function (e) {
        touchstart(e);
    });

    eBox.addEventListener('touchmove', function (e) {
        touchmove(e);
    });

    eBox.addEventListener('touchend', function (e) {
        touchend(e);
    });

    function touchstart(e) {
        swipeStart(e);
    }

    function touchmove(e) {
        if (isStart) {
            var touche = e.touches[0];
            if (status === 0) {
                var x = touche.pageX - startX,
                    y = touche.pageY - startY;

                if (Math.abs(x) > Math.abs(y)) {
                    status = 1;
                }
                else {
                    status = 2;
                }
            }
            if (status) {

                swipeBase.move(touche.pageX, onmove);

                e.preventDefault();
            }
        }
    }

    function touchend(e) {
        if (isStart && status) {
            if (e.touches.length) {
                swipeStart(e);
            }
            else {
                swipeBase.end(swipeLeft, swipeRight, swipeNot);

                onend();

                isStart = false;
            }
        }
    }

    function swipeStart(e) {
        if (onstart() === false)return;

        isStart = true;

        var touche = e.touches[0];

        startX = touche.pageX;
        startY = touche.pageY;

        swipeBase.start(startX);

        e.preventDefault();
    }
};

(function () {

    var
        totalPage = 6,
        eBox = document.body.children[0],
        eMidBox = eBox.children[0].children[1],

        eTit1, eTit2, eTit3, eCont;


    c.queryElements(eBox, '.tit,.tit,.cont,.tit', function (elems) {
        eTit1 = elems[0];

        eTit2 = elems[1];
        eCont = elems[2];
        eTit3 = elems[3];
    });

    var sliderOneLoad = new SliderOneLoad({
        eBox: eBox,
        totalPage: totalPage,

        // 准备加载，加载前
        loadBefore: function () {
            eBox.classList.add('loading');
        },
        // 数据开始加载
        onload: onload
    });

    onload(0);

    function onload(page) {

        titUpdate(page);

        if (page < totalPage) {

            eCont.innerHTML = page;
            // eCont.innerHTML = getQuesHtml(d, page);

        }
        else {
            // 最后一页情况
            // eCont.innerHTML = getSubmitHtml();
            eCont.innerHTML = page;

        }
        eBox.classList.remove('loading');
    }

    // 此参数 page 从 0 开始
    function titUpdate(page) {

        eTit1.innerHTML = getTit(page);
        eTit2.innerHTML = getTit(page + 1);
        eTit3.innerHTML = getTit(page + 2);

        // 此参数 page 从 1开始
        function getTit(page) {

            var tit = '';
            if (page > totalPage || page < 1) {
                tit = '&nbsp;';
            }
            else {
                tit = '<b>' + page + '</b>/' + totalPage
            }

            return tit;
        }
    }
})();

function SliderOneLoad(params) {
    var
        onload = params.onload,
        loadBefore = params.loadBefore,
        eBox = params.eBox,
        eMove = eBox.children[0],
        eItems = eMove.children,
        totalPage = params.totalPage,

        boxW,
        // 拖动情况 松开时 是否进行滑动的最大偏移值
        offset,

        transform = c.getRightCssName('transform')[1],
        transition = c.getRightCssName('transition')[1],

        // 拖动的长度
        moveLength = 0,

        isRun = false,

        // 是否需要加载页面
        // 因为 onload 方法是在 transitionend 中调用的，transitionend 在没有触发 change 情况下也可能会执行。所以需要这个开关
        isLoad = false,

        // 方向标识  0 往左  1 原地  2 往右
        targetId,

        // 当前显示项索引
        index = 0;

    resetWidth();

    c.swipeXScroll({
        eBox: eBox,
        swipeLeft: swipeLeft,
        swipeRight: swipeRight,
        swipeNot: function () {
            // ('未发生，但有移动');

            // 超过一般情况 滑动
            if (Math.abs(moveLength) > offset) {

                if (moveLength > 0) {
                    swipeRight();
                }
                else {
                    swipeLeft();
                }
            }
            else {
                // 复位
                reset();
            }
        },
        onstart: function () {
            if (isRun) return false;
            eMove.style[transition] = '0s';
        },
        onmove: function (to) {
            moveLength += to;
            setMoveX(moveLength - boxW);
        },
        onend: function () {
            moveLength = 0;
        }
    });

    // eBox.addEventListener("webkitTransitionEnd", transitionend);
    // eBox.addEventListener("transitionend", transitionend);

    this.go = function (i) {
        if (i === index)return;

        if (i > index) {
            targetId = 2;
        }
        else {
            targetId = 0;
        }

        change(i);
        anime();
    };

    this.resetWidth = resetWidth;

    function resetWidth() {
        boxW = eBox.clientWidth;
        offset = boxW / 3;
        setMoveX(-boxW);
    }

    function transitionend() {
        isRun = false;

        eMove.style[transition] = '0s';
        setMoveX(-boxW);

        if (isLoad) {
            onload(index);
            isLoad = false;
        }
    }

    function swipeLeft() {
        var i = index;
        i++;

        if (i >= totalPage) {
            i = totalPage - 1;
            targetId = 1;
        }
        else {
            targetId = 2;
            change(i);
        }

        anime();
    }

    function swipeRight() {
        var i = index;
        i--;

        if (i < 0) {
            i = 0;
            targetId = 1;
        }
        else {
            targetId = 0;
            change(i);

        }

        anime();
    }

    function reset() {
        targetId = 1;
        anime();
    }

    function change(i) {
        index = i;

        // eItems[index].classList.add('loading');

        loadBefore(index);

        isLoad = true;
    }

    function anime() {
        isRun = true;
        eMove.style[transition] = '0.3s';

        setMoveX(-targetId * boxW);

        setTimeout(transitionend, 300);
    }

    function setMoveX(x) {
        eMove.style[transform] = 'translate3d(' + x + 'px,0,0)';
    }

}
