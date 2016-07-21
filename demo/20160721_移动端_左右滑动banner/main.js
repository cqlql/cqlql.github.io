/**
 * Created by SD01 on 2016/7/19.
 */

'use strict';
swipe({
    eBox: document.querySelector('.banner')
});

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
    this.end = function (swipeLeft, swipeRight, reset) {

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
                reset();
            }

        }
        else {
            // 不小心模拟了click事件
            // move根本就没触发情况
        }
    };
}

/*
 * 能够区分滚动条的滑动
 * 固定为一点触摸
 *
 * */
function swipe(params) {
    var
        eBox = params.eBox,
        eMove = eBox.children[0],
        eBtnBox = eBox.children[1],
        eItems = eMove.children,
        count = eItems.length,
        eBtns = eBtnBox.children,

        // swipeLeft = params.swipeLeft,
        // swipeRight = params.swipeRight,
        // reset = params.reset,
        // move = params.move,

        boxW = eBox.clientWidth,

        swipeBase = new SwipeBase,

        transform = getRightCssName('transform')[1],
        transition = getRightCssName('transition')[1],

        // 记录点下的坐标
        startX, startY,

        // 拖动情况 松开时 是否进行滑动的最大偏移值
        offset = boxW / 3,

        // 实现区分滚动条
        // 0 没反映，1 x 方向，2 y 方向
        status = 0,

        // 拖动的长度
        dragLen,

        // 当前显示项索引
        index = 0;

    for (var i = 0, btnHtml = ''; i < count; i++) {
        // 初始化项的位置
        eItems[i].style[transform] = 'translateX(' + (i * 100) + '%)';

        // 拼接按钮
        btnHtml += '<li' + (i ? '' : ' class="active"') + '></li>';
    }
    eBtnBox.innerHTML = btnHtml;

    eBox.addEventListener('touchstart', function (e) {

        var touches = e.touches;

        if (touches.length === 1) {
            start(touches[0]);
        }

    });

    eBox.addEventListener('touchmove', function (e) {
        var touches = e.touches;
        move(touches[0], e);
    });

    eBox.addEventListener('touchend', function (e) {
        if (e.touches.length === 0) end();
    });

    function start(touche) {
        startX = touche.pageX;
        startY = touche.pageY;

        swipeBase.start(startX);

        dragLen = 0;
        status = 0;

        eMove.style[transition] = '0s';
    }

    function move(touche, e) {
        console.log(status);
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

            swipeBase.move(touche.pageX, function (toX) {
                dragLen += toX;
                eMove.style[transform] = 'translate3d(' + ((-index * boxW) + dragLen ) + 'px,0,0)';
            });
            e.preventDefault();
        }
    }

    function end() {
        if (status === 1) {
            swipeBase.end(swipeLeft, swipeRight, function () {
                // 未滑动，拖动情况

                // 超过一般情况 滑动
                if (Math.abs(dragLen) > offset) {

                    if (dragLen > 0) {
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
            });
        }
    }

    function swipeLeft() {
        var i = index;
        i++;
        if (i >= count) {
            i = count - 1;
        }
        change(i);
        anime();
    }

    function swipeRight() {
        var i = index;
        i--;
        if (i < 0) {
            i = 0;
        }
        change(i);
        anime();
    }

    function reset() {
        anime();
    }

    function change(i) {
        if (i !== index) {
            eBtns[index].classList.remove('active');
            eBtns[i].classList.add('active');
            index = i;

            // 按需加载
            var eItem = eItems[index];
            if (!eItem._data_isComplete) {
                var img = eItem.children[0],
                    imgUrl = img.dataset.src;
                if (imgUrl) img.src = imgUrl;
                eItem._data_isComplete = 1;
            }
        }
    }

    function anime() {

        eMove.style[transition] = '0.3s';

        eMove.style[transform] = 'translate3d(' + (-index * boxW) + 'px,0,0)';

    }

}

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