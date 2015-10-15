"use strict";
//功能拆分

function ContScroll(params) {

    var eBox = params.eBox,
        eCont = params.eCont,
        type = 'left',
        currContXY = 0,
        tempContXY
        , velocity = new c.Velocity()
        , stripingReduce = new c.StripingReduce()
        , maxXY = 0
        , that=this
    ;

    c.drag(eBox, function (xy) {

        xy = xy[type];
        
        velocity.change(xy);
        
        moveCont(tempContXY + xy);

        that.change(currContXY);

    }, function (e) {
        velocity.start();

        tempContXY = currContXY;

        stripingReduce.stop();
       
        if (e.cancelable) e.preventDefault();
    }, function () {
        stripingReduce.start(velocity.end() / 70, function (v) {
            moveCont(currContXY + v);
            that.change(currContXY);
        });
    });

    this.update = update;
    this.moveCont = moveCont;
    this.change = function () { };

    update({
        boxWH: eBox.clientWidth,
        contWH: eCont.clientWidth
    });

    function update(params) {
        var boxWH = params.boxWH,
            contWH = params.contWH;

        maxXY = boxWH - contWH;

        moveCont(currContXY);

        that.change(currContXY);
    }

    function moveCont(v) {
        if (v < maxXY) v = maxXY;
        else if (v > 0) v = 0;

        eCont.style[type] = v + 'px';

        currContXY = v;

    }
}


function ScrollBar() {
    var
        eBox = document.getElementById('demo1'),
        eCont = eBox.children[0],

        eBarBox = document.getElementById('scrollBar'),
        eBar = eBarBox.children[0]

        , type = 'left'
        , typeSize = type === 'left' ? 'width' : 'height'

        , currXY = 0
        , tempXY
        , maxXY = 0
        , contScroll = new ContScroll({
            eBox: eBox,
            eCont: eCont
        })
        , moveR // 滚动条 与 内容 的移动比
    ;

    c.drag(eBarBox, function (xy) {

        xy = xy[type];

        moveBar(tempXY + xy);

        contScroll.moveCont(-currXY * moveR);

    }, function (e) {
        tempXY = currXY;
        if (e.cancelable) e.preventDefault();
    }, function () {

    });

    update({
        boxWH: eBox.clientWidth,
        contWH: eCont.clientWidth,
        barBoxWH: eBarBox.clientWidth
    });

    contScroll.change = function (v) {
        moveBar(-v / moveR);
    };

    window.addEventListener('resize', function () {
        update({
            boxWH: eBox.clientWidth,
            contWH: eCont.clientWidth,
            barBoxWH: eBarBox.clientWidth
        });
    });
    
    function update(params) {
        var boxWH = params.boxWH,
            contWH = params.contWH,
            barBoxWH = params.barBoxWH
            , r = contWH / boxWH
            , barWH
        ;

        if (r <= 1) eBarBox.style.display = 'none';
        else eBarBox.style.display = 'block';

        barWH = barBoxWH / r;

        if (barWH < 30) barWH = 30;

        maxXY = barBoxWH - barWH;

        moveR = (contWH - boxWH) / maxXY;

        contScroll.update({
            boxWH: boxWH,
            contWH: contWH
        });

        eBar.style[typeSize] = barWH + 'px';
    }

    function moveBar(v) {
        if (v > maxXY) v = maxXY;
        else if (v < 0) v = 0;

        eBar.style[type] = v + 'px';

        currXY = v;
    }
}

ScrollBar();