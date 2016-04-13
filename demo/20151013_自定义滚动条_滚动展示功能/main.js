"use strict";


window.requestAnimationFrame=(function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.msRequestAnimationFrame||function(b,a){return window.setTimeout(b,1000/60)}})();window.cancelAnimationFrame=window.cancelAnimationFrame||window.mozCancelAnimationFrame||window.clearTimeout;
(function(){var a={};a.extend=function(d){var b=this;a.each(d,function(c,g){b[c]=g})};a.each=function(b,f){var g,h=b.length;if(h===undefined){for(g in b){if(f(g,b[g])===false){break}}}else{for(g=0;g<h;g++){if(f(g,b[g],h)===false){break}}}};a.Velocity=function(){var h,g=[],b=this;function f(){return(new Date()).getTime()-h}this.start=function(){g=[[0,0]];h=(new Date()).getTime()};this.end=function(){var c=g.length-1;if(c<1){return 0}var d=f()-g[c][0];if(d<200){return(g[0][1]-g[c][1])/d*1000}else{return 0}};this.change=function(c){g.unshift([f(),c]);if(g.length>4){g.length=4}}};a.StripingReduce=function(){var b;this.start=function(h,k){var i=20,j=h;function l(){j=parseFloat((j*0.8).toFixed(2));k(j);if(Math.abs(j)>0.1){b=setTimeout(l,i)}}b=setTimeout(l,i)};this.stop=function(){clearTimeout(b)}};a.ChangeAnime=function(l,n){var k=this,j=false;n=n?n:0.2;function m(){j=false}function b(c,d){function e(){var f=n*(k.to-k.cur);k.cur+=f;if(Math.abs(k.to-k.cur)<1){k.cur=k.to;m()}l(k.cur);if(j){window.requestAnimationFrame(e)}}k.to=c;k.cur=d?d:k.cur;if(j){return}j=true;window.requestAnimationFrame(e)}function i(){j=false}this.start=b;this.stop=i;this.cur=0;this.to=0;this.getState=function(){return j}};a.drag=function(j,i,n,k){var b=!-[1,],l=document;a.eventBind(j,"mousedown",m);function m(d){n(d);if(b){j.setCapture()}var c={mousemove:function(e){i({left:e.pageX-d.pageX,top:e.pageY-d.pageY,event:e})},mouseup:function(){if(k){k()}if(b){j.releaseCapture()}a.eventUnBind(document,c)}};a.eventBind(document,c);return false}};a.eventBind=function(n,i,m){var l,k;if(window.addEventListener){l="addEventListener";k=""}else{l="attachEvent";k="on"}if(typeof i==="string"){n[l](k+i,b(m))}else{for(var j in i){n[l](k+j,b(i[j]))}}function b(c){c.base_date_realListener=function(d){var e={pageX:d.pageX===undefined?document.documentElement.scrollLeft+d.clientX:d.pageX,pageY:d.pageY===undefined?document.documentElement.scrollTop+d.clientY:d.pageY,offsetX:d.offsetX,offsetY:d.offsetY,originalEvent:d,target:d.target||d.srcElement,preventDefault:function(){if(d.cancelable){d.preventDefault()}else{d.returnValue=false}},stopPropagation:function(){if(d.stopPropagation){d.stopPropagation()}else{d.cancelBubble=true}}};if(c(e)===false){e.preventDefault();e.stopPropagation()}};return c.base_date_realListener}};a.eventUnBind=function(l,k,j){var i,h;if(window.removeEventListener){i="removeEventListener";h=""}else{i="detachEvent";h="on"}if(typeof k==="string"){l[i](h+k,j.base_date_realListener)}else{for(var b in k){l[i](h+b,k[b].base_date_realListener)}}};a.mouseWheel=function(b,d){if(b.addEventListener){if(b.onmousewheel===undefined){b.addEventListener("DOMMouseScroll",d,false)}else{b.addEventListener("mousewheel",d,false)}}else{b.attachEvent("onmousewheel",d)}};a.removeMouseWheel=function(b,d){if(b.addEventListener){if(b.onmousewheel===undefined){b.removeEventListener("DOMMouseScroll",d,false)}else{b.removeEventListener("mousewheel",d,false)}}else{b.detachEvent("onmousewheel",d)}};window.c=window.common=a})();
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
            , hasScroll = false
            , contMoveAnime = new c.ChangeAnime(contCss)
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
        function moveCont(v, closeAnime) {
            var isScroll;//true表示 自定义的滚动条可 滚动，系统的不能滚动

            if (v < maxXY) v = maxXY;
            else if (v > 0) v = 0;

            if (closeAnime) { contCss(v); contMoveAnime.cur = v; }
            else { contMoveAnime.start(v); }

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

        function contCss(v) {
            eCont.style[moveAttrName] = v + 'px';
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
        this.moveToBottom = function (closeAnime) {
            change(maxXY, closeAnime);
        };

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

        function change(v, closeAnime) {

            moveBar(v);

            contScroll.moveCont(-v * moveR, closeAnime);

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

    document.getElementById('btn2').onclick = function () {
        scrollBar.moveToBottom();
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






