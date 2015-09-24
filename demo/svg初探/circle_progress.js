"use strict";

(function () {

    var common = {},
        c = common;

    //#region 缓动算法
    c.easing = {
        def: 'easeOutQuad',
        swing: function (x, t, b, c, d) {
            return common.easing[common.easing.def](x, t, b, c, d);
        },
        easeOutQuad: function (x, t, b, c, d) {
            return -c * (t /= d) * (t - 2) + b;
        },
        easeOutExpo: function (x, t, b, c, d) {
            return (t == d) ? b + c : c * (-Math.pow(2, -10 * t / d) + 1) + b;
        }
    };
    //#endregion

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
    c.easingBuild = function () {

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

                    excu(c.easing[easing ? easing : 'swing'](undefined, t, start, length, d));

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

    // 给字符串属性加支持的前缀
    /*
    
    type: 
        0 或不给, 减号连接,真正的 css属性名 
        1, 驼峰, 适用直接给style赋值

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

    c.getStyleName = function () {
        var obj = {};
        return function (name) {
            var styleName = obj[name];

            if (styleName === undefined) {
                styleName = obj[name] = c.addPrefix(name);
            }


            return styleName;
        }
    }();

    jQuery.fn.extend({
        circleProgress: function (params) {

            var

                current = params.current
                ,totals = params.totals
                , name = params.name

            , fullRadian = Math.PI * 2
             , halfRadian = Math.PI / 2

                ,jReplace = this
                ,jChild
                , start
                , end
                , go
                , isGo
            , p1, p2, p3, p4
            , f0, f1, f2, f3, f4
            ;

            if (!jReplace.data('data-isInit')) {
                jReplace.data('data-isInit',1)

                init();
            }

            go = jReplace.data('data-go');
            start = jReplace.data('data-start');
            jChild = jReplace.data('data-child');

            p1 = jChild[1];
            p2 = jChild[2];
            p3 = jChild[3];
            p4 = jChild[4];

            end = current / totals * fullRadian;
            jReplace.data('data-start', end);

            isGo = start < end;

            reset();

            jReplace.data('data-text').html('<p class="p1">' + name + '</p><p class="p2"><span>' + current + '</span>/' + totals + '</p>');

            go.excu(excu, start, end, 1000, 'easeOutQuad');


            function reset() {
                f0 = function () {
                    if (!isGo) {
                        p2.removeAttribute('d');
                    }
                    f0 = function () { };
                };
                f1 = function () {
                    if (isGo) p1.setAttribute('d', 'M0.5,0.5,0.5,0 A0.5,0.5 0 0,1 1,0.5');
                    else p3.removeAttribute('d');
                    f1 = function () { };
                };

                f2 = function () {
                    if (isGo) p2.setAttribute('d', 'M0.5,0.5,1,0.5 A0.5,0.5 0 0,1 0.5,1');
                    else p4.removeAttribute('d');
                    f2 = function () { };
                };

                f3 = function () {
                    if (isGo) p3.setAttribute('d', 'M0.5,0.5,0.5,1 A0.5,0.5 0 0,1 0,0.5');
                    f3 = function () { };
                };

                f4 = function () {
                    if (isGo) p4.setAttribute('d', 'M0.5,0.5,0,0.5 A0.5,0.5 0 0,1 0.5,0');
                    else p1.removeAttribute('d');

                    f4 = function () { };
                };
            }

            function excu(v) {
                var x, y;

                if (v < halfRadian) {
                    if (v > 0) f0();
                    else f4();
                    x = 0.5 + Math.sin(v) * 0.5;
                    y = 0.5 - Math.cos(v) * 0.5;

                    p1.setAttribute('d', 'M0.5,0.5,0.5,0 A0.5,0.5 0 0,1 ' + x + ',' + y);
                }
                else if (v < Math.PI) {
                    f1();

                    y = 0.5 + Math.sin(v - halfRadian) * 0.5;
                    x = 0.5 + Math.cos(v - halfRadian) * 0.5;

                    p2.setAttribute('d', 'M0.5,0.5,1,0.5 A0.5,0.5 0 0,1 ' + x + ',' + y);
                }
                else if (v < halfRadian * 3) {
                    f2();
                    x = 0.5 - Math.sin(v - Math.PI) * 0.5;
                    y = 0.5 + Math.cos(v - Math.PI) * 0.5;

                    p3.setAttribute('d', 'M0.5,0.5,0.5,1 A0.5,0.5 0 0,1 ' + x + ',' + y);
                }
                else if (v < fullRadian) {
                    f3();
                    y = 0.5 - Math.sin(v - halfRadian * 3) * 0.5;
                    x = 0.5 - Math.cos(v - halfRadian * 3) * 0.5;

                    p4.setAttribute('d', 'M0.5,0.5,0,0.5 A0.5,0.5 0 0,1 ' + x + ',' + y);
                }
                else {
                    f4();
                }
            }

            function init() {

                jReplace.css({
                    width: 110,
                    height:110
                });

                jReplace.addClass('circular-progress');

                jReplace.html('<svg height="100%" width="100%" viewBox="0 0 1 1">\
    <circle cx="0.5" cy="0.5" r="0.5" fill="#ddd"></circle>\
    <path d="M0.5 0.5 1 0.5 A0.5 0.5 0 0 1 1 0.5" style="fill:#ef8d1a;" />\
    <path d="M0.5 0.5 0.5 1 A0.5 0.5 0 0 1 0.5 1" style="fill:#ef8d1a;" />\
    <path d="M0.5 0.5 0.5 1 A0.5 0.5 0 0 1 0.5 1" style="fill:#ef8d1a;" />\
    <path d="M0.5 0.5 0.5 1 A0.5 0.5 0 0 1 0.5 1" style="fill:#ef8d1a;" />\
    <circle cx="0.5" cy="0.5" r="0.42" fill="#fff"></circle>\
</svg><div class="cp-txt"></div>');

                jReplace.data('data-go', new c.easingBuild());
                jReplace.data('data-child', jReplace.children().eq(0).children());
                jReplace.data('data-text', jReplace.children().eq(1));
                jReplace.data('data-start',0)
            }

        }
    });
    
    //(function () {

    //    $('div').eq(0).circleProgress({
    //        current: 7,
    //        totals:10,
    //        name: 'xxx'
    //    });
     
    //    setTimeout(function () {
    //        $('div').eq(0).circleProgress({
    //            current: 0,
    //            totals: 10,
    //            name: 'xxx'
    //        });
    //    },2000);


    //})();

})();


