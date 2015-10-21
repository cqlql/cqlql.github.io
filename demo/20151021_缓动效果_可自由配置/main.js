"use strict";


var eBox1 = document.getElementById('demo1'),
    a = new c.EasingBuild();

a.setCurParams({
    w: 100
});

function test(v) {
    console.log(requestAnimationFrame(function () {
        
    }));

}

function toWidth(v) {

    a.excu({
        w: v*1
    }, {
        go: function (to) {

            eBox1.style.width = to.w + 'px';
        },
        speed: 600
    });
}
function toLeft(v) {

    a.excu({
        l: v*1
    }, {
        go: function (to) {

            eBox1.style.left = to.l + 'px';
        },
        speed: 600
    });
}

function toWidthAndLeft(eIn) {
    var vs = eIn.value.split(',')
        , w = vs[0]
        , l = vs[1];

    w = isNaN(w) ? 0 : (w * 1);
    l = isNaN(l) ? 0 : (l * 1);

    eIn.value = ~~(Math.random() * 1000) + ',' + ~~(Math.random() * 1000);

    a.excu({
        w: w,
        l: l
    }, {
        go: function (to) {
            eBox1.style.width = to.w + 'px';
            eBox1.style.left = to.l + 'px';
        },
        speed: 1000
    });
}
