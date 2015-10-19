"use strict";


demo1();
demo2();
demo3();
demo4();

function demo1() {
    var eBox = document.getElementById('demo1'),
        eCont = eBox.children[0],
        eBarBox = document.getElementById('scrollBar1');

    var scrollBar = new ScrollBar({
        eBox: eBox,
        eCont: eCont,
        eBarBox: eBarBox,
        type: 'left'

    });

    scrollBar.update({
        boxWH: eBox.clientWidth,
        contWH: eCont.clientWidth,
        barBoxWH: eBarBox.clientWidth
    });

    var is = 0;
    document.getElementById('btn1').onclick = function () {
        if (is) {
            eBox.style.width = '1000px';
            eBarBox.style.width = '1000px';
            is = 0;
        }
        else {
            eBox.style.width = '400px';
            eBarBox.style.width = '400px';
            is = 1;
        }
        
        scrollBar.update({
            boxWH: eBox.clientWidth,
            contWH: eCont.clientWidth,
            barBoxWH: eBarBox.clientWidth
        });
    };
}

function demo2() {
    var eBox = document.getElementById('demo2'),
        eCont = eBox.children[0];

    var contScroll = new ContScroll({
        eBox: eBox,
        eCont: eCont,
        type: 'left'

    });

    contScroll.update({
        boxWH: eBox.clientWidth,
        contWH: eCont.clientWidth
    });
}

function demo3() {
    var eBox = document.getElementById('demo3'),
    eCont = eBox.children[0],
    eBarBox = document.getElementById('scrollBar3');

    var scrollBar = new ScrollBar({
        eBox: eBox,
        eCont: eCont,
        eBarBox: eBarBox

    });
    scrollBar.update({
        boxWH: eBox.clientHeight,
        contWH: eCont.clientHeight,
        barBoxWH: eBarBox.clientHeight
    });
}

function demo4() {
    var eBox = document.getElementById('demo4').children[1],
    eCont = eBox.children[0],
    eBarBox = eBox.children[1];

    var scrollBar = new ScrollBar({
        eBox: eBox,
        eCont: eCont,
        eBarBox: eBarBox,
        type: 'left',
        moveAttrName:'marginLeft'

    });
    scrollBar.update({
        boxWH: eBox.clientWidth,
        contWH: eCont.clientWidth,
        barBoxWH: eBarBox.clientWidth
    });
}

function ContScroll(params) {

    var eBox = params.eBox,
        eCont = params.eCont,
        type = params.type || 'top',
        moveAttrName = params.moveAttrName || type,

        boxWH, contWH,
        currContXY = 0,
        tempContXY
        , velocity = new c.Velocity()
        , stripingReduce = new c.StripingReduce()
        , maxXY = 0
        , that = this
        , isDrag = false
        , contMoveAnime = new c.changeAnime(function (v) {
            eCont.style[moveAttrName] = v + 'px';
        })
    ;

    c.drag(eBox, function (xy) {

        xy = xy[type];
        console.log(xy);
        velocity.change(xy);
        
        change(tempContXY + xy);

        isDrag = Math.abs(xy) > 6;
    }, function (e) {
        velocity.start();

        tempContXY = currContXY;

        stripingReduce.stop();

        isDrag = false;
       
        
    }, function () {
        stripingReduce.start(velocity.end() / 70, function (v) {
            changeByInertialDrag(currContXY + v);
        });
    });

    c.eventBind(eBox, 'click', function (e) {
        if (isDrag) {
            if (e.cancelable) e.preventDefault();
            return false;
        }
    });

    c.mouseWheel(eBox, mouseWheel);

    this.update = update;
    this.moveCont = moveCont;
    this.change = function () { };
    this.mouseWheel = mouseWheel;

    function update(params) {
        boxWH = params.boxWH;
        contWH = params.contWH;

        maxXY = boxWH - contWH;

        change(currContXY);
    }

    function mouseWheel(e) {
        var pre, xy = currContXY, to = boxWH / 4,
            isScroll;
        if (e.wheelDelta) //前120 ，后-120
            pre = e.wheelDelta > 0;
        else //firefox
            pre = e.detail < 0;

        if (pre) {
            //*往上滚
            xy += to;
        } else {
            //*往下滚
            xy -= to;
        }

        isScroll = change(xy);

        //没有滚动条 固定不阻止
        if (boxWH - contWH > 1) {
            return true;
        }

        //阻止滚动条滚动，left 情况固定阻止系统
        //if (type === 'left') {
        //    if (e.cancelable) e.preventDefault();
        //    return false;
        //}

        if (e.cancelable && isScroll) e.preventDefault();
        return !isScroll;
    }

    // 非惯性移动
    function moveCont(v) {
        var isScroll;//true表示 自定义的滚动条可 滚动，系统的不能滚动
        
        if (v < maxXY) v = maxXY;
        else if (v > 0) v = 0;

        contMoveAnime.start(v);
        
        isScroll = v !== currContXY;
        
        currContXY = v;

        return isScroll;
    }

    function change(v) {
        var isScroll = moveCont(v);

        that.change(currContXY);

        return isScroll;
    }

    // 惯性移动情况调用
    function changeByInertialDrag(v) {
        if (v < maxXY) v = maxXY;
        else if (v > 0) v = 0;

        eCont.style[moveAttrName] = v + 'px';

        currContXY = v;

        that.change(currContXY);
    }
}


function ScrollBar(params) {
    var
        eBox = params.eBox,
        eCont = params.eCont,

        eBarBox = params.eBarBox,        
        eBar = eBarBox.children[0],

        type = params.type || 'top',
        moveAttrName = params.moveAttrName || type
        , typeSize = type === 'top' ? 'height' : 'width'

        , boxWH
        , currXY = 0
        , tempXY
        , maxXY = 0
        , contScroll = new ContScroll({
            eBox: eBox,
            eCont: eCont,
            type: type,
            moveAttrName: moveAttrName
        })
        , moveR // 滚动条 与 内容 的移动比
    ;

    c.drag(eBar, function (xy) {
        
        xy = xy[type];
        
        moveBar(tempXY + xy);

    }, function (e) {
        tempXY = currXY;
    });
    c.eventBind(eBarBox, 'mousedown', function (e) {
        var v;

        if ((type === 'left' ? e.offsetX : e.offsetY) < currXY) {
            
            v = boxWH ;
        }
        else {
            v = -boxWH ;
        }

        moveBar(-v / moveR + currXY);

        if (e.cancelable) e.preventDefault();
        return false;
    });

    contScroll.change = function (v) {
        moveBar(-v / moveR);
    };

    c.mouseWheel(eBarBox, contScroll.mouseWheel);

    this.update = update;

    function update(params) {
        boxWH = params.boxWH;
        var contWH = params.contWH,
            barBoxWH = params.barBoxWH
            , r = contWH / boxWH
            , barWH
        ;

        if (r <= 1) {
            eBarBox.style.display = 'none';
            return;
        }
        eBarBox.style.display = 'block';

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
        
        eBar.style[moveAttrName] = v + 'px';

        contScroll.moveCont(-v * moveR);

        currXY = v;
    }
}
