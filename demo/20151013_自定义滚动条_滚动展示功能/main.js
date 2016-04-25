"use strict";


//window.requestAnimationFrame=(function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.msRequestAnimationFrame||function(b,a){return window.setTimeout(b,1000/60)}})();window.cancelAnimationFrame=window.cancelAnimationFrame||window.mozCancelAnimationFrame||window.clearTimeout;
//(function(){var b={};b.extend=function(c){var a=this;b.each(c,function(e,d){a[e]=d})};b.each=function(a,e){var d,c=a.length;if(c===undefined){for(d in a){if(e(d,a[d])===false){break}}}else{for(d=0;d<c;d++){if(e(d,a[d],c)===false){break}}}};b.Velocity=function(){var c,d=[],a=this;function e(){return(new Date()).getTime()-c}this.start=function(){d=[[0,0]];c=(new Date()).getTime()};this.end=function(){var g=d.length-1;if(g<1){return 0}var f=e()-d[g][0];if(f<200){return(d[0][1]-d[g][1])/f*1000}else{return 0}};this.change=function(f){d.unshift([e(),f]);if(d.length>4){d.length=4}}};b.StripingReduce=function(){var a;this.start=function(g,d){var f=20,e=g;function c(){e=parseFloat((e*0.8).toFixed(2));d(e);if(Math.abs(e)>0.1){a=setTimeout(c,f)}}a=setTimeout(c,f)};this.stop=function(){clearTimeout(a)}};b.ChangeAnime=function(d,h){var e=this,f=false;h=h?h:0.2;function c(){f=false}function a(k,j){function i(){if(f){var l=h*(e.to-e.cur);e.cur+=l;if(Math.abs(e.to-e.cur)<1){e.cur=e.to;c()}d(e.cur);window.requestAnimationFrame(i)}}if(f){return}f=true;e.to=k;e.cur=j?j:e.cur;window.requestAnimationFrame(i)}function g(){f=false}this.start=a;this.stop=g;this.cur=0;this.to=0;this.getState=function(){return f}};b.drag=function(f,g,h,e){var c=!-[1,],d=document;b.eventBind(f,"mousedown",a);function a(i){h(i);if(c){f.setCapture()}var j={mousemove:function(k){g({left:k.pageX-i.pageX,top:k.pageY-i.pageY,event:k})},mouseup:function(){if(e){e()}if(c){f.releaseCapture()}b.eventUnBind(document,j)}};b.eventBind(document,j);return false}};b.eventBind=function(h,g,c){var d,e;if(window.addEventListener){d="addEventListener";e=""}else{d="attachEvent";e="on"}if(typeof g==="string"){h[d](e+g,a(c))}else{for(var f in g){h[d](e+f,a(g[f]))}}function a(i){i.base_date_realListener=function(k){var j={pageX:k.pageX===undefined?document.documentElement.scrollLeft+k.clientX:k.pageX,pageY:k.pageY===undefined?document.documentElement.scrollTop+k.clientY:k.pageY,offsetX:k.offsetX,offsetY:k.offsetY,originalEvent:k,target:k.target||k.srcElement,preventDefault:function(){if(k.cancelable){k.preventDefault()}else{k.returnValue=false}},stopPropagation:function(){if(k.stopPropagation){k.stopPropagation()}else{k.cancelBubble=true}}};if(i(j)===false){j.preventDefault();j.stopPropagation()}};return i.base_date_realListener}};b.eventUnBind=function(c,d,e){var f,g;if(window.removeEventListener){f="removeEventListener";g=""}else{f="detachEvent";g="on"}if(typeof d==="string"){c[f](g+d,e.base_date_realListener)}else{for(var a in d){c[f](g+a,d[a].base_date_realListener)}}};b.mouseWheel=function(a,c){if(a.addEventListener){if(a.onmousewheel===undefined){a.addEventListener("DOMMouseScroll",c,false)}else{a.addEventListener("mousewheel",c,false)}}else{a.attachEvent("onmousewheel",c)}};b.removeMouseWheel=function(a,c){if(a.addEventListener){if(a.onmousewheel===undefined){a.removeEventListener("DOMMouseScroll",c,false)}else{a.removeEventListener("mousewheel",c,false)}}else{a.detachEvent("onmousewheel",c)}};window.c=window.common=b})();
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

            if (closeAnime) { contMoveAnime.stop(); contMoveAnime.cur = v;contCss(v); }
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






