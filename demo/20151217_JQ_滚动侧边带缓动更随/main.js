"use strict";

$.fn.extend({
    changeAnime: function () {

        window.requestAnimationFrame = (function () {
            return window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                function (callback, elem) {
                    return window.setTimeout(callback, 1000 / 60);
                };
        })();
        window.cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.clearTimeout;

        function ChangeAnime(change, rate) {

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
                cur = parseFloat(cur);
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
        }

        function init(params) {
            var
                jBox = params.jBox,
                initTop = params.initTop ? params.initTop : 0,
                to = params.to ? params.to : function () {
                    return jWin.scrollTop() + initTop;
                },
                jWin = $(window),
                anime = new ChangeAnime(function (v) {
                    jBox.css('top', v);
                }, .1);

            anime.start(to(jWin), jBox.css('top'));

            jWin.scroll(function () {
                anime.start(to(jWin));
            });

            jWin.resize(function () {
                anime.start(to(jWin));
            });
        }

        return function (params) {

            this.each(function () {
                var j = $(this);

                params.jBox = j;

                if (!j.data('changeAnime')) {
                    init(params);
                    j.data('changeAnime',1);
                }

            });
        }
    }()

});


$('.test').changeAnime({
    to: function (jWin) {
        var top = jWin.height() - 300;

        if (top < 0) top = 0;

        top = jWin.scrollTop() + top;

        return top;
    }
});

