"use strict";


//var c = {};
$ = jQuery;


c.pictureViewer = function (elem) {
    console.log(elem);

    var src = elem.src,
        img = new Image(),
        jImg = $(img),
        enlarge = Enlarge(),
        boxW,boxH,
        imgX, imgY,
            imgW,imgH;

    var jBox = $('<div class="img-view loading" tabindex="-1"><div class="bg"></div><div class="img"></div></div>');

    document.body.appendChild(jBox[0]);

    jBox.fadeIn();

    img.onload = function () {
        jBox.removeClass('loading');

        var xywh = center({
            boxWidth: jBox.width(),
            boxHeight: jBox.height(),
            width: img.width,
            height: img.height
        });

        imgX = xywh.left;
        imgY = xywh.top;
        imgW = xywh.width;
        imgH = xywh.height;

        jImg.css(xywh).fadeIn();

        drag();

        enlarge.ini();
    };

    img.src = src;

    jBox.append(img);

    // 关闭
    jBox.children('.bg').click(close);

    jBox.focus().keydown(function (e) {
        if (e.keyCode === 27) close();
    });

    function close() {
        jBox.finish().fadeOut(function () {
            jBox.remove();
        });
    }

    function center(params) {

        var boxWidth = params.boxWidth,
            boxHeight = params.boxHeight,
            width = params.width,
            height = params.height,
            PR = params.PR === undefined ? '' : 'margin-',

            boxR = boxWidth / boxHeight,
            r = width / height,

            left, top, whxy;

        if (boxR > r) {
            height = boxHeight;

            width = height * r;

            left = (boxWidth - width) / 2;
            top = 0;
        }
        else {
            width = boxWidth;

            height = width / r;

            left = 0;
            top = (boxHeight - height) / 2;
        }

        whxy = { width: width ? width : 0, height: height ? height : 0 };

        whxy[PR + 'left'] = left ? left : 0;
        whxy[PR + 'top'] = top ? top : 0;

        return whxy;
    }

    function drag() {
        var x, y;
        c.drag(jImg[0], function (xy) {

            imgX = xy.left + x;
            imgY = xy.top + y;
            jImg.css({
                left: imgX,
                top: imgY
            })
        }, function () {
            x = imgX;
            y = imgY;
        }, function () {

        });
    }

    //缩小放大
    function Enlarge() {

        var mouseOffsetXY, lastWHXY;

        function getLastWHXY() { return lastWHXY; }

        //根据光标所在元素位置，取当前增加 高宽 对象增加的 xy
        function getAddXY(toW, toH) {
            return {
                x: mouseOffsetXY.x / lastWHXY.width * Math.abs(toW - lastWHXY.width),
                y: mouseOffsetXY.y / lastWHXY.height * Math.abs(toH - lastWHXY.height)
            }
        }

        function excu(isUp, e, er) {
            var

                //每放大阶段值。宽度根据高宽比 得到
                valH = imgH * (er || .2),
                valW = valH / imgH * imgW,

                toW = imgW,
                toH = imgH,
                toX = imgX,
                toY = imgY,

                lenXY;

            mouseOffsetXY = getMouseOffset(e);

            lastWHXY = {
                width: imgW,
                height: imgH,
                left: imgX,
                top:imgY
            };

            if (isUp) {
                toW += valW;
                toH += valH;
            }
            else {
                toW -= valW;
                toH -= valH;
            }

            //根据增加的高宽 得 要加的 坐标
            lenXY = getAddXY(toW, toH);

            if (isUp) {
                toX -= lenXY.x;
                toY -= lenXY.y;
            }
            else {
                toX += lenXY.x;
                toY += lenXY.y;
            }

            imgW = toW;
            imgH = toH;
            imgX = toX;
            imgY = toY;
            jImg.animate({
                width: toW,
                height: toH,
                left: toX,
                top: toY
            }, { queue: false, speed: 1000 });
        }

        /*
        元素 范围判断
        */
        function domRange(elem) {
            return true;
        }

        //取 鼠标位置。放大依据
        function getMouseOffset(e) {
            var mouseOffsetX, mouseOffsetY;
            if (domRange(e.target || e.srcElement)) {
                var

                    pageX = e.pageX === undefined ? document.documentElement.scrollLeft + e.clientX : e.pageX,
                    pageY = e.pageY === undefined ? document.documentElement.scrollTop + e.clientY : e.pageY;

                mouseOffsetX = pageX - imgX;
                mouseOffsetY = pageY - imgY;

            }
            else {
                mouseOffsetX = imgW / 2;
                mouseOffsetY = imgH/ 2;
            }

            return { x: mouseOffsetX, y: mouseOffsetY };
        }

        //
        function ini() {

            c.mouseWheel(jImg[0], function (e) {
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

                excu(isUp, e);

                if (e.cancelable) e.preventDefault();
                return false;
            });

            //双击放大
            jImg.dblclick(function (e) {
                excu(true, e.originalEvent, .6);
            });
        }

        return { ini: ini, getAddXY: getAddXY, getLastWHXY: getLastWHXY };
    }
};

//var pictureViewer = new c.PictureViewer();

$(document.body).click(function (e) {
    var target = e.target;
    if (!$(target.parentElement).hasClass('img-view')) {
        c.pictureViewer(target);

    }
    //pictureViewer.show(target);
});


