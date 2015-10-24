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
        },
        easeInOutQuad: function (x, t, b, c, d) {
            if ((t /= d / 2) < 1) return c / 2 * t * t + b;
            return -c / 2 * ((--t) * (t - 2) - 1) + b;
        },
        easeInCubic: function (x, t, b, c, d) {
            return c * (t /= d) * t * t + b;
        },
        easeOutCubic: function (x, t, b, c, d) {
            return c * ((t = t / d - 1) * t * t + 1) + b;
        },
        easeInOutCubic: function (x, t, b, c, d) {
            if ((t /= d / 2) < 1) return c / 2 * t * t * t + b;
            return c / 2 * ((t -= 2) * t * t + 2) + b;
        },
        easeInQuart: function (x, t, b, c, d) {
            return c * (t /= d) * t * t * t + b;
        },
        easeOutQuart: function (x, t, b, c, d) {
            return -c * ((t = t / d - 1) * t * t * t - 1) + b;
        },
        easeInOutQuart: function (x, t, b, c, d) {
            if ((t /= d / 2) < 1) return c / 2 * t * t * t * t + b;
            return -c / 2 * ((t -= 2) * t * t * t - 2) + b;
        },
        easeInQuint: function (x, t, b, c, d) {
            return c * (t /= d) * t * t * t * t + b;
        },
        easeOutQuint: function (x, t, b, c, d) {
            return c * ((t = t / d - 1) * t * t * t * t + 1) + b;
        },
        easeInOutQuint: function (x, t, b, c, d) {
            if ((t /= d / 2) < 1) return c / 2 * t * t * t * t * t + b;
            return c / 2 * ((t -= 2) * t * t * t * t + 2) + b;
        },
        easeInSine: function (x, t, b, c, d) {
            return -c * Math.cos(t / d * (Math.PI / 2)) + c + b;
        },
        easeOutSine: function (x, t, b, c, d) {
            return c * Math.sin(t / d * (Math.PI / 2)) + b;
        },
        easeInOutSine: function (x, t, b, c, d) {
            return -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b;
        },
        easeInExpo: function (x, t, b, c, d) {
            return (t == 0) ? b : c * Math.pow(2, 10 * (t / d - 1)) + b;
        },
        easeOutExpo: function (x, t, b, c, d) {
            return (t == d) ? b + c : c * (-Math.pow(2, -10 * t / d) + 1) + b;
        },
        easeInOutExpo: function (x, t, b, c, d) {
            if (t == 0) return b;
            if (t == d) return b + c;
            if ((t /= d / 2) < 1) return c / 2 * Math.pow(2, 10 * (t - 1)) + b;
            return c / 2 * (-Math.pow(2, -10 * --t) + 2) + b;
        },
        easeInCirc: function (x, t, b, c, d) {
            return -c * (Math.sqrt(1 - (t /= d) * t) - 1) + b;
        },
        easeOutCirc: function (x, t, b, c, d) {
            return c * Math.sqrt(1 - (t = t / d - 1) * t) + b;
        },
        easeInOutCirc: function (x, t, b, c, d) {
            if ((t /= d / 2) < 1) return -c / 2 * (Math.sqrt(1 - t * t) - 1) + b;
            return c / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1) + b;
        },
        easeInElastic: function (x, t, b, c, d) {
            var s = 1.70158; var p = 0; var a = c;
            if (t == 0) return b; if ((t /= d) == 1) return b + c; if (!p) p = d * .3;
            if (a < Math.abs(c)) { a = c; var s = p / 4; }
            else var s = p / (2 * Math.PI) * Math.asin(c / a);
            return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
        },
        easeOutElastic: function (x, t, b, c, d) {
            var s = 1.70158; var p = 0; var a = c;
            if (t == 0) return b; if ((t /= d) == 1) return b + c; if (!p) p = d * .3;
            if (a < Math.abs(c)) { a = c; var s = p / 4; }
            else var s = p / (2 * Math.PI) * Math.asin(c / a);
            return a * Math.pow(2, -10 * t) * Math.sin((t * d - s) * (2 * Math.PI) / p) + c + b;
        },
        easeInOutElastic: function (x, t, b, c, d) {
            var s = 1.70158; var p = 0; var a = c;
            if (t == 0) return b; if ((t /= d / 2) == 2) return b + c; if (!p) p = d * (.3 * 1.5);
            if (a < Math.abs(c)) { a = c; var s = p / 4; }
            else var s = p / (2 * Math.PI) * Math.asin(c / a);
            if (t < 1) return -.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
            return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p) * .5 + c + b;
        },
        easeInBack: function (x, t, b, c, d, s) {
            if (s == undefined) s = 1.70158;
            return c * (t /= d) * t * ((s + 1) * t - s) + b;
        },
        easeOutBack: function (x, t, b, c, d, s) {
            if (s == undefined) s = 1.70158;
            return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
        },
        easeInOutBack: function (x, t, b, c, d, s) {
            if (s == undefined) s = 1.70158;
            if ((t /= d / 2) < 1) return c / 2 * (t * t * (((s *= (1.525)) + 1) * t - s)) + b;
            return c / 2 * ((t -= 2) * t * (((s *= (1.525)) + 1) * t + s) + 2) + b;
        },
        easeInBounce: function (x, t, b, c, d) {
            return c - jQuery.easing.easeOutBounce(x, d - t, 0, c, d) + b;
        },
        easeOutBounce: function (x, t, b, c, d) {
            if ((t /= d) < (1 / 2.75)) {
                return c * (7.5625 * t * t) + b;
            } else if (t < (2 / 2.75)) {
                return c * (7.5625 * (t -= (1.5 / 2.75)) * t + .75) + b;
            } else if (t < (2.5 / 2.75)) {
                return c * (7.5625 * (t -= (2.25 / 2.75)) * t + .9375) + b;
            } else {
                return c * (7.5625 * (t -= (2.625 / 2.75)) * t + .984375) + b;
            }
        },
        easeInOutBounce: function (x, t, b, c, d) {
            if (t < d / 2) return jQuery.easing.easeInBounce(x, t * 2, 0, c, d) * .5 + b;
            return jQuery.easing.easeOutBounce(x, t * 2 - d, 0, c, d) * .5 + c * .5 + b;
        }
    };
    //#endregion

    //#region 拖动基础
    c.drag = function (eDrag, onMove, onDown, onUp, otherParams) {
        var startY;

        eDrag.addEventListener('touchstart', function (e) {

            var touche = e.touches[0];

            startY = touche.pageY;

            onDown();

        });

        eDrag.addEventListener('touchmove', function (e) {
            var touche = e.touches[0],
                moveY = touche.pageY - startY;

            onMove(0, moveY, e);

        });

        eDrag.addEventListener('touchend', onUp);

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
            console.log(curParams);
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
    , currItem,prevItem,nextItem
    // 拖动情况 松开时 进行滑动的最大偏移值
    , offset = boxH / 3

    ,prevY,nextY

    , cssTransition = c.getCssAttrName('transition')
    , cssTransform = c.getCssAttrName('transform')

    , moveAnime = new c.changeAnime(function (v) {
        moveY(v)
    })

    , goAnime = new c.EasingBuild()

;

c.drag(eBox, function (x, y, e) {
    currentY = y;

    yVel.change(y);

    moveAnime.start(y);
    //moveY(currentY - (currIndex * boxH));

    e.preventDefault();

}, function () {
    yVel.start();

    prevIndex = currIndex === 0 ? count - 1 : currIndex-1;
    nextIndex = currIndex === count - 1 ? 0 : currIndex+1;

    prevItem = eItems[prevIndex];
    currItem = eItems[currIndex];
    nextItem = eItems[nextIndex];

    prevItem.style.setProperty(cssTransform, 'translate3d(0,' + boxH + 'px,0)');
    nextItem.style.setProperty(cssTransform, 'translate3d(0,' + boxH + 'px,0)');

    prevItem.classList.add('before');
    nextItem.classList.add('before');

    prevItem.style.zIndex = 1;
    nextItem.style.zIndex = 1;
    currItem.style.zIndex = 0;



    moveAnime.cur = 0;

}, function () {

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

function initShow() {

    currIndex = 0;
    currItem = eItems[currIndex];

    eBox.classList.remove('loading');

    currItem.style.setProperty(cssTransition, '0.4s');

    setTimeout(function () {
        currItem.style.setProperty(cssTransform, 'translate3d(0,0,0)');
        currItem.style.setProperty('opacity', '1');
        setTimeout(function () {
            currItem.style.setProperty(cssTransition, '0s');
            currItem.classList.remove('before');
        }, 100);
    }, 1);

}

function moveY(y) {
    var
        move,
        proportion,
        opacity,
        scale;

    move = y / 2 + y;
    proportion = Math.abs(y / boxH).toFixed(2);
    opacity = proportion *4;
    //scale = 1 - proportion / 4;
    scale = -proportion * boxH;
    console.log(scale);
    prevY=move - boxH;
    nextY=move + boxH;
    
    prevItem.style.setProperty(cssTransform, 'translate3d(0,' + prevY+ 'px,0)');
    nextItem.style.setProperty(cssTransform, 'translate3d(0,' + nextY + 'px,0)');

    prevItem.style.opacity = opacity;
    nextItem.style.opacity = opacity;

    //currItem.style.setProperty(cssTransform, 'scale(' + scale + ',' + scale + ')');
    currItem.style.setProperty(cssTransform, 'translate3d(0,0,' + scale + 'px)');
}

function changeBottom() {
    var index = currIndex - 1
        , y = moveAnime.cur
        , move =y / 2 + y - boxH
        , proportion = Math.abs(y/ boxH).toFixed(2)
        , opacity = proportion * 4
        //, scale = 1 - proportion / 4
        , scale = -proportion * boxH
    ;

    if (index < 0) index = count - 1;

    change(index);

    moveAnime.stop();

    goAnime.setCurParams({
        o:opacity,
        y: move,
        s: scale
    });

    goAnime.excu({
        y: 0,
        o: 1,
        s: -boxH
    }, {
        go: function (to) {
            prevItem.style.setProperty(cssTransform, 'translate3d(0,' + to.y + 'px,0)');
            prevItem.style.opacity = to.o;
            //currItem.style.setProperty(cssTransform, 'scale(' + to.s + ',' + to.s + ')');
            currItem.style.setProperty(cssTransform, 'translate3d(0,0,' + to.s + 'px)');
        },
        speed: 400
    });
    setTimeout(function () { prevItem.classList.remove('before'); }, 200);
}

function changeTop() {
    var index = currIndex + 1
    , y = moveAnime.cur
        , move = y / 2 + y + boxH
        , proportion = Math.abs(y / boxH).toFixed(2)
        , opacity = proportion * 4
        //, scale = 1 - proportion / 4
        , scale = -proportion * boxH
    ;

    if (index >= count) index = 0;

    change(index);

    moveAnime.stop();

    goAnime.setCurParams({
        o: opacity,
        y: move,
        s: scale
    });

    goAnime.excu({
        y: 0,
        o: 1,
        s: -boxH
    }, {
        go: function (to) {
            nextItem.style.setProperty(cssTransform, 'translate3d(0,' + to.y + 'px,0)');
            nextItem.style.opacity = to.o;
            //currItem.style.setProperty(cssTransform, 'scale(' + to.s + ',' + to.s + ')');
            currItem.style.setProperty(cssTransform, 'translate3d(0,0,' + to.s + 'px)');
        },
        speed: 400
    });
    setTimeout(function () { nextItem.classList.remove('before'); }, 200);

}

function anime() {

    //eMove.style.setProperty(cssTransition, '0.3s');

    //setTimeout(function () {
    //    moveY(-currIndex * boxH);
    //}, 1);
}

function change(index) {


    currIndex = index;

}

function inplace() {
    //anime();
}

