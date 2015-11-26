"use strict";


var eBox1 = document.getElementById('demo1'),
    a = new c.EasingBuild(),
    queue;

a.setCurParams({
    w: 100
});

queue = new c.Queue();

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
        //, h = vs[1]
        , l = vs[1]
        ,t=vs[2];

    w = isNaN(w) ? 0 : (w * 1);
    //h = isNaN(h) ? 0 : (h * 1);
    l = isNaN(l) ? 0 : (l * 1);
    t = isNaN(t) ? 0 : (t * 1);

    eIn.value = ~~(Math.random() * 1000) + ',' + ~~(Math.random() * 1000) + ',' + ~~(Math.random() *500);// + ',' + ~~(Math.random() * 1000);

    if (document.getElementById('queue').checked) {
        queue.add(function (loop) {
            animeStart(loop);
        });
    }
    else {
        animeStart();
    }

    function animeStart(cb) {
        cb = cb || function () { };

        a.excu({
            w: w,
            //h: h,
            l: l,
            t: t
        }, {
            go: function (to) {
                eBox1.style.width = to.w + 'px';
                //eBox1.style.height= to.h + 'px';
                eBox1.style.left = to.l + 'px';
                eBox1.style.top = to.t + 'px';
            },
            speed: 1000,
            callback: cb
        });
    }
}

function clearQueue() {
    queue.clear();
}

function stopAnime() {
    //queue.clear();
    a.stop();
}

