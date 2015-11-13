"use strict";
(function () {
    var c = {};

    //#region 拖动基础
    c.drag = function (eDrag, onMove, onDown, onUp, otherParams) {
        var startY,isStart;

        eDrag.addEventListener('touchstart', function (e) {
            isStart = true;

            if (onDown(e) === false) {
                isStart = false;
            }
            else {
                var touche = e.touches[0];


                startY = touche.pageY;
            }

        });

        eDrag.addEventListener('touchmove', function (e) {
            if (isStart) {
                var touche = e.touches[0],
                    moveY = touche.pageY - startY;

                onMove(0, moveY, e);
            }
        });

        eDrag.addEventListener('touchend', function (e) {
            if (isStart) {
                onUp(e);
            }
        });

    };
    //#endregion

    //#region 速率
    c.velocity = function () {

        var startTime,
            moveTimesArr = [],
            target = this;

        function getSustainTimes() {
            return (new Date()).getTime() - startTime;
        }

        //速率计时
        this.start = function () {
            moveTimesArr = [[0, 0]];
            startTime = (new Date()).getTime();
        };
        this.end = function () {
            var lastIndex = moveTimesArr.length - 1;

            if (lastIndex < 1) return 0;

            //间隔时间
            var intervalTime = getSustainTimes() - moveTimesArr[lastIndex][0];

            //有惯性情况。间隔时间
            if (intervalTime < 200) {
                // 滑动情况一般不会超过50毫秒。如果不够敏感，不应调节这里。条件end 返回的值，往小里调

                return (moveTimesArr[0][1] - moveTimesArr[lastIndex][1]) / intervalTime * 1000;
            }
                //无惯性
            else {
                return 0;
            }
        };

        this.change = function (val) {

            moveTimesArr.unshift([getSustainTimes(), val]);

            if (moveTimesArr.length > 4) moveTimesArr.length = 4;
        };
    };
    //#endregion

    //#region css加前缀
    /*

    type: 
        0 或不给, 减号连接,真正的 css属性名 
        1, 驼峰, 适用直接给style赋值
    例子
    cssTransform = c.addPrefix('transform')
    */
    c.addPrefix = function (cssAttr, type) {
        var cssPrefixes = ["ms", "moz", "webkit"],
            style = document.body.style,
            _cssAttr = cssAttr.charAt(0).toUpperCase() + cssAttr.substr(1);

        if (style[cssAttr] !== undefined) {

            return cssAttr;
        }
        for (var i = cssPrefixes.length, newAttr, cssPf; i--;) {

            cssPf = cssPrefixes[i];
            newAttr = cssPf + _cssAttr;

            if (style[newAttr] !== undefined) {

                return type ? newAttr : '-' + cssPf + '-' + cssAttr;
            }
        }
    };

    //#endregion

    //#region 取 css属性名，有前缀的
    /*
     * 单例模式，取过后的属性将保存，下次节省效率
     * 
     */

    c.getCssAttrName = function () {
        var obj = {};
        return function (name) {
            var styleName = obj[name];

            if (styleName === undefined) {
                styleName = obj[name] = c.addPrefix(name);
            }


            return styleName;
        }
    }();

    //#endregion

    c.bindClick = function (elem, fn) {
        var
            touchcancel,
            outmoded = c.deviceName === 'iPhone';

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

    window.common = window.c = c;
})();

var
    drag = common.drag
     , yVel = new common.velocity()
    , eFullBox = document.querySelector('.full-box')
    
    , _temp = eFullBox.children
    , eDrag = _temp[0]
    , eMove = eDrag.children[0]
    , eBtnBox = _temp[1]
    , eItems = eMove.children
    //, eDownloadBtn = _temp[2]
    , eArrows = _temp[2]
    , eWXInfo = _temp[3]
    , eDownloadInfo = document.querySelector('.download-info')
    , count = eMove.children.length

    , cssTransition = common.getCssAttrName('transition')
    , cssTransform = common.getCssAttrName('transform')

    , boxH = eFullBox.clientHeight
    , currentY
    , currIndex = 1
    // 拖动情况 松开时 进行滑动的最大偏移值
    , offset = boxH / 3
    , appVersion = navigator.appVersion
    , hasSlide
;

setImgCss(getImgWHXY());

btnsFn = btnsFn();

drag(eDrag, function (x, y, e) {
    currentY = y;

    yVel.change(currentY);

    moveY(currentY - (currIndex * boxH));

    e.preventDefault();

}, function (e) {
    if (e.target.classList.contains('big-btn')) {
        return false;
    }
    disableAnime();
    yVel.start();
}, function () {

    var vel = yVel.end();

    //滑动情况
    if (Math.abs(vel) > 40) {

        if (vel < 0) {
            // 左上滑
            changeLeft();

        } else {
            // 右滑
            changeRight();
        }
    }
    //移动情况
    else {

        // 超过一般情况 滑动
        if (Math.abs(currentY) > offset) {

            if (currentY > 0) {
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

});

addEventListener('resize', resize);

firstExcu();

function firstExcu() {
    change(1);

    moveY(-boxH)
}

function moveY(y) {
    eMove.style.setProperty(cssTransform, 'translate3d(0,' + y + 'px,0)');

}

function changeRight() {
    var index = currIndex - 1;

    if (index < 0) index = 0;

    if (index !== currIndex) {
        change(index);
    }
    anime();
}

function changeLeft() {
    var index = currIndex + 1;

    if (index >= count) index = count - 1;

    if (index !== currIndex) {
        change(index);
    }
    anime();
}

function inplace() {
    anime();
}

function anime() {

    eMove.style.setProperty(cssTransition, '0.3s');

    setTimeout(function () {
        moveY(-currIndex * boxH);
    }, 1);
}

function change(index) {

    var _index;

    loadImg(index);
    loadImg(index - 1);
    loadImg(index + 1);

    if (index === 0) {

        setTimeout(function () { correctShow(count - 2); }, 300);

    }
    else if (index === count - 1) {

        setTimeout(function () { correctShow(1); }, 300);
    }

    btnsFn.change(index);

    currIndex = index;

    //if (index === count - 1) {
    //    eArrows.style.display = 'none';
    //}
    //else {
    //    eArrows.style.display = 'block';
    //}
}

// 更正显示
function correctShow(index) {
    disableAnime();
    moveY(-index * boxH);
    loadImg(index);
    loadImg(index - 1);
    loadImg(index + 1);
    currIndex = index;
}

function loadImg(index) {
    var eItem = eItems[index];

    if (eItem && eItem.imgFinish === undefined) {
        eItem.style.backgroundImage = getImgUrl(index);
        downloadBtnInit(eItem.children[0]);
        eItem.imgFinish = 1;
    }
}

function getImgUrl(index) {
    if (index === 0) index = count - 2;
    else if (index === count - 1) index = 1;
    return 'url(imgs/0' + index + '.png)';
}

function disableAnime() {
    eMove.style.setProperty(cssTransition, '0s');
}

function resize() {
    disableAnime();

    boxH = eFullBox.clientHeight;

    moveY(-currIndex * boxH);

    btnsFn.resize();

    setImgCss(getImgWHXY());
} 

// 切换按钮
function btnsFn() {
    var arr = new Array(count-2)
    , eBtns;

    eBtnBox.innerHTML = '<li class="active">' + arr.join('</li><li>') + '</li>'

    eBtns = eBtnBox.children;

    resize();

    return {
        change: function (index) {
            eBtns[amendmentIndex(currIndex)-1].className = '';
            eBtns[amendmentIndex(index)-1].className = 'active';
        },
        resize: resize
    };

    function resize() {
        eBtnBox.style.setProperty(cssTransform, 'translate3d(0,' + ((boxH - eBtnBox.clientHeight) / 2) + 'px,0)');
    }
}

// 修正索引
function amendmentIndex(index) {

    if (index === 0) index = count - 2;
    else if (index === count - 1) index = 1;

    return index;
}

// 图片坐标
function getImgWHXY() {
    return;
    var boxW = eFullBox.clientWidth
        , imgW = 750
        , imgH = 1231
        , imgR = imgW / imgH
        , w, h, x, y
        , extra=0
    ;
    if (boxW <= 320) {
        extra = 40;
        boxW -= extra;
    }

    if (boxW <= 320) {
        extra = 40;
    }

    if (boxW / boxH > imgR) {
        w = boxW;
        h = w / imgR;
        x = 0;
        y = -(h - boxH) / 2; 
    }
    else {
        h = boxH;
        w = h * imgR;
        y= 0;
        x = -(w - boxW) / 2;
    }

    return { x: x + extra/2, y: y, w: w, h: h };

}

// 设置css
function setImgCss(whxy) {

    var imgStyle = document.getElementById('imgStyle');

    if (!imgStyle) {
        imgStyle = document.createElement('style');

        document.head.appendChild(imgStyle);

    }

    //imgStyle.innerHTML = '.full-box .items img{margin:' + whxy.y + 'px auto 0 ' + whxy.x + 'px;width:' + whxy.w + 'px;height:' + whxy.h + 'px}';
    //imgStyle.innerHTML = '.full-box .items li{background-position:' + whxy.x + 'px ' + whxy.y + 'px;background-size:' + whxy.w + 'px auto;background-repeat:no-repeat }';
    imgStyle.innerHTML = '.full-box .items li{background-position:center 0;background-size:auto 100%;background-repeat:no-repeat }';

}

// 下载按钮
function downloadBtnInit(eBtn) {

    var isWX = /micromessenger/i.test(appVersion),
        stopId;

    if (appVersion.indexOf('iPhone') > -1 || appVersion.indexOf('iPad') > -1) {

        if (isWX) {
            eWXInfo.innerHTML = '<img src="imgs/ios.png" />';

            c.bindClick(eBtn, function () {

                _czc.push(["_trackEvent", "下载页-数学π", "下载", "微信弹窗下载提示-iPhone"]);

                eWXInfo.style.display = 'block';
            });
        }
        else {
            eBtn.href = "itms-services://?action=download-manifest&url=https://api.shendupeiban.com/static/plist/AnanasMath.plist";

            c.bindClick(eBtn, function () {
                _czc.push(["_trackEvent", "下载页-数学π", "下载", "下载-iPhone"]);

                eDownloadInfo.style.setProperty(cssTransform, 'translate3d(0,0,0)');

                clearTimeout(stopId);

                //stopId = setTimeout(function () {
                //    eDownloadInfo.style.setProperty(cssTransform, 'translate3d(0,-100%,0)');
                //}, 5000);
            });
        }
    }
    else if (appVersion.indexOf('Android') > -1) {

        //if (isWX) {
        //    c.bindClick(eBtn, function () {
        //        _czc.push(["_trackEvent", "下载页-数学π", "下载", "微信弹窗下载提示-Android"]);
        //        eWXInfo.style.display = 'block';
        //    });
        //    eWXInfo.innerHTML = '<img src="imgs/info.png" />';
        //}
        //else {
        //    eBtn.href = "http://pi.shendupeiban.com/mobile/androidMath.apk";
        //    c.bindClick(eBtn, function () {
        //        _czc.push(["_trackEvent", "下载页-数学π", "下载", "下载-Android"]);
        //    });
        //}

        eBtn.href = "http://a.app.qq.com/o/simple.jsp?pkgname=com.sdjy.mathweekly";

        c.bindClick(eBtn, function () {
            _czc.push(["_trackEvent", "下载页-数学π", "下载", "下载-Android"]);
        });
    }
    else {
        eBtn.href = "http://pi.shendupeiban.com/mobile/androidMath.apk";

        c.bindClick(eBtn, function () {
            _czc.push(["_trackEvent", "下载页-数学π", "下载", "下载-PC"]);
        });
    }

    c.bindClick(eWXInfo, function () {
        eWXInfo.style.display = 'none';
    });
}
