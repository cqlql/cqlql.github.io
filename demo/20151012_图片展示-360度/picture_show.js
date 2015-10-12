"use strict";

function mouseWheel(dom, f) {
    if (dom.addEventListener) {
        if (dom.onmousewheel === undefined) dom.addEventListener('DOMMouseScroll', f, false);//firefox
        else dom.addEventListener('mousewheel', f, false);
    } else {
        dom.attachEvent('onmousewheel', f);//ie678
    }
}

window.requestAnimFrame = (function () {
    return window.requestAnimFrame ||
        window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback, element) {
            window.setTimeout(callback, 15);
        };
})();

/*

//创建
var anime = changeAnime(function (v) {
    side_follow.css('top', v);
});

//停止动画
anime.stop();

//开始动画
anime.start(100);//方式1 。只有目标位置
anime.start(100,0);//方式2。目标位置，初始位置

//取状态
anime.getState();
*/
function changeAnime_v2(change, rate) {

    var o = this,

        //开关。 是否进行中。true 进行中
        sw = false;

    rate = rate ? rate : .2;

    function lastExcu() {

        sw = false;
    }

    function start(to, cur) {

        function baseExcu() {

            var len = rate * (o.to - o.cur);

            o.cur += len;

            //最后一次
            if (Math.abs(o.to - o.cur) < 1) {
                o.cur = o.to;

                lastExcu();
            }

            change(o.cur);

            if (sw) window.requestAnimFrame(baseExcu);
        }

        o.to = to;
        o.cur = cur ? cur : o.cur;

        if (sw) return;

        sw = true;

        window.requestAnimFrame(baseExcu);
    }

    function stop() {
        sw = false;
    }

    this.start = start;
    this.stop = stop;
    this.cur = 0;
    this.to = 0;

    this.getState = function () {
        return sw;
    };
}

function picture_show() {
    var jBox = $('.picture_show'),
        jShowBox = jBox.children('.win'),
        wJq = $(window);

    function onEvent(target, type, listener) {
        if (addEventListener) {
            target.addEventListener(type, listener, false);
        }
        else {
            target.attachEvent("on" + type, listener);
        }
    }

    //拖动原型
    function drag(elem, onMove,onDowm,onUp) {
        var isIE678 = !-[1, ];
        
        function getPageXY(e) {
            var pageX = e.pageX === undefined ? document.documentElement.scrollLeft + e.clientX : e.pageX,
                pageY = e.pageY === undefined ? document.documentElement.scrollTop + e.clientY : e.pageY;

            return { x: pageX, y: pageY };
        }

        function mousedown(e) {
            e = e || window.event;

            var downPageXY = getPageXY(e);

            if (onDowm) onDowm();

            //IE678 执行捕捉 来 避免 图片默认选择事件
            if (isIE678) elem.setCapture();

            document.onmousemove = function (eve) {
                eve = eve || window.event;

                //光标相对 于 浏览器内容窗口 坐标
                var pageXY = getPageXY(eve);

                onMove({ left: pageXY.x - downPageXY.x, top: pageXY.y - downPageXY.y });

            };

            //注册松开事件
            document.onmouseup = function () {

                if (onUp) onUp();

                if (isIE678) elem.releaseCapture();
                this.onmousemove = this.onmouseup = null;//解除所有事件
            };

            return false;
        }
        elem.onmousedown = mousedown;
    }

    //窗口处理
    function boxHandle() {
        var
            //位置
            left = 100,
            right = 100,
            top = 100,
            bottom = 80,

            boxW, boxH;

        //窗口自适应
        function boxResize(winW, winH) {
            var
                //
                width = winW - left - right,
                height = winH - top - bottom;

            jBox.css({
                width: width,
                height: height,
                left: left,
                top: top
            });

            boxW = width;
            boxH = height;
        }

        function getBoxWH() {
            return { width: boxW, height: boxH };
        }

        function getBoxXY() {
            return {left:left,top:top};
        }

        return { boxResize: boxResize, getBoxWH: getBoxWH, getBoxXY: getBoxXY };
    }

    //浏览器窗口变化 接口
    function winResize() {
        var w = wJq.width(), h = wJq.height();

        boxHandle.boxResize(w, h);
    }

    //图片窗口 处理
    //图片窗口 自适应
    //在得到尺寸后才能够适应
    //疑问：全部得到后 还是第一张？
    function imgBoxHandle() {
        var jImgBox = jShowBox.children('.img_w'),

            imgRatioWH,

            curImgBoxW,
            curImgBoxH,
            curImgBoxX,
            curImgBoxY;

        //位置初始。在第一张图 就绪后即可调用
        function positionIni(imgW, imgH) {

            var boxWH = boxHandle.getBoxWH();

            curImgBoxW = imgW;
            curImgBoxH = imgH;
            curImgBoxX=(boxWH.width - curImgBoxW) / 2;
            curImgBoxY = (boxWH.height - curImgBoxH) / 2;

            imgRatioWH = imgW / imgH;

            jImgBox.css({
                width: curImgBoxW,
                height: curImgBoxH,
                left: curImgBoxX,
                top: curImgBoxY
            });

            thumbWin.ini(imgW,imgH);
        }

        //缩略图操作窗
        function thumbWin() {
            var jThumbWin = jBox.children('.thumb_w'),
                jShow = jThumbWin.children('b'),
                jSimg1, jSimg2,

                thumbWinW = jThumbWin.width(),
                thumbWinH = jThumbWin.height(),
                thumbW, thumbH,thumbX, thumbY,
                showX, showY, showW, showH, overflowLeft, overflowTop,
                showBorder = 4;

            // 初始 鸟瞰图
            function ini(imgW, imgH) {
                var _r = imgW / imgH;
                if (_r > thumbWinW / thumbWinH) {
                    thumbW = thumbWinW;
                    thumbH = thumbW / _r;
                }
                else {
                    thumbH = thumbWinW;
                    thumbW = thumbH * _r;
                }

                thumbX = (thumbWinW - thumbW) / 2;
                thumbY = (thumbWinH - thumbH) / 2;

                addImg();

                dragFn();

                update(curImgBoxX, curImgBoxY);
            }

            // 鸟瞰图 img初始
            function addImg() {

                var imgTxt = '<img src="images/121041_720x480.jpg" style="width:' + thumbW + 'px;height:' + thumbH + 'px;margin:' + thumbY + 'px ' + thumbX + 'px"/>';

                jSimg1 = $(imgTxt).appendTo($('<div class="t_img_w"></div>').prependTo(jThumbWin));
                jSimg2 = $(imgTxt).appendTo(jShow);
            }

            //地址改变
            function change(src) {

                jSimg1[0].src = src;
                jSimg2[0].src = src;
            }

            //鸟瞰图 拖动
            function dragFn() {

                   var x, y;

                drag(jShow[0], function (xy) {

                    x = showX + xy.left;
                     y = showY + xy.top;

                    if (x < 0) x = 0;
                    if (y < 0) y = 0;

                    if (x + showW + showBorder > thumbWinW) x = thumbWinW - showW - showBorder;
                    if (y + showH + showBorder > thumbWinH) y = thumbWinH - showH - showBorder;

                    jShow.css({ left: x, top: y });

                    showBoxUpdate(x, y);

                    bigImgBoxHandle.update(x, y);

                }, function () {

                }, function () {
                    showX = x;
                    showY = y;

                    bigImgBoxHandle.callBack();
                });
            }

            //更新 鸟瞰窗 中的图片。实现高亮
            function showBoxUpdate(showX, showY) {

                jSimg2.css({
                    'margin-left': -showX + thumbX - showBorder / 2,
                    'margin-top': -showY + thumbY - showBorder / 2
                });
            }

            //鸟瞰图 关闭开启处理
            function sw() {
                var state;


                function change() {
                    //高宽铺满 关闭。否则开启
                    var toClose = Math.round(showW + showBorder) >= thumbWinW && Math.round(showH + showBorder) >= thumbWinH;

                    if (!toClose === state) return state;

                    state = !toClose;

                    if (state) {
                        jThumbWin.stop(true, true).fadeIn(200);
                    }
                    else {
                        jThumbWin.stop(true,true).fadeOut(200);
                    }

                    return state;
                }


                return { change: change };
            }

            // 大图坐标 转 鸟瞰图坐标。参数 ：大图偏离 窗口 坐标
            function update(toX, toY) {

                //鸟瞰图拖动窗 坐标+高宽
                function whxy(bigToX, bigToY) {
                    var
                        //放大比
                        _r = curImgBoxW / thumbW,

                        _x = bigToX / _r,
                        _y = bigToY / _r,

                        //超出 xy
                        overflowRight, overflowBottom,

                        boxWH = boxHandle.getBoxWH();

                    ///坐标 、超出限制
                    showX = thumbX - _x;
                    showY = thumbY - _y;

                    overflowLeft = -showX;
                    overflowTop = -showY;
                    overflowRight = (boxWH.width - curImgBoxW - bigToX) / _r - thumbX;
                    overflowBottom = (boxWH.height - curImgBoxH - bigToY) / _r - thumbY;

                    if (showX < 0) showX = 0;
                    if (showY < 0) showY = 0;

                    if (overflowLeft < 0) overflowLeft = 0;
                    if (overflowTop < 0) overflowTop = 0;
                    if (overflowRight < 0) overflowRight = 0;
                    if (overflowBottom < 0) overflowBottom = 0;

                    ///高宽
                    showW = boxWH.width / _r - showBorder - overflowLeft - overflowRight;
                    showH = boxWH.height / _r - showBorder - overflowTop - overflowBottom;
                }

                ///
                whxy(toX, toY);

                if (sw.change()) {

                    //更新 鸟瞰 拖动窗
                    jShow.css({
                        width: showW,
                        height: showH,
                        left: showX,
                        top: showY
                    });

                    showBoxUpdate(showX, showY);
                }

            }

            // 鸟瞰图坐标 转 大图坐标
            function bigImgBoxHandle() {
                var x, y;
                function update(showX, showY) {

                    var
                        //放大比
                        _r = curImgBoxW / thumbW;

                    x = (-showX + thumbX + overflowLeft) * _r;
                    y = (-showY + thumbY + overflowTop) * _r;

                    jImgBox.css({
                        left: x,
                        top: y
                    });

                }

                //更正 公共 大图 坐标
                function callBack() {
                    curImgBoxX = x;
                    curImgBoxY = y;
                }

                return { update: update, callBack: callBack };

            }

            //### 初始执行 
            bigImgBoxHandle = bigImgBoxHandle();

            sw = sw();

            return { update: update, ini: ini, change: change, sw: sw.change };
        }

        //大图区功能初始。所有图 就绪调用
        function bigImgIni() {

            //拖动功能 切换
            function dragFn() {

                var btns = jShowBox.find('ul a'),
                    curI = 0,

                    dragInterfac;

                function change(i) {

                    switch (i) {

                        case 0:
                            dragInterfac = dragChange;
                            break;
                        case 1:
                            dragInterfac = dragImg;
                            break;

                        default:

                    }

                    curI = i;
                }

                btns.click(function () {

                    var i = btns.index(this);

                    if (i === curI) return;

                    btns.eq(curI).removeClass('active');
                    btns.eq(i).addClass('active');

                    change(i);

                });

                ///
                change(curI);

                drag(jShowBox[0], function (xy) {
                    dragInterfac.move(xy);
                }, function () {
                    dragInterfac.down();
                }, function () {
                    dragInterfac.up();
                });

                return {
                    set: function (obj) {
                        dragInterface = obj;
                    }
                };
            }

            //拖动切换
            function dragChange() {
                var
                    curIndex = 0,
                    toIndex = 0,

                    count = 60;

                function imgChange(x) {

                    imgIndexUpdate(x);

                    if (toIndex === curIndex) return;

                    jImgBox.children()[0].src = 'images/' + (toIndex + 121041) + '_720x480.jpg';

                    thumbWin.change('images/' + (toIndex + 121041) + '_720x480.jpg');
                }

                //坐标值转 图片索引。更新 toIndex
                function imgIndexUpdate(val) {

                    var i = ~~((val) / Math.ceil(360 / count));

                    toIndex = (curIndex + i) % count;

                    if (toIndex < 0) toIndex = count + toIndex;

                }

                return {
                    move: function (xy) {
                        imgChange(xy.left);
                    },
                    down: function () { },
                    up: function () { curIndex = toIndex; }
                };
            }

            //拖拽
            function dragImg() {

                var mouseOffsetX,
                    mouseOffsetY,

                    toX,
                    toY;

                return {
                    move: function (xy) {
                        var boxXY = boxHandle.getBoxXY();

                        toX = curImgBoxX;
                        toY = curImgBoxY;

                        toX += xy.left;
                        toY += xy.top;

                        jImgBox.css({
                            left: toX,
                            top: toY
                        });

                        thumbWin.update(toX,toY);
                    },
                    down: function () {
                        toX = curImgBoxX;
                        toY = curImgBoxY;
                    },
                    up: function () {
                        curImgBoxX = toX;
                        curImgBoxY = toY;
                    }
                };
            }

            //放大
            function enlarge() {
                var
                    animeW = new changeAnime_v2(function (v) { jImgBox.css('width', v); }),
                    animeH = new changeAnime_v2(function (v) { jImgBox.css('height', v); }),
                    animeX = new changeAnime_v2(function (v) { jImgBox.css('left', v); }),
                    animeY = new changeAnime_v2(function (v) { jImgBox.css('top', v); });

                function excu(isUp, e, er) {
                    var
                        mouseOffsetXY,

                        //每放大阶段值。宽度根据高宽比 得到
                        valH = curImgBoxH * (er || .2),
                        valW = valH * imgRatioWH,

                        toW = curImgBoxW,
                        toH = curImgBoxH,
                        toX = curImgBoxX,
                        toY = curImgBoxY,

                        _x,
                        _y;

                    if (!animeY.getState()) {
                        animeW.cur = curImgBoxW;
                        animeH.cur = curImgBoxH;
                        animeX.cur = curImgBoxX;
                        animeY.cur = curImgBoxY;
                    }

                    mouseOffsetXY = getMouseOffset(e);

                    _x = mouseOffsetXY.x / curImgBoxW * valW;
                    _y = mouseOffsetXY.y / curImgBoxH * valH;

                    if (isUp) {

                        toW += valW;
                        toH += valH;

                        toX -= _x;
                        toY -= _y;

                    }
                    else {
                        toW -= valW;
                        toH -= valH;

                        toX += _x;
                        toY += _y;
                    }

                    curImgBoxW = toW;
                    curImgBoxH = toH;
                    curImgBoxX = toX;
                    curImgBoxY = toY;

                    animeW.start(toW);
                    animeH.start(toH);
                    animeX.start(toX);
                    animeY.start(toY);

                    thumbWin.update(toX, toY, toW, toH);
                }

                /*
                元素 范围判断

                */
                function domRange(elem) {

                    do {

                        if (elem.className.indexOf('img_w') > -1) return true;

                        if (elem.className.indexOf('picture_show') > -1) return false;

                        elem = elem.parentElement;

                    } while (elem.tagName !== 'BODY');

                }

                //设置 鼠标位置。放大依据
                function getMouseOffset(e) {
                    var mouseOffsetX, mouseOffsetY;
                    if (domRange(e.target)) {
                        var boxXY = boxHandle.getBoxXY();

                        mouseOffsetX = e.pageX - boxXY.left - curImgBoxX;
                        mouseOffsetY = e.pageY - boxXY.top - curImgBoxY;
                    }
                    else {
                        mouseOffsetX = curImgBoxW / 2;
                        mouseOffsetY = curImgBoxH / 2;
                    }

                    return { x: mouseOffsetX, y: mouseOffsetY };
                }

                //jImgBox
                mouseWheel(jShowBox[0], function (e) {
                    ////IE/Opera/Chrome  向上正数，向下负数 
                    //fox 向下正数，向上负数

                    e = e || window.event;

                    var isUp = false;

                    if (e.wheelDelta) {//IE/Opera/Chrome 
                        if (e.wheelDelta > 0) isUp = true;
                    }
                    else if (e.detail) {//Firefox 
                        if (e.detail < 0) isUp = true;
                    }

                    excu(isUp, e);

                    if (e.cancelable) e.preventDefault();
                    return false;
                });

                //双击放大
                jImgBox.dblclick(function (e) {
                    excu(true, e.originalEvent, .6);
                });
            }

            ///
            dragChange = dragChange();
            dragImg = dragImg();
            dragFn();

            enlarge();
        }

        //图片居中。暂时废弃
        function imgResize(boxW, boxH) {
            jImgBox.css({
                top: (boxH - curImgBoxH) / 2,
                left: (boxW - curImgBoxW) / 2
            });
        }

        //###
        thumbWin = thumbWin();

        positionIni(668, 480);

        bigImgIni();

        return {};
    }

    ///

    boxHandle = boxHandle();

    //尺寸初始 
    wJq.resize(winResize);
    winResize();

    imgBoxHandle = imgBoxHandle();
}

$(function () {
    picture_show();
});