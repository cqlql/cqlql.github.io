"use strict";


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
c.eventBind(window, 'resize', function (e) {
    scrollBar.update({
        boxWH: eBox.clientWidth,
        contWH: eCont.clientWidth,
        barBoxWH: eBarBox.clientWidth
    });
    //scrollBar.update({
    //    boxWH: eBox.clientHeight,
    //    contWH: eCont.clientHeight,
    //    barBoxWH: eBarBox.clientHeight
    //});
});

function ContScroll(params) {

    var eBox = params.eBox,
        eCont = params.eCont,
        type = params.type||'top',
        boxWH, contWH,
        currContXY = 0,
        tempContXY
        , velocity = new c.Velocity()
        , stripingReduce = new c.StripingReduce()
        , maxXY = 0
        , that = this
        , isDrag = false
    ;

    c.drag(eBox, function (xy) {

        xy = xy[type];
        
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
            change(currContXY + v);
        });
    });

    c.eventBind(eBox, 'click', function (e) {
        if (isDrag) {
            if (e.cancelable) e.preventDefault();
            return false;
        }
    });

    c.mouseWheel(eBox, function (e) {
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
        if (type === 'left') {
            if (e.cancelable) e.preventDefault();
            return false;
        }

        if (e.cancelable && isScroll) e.preventDefault();
        return !isScroll;

    });

    this.update = update;
    this.moveCont = moveCont;
    this.change = function () { };

    function update(params) {
        boxWH = params.boxWH;
        contWH = params.contWH;

        maxXY = boxWH - contWH;

        change(currContXY);
    }

    function moveCont(v) {
        var isScroll;//true表示 自定义的滚动条可 滚动，系统的不能滚动
        
        if (v < maxXY) v = maxXY;
        else if (v > 0) v = 0;

        eCont.style[type] = v + 'px';

        isScroll = v !== currContXY;
        
        currContXY = v;

        return isScroll;
    }

    function change(v) {
        var isScroll=  moveCont(v);

        that.change(currContXY);

        return isScroll;
    }
}


function ScrollBar(params) {
    var
        eBox = params.eBox,
        eCont = params.eCont,

        eBarBox = params.eBarBox,        
        eBar = eBarBox.children[0],

        type = params.type || 'top'
        , typeSize = type === 'top' ? 'height' : 'width'

        , currXY = 0
        , tempXY
        , maxXY = 0
        , contScroll = new ContScroll({
            eBox: eBox,
            eCont: eCont,
            type: type
        })
        , moveR // 滚动条 与 内容 的移动比
    ;

    c.drag(eBar, function (xy) {
        
        xy = xy[type];
        
        moveBar(tempXY + xy);

        contScroll.moveCont(-currXY * moveR);

    }, function (e) {
        tempXY = currXY;
        if (e.cancelable) e.preventDefault();
    }, function () {

    });
    c.eventBind(eBox, 'mousedown', function (e) {
        var v;
        if ((type === 'left' ? e.pageX : e.pageY) < jBar.offset()[type]) {
            v = curConO + boxS;
        }
        else {
            v = curConO - boxS;
        }

        moveBar(v);

        if (e.cancelable) e.preventDefault();
        return false;
    });
    


    contScroll.change = function (v) {
        
        moveBar(moveR ?- v / moveR:0);
    };

    this.update = update;

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
