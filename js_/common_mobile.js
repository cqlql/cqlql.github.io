
"use strict";

// 系统判断
c.isIOS = navigator.appVersion.indexOf('Mac OS') > -1;
c.isAndroid = navigator.appVersion.indexOf('Android') > -1;
c.isWX = /micromessenger/i.test(navigator.appVersion);

// 取安卓版本
c.getAndroidVersion = function () {
    let v;
    let r = window.navigator.userAgent.match(/Android (\d.\d)/);
    v = r && r[1];

    c.getAndroidVersion=function () {
        return v;
    };

    return v;
};


// click 重写。解决 1、4.4以下webview 原始click灰色；2、ios原始click问题
c.click = function (elem, fn) {
    var
        touchcancel,
        outmoded = (this.getAndroidVersion() && this.getAndroidVersion() < 4.4) || (this.isIOS);

    if (outmoded) {
        elem.addEventListener('touchend', touchend);
        elem.addEventListener('touchstart', touchstart);
        elem.addEventListener('touchmove', touchmove);
    }
    else {
        elem.addEventListener('click', fn);
    }

    return function () {
        if (outmoded) {
            elem.removeEventListener('touchend', touchend);
            elem.removeEventListener('touchstart', touchstart);
            elem.removeEventListener('touchmove', touchmove);
        }
        else {
            elem.removeEventListener('click', fn);
        }
    };

    function touchend(e) {
        if (touchcancel) return;
        fn.call(this, e);
    }
    function touchstart() {
        touchcancel = false;
    }
    function touchmove() {
        touchcancel = true;
    }
};

// 经过优化的单指，多指无违和冲突。支持多浏览器
c.drag = function (eDrag, onMove, onDown, onUp) {

    var startX, startY, identifier;

    eDrag.addEventListener('touchstart', function (e) {
        var touche = e.touches[0];

        startX = touche.pageX;
        startY = touche.pageY;

        onDown(e);
    });

    eDrag.addEventListener('touchmove', function (e) {

        var touche = e.touches[0],
            pageX = touche.pageX, pageY = touche.pageY,
            moveX, moveY;

        moveX = pageX - startX;
        moveY = pageY - startY;

        onMove({ left: moveX, top: moveY, pageX: pageX, pageY: pageY, event: e });
    });

    eDrag.addEventListener('touchend', function (e) {

        if (e.touches.length > 0) {

            startX = e.touches[0].pageX;
            startY = e.touches[0].pageY;

        }

        onUp(e);
    });

};

// js 调用执行 设备 接口 
/*
 @example
   c.deviceCallback(['contact', 'jumppointsCallback'], 'jumppoints', data[curIndex].id);// 都带参
   c.deviceCallback(['contact', 'thisLevelCallback'], 'goBack:0');// 不带参
   c.deviceCallback(['answer', 'uploadPicture'], 'uploadPictureShort:' + iArr[0] + '_' + iArr[1]); // 只给ios带参
 */
c.deviceCallback = function () {
    if (c.isAndroid) {
        return function (aName, iName, str) {
            if (str === undefined) {
                window[aName[0]][aName[1]]();
            }
            else {
                window[aName[0]][aName[1]](str);
            }
        };
    }
    else if (c.isIOS) {
        return function (aName, iName, str) {
            if (iName === undefined) return;

            if (str === undefined) window.location.href = iName;
            else window.location.href = iName + ':' + encodeURIComponent(str);
        };
    }
}();

// 滚动条跳转缓动
c.ScrollTo = function (params) {
    var
        eBox = params.eBox,
        go = new c.EasingBuild();


    this.goY = function (toY, speed) {
        speed = speed || 600;

        go.setCurParams({
            y: eBox.scrollTop
        });

        go.excu({
            y: toY
        }, {
            go: function (to) {

                eBox.scrollTop = to.y;
            },
            speed: speed,
            time: 40
        });
    };

};

//#region 左右滑动
c.sideslip = function (params) {

    var
        eBox = params.eBox,
        changeRight = c.paramUn(params.changeRight, function () { }),
        changeLeft = c.paramUn(params.changeLeft, function () { }),
        inplace = c.paramUn(params.inplace, function () { }),
        moveX = c.paramUn(params.moveX, function () { }),
        resetStart = c.paramUn(params.resetStart, function () { }),
        getRunState = c.paramUn(params.getRunState, function () { return true; }),

        //eMove = params.eMove,
        //change = params.change,
        boxW = params.boxW,
        //count = params.count,

        startX, startY,

        // 0 没反映，1 x 方向，2 y 方向
        status = 0,

        // 拖动情况 松开时 进行滑动的最大偏移值
        offset = boxW / 3,

        currentX = 0,

        curIndex = 0,

        xVel = new c.Velocity();

    eBox.addEventListener('touchstart', function (e) {

        if (getRunState()) return;

        if (status === 1) {
            resetStart();
        }

        var touche = e.touches[0];

        startX = touche.pageX;
        startY = touche.pageY;

        xVel.start();

        status = 0;
    });

    eBox.addEventListener('touchmove', function (e) {
        if (getRunState()) return;
        var touche = e.touches[0],
            y = touche.pageY - startY;

        currentX = touche.pageX - startX;

        if (status === 0) {

            if (Math.abs(currentX) > Math.abs(y)) {
                status = 1;
            }
            else {
                status = 2;
            }
        }

        if (status === 1) {

            xVel.change(currentX);

            moveX((currentX - (curIndex * boxW)));

            e.preventDefault();

        }

    });

    eBox.addEventListener('touchend', function (e) {
        if (getRunState()) return;
        if (status === 1) {
            var val = xVel.end();

            //滑动情况
            if (Math.abs(val) > 40) {

                if (val < 0) {
                    // 左滑
                    changeLeft();

                } else {
                    // 右滑
                    changeRight();
                }
            }
                //移动情况
            else {

                // 超过一般情况 滑动
                if (Math.abs(currentX) > offset) {

                    if (currentX > 0) {
                        /// 向右
                        changeRight();
                    }
                    else {
                        /// 左
                        changeLeft();
                    }
                }
                else {
                    // 复位
                    inplace();
                }
            }
        }

    });

};
//#endregion

// 扩展 仿JQ
jsDo.fn.extend({
    click: function (fn) {

        return this.each(function (i, n) {
            c.click(n, fn);
        });
    }
    , drag: function (onMove, onDown, onUp) {
        c.drag(this[0], onMove, onDown, onUp);

        return this;
    }

});