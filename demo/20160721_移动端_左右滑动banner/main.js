/**
 * Created by SD01 on 2016/7/19.
 */

'use strict';

banner();

// 代替 Velocity 的新方式
function SwipeBase() {

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
}

/**
 * x方向，考虑滚动手势的滑动
 * 此滑动手势封装考虑了多点，对于拥有多种手势的功能可能不适用，此种情况需定制
 *
 * @param onstart 滑动开始触发，可通过 return false 可阻止往下进行
 *
 */
function swipeXScroll(params) {
    var
        eBox = params.eBox,

        swipeLeft = params.swipeLeft,
        swipeRight = params.swipeRight,
        swipeNot = params.swipeNot,
        onstart = params.onstart,
        onmove = params.onmove,
        // onend = params.onend,

        // 记录点下的坐标
        startX, startY,

        // 实现区分滚动条
        // 0 没反映，1 x 方向，2 y 方向
        status = 0,

        isStart = false,// 是否已经开始。true表示已经开始

        // 记录多点数据
        touchesData;

    eBox.addEventListener('touchstart', function (e) {

        var touches = e.touches,
            len = touches.length;

        if (len === 1) {
            start(touches[0]);
        }
        else {
            each(len, function (i) {
                startAgain(touches[i]);
            });
        }
    });

    eBox.addEventListener('touchmove', function (e) {
        var touches = e.touches;
        each(touches.length, function (i) {
            move(touches[i], e);
        });
    });

    eBox.addEventListener('touchend', function (e) {
        var touches = e.touches,
            changedTouches = e.changedTouches;
        if (touches.length === 0) {
            end(changedTouches[0]);
        }
        else {
            each(changedTouches.length, function (i) {
                delete  touchesData[changedTouches[i].identifier];
            });
            each(touches.length, function (i) {
                startAgain(touches[i], i);
            });
        }
    });

    function each(len, fn) {
        while (len--) {
            fn(len);
        }
    }

    function start(touche) {

        if (onstart() === false)return;

        startX = touche.pageX;
        startY = touche.pageY;

        status = 0;
        isStart = true;// 已经开始

        var data = {
            swipeBase: new SwipeBase
        };

        data.swipeBase.start(startX);


        touchesData = {};
        touchesData[touche.identifier] = data;
    }

    function startAgain(touche) {
        var id = touche.identifier;

        if (touchesData[touche.identifier]) {
            return;
        }

        var data = {
            swipeBase: new SwipeBase
        };

        data.swipeBase.start(touche.pageX);

        touchesData[id] = data;
    }

    function move(touche, e) {
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

        if (status === 1) {
            if (isStart) {
                touchesData[touche.identifier].swipeBase.move(touche.pageX, onmove);
            }
            e.preventDefault();
        }
    }

    function end(touche) {

        if (status === 1) {

            if (isStart) {
                touchesData[touche.identifier].swipeBase.end(swipeLeft, swipeRight, swipeNot);
                isStart = false;
            }
        }
    }

}


/**
 * 轮播：普通常用
 * 很基础的轮播，只有box move item 三种主要元素
 *
 * 支持 动画结束后才能进行下一步操作。见 anime 函数
 *
 * 关于滑动频繁无法触发 transitionend 事件bug：已解决
 * 是因为 onmove、onend 有可能绕过 onstart ，紧跟着 transitionend 后触发。没发生移动就造成 swipe 执行，就是原地执行了anime，开启了 isRun，却没关闭 isRun，解决办法是，必须保证 onstart 后，才会触发 onmove、onend，这就100%保证只有发生移动才会触发swipe
 *
 * */
function slider(params) {
    var eBox = params.eBox,
        each = params.each,
        onchange = params.onchange,
        eMove = eBox.children[0],
        eItems = eMove.children,
        count = eItems.length,

        boxW = eBox.clientWidth,

        transform = getRightCssName('transform')[1],
        transition = getRightCssName('transition')[1],

        // 拖动的长度
        moveLength = 0,

        // 拖动情况 松开时 是否进行滑动的最大偏移值
        offset = boxW / 3,

        isRun = false,// 是否动画进行中

        // 当前显示项索引
        index = 0;

    for (var i = 0, btnHtml = ''; i < count; i++) {
        // 初始化项的位置
        eItems[i].style[transform] = 'translateX(' + (i * 100) + '%)';

        each(i);
    }

    swipeXScroll({
        eBox: eBox,
        swipeLeft: swipeLeft,
        swipeRight: swipeRight,
        swipeNot: function () {
            // 未发生，但有移动;

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
            moveLength = 0;
            eMove.style[transition] = '0s';
        },
        onmove: function (to) {
            moveLength += to;
            eMove.style[transform] = 'translate3d(' + ((-index * boxW) + moveLength ) + 'px,0,0)';
        }
    });

    eBox.addEventListener("webkitTransitionEnd", transitionend);
    eBox.addEventListener("transitionend", transitionend);

    function transitionend() {
        isRun = false;
    }

    function swipeLeft() {
        var i = index;
        i++;
        if (i >= count) {
            i = count - 1;
        }
        else {
            change(i);
        }
        anime();
    }

    function swipeRight() {
        var i = index;
        i--;
        if (i < 0) {
            i = 0;
        }
        else {
            change(i);
        }
        anime();
    }

    function reset() {
        anime();
    }

    function change(i) {
        onchange(eItems[i], index, i);
        index = i;
    }

    function anime() {
        isRun = true; // 将开启 只有动画结束后才能进行下一步操作
        eMove.style[transition] = '.3s';
        eMove.style[transform] = 'translate3d(' + (-index * boxW) + 'px,0,0)';
    }
}

/**
 * banner：普通常用
 * 主要元素：box move item bottomBtn
 * */
function banner() {

    var eBox = document.querySelector('.banner'),
        eBtnBox = eBox.children[1],
        eBtns = eBtnBox.children,

        btnHtml = '';

    slider({
        eBox: eBox,
        each: function (i) {
            // 拼接按钮
            btnHtml += '<li' + (i ? '' : ' class="active"') + '></li>';
        },
        onchange: function (eItem, prevIndex, index) {
            eBtns[prevIndex].classList.remove('active');
            eBtns[index].classList.add('active');
            // 按需加载
            if (!eItem._data_isComplete) {
                var img = eItem.children[0],
                    imgUrl = img.dataset.src;
                if (imgUrl) img.src = imgUrl;
                eItem._data_isComplete = 1;
            }
        }
    });

    eBtnBox.innerHTML = btnHtml;
}

/**
 * 基础方法
 * */
function getRightCssName(cssPropertyName) {
    var
        firstLetter = cssPropertyName[0],
        firstLetterUpper = firstLetter.toUpperCase(),
        cssPrefixes = ["ms" + firstLetterUpper, "Moz" + firstLetterUpper, "webkit" + firstLetterUpper, firstLetter],
        cssPrefixesReal = ["-ms-", "-Moz-", "-webkit-", ''],
        style = document.body.style,
        name = toStyleName(cssPropertyName).substr(1);

    for (var i = cssPrefixes.length, newName; i--;) {
        newName = cssPrefixes[i] + name;

        if (newName in style) {
            return [cssPrefixesReal[i] + cssPropertyName, newName];
        }
    }
    return null;
}
function toStyleName(cssPropertyName) {
    return cssPropertyName.replace(/-\w/g, function (d) {
        return d[1].toUpperCase();
    });
}