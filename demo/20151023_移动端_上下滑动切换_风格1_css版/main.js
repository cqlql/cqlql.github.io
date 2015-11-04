"use strict";
(function () {
    var c = {};

    //#region 缓动算法
    c.easing = {
        def: 'easeOutQuad',
        swing: function (x, t, b, c, d) {
            return common.easing[common.easing.def](x, t, b, c, d);
        },
        easeInQuad: function (x, t, b, c, d) {
            return c * (t /= d) * t + b;
        },
        easeOutQuad: function (x, t, b, c, d) {
            return -c * (t /= d) * (t - 2) + b;
        }
    };
    //#endregion

    //#region 拖动基础
    c.drag = function (eDrag, onMove, onDown, onUp, otherParams) {
        var startX, startY;

        eDrag.addEventListener('touchstart', function (e) {

            var touche = e.touches[0];

            startY = touche.pageY;

            onDown(e);

        });

        eDrag.addEventListener('touchmove', function (e) {
            var touche = e.touches[0],
                moveY = touche.pageY - startY;

            onMove({ top: moveY, event: e });
        });

        eDrag.addEventListener('touchend', function (e) {
            onUp(e);
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

    //#region 动态动画效果
    /*
    **动态动画效果
    目标位置 随便都可以改变的动画效果
    

    /*
    *** 版本2
    //创建
    var anime = new c.changeAnime(function (v) {
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
    c.changeAnime = function (change, rate) {

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

                if (sw) window.requestAnimationFrame(baseExcu);
            }

            o.to = to;
            o.cur = cur ? cur : o.cur;

            if (sw) return;

            sw = true;

            window.requestAnimationFrame(baseExcu);
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
    };
    //#endregion

    //#region 动画效果 可 自由配置

    /*

        切记，传入参数必须是number类型
        
       var a = new common.EasingBuild();
    
        a.setCurParams({
            w: 100
        });
        a.excu({
            x: 600,
            y: 90,
            w: 600
        }, {
            go: function (to) {
    
                //div1.style.left = to.x + 'px';
                //div1.style.top = to.y + 'px';
                div1.style.width = to.w + 'px';
            },
            speed: 600
        });
    
    */
    c.EasingBuild = function (params) {
        var
            that = this,

            curParams = {},

            stopId = null;

        function excu(params, options) {

            var
                go = options.go,

                speed = options.speed === undefined ? 400 : options.speed,
                easing = options.easing === undefined ? 'swing' : options.easing,
                callBack = options.callBack === undefined ? function () { } : options.callBack,

                start = {},

                t = 0,//当前起始次数
                time = 16,//帧间隔
                d = speed / time;//总次数

            stop();

            c.each(params, function (key, value) {
                if (curParams[key] === undefined) {
                    curParams[key] = 0;
                }
                start[key] = curParams[key];
            });

            run();

            function run() {
                var to = {},
                    cur;

                if (t < d) {
                    t++;

                    c.each(params, function (key, value) {
                        cur = start[key];
                        to[key] = c.easing[easing](null, t, cur, value - cur, d);
                        curParams[key] = to[key];
                    });

                    go(to);

                    stopId = requestAnimationFrame(run, time);
                }
                else {
                    go(params);

                    c.each(params, function (key, value) {
                        curParams[key] = params[key];
                    });

                    stopId = null;

                    callBack();
                }
            }
        }

        function setCurParams(params) {

            for (var name in params) {
                curParams[name] = params[name];
            }
        }

        function stop() {
            if (stopId !== null) {
                cancelAnimationFrame(stopId);
                stopId = null;
            }
        }

        this.excu = excu;
        this.setCurParams = setCurParams;
        this.stop = stop;
        this.getCurParams = function () {

        };

        //setCurParams(params);
    };
    //#endregion

    //#region each 循环

    // 带length的集合对象、纯对象
    // fn 中 返回false 将跳出
    c.each = function (obj, fn) {
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
    };

    //#endregion

    window.common = window.c = c;
})();


var eBox = document.querySelector('.evaluating-report')
    , eItems = eBox.children
    , count = eItems.length
    , boxH = eBox.clientHeight
    , yVel = new c.velocity()
    , currentY
    , currIndex,prevIndex,nextIndex
    , currItem,prevItem,nextItem,moveItem
    // 拖动情况 松开时 进行滑动的最大偏移值
    , offset = boxH / 3

    , cssTransition = c.getCssAttrName('transition')
    , cssTransform = c.getCssAttrName('transform')

    , isAnime,isDrag
;

c.drag(eBox, function (params) {
    
    if (isAnime ||isDrag===false) return;

    currentY = params.top;

    yVel.change(currentY);

    moveY(currentY);

    params.event.preventDefault();

}, function (e) {

    if (isAnime || e.touches.length > 1) return;

    isDrag = true;

    currentY = 0;

    prevIndex = currIndex === 0 ? count - 1 : currIndex - 1;
    nextIndex = currIndex === count - 1 ? 0 : currIndex + 1;

    prevItem = eItems[prevIndex];
    currItem = eItems[currIndex];
    nextItem = eItems[nextIndex];

    yVel.start();

}, function (e) {
    if (isAnime || e.touches.length > 1 || currentY === 0 || isDrag === false) return;

    isAnime = 1;
    isDrag = false;

    var vel = yVel.end();

    //滑动情况
    if (Math.abs(vel) > 40) {
        if (vel < 0) {
            // 向下
            changeTop();

        } else {
            // 上
            changeBottom();
        }
    }
        //移动情况
    else {

        // 超过一般情况 滑动
        if (Math.abs(currentY) > offset) {

            if (currentY > 0) {
                /// 向下
                changeBottom();
            }
            else {
                /// 上
                changeTop();
            }
        }
        else {
            // 复位
            inplace();
        }
    }

});

initShow();

function moveY(y) {
    var moveParams = getMoveParams(y);

    prevItem.style.setProperty(cssTransform, 'translate3d(0,' + (moveParams.move - boxH) + 'px,0)');
    nextItem.style.setProperty(cssTransform, 'translate3d(0,' + (moveParams.move + boxH) + 'px,0)');
    currItem.style.setProperty(cssTransform, 'translate3d(0,0,' + moveParams.scale + 'px)');

    prevItem.style.opacity = moveParams.opacity;
    nextItem.style.opacity = moveParams.opacity;

}

function getMoveParams(y) {

    var
        proportion = Math.abs(y / boxH).toFixed(2)

        , move = y / 2 + y
        , opacity = proportion * 2
        //, scale = 1 - proportion / 4
        , scale = -proportion * boxH;

    return {
        move: move
        , opacity: opacity
        , scale: scale
    };
}

function initShow() {

    currIndex = 0;
    currItem = eItems[currIndex];

    eBox.classList.remove('loading');

    currItem.style.setProperty(cssTransition, '0.4s');
    currItem.style.setProperty(cssTransform, 'translate3d(0,0,0)');
    setTimeout(function () {

        currItem.style.setProperty('opacity', '1');

        setTimeout(function () {
            currItem.style.setProperty(cssTransition, '0s');
            currItem.classList.remove('before');
        }, 100);
    }, 100);

}

function changeBottom() {
    var index = currIndex - 1;

    if (index < 0) index = count - 1;

    change(index);

    prevItem.style.setProperty(cssTransition, '0.3s');
    currItem.style.setProperty(cssTransition, '0.3s');

    setTimeout(function () {

        prevItem.style.setProperty(cssTransform, 'translate3d(0,0,0)');
        prevItem.style.opacity = 1;
        currItem.style.setProperty(cssTransform, 'translate3d(0,0,-' + boxH + 'px)');

        setTimeout(function () {
            prevItem.style.setProperty(cssTransition, '0s');
            nextItem.style.setProperty(cssTransition, '0s');
            currItem.style.setProperty(cssTransition, '0s');

            nextItem.style.setProperty(cssTransform, 'translate3d(0,' + boxH + 'px,0)');
            currItem.style.setProperty(cssTransform, 'translate3d(0,' + boxH + 'px,0)');

            nextItem.classList.add('before');
            currItem.classList.add('before');

            prevItem.style.zIndex = 0;
            nextItem.style.zIndex = 1;
            currItem.style.zIndex = 1;

            isAnime = 0;
        }, 600);
    }, 1);

    setTimeout(function () { prevItem.classList.remove('before'); }, 50);
}

function changeTop() {
    var index = currIndex + 1;

    if (index >= count) index = 0;

    change(index);

    nextItem.style.setProperty(cssTransition, '0.3s');
    currItem.style.setProperty(cssTransition, '0.3s');

    setTimeout(function () {

        nextItem.style.setProperty(cssTransform, 'translate3d(0,0,0)');
        nextItem.style.opacity = 1;
        currItem.style.setProperty(cssTransform, 'translate3d(0,0,-' + boxH + 'px)');

        setTimeout(function () {

            prevItem.style.setProperty(cssTransition, '0s');
            nextItem.style.setProperty(cssTransition, '0s');
            currItem.style.setProperty(cssTransition, '0s');

            prevItem.style.setProperty(cssTransform, 'translate3d(0,' + boxH + 'px,0)');
            currItem.style.setProperty(cssTransform, 'translate3d(0,' + boxH + 'px,0)');

            prevItem.classList.add('before');
            currItem.classList.add('before');

            nextItem.style.zIndex = 0;
            prevItem.style.zIndex = 1;
            currItem.style.zIndex = 1;

            isAnime = 0;

        }, 600);
    }, 1);

    setTimeout(function () { nextItem.classList.remove('before'); }, 50);
}

function change(index) {


    currIndex = index;

}

function inplace() {

    var moveParams = getMoveParams(currentY),
        moveItem,
        h;

    if (currentY > 0) {
        moveItem = prevItem;
        h = -boxH;
    }
    else {
        moveItem = nextItem;
        h = boxH;
    }

    moveItem.style.setProperty(cssTransition, '0.3s');
    currItem.style.setProperty(cssTransition, '0.3s');

    setTimeout(function () {

        moveItem.style.setProperty(cssTransform, 'translate3d(0,' + h + 'px,0)');
        moveItem.style.opacity = 1;
        currItem.style.setProperty(cssTransform, 'translate3d(0,0,0)');

        setTimeout(function () {

            moveItem.style.setProperty(cssTransition, '0s');
            currItem.style.setProperty(cssTransition, '0s');

            isAnime = 0;

        }, 300);
    }, 1);

}

