"use strict";

//#region 规划
/*
文件的格式
    test_1_1_1_350.jpg
    数字1：横向
    数字2：纵向
    数字3：切图
    数字4：尺寸-width

*/



/*
滚轮放大
    增加的高宽
    光标所在区域位置比决定坐标偏移

    放大后新坐标高宽
        参数：
            元素原坐标高宽
                x,y,w,h
            光标所在放大元素位置
                x,y

        逻辑：
            要增加的长度是根据放大百分数得到wLen,hLen

        输出：
            放大元素 新的 坐标高宽 

    光标所在放大元素位置

    元素原坐标、高宽
        此处跟拖动关联

拖动移动
    
    参数：
        当前坐标

    输出：
        新的坐标


尺寸坐标控制
    拖动移动+滚轮放大

    效果：
        初始为满屏


    接口：
        坐标控制。undefined 则不改变
        根据插件尺寸 更新

    内置变量：
        记录插件显示窗口 尺寸

    *事件：
        尺寸或坐标改变 调用 事件，传入当前尺寸坐标


***
缩略图
    指定尺寸的容器
    完全显示的图片，图片控制在容器内
    拖动范围控制在图片内
    
    拖动层：
        插件窗口与大图 关系对应 中间的拖动层与缩略图
    
    事件：
        拖动层坐标改变事件。事件内执行 大图坐标控制 接口
    
    接口：
        拖动层 坐标尺寸改变
        参数是 大图 坐标 尺寸
            
        接口关系：
            受大图 尺寸坐标控制 同步，随大图更新而调用

    传入参数：
        大图尺寸
    
    内置变量：
        记录拖动层当前坐标、尺寸
        容器尺寸

    缩略图生成：
        指定尺寸的容器+大图尺寸

***
线上切图优化方案实现
    传入参数
        大图容器
    
    实现：
        优化图将不会被删除，上面叠加加载大图，加载好后将删除旧的大图
        旋转将只保留优化图，停止200毫秒后将加载当前尺寸大图
        坐标尺寸 使用百分比
    

***
360旋转放大看图程序

    内置参数：
        插件 高宽。可固定，可变化

    传入参数：
        指定插件高宽

    接口：
        更改 插件高宽

    事件：
        高宽改变 事件，传入 改变高宽


    本地实现方案：
        1、所有优化图加载
            传入参数：
                dataSrc 所有优化图src 的数组
                callBack 加载好后 正式初始

        2、大图尺寸
            取优化图尺寸即可

    线上优化方案说明
        优化图尺寸
        原图尺寸
            然后就能得出切图方案
            当然 还是在 所有优化图加载完成 后处理

*/
/*
拖动旋转核心
    实现指定范围内，完成一周，也就是1张到最后一张
    必要核心参数
        绑定的拖动触发范围
        xy 各 方向的图片总数
        拖动回调，输出对应的图片索引
        记录初始当前xy索引。x默认是0，y则是中间

    调用举例
        var dragRotate = new dragRotateCore({
            jElement: $('#div2'),
            xCount: 60,
            yCount: 60,
            onMove: function(xNum, yNum) {
                console.log(xNum, yNum);
            }
        });
        dragRotateCore.setRange(400,200);
        dragRotateCore.setCurXYNum(0,Math.floor(yCount / 2));

旋转
    内置变量
        记录当前xy方向索引

    接口
        指定xy方向值实现旋转

*/
/*

窗口尺寸变化
    同时改变 图片容器的 最大xy，最小wh 限制
XX放大缩小。包括上面两种限制，还有如下


一些想法
    数据与显示分离
    先数据，后显示

    合理规划

    根据效果来思考

现在的思路是
    完全分离wh 、xy的控制。先得到 whxy数据。然后显示

    wh控制思考
        最小wh，根据显示容器wh生成最小wh
        最大高宽由图片决定
        影响xy 2点：            
            决定最小xy，显示容器wh 减 图片容器wh 得到。随这两个容器的高宽而改变
            决定xy是否居中 ，居中情况 将不受 拖动移动控制

    
    xy控制思考
        最大xy：0。这是固定死的



*/
//#endregion

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback, element) {
            window.setTimeout(callback, 17);
        };
})();

var pictureShow = (function () {

    function Anime(params) {
        var
            that = this,

            curParams = {},

            stopId = null;

        function excu(params, options) {

            var
                go = options.go,

                speed = options.speed === undefined ? 400 : options.speed,
                easing = options.easing === undefined ? 'swing' : options.easing,
                callBack = options.callBack === undefined ? function () { } : options.callBack,

                start = {},

                t = 0,//当前起始次数
                time = 17,//帧间隔
                d = speed / time;//总次数

            if (stopId !== null) stop();

            for (var name in params) {

                if (curParams[name] === undefined) {
                    curParams[name] = 0;
                }

                start[name] = curParams[name];
            }

            function run() {
                var to = {},
                    cur;

                if (t < d) {
                    t++;

                    for (var name in params) {
                        cur = start[name];
                        to[name] = jQuery.easing[easing](null, t, cur, params[name] - cur, d);
                    }

                    curParams = to;

                    go(to);

                    stopId = requestAnimFrame(run);
                }
                else {
                    go(params);

                    curParams = params;

                    stopId = null;

                    callBack();
                }
            }

            run();
        }

        function setCurParams(params) {
            for (var name in params) {
                curParams[name] = params[name];
            }
        }

        this.excu = excu;
        this.setCurParams = setCurParams;

        setCurParams(params);
    }

    function dragRotateCore(params) {
        var
            that = this,

            xCount = params.xCount,
            yCount = params.yCount,

            xl = 10,
            yl = 10,
            curXNum = 0,
            curYNum = Math.floor(yCount / 2),
            _xNum, _yNum;

        this.onMove = function () { };

        this.move = function (xy) {

            curXNum = (xCount + Math.floor(xy.left / xl) % xCount + _xNum) % xCount;
            curYNum = _yNum + Math.floor(xy.top / yl);

            if (curYNum < 0) curYNum = 0;
            if (curYNum > yCount - 1) curYNum = yCount-1;

            that.onMove(curXNum, curYNum);
        };

        this.down = function () {
            _xNum = curXNum;
            _yNum = curYNum;
        };

        //尺度 、单位
        this.setRange = function (w, h) {
            xl = w / xCount;
            yl = 50;//h / yCount;
        };
        this.setCurXYNum = function (xNum, yNum) {
            curXNum = xNum;
            curYNum = yNum;
        }

        this.ini = function () {
            that.onMove(curXNum, curYNum);
        };
    }

    function oneTouchDrag(jElem, onMove, onDown, onUp) {
        var jDom = $(document.body),
            startTouche;

        function end(e) {
            var touches = e.originalEvent.touches;
            if (touches.length === 0) {
                if (onUp) onUp();

                jDom.off(eveFn);//解除所有事件
            }
        }

        function down(e) {
            if (onDown) onDown(e);

            startTouche = e.originalEvent.touches[0];

            jDom.on(eveFn);

            return false;
        }

        function start(e) {

            var touches = e.originalEvent.touches;

            if (touches.length === 1) {

               return down(e);
            }
        }

        var eveFn = {
            touchmove: function (e) {

                var touches = e.originalEvent.touches;

                if (touches.length === 1) {

                    var moveTouche = e.originalEvent.touches[0],
                      pageX = moveTouche.pageX - startTouche.pageX,
                      pageY = moveTouche.pageY - startTouche.pageY;

                    onMove({ left: pageX, top: pageY });
                }
            },
            touchend: end
        };

        jElem.on({
            touchstart: start
        });
    }

    function mainHandle() {
        var
          jBox,

          jImgBox,
          jImg,
          eImg,

          showWH,
          imgWH,
          imgWHR,

          boxXY,

          xCount,
          yCount,

          thumb = new thumbHandle(),

          imgBoxWH = {
              width: 0,
              height: 0
          },
          imgBoxXY = {
              left: 0,
              top: 0
          },

          imgBoxIsCenter = {
              x: false,
              y: false
          },

          imgBoxMinXY = {
              left: 0,
              top: 0
          },
          imgBoxMinWH = {
              width: 0,
              height: 0
          },
          dragRotate,
              
          imgAnimeWH = new Anime(),
          imgAnimeXY = new Anime();

        function drag() {

            function dragMove() {
                var x, y;

                this.down = function () {
                    x = imgBoxXY.left;
                    y = imgBoxXY.top;
                };

                this.move = function (xy) {
                    var _x, _y;

                    _x = x + xy.left;
                    _y = y + xy.top;

                    setImgBoxXY(_x, _y);

                    animeXY();
                };
            }

            var dragInterface,
                jBtnMove = $('#pDragMove'),
                jBtnRotate = $('#pDragRotate');

            dragMove = new dragMove();

            dragInterface = dragRotate;

            common.drag_v2(jBox,function(xy){
                dragInterface.move(xy);
            }, function () {
                dragInterface.down();
            });

            jBtnMove.click(function () {
                jBtnRotate.removeClass('active');
                jBtnMove.addClass('active');
                dragInterface = dragMove;
            });
            jBtnRotate.click(function () {
                jBtnMove.removeClass('active');
                jBtnRotate.addClass('active');
                dragInterface = dragRotate;
            });
        }

        function setImgBoxWH(w, h) {
            if (w < imgBoxMinWH.width) {
                w = imgBoxMinWH.width;
            }

            if (h < imgBoxMinWH.height) {
                h = imgBoxMinWH.height;
            }

            if (w > imgWH.width) {
                w = imgWH.width;
            }

            if (h > imgWH.height) {
                h = imgWH.height;
            }

            if (w <= showWH.width) {
                imgBoxIsCenter.x = true;
            }
            else {
                imgBoxIsCenter.x = false;
            }

            if (h <= showWH.height) {
                imgBoxIsCenter.y = true;
            }
            else {
                imgBoxIsCenter.y = false;
            }

            if (imgBoxIsCenter.x && imgBoxIsCenter.y) {
                thumb.hide();
            }
            else {
                thumb.show();
            }

            //最小xy
            imgBoxMinXY.left = showWH.width - w;
            imgBoxMinXY.top = showWH.height - h;

            dragRotate.setRange(w, h);

            imgBoxWH = {
                width: w,
                height: h
            };

        }

        function setImgBoxXY(x, y) {

            if (imgBoxIsCenter.x) {
                x = (showWH.width - imgBoxWH.width) / 2;
            }
            else {
                if (x < imgBoxMinXY.left) {
                    x = imgBoxMinXY.left;
                }

                if (x > 0) {
                    x = 0;
                }
            }


            if (imgBoxIsCenter.y) {
                y = (showWH.height - imgBoxWH.height) / 2;
            } else {
                if (y < imgBoxMinXY.top) {
                    y = imgBoxMinXY.top;
                }

                if (y > 0) {
                    y = 0;
                }
            }

            imgBoxXY = {
                left: x,
                top: y
            };

            thumb.updateMoveWHXY();
        }

        function animeWH(is) {
            if (is) {
                jImgBox.animate(imgBoxWH, { queue: false });

                imgAnimeWH.excu({
                    width: imgBoxWH.width,
                    height: imgBoxWH.height
                }, {
                    go: function (to) {
                        jImgBox.css(to);
                    }
                });
            }
            else {
                jImgBox.css(imgBoxWH);
                imgAnimeWH.setCurParams(imgBoxWH);
            }


        }
        function animeXY(is) {
            if (is) {

                imgAnimeXY.excu({
                    left: imgBoxXY.left,
                    top: imgBoxXY.top
                }, {
                    go: function (to) {
                        jImgBox.css('transform', 'translate3d(' + to.left + 'px,' + to.top + 'px,0)');
                    }
                });
            }
            else {
                jImgBox.css('transform', 'translate3d(' + imgBoxXY.left + 'px,' + imgBoxXY.top + 'px,0)');
                imgAnimeXY.setCurParams(imgBoxXY);
            }
        }

        //点  相对 Img 百分百
        function pointRelativeImg(point) {

            var pointX = point.pageX - boxXY.left - imgBoxXY.left,
                pointY = point.pageY - boxXY.top - imgBoxXY.top;

            return {
                x: pointX / imgBoxWH.width,
                y: pointY / imgBoxWH.height,
                r: pointX / pointY
            };
        }

        function updateImgBoxXYByPoint(point, relativeXY,isAnime) {

            var newPoX = point.pageX - boxXY.left - imgBoxWH.width * relativeXY.x,
                newPoY = point.pageY - boxXY.top - imgBoxWH.height * relativeXY.y;

            isAnime = isAnime === undefined ? true : isAnime;

            setImgBoxXY(newPoX, newPoY);
            animeXY(isAnime);
        }

        function touch() {

            var oneTouch = {
                startTouche: null,
                start: function (e) {
                    
                    var touches = e.originalEvent.touches;

                    if (touches.length === 1 && e.target.className !== 'p_t_m') {

                        oneTouch.startTouche = touches[0];
                        dragRotate.down();
                    }
                },
                move: function (e) {
                    var touches=e.originalEvent.touches;

                    if (touches.length === 1 && e.target.className !== 'p_t_m') {

                        var moveTouche = e.originalEvent.touches[0],
                          pageX = moveTouche.pageX - oneTouch.startTouche.pageX,
                          pageY = moveTouche.pageY - oneTouch.startTouche.pageY;

                        dragRotate.move({ left: pageX, top: pageY });
                    }
                }
            };

            var beforeChangeW,relativeXY;

            var mc = new Hammer.Manager(jImgBox[0]);

            mc.add(new Hammer.Pan({ threshold: 0, pointers: 0 }));

            mc.add(new Hammer.Rotate({ threshold: 0 })).recognizeWith(mc.get('pan'));
            mc.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith([mc.get('pan'), mc.get('rotate')]);

            //双点放大
            mc.on("pinchmove", onPinch);

            function onPinch(e) {

                var w = beforeChangeW * e.scale,
                    h = w / imgWHR;

                setImgBoxWH(w, h);

                updateImgBoxXYByPoint(e.srcEvent.touches[0], relativeXY,false);

                animeWH();
            }

            jBox.on({
                touchstart: function (e) {
                    oneTouch.start(e);

                    var touches = e.originalEvent.touches;
                    if (touches.length === 2) {

                        beforeChangeW = imgBoxWH.width;
                        relativeXY = pointRelativeImg(touches[0]);
                    }
                    

                }, 
                touchmove: function(e) {
                    oneTouch.move(e);
                },
                touchend: function(e) {
                    oneTouch.start(e);
                }
            });

        }

        function doubleZoom() {
            var doubleTap = new DoubleTap();
            jBox.on({
                touchstart: function (e) {

                    doubleTap.tap(function () {
                        var
                            touches = e.originalEvent.touches,
                            touche, w, h, relativeXY;

                        if (touches.length > 1) return;

                        touche = touches[0];
                        w = imgBoxWH.width * 1.4;
                        h = w / imgWHR;
                        relativeXY = pointRelativeImg(touche);

                        setImgBoxWH(w, h);
                        updateImgBoxXYByPoint(touche, relativeXY);
                        animeWH(true);
                    });
                }
            });
        }

        function doubleToucheZoomOut() {
            var doubleTap = new DoubleTap();

            doubleTouche({
                jEl: jBox,
                excu: function (e) {
                    doubleTap.tap(function () {
                        var 
                            touche = e.originalEvent.touches[0],
                            w = imgBoxWH.width * .6,
                            h = w / imgWHR,
                        
                        relativeXY = pointRelativeImg(touche);

                        setImgBoxWH(w, h);
                        updateImgBoxXYByPoint(touche, relativeXY);
                        animeWH(true);
                    });

                }
            });
        }

        /*
        放大、缩小。 滚轮、双手指触摸
        */
        function zoomHandle() {

            /*
            元素 范围判断
            光标 是否位于 当前元素 到 指定元素 范围
            */
            function domRange(elem) {

                while (elem.className.indexOf('picture_show_3d') === -1) {
                    if (elem.className.indexOf('p_img') > -1) return true;

                    elem = elem.parentElement;
                }


                return false;
            }

            //取 鼠标位置。放大依据
            function getMouseOffset(e) {
                var mouseOffsetX, mouseOffsetY,
                    pageX, pageY;

                if (domRange(e.target || e.srcElement)) {
                    pageX = e.pageX === undefined ? document.documentElement.scrollLeft + e.clientX : e.pageX;
                    pageY = e.pageY === undefined ? document.documentElement.scrollTop + e.clientY : e.pageY;
                    mouseOffsetX = pageX - boxXY.left - imgBoxXY.left;
                    mouseOffsetY = pageY - boxXY.top - imgBoxXY.top;
                }
                else {
                    mouseOffsetX = imgBoxWH.width / 2;
                    mouseOffsetY = imgBoxWH.height / 2;
                }

                return { x: mouseOffsetX, y: mouseOffsetY };
            }

            function wheelZoom() {

                function wheelExcu(isUp, e) {

                    var w, h,
                        newW, newH, newX, newY,
                        toW, toH,
                        ratio = .1,
                        mouseOffsetXY = getMouseOffset(e);

                    w = newW = imgBoxWH.width;
                    h = newH = imgBoxWH.height;

                    toW = w * ratio;
                    toH = h * ratio;

                    if (isUp) {

                        newW += toW;
                        newH += toH;
                    } else {
                        newW -= toW;
                        newH -= toH;
                    }
                    setImgBoxWH(newW, newH);

                    //计算 新的xy


                    newX = imgBoxXY.left - mouseOffsetXY.x / w * (imgBoxWH.width - w);
                    newY = imgBoxXY.top - mouseOffsetXY.y / h * (imgBoxWH.height - h);

                    setImgBoxXY(newX, newY);

                    animeWH(true);
                    animeXY(true);
                }


                core.mouseWheel(jBox[0], function (e) {
                    ////IE/Opera/Chrome  向上正数，向下负数 
                    //fox 向下正数，向上负数

                    e = e || window.event;

                    var isUp = false;

                    if (e.wheelDelta) {//IE/Opera/Chrome 
                        if (e.wheelDelta > 0) isUp = true;
                    }
                    else if (e.detail) {//Firefox 
                        if (e.detail < 0) isUp = true;
                    }

                    wheelExcu(isUp, e);

                    if (e.cancelable) e.preventDefault();
                    return false;
                });

            }

            wheelZoom();

        }

        //缩略图
        function thumbHandle() {
            var jThumbBox,
                jThumbImgBox,
                jThumbImg,
                eThumbImg,
                jThumbMove,
                thumbBoxWH,
                thumbImgBoxWH,
                thumbMoveWH,
                thumbMoveXY,
                thumbMoveMaxXY,
                thumbMoveBorderW,

                zoomR,

                isShow = false;

            this.updateMoveWHXY = function () {
                var w, h, x, y;

                zoomR = imgBoxWH.width / thumbImgBoxWH.width;

                w = showWH.width / zoomR;
                h = showWH.height / zoomR;
                x = -imgBoxXY.left / zoomR;
                y = -imgBoxXY.top / zoomR;

                if (imgBoxIsCenter.x) {
                    w += x * 2;
                    x = 0;
                }

                if (imgBoxIsCenter.y) {
                    h += y * 2;
                    y = 0;
                }

                thumbMoveWH = {
                    width: w - thumbMoveBorderW*2,
                    height: h - thumbMoveBorderW*2
                };

                thumbMoveMaxXY = {
                    left: thumbImgBoxWH.width - w,
                    top: thumbImgBoxWH.height - h
                };

                setMoveXY(x, y);

                thumbAnimeWH(true);
                thumbAnimeXY(true);
            };

            this.hide = function () {
                 if (isShow) {
                     isShow = false;
                     jThumbBox.hide();
                 }
            };

            this.show = function () {
                 if (isShow === false) {
                     isShow = true;
                     jThumbBox.show();
                 }
            };

            this.changeSrc = function (src) {
                eThumbImg.src = src;
            };

            function updateImgBoxXY(thumbX, thumbY) {

                imgBoxXY = {
                    left: imgBoxIsCenter.x?imgBoxXY.left: - thumbMoveXY.left * zoomR,
                    top: imgBoxIsCenter.y ? imgBoxXY.top : -thumbMoveXY.top * zoomR
                };

                animeXY(true);
            }

            function setMoveXY(x, y) {

                if (x < 0) x = 0;
                if (x > thumbMoveMaxXY.left) x = thumbMoveMaxXY.left;

                if (y < 0) y = 0;
                if (y > thumbMoveMaxXY.top) y = thumbMoveMaxXY.top;

                 thumbMoveXY = {
                    left: x,
                    top: y
                 };
            }

            function thumbAnimeWH(is) {
                 //if (is) {
                 //    jThumbMove.animate(thumbMoveWH, { queue: false });
                 //}
                 //else {
                 //    jThumbMove.css(thumbMoveWH);
                 //}
                    
                // jThumbMove.css('transform','scale('+thumbMoveWH.width/thumbImgBoxWH.width+')');

                jThumbMove.css(thumbMoveWH);

            }

            function thumbAnimeXY(is) {

                // if (is) {
                //     jThumbMove.animate(thumbMoveXY, { queue: false });
                // }
                // else {
                //     jThumbMove.css(thumbMoveXY);
                // }

                    // var s=thumbMoveWH.width/thumbImgBoxWH.width;
                // jThumbMove.css('transform','scale('+s+') translate3d('+(thumbMoveXY.left-(thumbImgBoxWH.width-thumbMoveWH.width)/2)/s+'px,'+(thumbMoveXY.top-(thumbImgBoxWH.height-thumbMoveWH.height)/2)/s+'px,0)');
                 jThumbMove.css('transform','translate3d('+thumbMoveXY.left+'px,'+thumbMoveXY.top+'px,0)');

            }

            function drag() {
                var x, y;
                common.drag_v2(jThumbMove, function (xy) {
                    var _x, _y;

                    _x = x + xy.left;
                    _y = y + xy.top;

                    setMoveXY(_x, _y);

                    updateImgBoxXY();

                    thumbAnimeXY();

                }, function () {
                    x = thumbMoveXY.left;
                    y = thumbMoveXY.top;
                });

                oneTouchDrag(jThumbMove, function (xy) {
                    var _x, _y;

                    _x = x + xy.left;
                    _y = y + xy.top;

                    setMoveXY(_x, _y);

                    updateImgBoxXY();

                    thumbAnimeXY();

                    
                }, function () {

                    x = thumbMoveXY.left;
                    y = thumbMoveXY.top;

                });

            }



            this.ini = function (params) {
                var xywh;

                jThumbBox = params.jThumbBox;
                jThumbImgBox = jThumbBox.children();
                jThumbImg = jThumbImgBox.children('img');
                eThumbImg = jThumbImg[0];
                jThumbMove = jThumbImgBox.children('.p_t_m');
                thumbMoveBorderW = 0;

                thumbBoxWH = {
                    width:parseFloat( jThumbBox.css('width')),
                    height: parseFloat(jThumbBox.css('height'))
                };

                xywh = common.imgCenterByBox_v1({
                    boxWidth: thumbBoxWH.width,
                    boxHeight: thumbBoxWH.height,
                    width: imgWH.width,
                    height: imgWH.height
                });

                xywh.left = jThumbBox.css('left');
                xywh.top = jThumbBox.css('top');

                jThumbImgBox.css(xywh);

                thumbImgBoxWH = {
                    width: xywh.width,
                    height:xywh.height
                };

                drag();


            };
        }

        //根据窗口 变化 imgbox尺寸、坐标
        this.updateByShowWH = function (sWH) {
            var showWHR,
                noDragX,
                noDragY;

            showWH = sWH;

            showWHR = showWH.width / showWH.height;

            //最小wh
            if (showWHR > imgWHR) {
                imgBoxMinWH.height = showWH.height;
                imgBoxMinWH.width = showWH.height * imgWHR;
            } else {
                imgBoxMinWH.width = showWH.width;
                imgBoxMinWH.height = showWH.width / imgWHR;
            }

            setImgBoxWH(imgBoxWH.width, imgBoxWH.height);

            setImgBoxXY(imgBoxXY.left, imgBoxXY.top);

            imgAnimeWH.setCurParams(imgBoxWH);
            imgAnimeXY.setCurParams(imgBoxXY);

            animeWH();

            animeXY();
        };

        this.ini = function (params) {
            jBox = params.jBox;
            imgWH = params.imgWH;
            xCount = params.xCount;
            yCount = params.yCount;
            boxXY = params.boxXY;

            jImgBox = jBox.children('.p_img');
            jImg = jImgBox.children();
            eImg = jImg[0];
            jImgBox = jImg;

            imgWHR = imgWH.width / imgWH.height;

            dragRotate = new dragRotateCore({
                xCount: xCount,
                yCount: yCount
            });

            dragRotate.onMove = function (xNum, yNum) {
                $('#info').html('横向：' + (xNum+1) + '<br/>纵向：' + (yNum+1));
                var src = 'images/' + (yNum+1) + '/1210' + (41 + xNum) + '_720x480.jpg';
                eImg.src = src;
                thumb.changeSrc(src);
            };

            doubleZoom();
            doubleToucheZoomOut();

            touch();

            drag();

            zoomHandle();

            thumb.ini({
                jThumbBox: jBox.children('.p_thumb')
            });

            //初始显示第一张
            dragRotate.ini();
        };
    }

    function DoubleTap(params) {
        params = params === undefined ? {} : params;

        var
            that = this,

            hanFirst = false,

            time = params.time === undefined ? 200 : params.time,

            t = 0,

            stopId;



        this.tap = function (excu) {
            clearTimeout(stopId);

            t++;

            stopId = setTimeout(function () {
                t = 0;
            }, time);

            if (t === 2) {
                excu&&excu();
                clearTimeout(stopId);
                t = 0;
            }
        };


    }

    function doubleTouche(params) {
        var
            jEl = params.jEl,
            excu=params.excu,
            doubleTap = new DoubleTap({time:100});

        jEl.on({
            touchstart: function (e) {
                var touches = e.originalEvent.touches;

                if (touches.length === 1) {
                    doubleTap.tap();
                }
                if (touches.length === 2) {
                    doubleTap.tap(function () {
                        excu(e);
                    });
                }
            }
        });

        
    }

    return function() {
        var jBox = $('.picture_show_3d'),

            handle = new mainHandle(),

            imgWH = {
                width: 1800,
                height: 1293
            },
            xCount = 60,
            yCount = 6;

        function getShowWH() {

            return {
                width: wJq.width(),
                height: wJq.height()

            };
        }

        function ini() {
            
            handle.ini({
                jBox: jBox,
                imgWH: imgWH,
                boxXY: jBox.offset(),

                xCount: xCount,
                yCount: yCount
            });

            wJq.resize(function() {
                handle.updateByShowWH(getShowWH());
            });

            handle.updateByShowWH(getShowWH());
        }

        ini();

    }

})();

$(function() {
    window.wJq = $(window);
    ///

    var ps = new pictureShow();

    
    /*var
        tlbr = {
            t: 20,
            l: 40,
            b: 20,
            r: 40
        },
        ps = new pictureShow();

    ps.mainBoxHandle.setXY({
        left: tlbr.l,
        top: tlbr.t
    });

    ps.mainBoxHandle.setWH({
        width: wJq.width() - 40,
        height: wJq.height() - 40
    });

    wJq.resize(function () {
        ps.mainBoxHandle.setWH({
            width: wJq.width() - 40,
            height: wJq.height() - 40
        });
    });*/

});