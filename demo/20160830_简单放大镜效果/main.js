/**
 * Created by CQL on 2016/8/30.
 */


'use strict';

var c = commonInit();

var eMain,
    eImg, eBIgImg,
    eImgWin,
    eSelectMove,
    eBigImgWin,

    selectMoveW,
    selectMoveH,

    mainMxy,// 主容器 页边距
    imgWinXYWH,
    imgW, imgH,// img高宽

    // mousemmove中触发，实现放大才加载大图。加载小图片后会被重置，且每次只执行一次
    zoomStart = function () {
    },

    // 大图用了同一张，测试用
    url = '3.jpg',
    bigUrl = '3.jpg',

    isLoading = 1,
    scale = 2;

// 取元素
c.queryElements(document.body, '.picture-magnifier,.img,img,.move,.big-img,img', function (elems) {
    eMain = elems['.picture-magnifier'];
    eImg = elems['img'];
    eImgWin = elems['.img'];
    eSelectMove = elems['.move'];
    eBigImgWin = elems['.big-img'];
    eBIgImg = elems['img1'];
});

// 加载小图片
c.imgSizeExcu(url, function (img) {
    isLoading = 0;

    var w = img.width,
        h = img.height;

    var mainW = eMain.clientWidth,
        mainH = eMain.clientHeight;

    imgWinXYWH = c.imgCenter(w, h, mainW, mainH);

    imgW = imgWinXYWH.w;
    imgH = imgWinXYWH.h;

    eImgWin.style.width = imgW + 'px';
    eImgWin.style.height = imgH + 'px';
    eImgWin.style.marginTop = imgWinXYWH.y + 'px';

    eImg.src = img.src;

    zoomStart = function () {
        eBIgImg.width = imgW * scale;
        eBIgImg.height = imgH * scale;
        eBIgImg.src = bigUrl;

        selectMoveSizeUpdate();

        zoomStart = function () {
        };
    };
});

// div.img  坐标
mainMxy = c.relativeXY(eMain);

eImgWin.addEventListener('mousemove', function (e) {
    if (isLoading) return;
    zoomStart();

    var x = e.pageX - mainMxy.x - imgWinXYWH.x - selectMoveW / 2,
        y = e.pageY - mainMxy.y - imgWinXYWH.y - selectMoveH / 2,
        maxX = imgW - selectMoveW,
        maxY = imgH - selectMoveH;

    if (x < 0) {
        x = 0;
    }

    if (y < 0) {
        y = 0;
    }

    if (x > maxX) {
        x = maxX;
    }
    if (y > maxY) {
        y = maxY;
    }

    eSelectMove.style.left = x + 'px';
    eSelectMove.style.top = y + 'px';
    eBIgImg.style.left = -x * scale + 'px';
    eBIgImg.style.top = -y * scale + 'px';
});

// div.move 尺寸初始
function selectMoveSizeUpdate() {
    var bigImgWinW = eBigImgWin.clientWidth,
        bigImgWinH = eBigImgWin.clientHeight;

    selectMoveW = bigImgWinW / scale;
    selectMoveH = bigImgWinH / scale;

    eSelectMove.style.width = selectMoveW + 'px';
    eSelectMove.style.height = selectMoveH + 'px';
}

function commonInit() {

    var c = {};

    c.hasClass = function (elem, className) {
        if (elem) return (' ' + elem.className + ' ').indexOf(' ' + className.trim() + ' ') > -1;
        return false;
    };

    c.queryElements = function (rootElem, names, callback) {
        var name,
            resultElems = [],
            nameIds = {},
            test;

        if (typeof names === 'string') names = names.split(',');

        setName();

        go(rootElem.children);

        callback(resultElems);

        function go(childs) {
            var nameId = '';
            for (var i = 0, len = childs.length, elem; i < len; i++) {
                elem = childs[i];

                if (!name) {
                    return false;
                }
                nameId = nameIds[name];
                if (!nameId) {
                    nameId = nameIds[name] = '';
                }

                if (test(elem)) {

                    resultElems.push(elem);
                    resultElems[name + nameId] = elem;

                    nameIds[name]++;

                    setName();
                }

                go(elem.children);
            }

        }

        function setName() {
            name = names.shift();

            if (name) {
                if (name.substr(0, 1) === '.') {
                    test = function (elem) {
                        return c.hasClass(elem, name.substr(1));
                    };
                }
                else {
                    test = function (elem) {
                        // html标签 tagName 大写，但svg标签 tagName 小写
                        return elem.tagName.toUpperCase() === name.toUpperCase();
                    };
                }
            }
        }
    };

    c.relativeXY = function (initial, target) {
        var x = 0, y = 0,
            _target = initial;
        target = target || document.body;

        while (_target !== target) {
            x += _target.offsetLeft;
            y += _target.offsetTop;

            _target = _target.offsetParent;
        }

        return {x: x, y: y};
    };

    c.imgSizeExcu = function (src, f, err) {
        var img = new Image(),
            iserror = false;

        img.onerror = function () {
            err && err(img);
            iserror = true;
        };

        img.src = src;

        //返回false 将跳出 循环
        tryExcu();

        function tryExcu() {
            if (iserror) return;
            if (img.complete || img.width) {
                f(img);
                return;
            }

            setTimeout(tryExcu, 100)
        }

    };

    c.imgCenter = function (imgw, imgh, boxw, boxh) {
        var imgWH = imgw / imgh,
            boxWH = boxw / boxh,
            x = 0, y = 0, w, h;

        if (imgWH > boxWH) {
            // 图片宽 比 窗口宽 大时

            w = boxw;
            h = boxw / imgWH;

            y = (boxh - h) / 2;
        }
        else {

            w = boxh * imgWH;
            h = boxh;

            x = (boxw - w) / 2;
        }

        return {
            x: x, y: y, w: w, h: h
        }
    };

    return c;
}