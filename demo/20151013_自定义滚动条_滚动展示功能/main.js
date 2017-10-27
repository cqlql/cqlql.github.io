"use strict";

window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame
  || window.mozRequestAnimationFrame || window.msRequestAnimationFrame || function (callback, elem) {
    return window.setTimeout(callback, 1000 / 60);
  };
window.cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.clearTimeout;
(function () {

  var c = {};


  //#region 速率计算
  c.Velocity = function () {

    var startTime,
      moveTimesArr = [],
      target = this;

    function getSustainTimes() {
      return (new Date()).getTime() - startTime;
    }

    //速率计时
    this.start = function () {
      moveTimesArr = [[0, 0]];
      startTime = (new Date()).getTime();
    };
    this.end = function () {
      var lastIndex = moveTimesArr.length - 1;

      if (lastIndex < 1) return 0;

      //间隔时间
      var intervalTime = getSustainTimes() - moveTimesArr[lastIndex][0];

      //有惯性情况。间隔时间
      if (intervalTime < 200) {
        // 滑动情况一般不会超过50毫秒。如果不够敏感，不应调节这里。条件end 返回的值，往小里调

        return (moveTimesArr[0][1] - moveTimesArr[lastIndex][1]) / intervalTime * 1000;
      }
      //无惯性
      else {
        return 0;
      }
    };

    this.change = function (val) {

      moveTimesArr.unshift([getSustainTimes(), val]);

      if (moveTimesArr.length > 4) moveTimesArr.length = 4;
    };
  };
  //#endregion

  //#region 减动画核心

  /*
  * 减动画核心
  *
  * 可实现惯性，也许还有更好的办法
  * 暂只支持一个方向(x或者y)
  * */
  c.StripingReduce = function () {
    var stopId;
    this.start = function (to, fn) {
      var times = 20,
        vel = to;

      function back() {
        vel = parseFloat((vel * .8).toFixed(2));

        fn(vel);

        if (Math.abs(vel) > 0.1) stopId = setTimeout(back, times);
      }

      stopId = setTimeout(back, times);
    };

    this.stop = function () {
      clearTimeout(stopId);
    };
  };

  //#endregion

  //#region 动态动画效果
  /*
  **动态动画效果
  目标位置 随便都可以改变的动画效果


  /*
  *** 版本2
  //创建
  var anime = new c.ChangeAnime(function (v) {
      side_follow.css('top', v);
  });

  //停止动画
  anime.stop();

  //开始动画
  anime.start(100);//方式1 。只有目标位置
  anime.start(100,0);//方式2。目标位置，初始位置

  //取状态
  anime.getState();
  */
  c.ChangeAnime = function (change, rate) {

    var o = this,

      //开关。 是否进行中。true 进行中
      sw = false;

    rate = rate ? rate : .2;

    function lastExcu() {

      sw = false;
    }

    // 参数2 可以是任意值，12px这种也是有效的，其他非数字将视为0
    function start(to, cur) {

      function baseExcu() {
        if (sw) {
          var len = rate * (o.to - o.cur);

          o.cur += len;

          //最后一次
          if (Math.abs(o.to - o.cur) < 1) {
            o.cur = o.to;

            lastExcu();
          }

          change(o.cur);

          window.requestAnimationFrame(baseExcu);
        }
      }

      o.to = to;
      cur = parseFloat(cur);
      o.cur = cur ? cur : o.cur;

      if (sw) return;
      sw = true;

      window.requestAnimationFrame(baseExcu);
    }

    function stop() {
      sw = false;
    }

    this.start = start;
    this.stop = stop;
    this.cur = 0;
    this.to = 0;

    this.getState = function () {
      return sw;
    };
  };
  //#endregion


  //#region each 循环

  // 带length的集合对象 或 纯对象
  // fn 中 返回false 将跳出
  c.each = function (obj, fn) {
    var
      key,
      len = obj && obj.length;

    if (len === undefined) {
      for (key in obj) {
        if (fn(key, obj[key]) === false) {
          break;
        }
      }
    }
    else {
      for (key = 0; key < len; key++) {
        if (fn(key, obj[key], len) === false) {
          break;
        }
      }
    }
  };

  //#endregion

  // 扩展
  c.extend = function (obj) {
    var target = this;
    c.each(obj, function (k, v) {
      target[k] = v;
    });
  };




  window.c = window.common = c;

})();
/// pc
c.extend({

  //#region 事件绑定/解除

  // pc
  eventBind: function (target, types, listener) {
    var fnName,
      typePrefix;
    if (window.addEventListener) {

      fnName = 'addEventListener';
      typePrefix = '';
    }
    else {
      fnName = 'attachEvent';
      typePrefix = 'on';
    }

    if (typeof types === 'string') {
      //target[fnName](typePrefix + types, listener);
      target[fnName](typePrefix + types, eventFn(listener));
    }
    else {
      for (var k in types) {
        //target[fnName](typePrefix + k, types[k]);
        target[fnName](typePrefix + k, eventFn(types[k]));
      }
    }

    function eventFn(listener) {

      listener.base_date_realListener = function (e) {

        var event = {
          pageX: e.pageX === undefined ? document.documentElement.scrollLeft + e.clientX : e.pageX
          , pageY: e.pageY === undefined ? document.documentElement.scrollTop + e.clientY : e.pageY
          , offsetX: e.offsetX
          , offsetY: e.offsetY
          , originalEvent: e
          , target: e.target || e.srcElement
          , preventDefault: function () {
            if (e.cancelable) e.preventDefault();
            else e.returnValue = false;
          }
          , stopPropagation: function () {
            if (e.stopPropagation) e.stopPropagation();
            else e.cancelBubble = true;
          }
        };

        if (listener(event) === false) {
          event.preventDefault();
          event.stopPropagation();
        }
      };

      return listener.base_date_realListener;

    }

    //if (addEventListener) {
    //    target.addEventListener(types, listener);
    //}
    //else {
    //    target.attachEvent('on' + types, listener);
    //}
  },
  eventUnBind: function (target, types, listener) {
    //if (removeEventListener) {
    //    target.removeEventListener(types, listener);
    //}
    //else {
    //    target.detachEvent('on' + types, listener);
    //}

    var fnName,
      typePrefix;
    if (window.removeEventListener) {

      fnName = 'removeEventListener';
      typePrefix = '';
    }
    else {
      fnName = 'detachEvent';
      typePrefix = 'on';
    }

    if (typeof types === 'string') {
      target[fnName](typePrefix + types, listener.base_date_realListener);
    }
    else {
      for (var k in types) {
        target[fnName](typePrefix + k, types[k].base_date_realListener);
      }
    }
  },

  //#endregion

  //#region 滚轮
  /*
  core.mouseWheel(jMainBox[0], function (e) {
      var pre;
      if (e.wheelDelta) //前120 ，后-120
          pre = e.wheelDelta > 0;
      else //firefox
          pre = e.detail < 0;

      if (pre) {
          //*往上滚
      } else {
          //*往下滚
      }

      //阻止滚动条滚动
      if (e.cancelable) e.preventDefault();
      return false;
  });
  */
  mouseWheel: function (dom, f) {
    if (dom.addEventListener) {
      this.mouseWheel = function (dom, f) {
        if (dom.onmousewheel === undefined) dom.addEventListener('DOMMouseScroll', f, false);//firefox
        else dom.addEventListener('mousewheel', f, false);
      }
    }
    else if(dom.attachEvent){
      this.mouseWheel = function (dom, f) {
        dom.attachEvent('onmousewheel', f);//ie678
      }
    }

    this.mouseWheel(dom, f);

  },
  removeMouseWheel: function (dom, f) {
    if (dom.addEventListener) {
      if (dom.onmousewheel === undefined) dom.removeEventListener('DOMMouseScroll', f, false);//firefox
      else dom.removeEventListener('mousewheel', f, false);
    } else {
      dom.detachEvent('onmousewheel', f);//ie678
    }
  },
  //#endregion


  //#region 拖动基础

  drag: function (eDrag, onMove, onDown, onUp) {
    var isIE678 = !-[1, ],
      eDom = document;

    c.eventBind(eDrag, 'mousedown', down);

    function down(e) {

      if (onDown(e) === false) return;

      //IE678 执行捕捉 来 避免 图片文字等默认选择事件
      if (isIE678) eDrag.setCapture();

      var eveFn = {
        mousemove: function (eve) {

          onMove({ left: eve.pageX - e.pageX, top: eve.pageY - e.pageY, event: eve });
        },
        mouseup: function () {
          if (onUp) onUp();

          if (isIE678) eDrag.releaseCapture();

          c.eventUnBind(document, eveFn);//解除所有事件
        }
      };

      c.eventBind(document, eveFn);

      return false;
    }

  }

  //#endregion
});

c.extend({
    ContScroll: function ContScroll(params) {

        var eBox = params.eBox,
            eCont = params.eCont,
            type = params.type || 'top',
            moveAttrName = params.moveAttrName || type,
            contDrag = params.contDrag === undefined ? true : params.contDrag,
            minBottom = params.minBottom || 0,
            onbottom = params.onbottom || function () { },

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
            , excuInterval = new ExcuInterval()
        ;

        if (contDrag) contDragInit();

        c.mouseWheel(eBox, mouseWheel);

        this.update = update;
        this.moveCont = moveCont;
        this.change = function () { };
        this.mouseWheel = mouseWheel;
        this.bottomTest = function () {
          return contWH - boxWH + currContXY < minBottom
        }

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

            // if (e.cancelable && isScroll) 
            e.preventDefault();
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

          excuInterval.excu(function () {
            onbottom(contWH - boxWH + currContXY < minBottom);
          }, 100)

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

        function ExcuInterval() {
          var status = 0;
          this.excu = function (fn, time) {
            if (status) return;
            status = 1;
            setTimeout(function () {
              fn();
              status = 0;
            }, time);
          }
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

            minBottom = params.minBottom,
            onbottom = params.onbottom,

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
                contDrag: contDrag,
                minBottom: minBottom,
                onbottom: onbottom
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
        this.bottomTest = function () {
          return contScroll.bottomTest()
        }

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
        type: 'left',
        minBottom: 30,
        onbottom: function (isBott) {
          console.log(isBott, scrollBar.bottomTest())
        }

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






