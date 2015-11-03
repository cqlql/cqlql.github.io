"use strict";

var c = {};

//#region css加前缀
/*

type: 
    0 或不给, 减号连接,真正的 css属性名 
    1, 驼峰, 适用直接给style赋值
例子
cssTransform = c.addPrefix('transform')
*/
c.addPrefix = function (cssAttr, type) {
    var cssPrefixes = ["ms", "moz", "webkit"],
        style = document.body.style,
        _cssAttr = cssAttr.charAt(0).toUpperCase() + cssAttr.substr(1);

    if (style[cssAttr] !== undefined) {

        return cssAttr;
    }
    for (var i = cssPrefixes.length, newAttr, cssPf; i--;) {

        cssPf = cssPrefixes[i];
        newAttr = cssPf + _cssAttr;

        if (style[newAttr] !== undefined) {

            return type ? newAttr : '-' + cssPf + '-' + cssAttr;
        }
    }
};

//#endregion

//#region 取 css属性名，有前缀的
/*
 * 单例模式，取过后的属性将保存，下次节省效率
 * 
 */

c.getCssAttrName = function () {
    var obj = {};
    return function (name) {
        var styleName = obj[name];

        if (styleName === undefined) {
            styleName = obj[name] = c.addPrefix(name);
        }


        return styleName;
    }
}();

//#endregion

//#region 设置 css 组

// 组
c.setCss = function (ele, group) {
    for (var k in group) {
        ele.style.setProperty(k, group[k]);
    }
};

// 单个 
c.setCssSingle = function (ele, name, val) {
    ele.style.setProperty(c.getCssAttrName(name), val);
};

//#endregion

///////////////

var eB, eImg,
	imgX, imgY,
	single,
	cssTransform,
	cssTransition;

cssTransform = c.addPrefix('transform');
cssTransition = c.addPrefix('transition');

function ImageZoom(ele) {
    var
		imgW = 300,
		imgH = 300,
		imgX = 0,
		imgY = 0,
		tempImgX, tempImgY, tempImgW, tempImgH, startDataXY, startDataLT, startLeftR, startTopR, single = SingleHandle();

    ele.addEventListener('touchstart', function (e) {
        var
			touche1, touche2, xLen, yLen, centerX, centerY, leftX, leftY;

        eImg = ele.children[0];

        eImg.style.setProperty(cssTransition, '0s ease');

        if (e.touches.length === 2) {
            startDataXY = getDataXY(e.touches[0], e.touches[1]);
            tempImgX = imgX;
            tempImgY = imgY;
            tempImgW = imgW;
            tempImgH = imgH;

            startLeftR = tempImgW / startDataXY.diameter;
            startTopR = tempImgH / startDataXY.diameter;

            leftX = startDataXY.centerX - startDataXY.diameter / 2;
            leftY = startDataXY.centerY - startDataXY.diameter / 2;
            startDataLT = {
                leftX: leftX,
                leftY: leftY,
                leftR: (leftX - tempImgX) / tempImgW,
                topR: (leftY - tempImgY) / tempImgH
            };
        } else {
            single.start(e.touches[0]);
        }
    });

    ele.addEventListener('touchmove', function (e) {
        var moveDateXY;
        if (e.touches.length === 2) {
            moveDateXY = getDataXY(e.touches[0], e.touches[1]);

            move(moveDateXY);
        } else {
            single.move(e.touches[0]);
        }
        e.preventDefault();
    });

    ele.addEventListener('touchend', function (e) {
        if (e.touches.length === 1) {
            single.start(e.touches[0]);
        }
    });

    return {
        setWH: function (w, h) {
            if (w !== undefined) imgW = w;
            if (h !== undefined) imgH = h;
        },
        setXY: function (x, y) {
            if (x !== undefined) imgX = x;
            if (y !== undefined) imgY = y;
        }
    };

    function move(moveDateXY) {
        var
			addImgW, addImgH, x, y

		, moveDataLT = {
		    leftX: moveDateXY.centerX - moveDateXY.diameter / 2,
		    leftY: moveDateXY.centerY - moveDateXY.diameter / 2
		};

        imgW = moveDateXY.diameter * startLeftR;
        imgH = moveDateXY.diameter * startTopR;

        eImg.style.width = imgW.toFixed(2) + 'px';
        eImg.style.height = imgH.toFixed(2) + 'px';

        addImgW = imgW - tempImgW;
        addImgH = imgH - tempImgH;

        x = moveDataLT.leftX - startDataLT.leftX;
        y = moveDataLT.leftY - startDataLT.leftY;

        imgX = tempImgX + x - addImgW * startDataLT.leftR;
        imgY = tempImgY + y - addImgH * startDataLT.topR;

        c.setCssSingle(eImg, 'transform', ' translate3d(' + imgX.toFixed(2) + 'px,' + imgY.toFixed(2) + 'px,0)');
    }

    // 相当于浏览器窗口
    function getDataXY(touche1, touche2) {
        var
			xLen, yLen, centerX, centerY;

        xLen = Math.abs(touche1.pageX - touche2.pageX);
        yLen = Math.abs(touche1.pageY - touche2.pageY);

        if (touche1.pageX < touche2.pageX) {
            centerX = touche1.pageX + xLen / 2;
        } else {
            centerX = touche2.pageX + xLen / 2;
        }

        if (touche1.pageY < touche2.pageY) {
            centerY = touche1.pageY - ele.parentElement.offsetTop + yLen / 2;
        } else {
            centerY = touche2.pageY - ele.parentElement.offsetTop + yLen / 2;
        }

        return {
            centerX: centerX,
            centerY: centerY,
            diameter: Math.sqrt(Math.pow(xLen, 2) + Math.pow(yLen, 2))
        }
    }

    // 单手指处理
    function SingleHandle() {
        var sx, sy;
        return {
            start: function (touche) {
                sx = touche.pageX;
                sy = touche.pageY;
                tempImgX = imgX;
                tempImgY = imgY;
            },
            move: function (touche) {
                imgX = tempImgX + touche.pageX - sx;
                imgY = tempImgY + touche.pageY - sy;

                c.setCssSingle(eImg, 'transform', ' translate3d(' + imgX + 'px,' + imgY + 'px,0)');

            }
        };
    }

}

ImageZoom(document.querySelector('.show-win'));