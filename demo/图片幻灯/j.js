

var core = {},
    common = {};

core.imageSize = function () {

    var loopTry = new core.loopTry_v2(),
        img = new Image();

    this.excu = function (src, f) {

        img = new Image();

        img.onerror = function () {

            f({ width: 0, height: 0 }, img);

            loopTry.stop();
        };

        img.src = src;

        //返回false 将跳出 循环
        loopTry.excu(function () {

            if (img.complete || img.width) {
                f({ width: img.width, height: img.height }, img);
                return false;
            }
        });
    };

    this.stop = function () {
        img.removeAttribute('src');
        loopTry.stop();
    };
};

core.loopTry_v2 = function () {

    var stopId;
    this.excu = function (tryFn, time) {

        time = time === undefined ? 100 : time
        function fn() {
            if (tryFn() !== false) {
                stopId = setTimeout(fn, time);
            }
        }
        stopId = setTimeout(fn, time);
    };

    this.stop = function () {
        clearTimeout(stopId);
    };

};

core.delayExcu = function () {
    var stopId = null;

    function clear() {
        if (stopId !== null) {

            clearTimeout(stopId);

            stopId = null;

            return true;
        }
        return false;
    }

    this.excu = function (fn, time) {
        time = time === undefined ? 200 : time;
        clear();
        stopId = setTimeout(function () {
            fn();
            stopId = null;
        }, time);
    };

    this.clear = clear;
};
core.validExcu = function () {
    var timeId = null;

    function clear() {
        if (timeId) {
            clearTimeout(timeId);
            timeId = null;
        }
    }

    this.excu = function (callBack, time) {
        clear();

        timeId = setTimeout(function () {
            timeId = null;
            callBack();
        }, time || 200);
    };

    this.clear = clear;

};
//#region 滚轮
/*
core.mouseWheel(jMainBox[0], function (e) {
    var pre;
    if (e.wheelDelta) //前120 ，后-120
        pre = e.wheelDelta > 0;
    else //firefox
        pre = e.detail < 0;

    if (pre) {
        //*往上滚

    } else {
        //*往下滚

    }

    //阻止滚动条滚动
    if (e.cancelable) e.preventDefault();
    return false;
});
*/
core.mouseWheel = function (dom, f) {
    if (dom.addEventListener) {
        if (dom.onmousewheel === undefined) dom.addEventListener('DOMMouseScroll', f, false);//firefox
        else dom.addEventListener('mousewheel', f, false);
    } else {
        dom.attachEvent('onmousewheel', f);//ie678
    }
};
core.removeMouseWheel = function (dom, f) {
    if (dom.addEventListener) {
        if (dom.onmousewheel === undefined) dom.removeEventListener('DOMMouseScroll', f, false);//firefox
        else dom.removeEventListener('mousewheel', f, false);
    } else {
        dom.detachEvent('onmousewheel', f);//ie678
    }
};
//#endregion


//#region 箭头居中

common.arrowCenter = function (params) {
    function update() {
        var
            st = wJq.scrollTop(),
            to,
            btnH = 105,
            _v;

        if (st < boxTop) {
            _v = bh + boxTop - st;
            if (_v > winH) _v = winH;
            to = _v - boxTop + st
            to = (to - btnH) / 2;
        }
        else {
            to = bh + boxTop - st;

            if (to > winH) to = winH;

            to = (to - 72) / 2 + st - boxTop;
        }
        if (to < 0) { to = 0; }
        else if (to > bh - btnH) { to = bh - btnH; }

        jArrows.css('top', to);
    }

    ///
    var
        jArrows = params.jArrows,
        boxTop = params.boxTop,
        winH = wJq.height(),
        bh;

    wJq.resize(function () {
        winH = wJq.height();

        update();
    });
    wJq.scroll(update);

    this.update = function (h) {
        bh = parseFloat(h);
        update();
    };
};

//#endregion

//#region 放大处理
common.zoomHandle = function (jBox) {
    var zoomWH = 210,
        zoomBoxBorderW = 2;

    var zoomBox = $('<div>').appendTo(jBox).css({
        position: 'absolute',
        zIndex: 1,
        background: '#fff',
        width: zoomWH,
        height: zoomWH,
        overflow: 'hidden',
        border: zoomBoxBorderW + 'px solid #ddd',
        'border-radius': core.is360 ? 'none' : '50%',
        'box-shadow': '3px 6px 16px rgba(0, 0, 0, 0.6)',
        display: 'none',
        cursor: 'none'
    }).append('<img/><div style="position: absolute;width: 100%;height: 100%;border-radius: ' + (core.is360 ? 'none' : '50%') + ';box-shadow: rgb(0, 0, 0) 0 0 8px inset;"></div>'),
        bigImg = zoomBox.children('img').css({ position: 'absolute' }),
        oZoomCore = new zoomCore({
            box: jBox,
            zoomBox: zoomBox,
            bigImg: bigImg
        });

    //放大核心
    function zoomCore(params) {
        var
            //直接给参
            w = 1000,
            h = 667,
            zoomWH = 240,
            multiple = 2,
            boxBorderW = 10,
            zoomBoxBorderW = 10,

            //dom
            box = params.box,
            zoomBox = params.zoomBox,
            bigImg = params.bigImg,

            //*公共
            boxXY = box.offset(),
            zoomBoxWHHalf,
            zoomBoxEntityWHHalf,
            noExcu = false,//是否要执行
            isTransparent = false
        ;

        wJq.resize(function () { boxXY = box.offset(); });

        this.update = function (params) {

            w = params.w;
            h = params.h;
            zoomWH = params.zoomWH;
            multiple = params.multiple;
            boxBorderW = params.boxBorderW;
            zoomBoxBorderW = params.zoomBoxBorderW;

            zoomBoxEntityWHHalf = (zoomWH + zoomBoxBorderW * 2) / 2;
            zoomBoxWHHalf = zoomWH / 2;

            bigImg.width(w * multiple).height(h * multiple);

            noExcu = false;
        };

        this.stop = function () {
            noExcu = true;
            overflowHandle(true);
        };

        //超出界限 处理
        var overflowHandle = (function () {
            var zoomBoxState = false;//false 表示 隐藏

            return function (isOverflow) {
                if (isOverflow && zoomBoxState) {
                    zoomBox.hide();
                    zoomBoxState = false;
                }
                else if (!isOverflow && !zoomBoxState) {
                    zoomBox.show();
                    zoomBoxState = true;
                }
            };
        })();

        box.mousemove(function (eve) {

            if (noExcu) return;

            toTransparent();

            var x, y, pageX, pageY, isOverflow = false;

            eve = eve || window.event;

            //光标相对 于 浏览器内容窗口 坐标
            pageX = eve.pageX ? eve.pageX : document.documentElement.scrollLeft + eve.clientX;
            pageY = eve.pageY ? eve.pageY : document.documentElement.scrollTop + eve.clientY;

            //光标相对于 被放大块 的坐标
            x = pageX - boxXY.left - boxBorderW;
            y = pageY - boxXY.top - boxBorderW;

            if (x < 0) {
                x = 0;
                isOverflow = true;
            }
            else if (x > w) {
                x = w;
                isOverflow = true;
            }
            if (y < 0) {
                y = 0;
                isOverflow = true;
            }
            else if (y > h) {
                y = h;
                isOverflow = true;
            }

            overflowHandle(isOverflow);

            zoomBox.css({ left: x - zoomBoxEntityWHHalf, top: y - zoomBoxEntityWHHalf });
            bigImg.css({ left: -x * multiple + zoomBoxWHHalf, top: -y * multiple + zoomBoxWHHalf });
        });

        box.hover(function () {
            noExcu || toTransparent();
        }, function () {
            noExcu || box.children('img').animate({ opacity: 1 }, { queue: false });
            isTransparent = false;
        });

        function toTransparent() {
            if (isTransparent === false) {
                box.children('img').animate({ opacity: .8 }, { queue: false });
                isTransparent = true;
            }
        }
    }

    function load(isZoom, params) {
        if (isZoom) {
            bigImg[0].src = params.src;

            oZoomCore.update({
                w: params.boxW,
                h: params.boxH,
                zoomWH: zoomWH,
                multiple: params.multiple,
                boxBorderW: 0,
                zoomBoxBorderW: zoomBoxBorderW
            });
        } else {
            oZoomCore.stop();
        }
    }

    load(false);

    return load;
};

//#endregion

common.imgFullByBox_v1 = function (params) {

    var
        boxWidth = params.boxWidth,
        boxHeight = params.boxHeight,
        width = params.width,
        height = params.height,
        PR = params.PR === undefined ? '' : 'margin-',

        boxRatio = boxWidth / boxHeight,
        ratio = width / height,
        w, h, x, y, whxy;

    if (boxRatio > ratio) {
        w = boxWidth;
        h = boxWidth / ratio;
        x = 0;
        y = -(h - boxHeight) / 4;
    }
    else {

        w = boxHeight * ratio;
        h = boxHeight;
        x = -(w - boxWidth) / 2;
        y = 0;
    }

    whxy = { width: w || boxWidth, height: h || boxHeight };


    whxy[PR + 'left'] = x || 0;
    whxy[PR + 'top'] = y || 0;

    return whxy;
}

//使用举例：common.imgCenterByBox_v1({ boxWidth: 90, boxHeight: 90, width: img.width, height: img.height });
//@param PR 是否使用 margin 前缀。默认不使用。非undefined 都将使用
common.imgCenterByBox_v1 = function (params) {

    var boxWidth = params.boxWidth,
        boxHeight = params.boxHeight,
        width = params.width,
        height = params.height,
        PR = params.PR === undefined ? '' : 'margin-',

        boxR = boxWidth / boxHeight,
        r = width / height,

        left, top, whxy;

    if (boxR > r) {
        height = boxHeight;

        width = height * r;

        left = (boxWidth - width) / 2;
        top = 0;
    }
    else {
        width = boxWidth;

        height = width / r;

        left = 0;
        top = (boxHeight - height) / 2;
    }

    whxy = { width: width ? width : 0, height: height ? height : 0 };

    whxy[PR + 'left'] = left ? left : 0;
    whxy[PR + 'top'] = top ? top : 0;

    return whxy;

};

//#region 浏览器窗口滚动条动画

/*
调用举例：

//动画
$(window).scrollRun(1000);
$(window).scrollRun(1000, 2000);
$(window).scrollRun(1000, 2000, undefined, undefined, 'Top');
$(window).scrollRun(1000, 2000, undefined, undefined, 'Left');
$(window).scrollRun(1000,600,'easeOutQuint',function(){}, 'Top');

//停止
$(window).scrollStop();

*/

jQuery.fn.extend((function () {
    var go, goLeft;

    function scrollRun(end, speed, easing, callBack, way) {
        var
            speed = speed === undefined ? 400 : speed,
            way = way === undefined ? 'Top' : way,
            wJq = this,
            g;

        if (way === 'Top') {
            if (go === undefined) go = new common.easingBuild();
            g = go;
        }
        else {
            if (goLeft === undefined) goLeft = new common.easingBuild();

            g = goLeft;
        }

        g.excu(function (v) {
            wJq['scroll' + way](v);
        }, wJq['scroll' + way](), end, speed, easing, callBack);
    }

    function scrollStop() {
        go && go.stop();
        goLeft && goLeft.stop();
    }

    //滚轮事件情况 停止 滚动条动画
    $(function () {
        core.mouseWheel(window.document.body, function (e) {
            wJq.scrollStop();
        });
    });


    return {
        scrollRun: scrollRun,
        scrollStop: scrollStop
    };
})());

//#region 动画效果 可 自由配置

/*
使用举例：
var dom = $('div'),
    go = new easingBuild();

//excu的参数说明: 反复执行的函数，起始位置，目标位置，用时(毫秒)(可选，默认400)，缓动算法(可选，默认swing)，到达目标位置时回调(可选)
go.excu(function (v) {
    dom.css('-webkit-transform', 'rotateZ(' + v + 'deg)');
    dom.css('left', v);
}, 0, 1000, 1000, 'easeInOutQuint');

*/
common.easingBuild = function () {

    var stopId;

    //params: 反复执行的函数，起始位置，目标位置，用时(毫秒)，缓动算法，到达目标位置时回调
    function excu(excu, start, end, speed, easing, callBack) {

        var
            speed = (speed === undefined ? 400 : speed),

            t = 0,//当前起始次数
            time = 20,//帧间隔
            d = speed / time,//总次数

            length = end - start; //要走的总长度

        if (stopId !== undefined) stop();

        function run() {
            if (t < d) {
                t++;

                excu(Math.ceil(jQuery.easing[easing ? easing : 'swing'](undefined, t, start, length, d)));

                stopId = setTimeout(run, time);
            }
            else {
                excu(end);

                stopId = undefined;

                callBack && callBack();
            }
        }

        run();
    }

    function stop() {
        clearTimeout(stopId);
        stopId = undefined;
    }

    this.excu = excu;
    this.stop = stop;
};


//#endregion

//#endregion



(function () {
    window.wJq = $(window);
    imageView($('#imageView'));

    /* 参数举例：
        bigChange =(function () {
            var jCurBigImg = $(),
                jShow;
            return function (src,jDoms) {
                jCurBigImg.stop().fadeOut(400, function () { $(this).remove(); });

                jCurBigImg = $('<img src="' + src + '"/>').prependTo(jShow).hide().fadeIn();
            };
        })();
        */
    function pictureShow_s1(params) {
        function moveCenter(index, showNum, itemW) {
            //得到 ul 的位移
            return (~~(showNum / 2) - index) * itemW;
        }

        function show(index) {
            var selItem;

            if (index === curIndex) return;

            arrowsHandle(index);

            jSelItems.eq(curIndex).removeClass('active');
            selItem = jSelItems.eq(index).addClass('active');

            anime(index);

            change(index, { count: count, curIndex: curIndex });

            curIndex = index;

            validLoad.excu(function () {

                loadImgByIndex(index);

                bigChange(index, selItem.attr('data-bigsrc'), {});
            });
        }

        function loadImgByIndex(index) {

            var a = Math.floor(showNum / 2),
                b,
                jItem,
                _showNum = showNum + ((showNum % 2 === 0) ? 1 : 0);

            if (index > count - a - 1) {
                index = count - a - 1;
            }

            if (index < a) {
                index = a;
            }

            for (var i = 0; i < _showNum ; i++) {
                b = index - a + i;

                if (b >= count) break;

                jItem = jSelItems.eq(b);

                if (jItem.data('isFinish') === undefined) {

                    jItem.removeClass('loading');
                    jItem.data('isFinish', true);

                    selImgLoad(jItem);
                }
            }
        }

        function anime(index) {
            var x = moveCenter(index, showNum, selItemW);
            if (x < -maxMoveLen) x = -maxMoveLen;
            if (x > 0) x = 0;
            jSelMove.animate({ marginLeft: x + leftAvertence });
        }

        function arrowsHandle(index) {
            jArrows.removeClass('disabled');
            if (index === 0) {
                jArrows.eq(0).addClass('disabled');
            }
            if (index === count - 1) {
                jArrows.eq(1).addClass('disabled');
            }
        }

        function selImgLoad(jItem) {
            var imageSize = new core.imageSize();

            imageSize.excu(jItem.attr('data-src'), function (size, img) {

                jItem.html('<div style="height:' + selBoxH + 'px;overflow:hidden;"><img src="' + img.src + '"/></div>').children().hide().fadeIn()
                    .children().css(common.imgFullByBox_v1({ boxWidth: selBoxW, boxHeight: selBoxH, width: img.width, height: img.height }))
            });
        }

        var jBox = params.jBox,
            jSelShow = jBox.find('.p_show_sel'),
            jSelMove = jSelShow.children('ul'),
            jSelLis = jSelMove.children(),
            jSelItems = jSelLis.children(),

            jArrowChange = jBox.find('.p_arrow'),

            jArrows = jBox.find('.l_l,.l_r'),

            selBoxW = params.selBoxW,
            selBoxH = params.selBoxH,
            selShowW = params.selShowW === undefined ? 295 : params.selShowW,
            selItemW = params.selItemW === undefined ? 59 : params.selItemW,
            leftAvertence = params.leftAvertence === undefined ? 0 : params.leftAvertence,

            bigChange = params.bigChange === undefined ? function () { } : params.bigChange,
            change = params.change === undefined ? function () { } : params.change,

            showNum = Math.round(selShowW / selItemW),

            count = jSelItems.length,

            maxMoveLen = count * selItemW - selShowW,

            curIndex,

            validLoad = new core.validExcu(),
            imageSize = new core.imageSize();

        if (count === 0) return;

        selImgLoad = params.selImgLoad === undefined ? selImgLoad : params.selImgLoad

        jSelMove.width(count * selItemW);

        jArrowChange.length && jArrowChange.click(function () {
            var index = curIndex;

            if (jArrowChange.index(this)) {
                if (index === count - 1) {
                    common.msg('已到最后');
                    return;
                }
                index++;

            }
            else {
                if (index === 0) {
                    common.msg('已到最前');
                    return;
                }
                index--;

            }

            show(index);
        });

        jArrows.click(function () {
            var index = curIndex;

            if (jArrows.index(this)) {
                if (index === count - 1) {
                    common.msg('已到最后');
                    return;
                }

                index += showNum;

                if (index > count - 1) { index = count - 1; }

            }
            else {
                if (index === 0) {
                    common.msg('已到最前');
                    return;
                }
                index -= showNum;
                if (index < 0) { index = 0; }

            }

            show(index);
        });

        jSelItems.click(function () {
            show(jSelItems.index(this));
        });

        show(0);

    }

    function imageView(jBox) {

        function bigHandle() {
            var jCurBig = $(),
                imageSize = new core.imageSize(),
                sizeData = [],
                delayExcu = new core.delayExcu(),
                    multiple;

            this.change = function (index, src, jDoms) {
                var size = sizeData[index],
                    imgCss;
                if (sizeData.length > 0) wJq.scrollRun(topHeight);
                if (size) {

                    jCurBig.stop().fadeOut(400, function () { $(this).remove(); });

                    //是否加载放大
                    multiple = size.width / boxW;

                    imgCss = common.imgCenterByBox_v1({
                        boxWidth: boxW,
                        boxHeight: multiple > 1 ? boxW / (size.width / size.height) : size.height,
                        width: size.width,
                        height: size.height
                    });

                    jCurBig = $('<img src="' + src + '"/>').prependTo(jShow).hide().fadeIn().css(imgCss);

                    jShow.animate({ height: imgCss.height });
                    jArrows.height(imgCss.height);

                    arrowHandle.update(imgCss.height);

                    if (multiple > 1) {
                        zoomLoad(true, {
                            src: src,
                            multiple: multiple,
                            boxW: imgCss.width,
                            boxH: imgCss.height
                        });
                    }
                    else {
                        zoomLoad(false);
                    }
                }
                else {
                    imageSize.stop();

                    jCurBig.stop().fadeOut(400, function () { $(this).remove(); });

                    delayExcu.excu(function () { jShow.addClass('loading'); });

                    imageSize.excu(src, function (size, img) {
                        delayExcu.clear();

                        jShow.removeClass('loading');

                        if (size.height <= 0) size.height = 300;

                        //加载放大
                        multiple = size.width / boxW;

                        imgCss = common.imgCenterByBox_v1({
                            boxWidth: boxW,
                            boxHeight: multiple > 1 ? boxW / (size.width / size.height) : size.height,
                            width: size.width,
                            height: size.height
                        });

                        jCurBig = $(img).prependTo(jShow).hide().fadeIn().css(imgCss);

                        jShow.animate({ height: imgCss.height });

                        jArrows.height(imgCss.height);
                        console.log(imgCss.height + ":=====");
                        sizeData[index] = size;

                        arrowHandle.update(imgCss.height);

                        if (multiple > 1) {

                            zoomLoad(true, {
                                src: src,
                                multiple: multiple,
                                boxW: imgCss.width,
                                boxH: imgCss.height
                            });
                        }
                        else {
                            zoomLoad(false);
                        }

                    });




                }
            };
        }

        if (jBox.length === 0) return;

        var jShow = jBox.children('.p_show'),
            jPageBox = jBox.find('.page_box'),
            jTxt = jBox.find('.descri'),
            jTxtItems = jTxt.children(),
            jArrows = jBox.children('.p_arrow'),
            topHeight = jBox.offset().top - $('#header .header_fixed').height(),

            boxW = jBox.width(),

            bigHandle = new bigHandle(),
            arrowHandle = new common.arrowCenter({ jArrows: jArrows.children('i'), boxTop: jBox.offset().top }),
            zoomLoad = common.zoomHandle(jShow);

        pictureShow_s1({
            jBox: jBox,
            selShowW: boxW - 62,
            selItemW: 117,
            selBoxW: 100,
            selBoxH: 80,
            bigChange: bigHandle.change,
            change: function (index, otherData) {
                jTxtItems.eq(otherData.curIndex).hide();
                jTxtItems.eq(index).show();
                jPageBox.html('<span class="curr">' + (index + 1) + '</span>/<span class="total_page">' + otherData.count + '</span>');
            }
        });

        //分享
        //common.share();
    }
})();

