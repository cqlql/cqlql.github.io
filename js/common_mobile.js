
"use strict";

c.extend({

    // 取安卓版本
    getAndroidVersion:function () {
        var v;
        return function () {

            if (v === undefined) {
                var r = window.navigator.userAgent.match(/Android (\d.\d)/);
                v = r && r[1];
            }

            return v;
        };
    }(),

    // click 重写。解决 1、4.4以下webview 原始click灰色；2、ios原始click问题
    click : function (elem, fn) {
        var
            touchcancel,
            outmoded = (this.getAndroidVersion() && this.getAndroidVersion() < 4.4) || (this.deviceName === 'iPhone');

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
    },

    // 经过优化的单指，多指无违和冲突。支持多浏览器
    drag: function (eDrag, onMove, onDown, onUp) {

        var startX, startY, identifier;

        eDrag.addEventListener('touchstart', function (e) {
            var touche = e.touches[0];

            startY = touche.pageY;

            onDown(e);
        });

        eDrag.addEventListener('touchmove', function (e) {

            var touche = e.touches[0],
                moveY;

            moveY = touche.pageY - startY;

            onMove({ top: moveY, event: e });


        });

        eDrag.addEventListener('touchend', function (e) {

            if (e.touches.length > 0) {

                startY = e.touches[0].pageY;

            }

            onUp(e);
        });

    }

    , isWX: /micromessenger/i.test(navigator.appVersion)

});

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


// 系统判断
c.extend({
    isIOS: navigator.appVersion.indexOf('Mac OS') > -1,
    isAndroid: navigator.appVersion.indexOf('Android') > -1
});

