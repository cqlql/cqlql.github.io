

"use strict";

var isIOS= navigator.appVersion.indexOf('Mac OS') > -1,
    isAndroid = navigator.appVersion.indexOf('Android') > -1;

// 取安卓版本
var getAndroidVersion = function () {
    var v;
    return function () {

        if (v === undefined) {
            var r = window.navigator.userAgent.match(/Android (\d.\d)/);
            v = r && r[1];
        }

        return v;
    };
}();

click(document.getElementById('eBtn'), function () {
    if (isAndroid) {
        console.log(123);
    }
    else if (isIOS) {
        location.href = 'xxx:0'

    }
});

function click(elem, fn) {
    var
          touchcancel,
          outmoded = (getAndroidVersion() && getAndroidVersion() < 4.4) || (isIOS);

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
}

