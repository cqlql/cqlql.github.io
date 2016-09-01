/**
 * Created by Jony on 2016/8/10.
 */


document.getElementById('popupBtn').onclick = transmitData;

function transmitData() {
    doWork();

    clipPicture('imgs/1.jpg');

    // 做作业
    function doWork() {
        var record = new Record,
            shortRecord = new Record,
            pictureClip = new PictureClip;

        // 拍照截图
        window.clipPicture = function (url) {
            pictureClip.show(url, {1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5});
        };

        // 截图确认
        window.clipConfirm = function () {
            // jshomework.clipParams(JSON.stringify(pictureClip.getSelectData()));
        };

        // 临时保存
        window.saveData = function () {
            for (var k in workData) {
                // jshomework.saveData(JSON.stringify(workData));
                return;
            }
        };

        //关闭截图
        window.clipClose = function () {
            pictureClip.hide();
        };

        function quesListBuild() {
            var html = '';

            data.questions.forEach(function (n, i) {
                record.add(i);
                html += quesBuild(n.type, i);
            });
            eQuesList.innerHTML = html;
        }

        function quesBuild(type, i) {

            return ({
                // 选择题
                1: choice,
                2: choice,
                // 填空
                3: short,
                // 判断
                4: judge,
                // 问答
                5: short
            })[type]();

            function choice() {

                var optionHtml = '',
                    myAnswer = workData[i],
                    answerText = myAnswer ? myAnswer.text : '',
                    optionValue;

                for (var j = 0; j < 4; j++) {
                    optionValue = c.getLetter(j);
                    optionHtml += '<a class="option' + (answerText.indexOf(optionValue) > -1 ? ' selected' : '') + '">' + optionValue + '</a>';
                }

                return '<dl class="choice cf" data-index="' + i + '"><dt>' + (i + 1) + '.</dt><dd><div class="c-wrap">' + optionHtml + '</div></dd></dl>';
            }

            function judge() {
                var
                    myAnswer = workData[i],
                    isDo = 0,
                    isRight;

                if (myAnswer) {
                    isRight = myAnswer.text === '对';
                    isDo = 1;
                }

                return '<dl class="judge cf" data-index="' + i + '">\
<dt>' + (i + 1) + '.</dt><dd>\
<div class="c-wrap">\
<a class="option' + (isDo ? (isRight ? ' selected' : '') : '') + '">正确</a>\
<a class="option' + (isDo ? (isRight ? '' : ' selected') : '') + '">错误</a>\
</div></dd></dl>';
            }

            function short() {
                shortRecord.add(i);

                var myAnswer = workData[i],
                    imgsHtml = '';

                if (myAnswer) {
                    myAnswer.images.forEach(function (n) {
                        imgsHtml += '<a class="img"><span class="img-wp"><img onload="imgFullCenter(this);" src="' + n + '"></span><b class="remove-btn"></b></a>';
                    });
                }

                return '<dl class="short cf" data-index="' + i + '"><dt>' + (i + 1) + '.</dt><dd><div class="c-wrap">' + imgsHtml + '<a class="chose-img-btn"></a></div></dd></dl>';

            }
        }

        //记录是否做题
        function Record() {
            var data = {};

            // 取消一题调用
            this.add = function (i) {
                data[i] = i * 1 + 1;
            };

            // 做一题调用
            this.remove = function (i) {
                delete data[i];
            };

            // 是否完成。 1 完成；0 未完成
            this.isComplete = function () {
                var notQuesNo = '';
                for (var k in data) {
                    notQuesNo += ',' + (++k);
                }
                return notQuesNo.substr(1);
            };

            this.getData = function () {
                return data;
            };
        }

    }

}

// 截图
function PictureClip() {
    var that = this;

    this.show = function (url, quesNoData) {
        init();
        that.show(url, quesNoData);
    };

    function init() {

        var eBox = document.getElementById('pictureClip'),
            eImgWin,
            eImgWp,
            eQuesNoList,
            eBtns,
            imgWinW, imgWinH,
            ow, oh, cw, ch,// 图片尺寸，原始+当前
            scale, // 图片放大

            selectData = {}// 以题号为key
            ;

        c.queryElements(eBox, '.img-win,.img,.list', function (elems) {
            eImgWin = elems[0];
            eImgWp = elems[1];
            eQuesNoList = elems[2];
            eBtns = eQuesNoList.children;
        });

        imgWinW = eImgWin.clientWidth;
        imgWinH = eImgWin.clientHeight;

        c.click(eQuesNoList, function (e) {
            var btn = e.target;
            if (btn.tagName === 'A') {
                if (btn.classList.contains('active')) {
                    removeSelectRect(btn.dataset.qno, btn.dataset.index);
                }
                else {
                    addSelectRect(btn.dataset.qno, btn.dataset.index);
                }
            }
        });

        that.show = function (url, quesNoData) {

            eBox.classList.add('show');

            c.imgSizeExcu(url, function (img) {

                selectData = {};

                eImgWp.innerHTML = '';

                ow = img.width;
                oh = img.height;
                eImgWp.appendChild(img);

                var xywh = c.imgCenter(ow, oh, imgWinW, imgWinH);

                cw = xywh.w;
                ch = xywh.h;

                eImgWp.style.width = cw + 'px';
                eImgWp.style.height = ch + 'px';
                eImgWp.style.left = xywh.x + 'px';
                eImgWp.style.top = xywh.y + 'px';

                //
                scale = ow / cw;

                bindData(quesNoData);

            });
        };
        that.hide = function () {
            eBox.classList.remove('show');
        };
        that.getSelectData = function () {
            var data = [];
            c.each(selectData, function (k, n) {
                var d = n.getXYWH(scale);
                d.qNo = k;
                data.push(d);
            });

            return data;
        };

        function reomveActiveBtn(btn) {
            btn.classList.remove('active');
        }

        function addActiveBtn(btn) {
            btn.classList.add('active');
        }

        function bindData(quesNoData) {

            var i = 0,
                html = '';
            c.each(quesNoData, function (qNo) {

                // 默认增加3个
                if (i < 3) addSelectRect(qNo, i);

                html += '<a href="javascript:;"  data-qno="' + qNo + '" data-index="' + i + '">' + qNo + '</a>';

                i++;
            });
            eQuesNoList.innerHTML = html;
        }

        function removeSelectRect(qNo, i) {
            selectData[qNo].remove();
            delete selectData[qNo];
            reomveActiveBtn(eBtns[i]);
        }

        function addSelectRect(qNo, i) {

            var clipRect = new ClipRect({
                qNo: qNo,
                onclose: function () {
                    removeSelectRect(qNo, i);
                },
                getWinWH: function () {
                    return {w: cw, h: ch};
                }
            });

            selectData[qNo] = clipRect;

            eImgWp.appendChild(clipRect.getElemBox());

            var h = ch / 3;
            clipRect.setXYWH(10, h * i + 10, cw - 20, h - 20);

            setTimeout(function () {
                addActiveBtn(eBtns[i]);
            }, 100);

        }
    }

    function ClipRect(params) {

        var
            qNo = params.qNo,
            onclose = params.onclose,
            getWinWH = params.getWinWH,
            eBox,//= params.eBox,
            boxW = 200,
            boxH = 200,
            // boxX=eBox.offsetLeft,boxY=eBox.offsetTop,
            boxX = 0, boxY = 0,

            winW, winH,// 拖动参照窗口 高宽

            dragBase = new DragBase,
            isStart = 0,

            transform = c.getRightCssName('transform')[1],

            currBar;

        ClipRect.zIndex = 0;

        htmlBuild();

        touchBind();

        // this.setWinWH = function (w, h) {
        //     winW = w;
        //     winH = h;
        // };

        this.getElemBox = function () {
            return eBox;
        };

        this.remove = function () {
            eBox.remove();
        };

        this.getXYWH = function (scale) {
            return {
                x: (boxX * scale).toFixed(0),
                y: (boxY * scale).toFixed(0),
                w: (boxW * scale).toFixed(0),
                h: (boxH * scale).toFixed(0)
            }
        };

        this.setXYWH = function (x, y, w, h) {

            barFn.move(x, y);

            // barFn.t(0, y - boxY);
            barFn.r(w - boxW, 0);
            barFn.b(0, h - boxH);
            // barFn.l(0, x - boxX);
        };

        function htmlBuild() {
            eBox = c.htmlToNodes('<div class="select-rect">\
            <div class="text"><span>第' + qNo + '题</span></div>\
            <div class="t-bar" data-type="t"></div>\
            <div class="r-bar" data-type="r"></div>\
            <div class="b-bar" data-type="b"></div>\
            <div class="l-bar" data-type="l"></div>\
            <div class="lt-bar" data-type="lt"></div>\
            <div class="rt-bar" data-type="rt"></div>\
            <div class="rb-bar" data-type="rb"></div>\
            <div class="lb-bar" data-type="lb"></div>\
            <div class="close" data-type="close"></div>\
            </div>')[0];
        }

        function touchBind() {
            eBox.addEventListener('touchstart', function (e) {

                // console.log('touchstart', e);

                var touches = e.touches;

                if (touches.length === 1) {
                    start(e, touches[0]);
                }
            });

            eBox.addEventListener('touchmove', function (e) {
                // console.log('touchmove');

                if (isStart) {
                    var touches = e.touches;

                    if (touches.length === 1) {
                        move(touches[0]);
                        e.preventDefault();
                    }
                }

            });

            eBox.addEventListener('touchend', function (e) {

                var touches = e.touches,
                    len = touches.length;

                if (len === 1) {
                    // start(e, touches[0]);
                }
                else if (len === 0) {
                    end();
                }
            });

            eBox.addEventListener('touchcancel', function (e) {
                // console.log('touchcancel');
            });

        }

        function DragBase() {
            var
                prevX, prevY,
                toX, toY;

            this.start = function (x, y) {
                prevX = x;
                prevY = y;
                toX = 0;
                toY = 0;
            };

            this.move = function (x, y, fn) {
                toX = x - prevX;
                toY = y - prevY;

                fn(toX, toY);

                prevX = x;
                prevY = y;
            };
        }

        function start(e, touche) {
            var type = e.target.dataset.type;

            if (type === 'close') {
                onclose();
            }
            else {
                isStart = true;
                dragBase.start(touche.pageX, touche.pageY);
                currBar = barFn[type || 'move'];
                eBox.style.zIndex = ClipRect.zIndex++;
            }
        }

        function move(touche) {
            dragBase.move(touche.pageX, touche.pageY, function (toX, toY) {
                currBar(toX, toY);
            });
        }

        function end() {
            isStart = false;
        }

        function getMaxY() {
            return getWinWH().h - boxH;
        }

        // bar 功能
        var minW = 110, minH = 60;
        var barFn = {
            t: function (toX, toY) {
                var prevBoxY = boxY,
                    maxY = boxY + boxH - minH;

                boxY += toY;

                if (boxY < 0) {
                    boxY = 0;
                    toY = boxY - prevBoxY;
                }
                else if (boxY > maxY) {
                    boxY = maxY;
                    toY = boxY - prevBoxY;
                }

                boxH -= toY;

                eBox.style.height = boxH + 'px';
                // eBox.style.top=boxY+'px';
                eBox.style[transform] = 'translate3d(' + boxX + 'px,' + boxY + 'px,0)';
            },
            r: function (toX, toY) {

                var maxW = getWinWH().w - boxX;

                boxW += toX;

                if (boxW < minW) {
                    boxW = minW;
                }
                else if (boxW > maxW) {
                    boxW = maxW;
                }

                eBox.style.width = boxW + 'px';

            },
            b: function (toX, toY) {
                var maxH = getWinWH().h - boxY;

                boxH += toY;

                if (boxH < minH) {
                    boxH = minH;
                }
                else if (boxH > maxH) {
                    boxH = maxH;
                }

                eBox.style.height = boxH + 'px';
            },
            l: function (toX, toY) {
                var prevBoxX = boxX,
                    maxX = boxX + boxW - minW;

                boxX += toX;
                if (boxX < 0) {
                    boxX = 0;
                    toX = -prevBoxX;
                }
                else if (boxX > maxX) {
                    boxX = maxX;
                    toX = boxX - prevBoxX;
                }

                boxW -= toX;

                eBox.style.width = boxW + 'px';
                // eBox.style.left=boxX+'px';
                eBox.style[transform] = 'translate3d(' + boxX + 'px,' + boxY + 'px,0)';
            },

            lt: function (toX, toY) {
                barFn.l(toX, toY);
                barFn.t(toX, toY);
            },
            rt: function (toX, toY) {
                barFn.r(toX, toY);
                barFn.t(toX, toY);
            },
            rb: function (toX, toY) {
                barFn.r(toX, toY);
                barFn.b(toX, toY);
            },
            lb: function (toX, toY) {
                barFn.l(toX, toY);
                barFn.b(toX, toY);
            },
            move: function (toX, toY) {
                var maxX = getWinWH().w - boxW, maxY = getWinWH().h - boxH;
                boxY += toY;
                if (boxY < 0) {
                    boxY = 0;
                }
                else if (boxY > maxY) {
                    boxY = maxY;

                }

                boxX += toX;
                if (boxX < 0) {
                    boxX = 0;
                }
                else if (boxX > maxX) {
                    boxX = maxX;

                }

                // eBox.style.left=boxX +'px';
                // eBox.style.top=boxY+'px';
                eBox.style[transform] = 'translate3d(' + boxX + 'px,' + boxY + 'px,0)';
            }
        };

    }

}

function imgFullCenter(img) {
    var boxw = 58, boxh = 58,
        imgw = img.width, imgh = img.height;

    var xywh = c.imgFullCenter(imgw, imgh, boxw, boxh);

    var style = img.style;

    style.marginLeft = xywh.x + 'px';
    style.marginTop = xywh.y + 'px';
    style.width = xywh.w + 'px';
    style.height = xywh.h + 'px';
    style.maxWidth = 'none';
    style.maxHeight = 'none';
    style.backgroundImage = 'none';
}