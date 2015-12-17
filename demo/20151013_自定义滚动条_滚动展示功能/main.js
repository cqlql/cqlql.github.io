"use strict";

c.extend({
    ContScroll: function ContScroll(params) {

        var eBox = params.eBox,
            eCont = params.eCont,
            type = params.type || 'top',
            moveAttrName = params.moveAttrName || type,
            contDrag = params.contDrag === undefined ? true : params.contDrag,

            boxWH, contWH,
            currContXY = 0,
            tempContXY
            , velocity = new c.Velocity()
            , stripingReduce = new c.StripingReduce()
            , maxXY = 0
            , that = this
            , isDrag = false
            ,hasScroll=false
            , contMoveAnime = new c.ChangeAnime(function (v) {
                eCont.style[moveAttrName] = v + 'px';
            })
        ;

        if (contDrag) contDragInit();

        c.mouseWheel(eBox, mouseWheel);

        this.update = update;
        this.moveCont = moveCont;
        this.change = function () { };
        this.mouseWheel = mouseWheel;

        function update(params) {
            boxWH = params.boxWH;
            contWH = params.contWH;

            if (contWH - boxWH > 1) {
                maxXY = boxWH - contWH;

                change(currContXY);

                hasScroll = true;
            }
            else {
                hasScroll = false;
            }
        }

        function mouseWheel(e) {
            if (hasScroll === false) return false;

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

        // 内容拖动功能
        function contDragInit() {
            c.drag(eBox, function (xy) {

                xy = xy[type];

                velocity.change(xy);

                change(tempContXY + xy);

                isDrag = Math.abs(xy) > 6;
            }, function (e) {

                if (hasScroll === false) return false;

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
                    e.preventDefault();
                }
            });
        }

    },

    /*
    
    参数：
     eBox
     eCont
     eBarBox
     contDrag
     type
     moveAttrName
     */

    ScrollBar: function (params) {
        var
            eBox = params.eBox,
            eCont = params.eCont,

            eBarBox = params.eBarBox,
            eBar = eBarBox.children[0],

            contDrag = params.contDrag,

            type = params.type || 'top',
            moveAttrName = params.moveAttrName || type
            , typeSize = type === 'top' ? 'height' : 'width'

            , boxWH
            , currXY = 0
            , tempXY
            , maxXY = 0
            , contScroll = new c.ContScroll({
                eBox: eBox,
                eCont: eCont,
                type: type,
                moveAttrName: moveAttrName,
                contDrag: contDrag
            })
            , moveR = 1 // 滚动条 与 内容 的移动比

            // 这里没必要要，因为没有滚动条情况，滚动条会直接消失，事件什么的都是浮云
            //, hasScroll = false // 是否有滚动条
        ;

        c.drag(eBar, function (xy) {
            xy = xy[type];
            change(tempXY + xy);
        }, function (e) {
            tempXY = currXY;
        });
        c.eventBind(eBarBox, 'mousedown', function (e) {

            var v;

            if ((type === 'left' ? e.offsetX : e.offsetY) < currXY) {

                v = boxWH;
            }
            else {
                v = -boxWH;
            }
            change(-v / moveR + currXY);

            e.preventDefault();
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
            }
            else {
                eBarBox.style.display = 'block';

                barWH = barBoxWH / r;

                if (barWH < 30) barWH = 30;

                maxXY = barBoxWH - barWH;

                moveR = (contWH - boxWH) / maxXY;

                eBar.style[typeSize] = barWH + 'px';
            }

            contScroll.update({
                boxWH: boxWH,
                contWH: contWH
            });
        }

        function moveBar(v) {
            if (v > maxXY) v = maxXY;
            else if (v < 0) v = 0;

            eBar.style[moveAttrName] = v + 'px';

            currXY = v;
        }

        function change(v) {

            moveBar(v);

            contScroll.moveCont(-v * moveR);

        }
    }
});

demo1();
demo2();
demo3();
demo4();

function demo1() {
    var eBox = document.getElementById('demo1'),
        eCont = eBox.children[0],
        eBarBox = document.getElementById('scrollBar1');

    var scrollBar = new c.ScrollBar({
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

    var contScroll = new c.ContScroll({
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

    var scrollBar = new c.ScrollBar({
        eBox: eBox,
        eCont: eCont,
        eBarBox: eBarBox,
        contDrag: false,
        moveAttrName:'marginTop'
    });
    scrollBar.update({
        boxWH: eBox.clientHeight,
        contWH: eCont.clientHeight,
        barBoxWH: eBarBox.clientHeight
    });
    
    //var contScroll = new c.ContScroll({
    //    eBox: eBox,
    //    eCont: eCont
    //});

    //contScroll.update({
    //    boxWH: eBox.clientHeight,
    //    contWH: eCont.clientHeight
    //});
}

function demo4() {
    var eBox = document.getElementById('demo4').children[1],
    eCont = eBox.children[0],
    eBarBox = eBox.children[1];

    var scrollBar = new c.ScrollBar({
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






