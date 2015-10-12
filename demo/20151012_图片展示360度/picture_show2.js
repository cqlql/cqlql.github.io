"use strict";

//调试
window.ielog = (function () {

    function css(param, elem) {
        for (var name in param) elem.style[name] = param[name];
    }

    function prepend(elem, targetElem) {
        targetElem.insertBefore(elem, targetElem.childNodes[0]);
    }

    var elem = null;
    return function (htmlTxt) {

        if (elem === null) {
            elem = document.createElement('div');
            css({
                background: '#FFC3C3',
                color: '#000',
                padding: '5px',
                position: 'fixed',
                right: '0',
                bottom: '0',
                zIndex: 999
            }, elem);
        }

        elem.innerHTML += '<p>' + htmlTxt + '</p>';

        document.body.insertBefore(elem, document.body.childNodes[0]);
    };
})();

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

var core = {};
core.mouseWheel = function (dom, f) {
    if (dom.addEventListener) {
        if (dom.onmousewheel === undefined) dom.addEventListener('DOMMouseScroll', f, false);//firefox
        else dom.addEventListener('mousewheel', f, false);
    } else {
        dom.attachEvent('onmousewheel', f);//ie678
    }
};
//#region 有效执行
/*
有效执行。快速更新 情况 实现在 在最后结束后再更新
计时情况调用。都将重新计时


@使用举例
var validLoad = new validExcu();
validLoad.excu(function () { showLoad(left) },300);
*/
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
//#endregion

var common = {};
//#region 自动3d旋转
/*
绑定按钮

*/
common.autoPlay = function (jBtn, onStart, onStop, onChange) {

    var isExcu = false,
        stopId,
        time = 16;//循环间隔

    function stop() {
        if (stopId) clearTimeout(stopId);
        stopId = null;
        isExcu = false;
        onStop.call(jBtn);
    }

    function play() {

        onChange();

        stopId = setTimeout(play, time);
    }

    //设置循环间隔
    function setTime(t) {
        time = t;
    }


    //状态接口
    function getStatus() { return isExcu; }

    jBtn.click(function () {
        if (isExcu) {
            stop();
        }
        else {
            isExcu = true;
            play();
            onStart.call(jBtn);
        }
    });

    return { stop: stop, setTime: setTime, getStatus: getStatus };
};

/*

@time：指定毫秒内 转完360度。假如是4000，则4秒内转完360度

@使用示例：
common.autoPlay3D({
    jBtn: $imgShowBox.children('.p_rotate'),
    getCount: function () { return jItems.length; },
    getCurIndex: dragHandle.getCurIndex,
    setCurIndex: dragHandle.setCurIndex,
    onChange: imgChange,
    startCallBack: function () { },//可选
    stopCallBack: function () { },//可选
    hasText: false //可选。默认为true
});
*/

common.autoPlay3D = function (params) {

    var jBtn = params.jBtn,
        time = params.time === undefined ? 4000 : params.time,
        getCount = params.getCount,
        getCurIndex = params.getCurIndex,
        setCurIndex = params.setCurIndex,
        onChange = params.onChange,
        stopCallBack = params.stopCallBack === undefined ? function () { } : params.stopCallBack,
        startCallBack = params.startCallBack === undefined ? function () { } : params.startCallBack,
        hasText = params.hasText === undefined ? true : false,

        isExcu = false,
        stopId;

    var autoPlay = common.autoPlay(jBtn, function () {
        if (hasText) jBtn.html('停止');
        startCallBack();
    }, function () {
        if (hasText) jBtn.html('自动播放');
        stopCallBack();
    }, function () {
        var
            count = getCount(),
            curIndex = getCurIndex();

        autoPlay.setTime(~~(time / count));

        curIndex++;

        if (curIndex >= count) curIndex = 0;

        setCurIndex(curIndex);

        onChange(curIndex);
    });

    return { stop: autoPlay.stop, getStatus: autoPlay.getStatus };
};


//#endregion
//#region 拖动原型
common.drag = function (elem, onMove, onDowm, onUp) {
    var isIE678 = !-[1, ];

    function getPageXY(e) {
        var pageX = e.pageX === undefined ? document.documentElement.scrollLeft + e.clientX : e.pageX,
            pageY = e.pageY === undefined ? document.documentElement.scrollTop + e.clientY : e.pageY;

        return { x: pageX, y: pageY };
    }

    function mousedown(e) {
        e = e || window.event;

        var downPageXY = getPageXY(e);

        if (onDowm) onDowm(e);

        //IE678 执行捕捉 来 避免 图片默认选择事件
        if (isIE678) elem.setCapture();

        document.onmousemove = function (eve) {
            eve = eve || window.event;

            //光标相对 于 浏览器内容窗口 坐标
            var pageXY = getPageXY(eve);

            onMove({ left: pageXY.x - downPageXY.x, top: pageXY.y - downPageXY.y, event: eve });
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
};
//#endregion
//#region 拖动切换
common.dragChange = function () {

    var
        count = 1,
        curIndex = 0,
        toIndex = 0,

        onChange,
        onDown = function () { }, onUp = function () { },

        _tempIndex;

    function imgChange(x) {

        imgIndexUpdate(x);

        if (toIndex === curIndex) return;

        curIndex = toIndex;

        onChange(toIndex);
    }

    //坐标值转 图片索引。更新 toIndex
    function imgIndexUpdate(x) {

        var i = ~~(x / Math.ceil(360 / count));

        toIndex = (_tempIndex + i) % count;

        if (toIndex < 0) toIndex = count + toIndex;

    }

    function setChange(fn) { onChange = fn; }
    function setDown(fn) { onDown = fn; }
    function setUp(fn) { onUp = fn; }

    function setCurIndex(i) {
        curIndex = i;
    }

    function setCount(num) {
        count = num;
    }

    function getCount() {
        return count;
    }

    function getCurIndex() {
        return curIndex;
    }

    return {
        move: function (xy) { imgChange(xy.left); },
        down: function () { _tempIndex = curIndex; onDown(); },
        up: function () { onUp(); },
        setCount: setCount,
        getCount: getCount,
        setCurIndex: setCurIndex,
        getCurIndex: getCurIndex,
        setChange: setChange,
        setDown: setDown,
        setUp: setUp
    };
};
//#endregion



function imgRotateShow() {
    var jBox, jShowBox, jImgBox, jImg,

        pathData,

        un;

    function domIni(html) {
        jBox = $(html);
        jShowBox = jBox.find('.r_win');
        jImgBox = jShowBox.children('.r_img_box');
        jImg = jImgBox.children();

        bJq.append(jBox);
    }

    function htmlCreat() {
        return '<div class="rotate_img_show">'
            + '    <div class="r_bg"></div>'
            + '    <div class="r_main">'
            + '        <div class="r_win">'
            + '            <div class="r_img_box"><img /></div>'
            + '        </div>'
            + '        <div class="r_thumb"><b></b></div>'
            + '        <div class="r_btn"><ul class="r_b">'
            + '            <li><a class="r_b1 active" href="javascript:;">360旋转</a></li>'
            + '            <li><a class="r_b2" href="javascript:;">拖拽图片</a></li>'
            + '            <li><a class="r_b3" href="javascript:;">自动播放</a></li>'
            + '            <li><a class="r_b4" href="javascript:;">关闭</a></li></ul>'
            + '        </div>'
            + '    </div>'
            + '</div>';
    }

    function boxSize() {

        var
            //位置
            left = 0,
            right = 0,
            top = 0,
            bottom = 0,
            boxW, boxH;

        //窗口自适应
        function resize(winW, winH) {
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
            return { left: left + wJq.scrollLeft(), top: top + wJq.scrollTop() };
        }

        return { resize: resize, getBoxWH: getBoxWH, getBoxXY: getBoxXY };

    }

    function onResize() {
        var winW = wJq.width(), winH = wJq.height();

        boxSize.resize(winW, winH);

        imgHandle.whxyUpdate();
    }

    function imgHandle() {

        var imgSize, imgRatioWH, imgBoxWHXY, imgBoxWHXY_VM,
            isMin;

        function getImgSize() { return imgSize; }
        function getImgRatioWH() { return imgRatioWH; }
        function getImgBoxWHXY() { return imgBoxWHXY; }
        function setImgBoxWHXY(whxy) {
            imgBoxWHXY = {
                width: whxy.width === un ? imgBoxWHXY.width : whxy.width,
                height: whxy.height === un ? imgBoxWHXY.height : whxy.height,
                left: whxy.left === un ? imgBoxWHXY.left : whxy.left,
                top: whxy.top === un ? imgBoxWHXY.top : whxy.top
            };
        }
        function getImgBoxWHXY_VM() { return imgBoxWHXY_VM; }
        function setImgBoxWHXY_ByVM(whxy) {
            imgBoxWHXY_VM = {
                width: whxy.width === un ? imgBoxWHXY_VM.width : whxy.width,
                height: whxy.height === un ? imgBoxWHXY_VM.height : whxy.height,
                left: whxy.left === un ? imgBoxWHXY_VM.left : whxy.left,
                top: whxy.top === un ? imgBoxWHXY_VM.top : whxy.top
            };

            toImgBoxWHXY();
        }

        //@params PR left\top 前缀。可选，默认空字符串。否则margin-
        function centerInBox(w, h, boxW, boxH, PR) {
            var
                PR = PR === undefined ? '' : 'margin-',

                r = w / h,
                whxy,
                w, h, x, y;

            if (r < boxW / boxH) {
                h = boxH;
                w = h * r;
                y = 0;
                x = (boxW - w) / 2;
            }
            else {
                w = boxW;
                h = w / r;
                x = 0;
                y = (boxH - h) / 2;
            }

            whxy = {
                width: w,
                height: h
            };

            whxy[PR + 'left'] = x;
            whxy[PR + 'top'] = y;
            return whxy;
        }

        function showOne() {
            imgSize = pathData[0].size;

            jImg[0].src = pathData[0].thumb;
            jImg[0].src = pathData[0].path;

            imgRatioWH = imgSize[0] / imgSize[1];
        }

        function getMaxWH() {
            var
                thumbWHXY = thumbWin.getThumbWHXY(),
                maxR = boxSize.getBoxWH().width / 20;
            return {
                width: thumbWHXY.winW * maxR,
                height: thumbWHXY.winH * maxR
            };
        }

        function limitWHXY() {
            var boxWH = boxSize.getBoxWH(),
                thumbWHXY = thumbWin.getThumbWHXY(),
                imgBoxMinWH = centerInBox(thumbWHXY.winW, thumbWHXY.winH, boxWH.width, boxWH.height),
                imgBoxMaxWH = getMaxWH(),
                lenXY, lastWHXY;

            //限制高宽
            if (imgBoxWHXY_VM.width < imgBoxMinWH.width) {
                setImgBoxWHXY_ByVM({ width: imgBoxMinWH.width, height: imgBoxMinWH.height });
            }
            else if (imgBoxWHXY_VM.width > imgBoxMaxWH.width) {
                /// 限制最大
                lastWHXY = enlarge.getLastWHXY();
                lenXY = enlarge.getAddXY(imgBoxMaxWH.width, imgBoxMaxWH.height);

                setImgBoxWHXY_ByVM({
                    width: imgBoxMaxWH.width, height: imgBoxMaxWH.height,
                    left: lastWHXY.left - lenXY.x,
                    top: lastWHXY.top - lenXY.y
                });
            }

            //限制坐标
            if (boxWH.width > imgBoxWHXY_VM.width) {
                setImgBoxWHXY_ByVM({ left: (boxWH.width - imgBoxWHXY_VM.width) / 2 });
            }
            else if (boxWH.width - imgBoxWHXY_VM.width > imgBoxWHXY_VM.left) {
                setImgBoxWHXY_ByVM({ left: boxWH.width - imgBoxWHXY_VM.width });
            }
            else if (imgBoxWHXY_VM.left > 0) {
                setImgBoxWHXY_ByVM({ left: 0 });
            }

            if (boxWH.height > imgBoxWHXY_VM.height) {
                setImgBoxWHXY_ByVM({ top: (boxWH.height - imgBoxWHXY_VM.height) / 2 });
            }
            else if (boxWH.height - imgBoxWHXY_VM.height > imgBoxWHXY_VM.top) {
                setImgBoxWHXY_ByVM({ top: boxWH.height - imgBoxWHXY_VM.height });
            }
            else if (imgBoxWHXY_VM.top > 0) {
                setImgBoxWHXY_ByVM({ top: 0 });

            }

            if (imgBoxWHXY_VM.width <= imgBoxMinWH.width) isMin = true;
            else isMin = false;

            onImgMinChange();
        }

        //居中
        function center() {

            var thumbWHXY, boxWH;

            //算出居中的虚拟 whxy
            thumbWHXY = thumbWin.getThumbWHXY();
            boxWH = boxSize.getBoxWH();
            imgBoxWHXY_VM = centerInBox(thumbWHXY.winW, thumbWHXY.winH, boxWH.width, boxWH.height);

            //实际居中
            toImgBoxWHXY();
            jImgBox.css(imgBoxWHXY);

            isMin = true;
        }

        function whxyUpdate() {
            anime(0);
        }

        function toImgBoxWHXY() {

            imgBoxWHXY = centerInBox(imgSize[0], imgSize[1], imgBoxWHXY_VM.width, imgBoxWHXY_VM.height);

            imgBoxWHXY.left += imgBoxWHXY_VM.left;

            imgBoxWHXY.top += imgBoxWHXY_VM.top;

        }

        function anime(a) {

            limitWHXY();

            if (a === un) jImgBox.animate(imgBoxWHXY, { queue: false, speed: 1000 });
            else jImgBox.css(imgBoxWHXY);

            thumbWin.update();
        }

        //初始
        function ini() {


        }

        function getSizeStatus() {
            return isMin;
        }

        return {

            toImgBoxWHXY: toImgBoxWHXY,

            getImgBoxWHXY_VM: getImgBoxWHXY_VM,
            setImgBoxWHXY_ByVM: setImgBoxWHXY_ByVM,

            getImgSize: getImgSize,
            getImgRatioWH: getImgRatioWH,

            getSizeStatus: getSizeStatus,

            anime: anime,
            showOne: showOne,
            whxyUpdate: whxyUpdate,
            center: center,
            ini: ini
        };
    }

    //图片最小状态 时 执行
    function onMinImg() {
        btnHandle.toRotate();

        thumbWin.hide();
    }
    //状态改变时指向。图片的两种状态，最小，其他 。getSizeStatus 返回true 表示最小
    function onImgMinChange() {
        if (imgHandle.getSizeStatus()) {

            //切换到旋转
            btnHandle.toRotate();

            thumbWin.hide();
        }
        else {

            thumbWin.show();
        }

    }

    //缩小放大
    function enlarge() {

        var mouseOffsetXY, lastWHXY;

        function getLastWHXY() { return lastWHXY; }

        //根据光标所在元素位置，取当前增加 高宽 对象增加的 xy
        function getAddXY(toW, toH) {
            return {
                x: mouseOffsetXY.x / lastWHXY.width * Math.abs(toW - lastWHXY.width),
                y: mouseOffsetXY.y / lastWHXY.height * Math.abs(toH - lastWHXY.height)
            }
        }

        function excu(isUp, e, er) {
            var
                imgBoxWHXY = imgHandle.getImgBoxWHXY_VM(),

                //每放大阶段值。宽度根据高宽比 得到
                valH = imgBoxWHXY.width * (er || .2),
                valW = valH / imgBoxWHXY.height * imgBoxWHXY.width,

                toW = imgBoxWHXY.width,
                toH = imgBoxWHXY.height,
                toX = imgBoxWHXY.left,
                toY = imgBoxWHXY.top,

                lenXY;

            mouseOffsetXY = getMouseOffset(e);

            lastWHXY = imgBoxWHXY;

            if (isUp) {
                toW += valW;
                toH += valH;
            }
            else {
                toW -= valW;
                toH -= valH;
            }

            //根据增加的高宽 得 要加的 坐标
            lenXY = getAddXY(toW, toH);

            if (isUp) {
                toX -= lenXY.x;
                toY -= lenXY.y;
            }
            else {
                toX += lenXY.x;
                toY += lenXY.y;
            }

            imgHandle.setImgBoxWHXY_ByVM({
                width: toW,
                height: toH,
                left: toX,
                top: toY
            }, mouseOffsetXY);

            //动画
            imgHandle.anime();

            //thumbWin.update(toX, toY);
        }

        /*
        元素 范围判断
        */
        function domRange(elem) {

            do {
                if (elem.className.indexOf('r_img_box') > -1) return true;

                if (elem.className.indexOf('rotate_img_show') > -1) return false;

                elem = elem.parentElement;

            } while (elem.tagName !== 'BODY');

        }

        //取 鼠标位置。放大依据
        function getMouseOffset(e) {
            var mouseOffsetX, mouseOffsetY,
                imgBoxWHXY = imgHandle.getImgBoxWHXY_VM();
            if (domRange(e.target || e.srcElement)) {
                var boxXY = boxSize.getBoxXY(),
                    pageX = e.pageX === un ? document.documentElement.scrollLeft + e.clientX : e.pageX,
                    pageY = e.pageY === un ? document.documentElement.scrollTop + e.clientY : e.pageY;

                mouseOffsetX = pageX - boxXY.left - imgBoxWHXY.left;
                mouseOffsetY = pageY - boxXY.top - imgBoxWHXY.top;

            }
            else {
                mouseOffsetX = imgBoxWHXY.width / 2;
                mouseOffsetY = imgBoxWHXY.height / 2;
            }

            return { x: mouseOffsetX, y: mouseOffsetY };
        }

        //
        function ini() {

            core.mouseWheel(jShowBox[0], function (e) {
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

        return { ini: ini, getAddXY: getAddXY, getLastWHXY: getLastWHXY };
    }

    //图片 360切换
    function imgChange() {
        var dragChange, validLoad;

        function onChange(i) {
            var path = pathData[i];

            jImg[0].src = path.thumb;

            validLoad.excu(function () { jImg[0].src = path.path; });

            thumbWin.change(path.thumb);
        }

        function getDrag() { return dragChange; }

        function ini() {
            validLoad = new core.validExcu();

            dragChange = common.dragChange();

            dragChange.setChange(onChange);

            dragChange.setCount(pathData.length);
        }

        return { ini: ini, getDrag: getDrag, onChange: onChange };
    }

    //图片拖动
    function imgDrag() {

        var drag;
        function getDrag() { return drag; }

        function ini() {

            var curImgBoxXY_VM;

            drag = {
                move: function (xy) {

                    var toXY = {
                        left: curImgBoxXY_VM.left + xy.left,
                        top: curImgBoxXY_VM.top + xy.top
                    };

                    imgHandle.setImgBoxWHXY_ByVM(toXY);

                    imgHandle.anime(0);
                },
                down: function () {
                    curImgBoxXY_VM = imgHandle.getImgBoxWHXY_VM();
                },
                up: function () {

                }
            };
        }

        return { ini: ini, getDrag: getDrag };
    }

    //按钮功能
    function btnHandle() {
        var btns, curI, dragInterfac,
            urlPR = '/themes/enterprise/images/rotate_pic/';

        function upBtnShow() {

            if (curI) jBox.css('cursor', 'url(' + urlPR + 'openhand.cur),move');
            else jBox.css('cursor', 'url(' + urlPR + 'openhand360.cur),e-resize');

            //if (curI) jBox.removeClass('rotate').addClass('drag');
            //else jBox.removeClass('rotate').addClass('drag');
        }

        function downBtnShow() {
            if (curI) jBox.css('cursor', 'url(' + urlPR + 'closedhand.cur),move');
            else jBox.css('cursor', 'url(' + urlPR + 'closedhand360.cur),e-resize');
        }

        function change(i) {

            switch (i) {
                case 0:
                    dragInterfac = imgChange.getDrag();
                    break;
                case 1:
                    dragInterfac = imgDrag.getDrag();
                    break;
                default:

            }

            curI = i;

            upBtnShow();
        }

        function drag() {
            common.drag(jShowBox[0], function (xy) {
                dragInterfac.move(xy);
            }, function () {
                autoPlay.stop();
                dragInterfac.down();
                downBtnShow();
            }, function () {
                dragInterfac.up();
                upBtnShow();
            });
        }

        //自动播放
        function autoPlay(jBtn, startCallBack, stopCallBack) {

            return common.autoPlay3D({
                jBtn: jBtn,
                getCount: function () { return pathData.length; },
                getCurIndex: imgChange.getDrag().getCurIndex,
                setCurIndex: imgChange.getDrag().setCurIndex,
                onChange: imgChange.onChange,
                startCallBack: startCallBack,
                stopCallBack: stopCallBack
            });
        }

        function btnChange(index) {

            btns.eq(curI).removeClass('active');
            btns.eq(index).addClass('active');
        }

        function toRotate() {
            if (curI === 0) return;

            if (!autoPlay.getStatus()) btnChange(0);

            change(0);
        }

        function ini() {
            btns = jBox.find('.r_btn a');
            curI = 0;

            btns.eq(0).add(btns.eq(1)).click(function () {
                autoPlay.stop();

                var i = btns.index(this);

                if (i && imgHandle.getSizeStatus()) {
                    common.msg(1, '放大后方可使用拖动功能');
                    return;
                }

                if (i === curI) return;

                btnChange(i);

                change(i);
            });

            //自动播放
            autoPlay = autoPlay(btns.eq(2), function () {
                btnChange(2);
            }, function () {
                btns.eq(curI).addClass('active');
                btns.eq(2).removeClass('active');
            });

            //关闭
            btns.eq(3).click(function () {
                close();
                autoPlay.stop();
            });

            //初始
            dragInterfac = imgChange.getDrag();
            jBox.addClass('rotate');

            drag();
        }

        return { ini: ini, toRotate: toRotate };

    }

    //鸟瞰图
    function thumbWin() {
        var jThumbWin,
            jShow,
            jSimg1, jSimg2,
            thumbWinW, thumbWinH,
            thumbW, thumbH, thumbX, thumbY,
            showX, showY, showW, showH, overflowLeft, overflowTop,
            showBorder;

        // 鸟瞰图 img初始
        function addImg() {

            var imgTxt = '<img src="' + pathData[0].thumb + '" style="width:' + thumbW + 'px;height:' + thumbH + 'px;margin:' + thumbY + 'px ' + thumbX + 'px"/>';

            jSimg1 = $(imgTxt).appendTo($('<div class="r_imgwin"></div>').prependTo(jThumbWin));
            jSimg2 = $(imgTxt).appendTo(jShow);
        }

        //地址改变
        function change(src) {

            jSimg1[0].src = src;
            jSimg2[0].src = src;
        }

        //鸟瞰图 拖动
        function dragFn() {

            var curx, cury;

            common.drag(jShow[0], function (xy) {
                var x = curx + xy.left,
                    y = cury + xy.top,
                    zoomR = getZoomR();

                if (x < 0) x = 0;
                if (y < 0) y = 0;

                if (x + showW > thumbWinW) x = thumbWinW - showW;
                if (y + showH > thumbWinH) y = thumbWinH - showH;

                jShow.css({ left: x, top: y });
                showBoxUpdate(x, y);

                imgHandle.setImgBoxWHXY_ByVM({
                    left: -x * zoomR,
                    top: -y * zoomR
                });

                //动画
                imgHandle.anime(0);

                showX = x;
                showY = y;

            }, function () {
                curx = showX;
                cury = showY;

            }, function () {


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
            var state = false;

            function show() {
                state = true;

                jThumbWin.fadeIn();

            }

            function hide() {
                state = false;
                jThumbWin.fadeOut();
            }


            return { show: show, hide: hide };
        }

        function getZoomR() {

            return imgHandle.getImgBoxWHXY_VM().width / thumbWinW;
        }

        // 大图坐标 转 鸟瞰图坐标。参数 ：大图偏离 窗口 坐标
        function update() {
            var imgVM_whxy = imgHandle.getImgBoxWHXY_VM(),

                boxWH = boxSize.getBoxWH(),

                zoomR = getZoomR(),
                // ol,ot,or,ob,
                w, h, x, y;

            w = boxWH.width / zoomR;
            h = boxWH.height / zoomR;
            x = -imgVM_whxy.left / zoomR;
            y = -imgVM_whxy.top / zoomR;

            if (x < 0) {
                //ol = x;

                w -= x;

                x = 0;
            }
            if (y < 0) {
                //ot = y;

                h -= y;

                y = 0;
            }

            if (w > thumbWinW) {
                //or = w - thumbWinW;
                w = thumbWinW;
            }
            if (h > thumbWinH) {
                //ob = h - thumbWinH;
                h = thumbWinH;
            }

            jShow.css({
                width: w - showBorder,
                height: h - showBorder,
                left: x,
                top: y
            });

            showBoxUpdate(x, y);

            showX = x;
            showY = y;
            showW = w;
            showH = h;
            //overflowLeft=ol;
            //overflowTop=ot;

        }

        //
        function getThumbWHXY() {

            return { width: thumbW, height: thumbH, left: thumbX, top: thumbY, winW: thumbWinW, winH: thumbWinH };
        }

        function ini() {
            jThumbWin = jBox.find('.r_thumb');
            jShow = jThumbWin.children('b');
            thumbWinW = jThumbWin.width();
            thumbWinH = jThumbWin.height();
            showBorder = 4;

            var imgWHRatio = imgHandle.getImgRatioWH();

            if (imgWHRatio > thumbWinW / thumbWinH) {
                thumbW = thumbWinW;
                thumbH = thumbW / imgWHRatio;
            }
            else {
                thumbH = thumbWinW;
                thumbW = thumbH * imgWHRatio;
            }

            thumbX = (thumbWinW - thumbW) / 2;
            thumbY = (thumbWinH - thumbH) / 2;

            addImg();

            dragFn();


        }

        sw = sw();

        return { ini: ini, update: update, change: change, getThumbWHXY: getThumbWHXY, show: sw.show, hide: sw.hide };
    }

    function setPathData(d) { pathData = d; }

    //初始。只执行一次
    function ini() {
        /// example
        boxSize = boxSize();
        imgHandle = imgHandle();
        thumbWin = thumbWin();
        enlarge = enlarge();
        imgDrag = imgDrag();
        btnHandle = btnHandle();
        imgChange = imgChange();

        /// 准备工作
        domIni(htmlCreat());
        wJq.resize(onResize);

        /// 初始
        boxSize.resize(wJq.width(), wJq.height());
        imgHandle.showOne()
        thumbWin.ini();
        imgHandle.ini();
        imgHandle.center();
        enlarge.ini();
        imgDrag.ini();
        imgChange.ini();
        btnHandle.ini();
    }

    var show = (function () {
        var hasIni;//是否已经被初始。undefined 表示没有。true表示已经被初始

        return function () {
            if (hasIni === un) {
                hasIni = true;
                ini();
            }
            else {
                jBox.show();
            }
        };
    })();

    function close() {
        jBox.hide();
    }

    return {
        popWin: show,
        setPathData: setPathData
    };
}

$(function () {
    window.wJq = $(window);
    window.bJq = $(document.body);

    imgRotateShow = imgRotateShow();

    var pathData = [{ thumb: "images/1/121041_720x480.jpg", path: "images/1/121041_720x480.jpg", size: [668, 480] }, { thumb: "images/1/121042_720x480.jpg", path: "images/1/121042_720x480.jpg" }, { thumb: "images/1/121043_720x480.jpg", path: "images/1/121043_720x480.jpg" }, { thumb: "images/1/121044_720x480.jpg", path: "images/1/121044_720x480.jpg" }, { thumb: "images/1/121045_720x480.jpg", path: "images/1/121045_720x480.jpg" }, { thumb: "images/1/121046_720x480.jpg", path: "images/1/121046_720x480.jpg" }, { thumb: "images/1/121047_720x480.jpg", path: "images/1/121047_720x480.jpg" }, { thumb: "images/1/121048_720x480.jpg", path: "images/1/121048_720x480.jpg" }, { thumb: "images/1/121049_720x480.jpg", path: "images/1/121049_720x480.jpg" }, { thumb: "images/1/121050_720x480.jpg", path: "images/1/121050_720x480.jpg" }, { thumb: "images/1/121051_720x480.jpg", path: "images/1/121051_720x480.jpg" }, { thumb: "images/1/121052_720x480.jpg", path: "images/1/121052_720x480.jpg" }, { thumb: "images/1/121053_720x480.jpg", path: "images/1/121053_720x480.jpg" }, { thumb: "images/1/121054_720x480.jpg", path: "images/1/121054_720x480.jpg" }, { thumb: "images/1/121055_720x480.jpg", path: "images/1/121055_720x480.jpg" }, { thumb: "images/1/121056_720x480.jpg", path: "images/1/121056_720x480.jpg" }, { thumb: "images/1/121057_720x480.jpg", path: "images/1/121057_720x480.jpg" }, { thumb: "images/1/121058_720x480.jpg", path: "images/1/121058_720x480.jpg" }, { thumb: "images/1/121059_720x480.jpg", path: "images/1/121059_720x480.jpg" }, { thumb: "images/1/121060_720x480.jpg", path: "images/1/121060_720x480.jpg" }, { thumb: "images/1/121061_720x480.jpg", path: "images/1/121061_720x480.jpg" }, { thumb: "images/1/121062_720x480.jpg", path: "images/1/121062_720x480.jpg" }, { thumb: "images/1/121063_720x480.jpg", path: "images/1/121063_720x480.jpg" }, { thumb: "images/1/121064_720x480.jpg", path: "images/1/121064_720x480.jpg" }, { thumb: "images/1/121065_720x480.jpg", path: "images/1/121065_720x480.jpg" }, { thumb: "images/1/121066_720x480.jpg", path: "images/1/121066_720x480.jpg" }, { thumb: "images/1/121067_720x480.jpg", path: "images/1/121067_720x480.jpg" }, { thumb: "images/1/121068_720x480.jpg", path: "images/1/121068_720x480.jpg" }, { thumb: "images/1/121069_720x480.jpg", path: "images/1/121069_720x480.jpg" }, { thumb: "images/1/121070_720x480.jpg", path: "images/1/121070_720x480.jpg" }, { thumb: "images/1/121071_720x480.jpg", path: "images/1/121071_720x480.jpg" }, { thumb: "images/1/121072_720x480.jpg", path: "images/1/121072_720x480.jpg" }, { thumb: "images/1/121073_720x480.jpg", path: "images/1/121073_720x480.jpg" }, { thumb: "images/1/121074_720x480.jpg", path: "images/1/121074_720x480.jpg" }, { thumb: "images/1/121075_720x480.jpg", path: "images/1/121075_720x480.jpg" }, { thumb: "images/1/121076_720x480.jpg", path: "images/1/121076_720x480.jpg" }, { thumb: "images/1/121077_720x480.jpg", path: "images/1/121077_720x480.jpg" }, { thumb: "images/1/121078_720x480.jpg", path: "images/1/121078_720x480.jpg" }, { thumb: "images/1/121079_720x480.jpg", path: "images/1/121079_720x480.jpg" }, { thumb: "images/1/121080_720x480.jpg", path: "images/1/121080_720x480.jpg" }, { thumb: "images/1/121081_720x480.jpg", path: "images/1/121081_720x480.jpg" }, { thumb: "images/1/121082_720x480.jpg", path: "images/1/121082_720x480.jpg" }, { thumb: "images/1/121083_720x480.jpg", path: "images/1/121083_720x480.jpg" }, { thumb: "images/1/121084_720x480.jpg", path: "images/1/121084_720x480.jpg" }, { thumb: "images/1/121085_720x480.jpg", path: "images/1/121085_720x480.jpg" }, { thumb: "images/1/121086_720x480.jpg", path: "images/1/121086_720x480.jpg" }, { thumb: "images/1/121087_720x480.jpg", path: "images/1/121087_720x480.jpg" }, { thumb: "images/1/121088_720x480.jpg", path: "images/1/121088_720x480.jpg" }, { thumb: "images/1/121089_720x480.jpg", path: "images/1/121089_720x480.jpg" }, { thumb: "images/1/121090_720x480.jpg", path: "images/1/121090_720x480.jpg" }, { thumb: "images/1/121091_720x480.jpg", path: "images/1/121091_720x480.jpg" }, { thumb: "images/1/121092_720x480.jpg", path: "images/1/121092_720x480.jpg" }, { thumb: "images/1/121093_720x480.jpg", path: "images/1/121093_720x480.jpg" }, { thumb: "images/1/121094_720x480.jpg", path: "images/1/121094_720x480.jpg" }, { thumb: "images/1/121095_720x480.jpg", path: "images/1/121095_720x480.jpg" }, { thumb: "images/1/121096_720x480.jpg", path: "images/1/121096_720x480.jpg" }, { thumb: "images/1/121097_720x480.jpg", path: "images/1/121097_720x480.jpg" }, { thumb: "images/1/121098_720x480.jpg", path: "images/1/121098_720x480.jpg" }, { thumb: "images/1/121099_720x480.jpg", path: "images/1/121099_720x480.jpg" }, { thumb: "images/1/121100_720x480.jpg", path: "images/1/121100_720x480.jpg" }];
    imgRotateShow.setPathData(pathData);
    $('a').click(function () {
        imgRotateShow.popWin();
    });

    imgRotateShow.popWin();

    

    //var data = '[';
    //for (var i = 0; i < 60; i++) {
    //    data += '{ thumb:"images/1/1210' + (41 + i) + '_720x480.jpg",';
    //    data += 'path:"images/1/1210' + (41 + i) + '_720x480.jpg"},';
    //}
    //data += ']';
});