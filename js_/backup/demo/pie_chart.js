'use strict';

var $ = require('dom');

var svg = document.getElementsByTagName('svg')[0];
svg.innerHTML = '<path fill="#4285f4"></path>'
    + '<path class="line"></path>'
    + '<text>说法</text>'
    + '<path fill="#ea4335"></path>'
    + '<path class="line"></path>'
    + '<text>说法</text>'
    + '<path fill="#ea4335"></path>'
    + '<path class="line"></path>'
    + '<text>说法</text>'
    + '<path fill="#ea4335"></path>'
    + '<path class="line"></path>'
    + '<text>说法</text>'
    + '<path fill="#ea4335"></path>'
    + '<path class="line"></path>'
    + '<text>说法</text>'
;


var
    pi = Math.PI,
    r = 10,
    boxSize = 40,
    center = boxSize / 2,
    prevLineY = 0,
    prevIsBig;

$.queryElements(document.body, 'path,path,text,path,path,text,path,path,text,path,path,text,path,path,text', function (elems) {

    pie({
        startRadian: radian(10),
        endRadian: radian(90),
        sPath: elems[0],
        sLinePath: elems[1],
        sText: elems[2]
    });
    pie({
        startRadian: radian(90),
        endRadian: radian(120),
        sPath: elems[3],
        sLinePath: elems[4],
        sText: elems[5]
    });
    // pie({
    //     startRadian: radian(120),
    //     endRadian: radian(190),
    //     sPath: elems[6],
    //     sLinePath: elems[7],
    //     sText: elems[8]
    // });
    pie({
        startRadian: radian(180),
        endRadian: radian(190),
        sPath: elems[9],
        sLinePath: elems[10],
        sText: elems[11]
    });
    pie({
        startRadian: radian(190),
        endRadian: radian(200),
        sPath: elems[12],
        sLinePath: elems[13],
        sText: elems[14]
    });
});


function pie(params) {
    var startRadian = params.startRadian,
        endRadian = params.endRadian,

        sPath = params.sPath,
        sLinePath = params.sLinePath,
        sText = params.sText;

    to(startRadian, endRadian);
    line(startRadian, endRadian);

    function to(s, e) {
        var startXY = getXY(s, r),
            endXY = getXY(e, r);

        sPath.setAttribute('d', 'M' + center + ' ' + center + 'L' + startXY.x + ' ' + startXY.y + 'A' + r + ' ' + r + ',0,' + (e - s > pi ? 1 : 0) + ',1,' + endXY.x + ' ' + endXY.y + 'Z');

    }

    function line(s, e) {
        var radian = s + (e - s) / 2;
        var xy = getXY(radian, r);
        var endXY = getXY(radian, r +2);
        var endX2, textX;

        // 是否是超过180度
        if (radian > pi) {
            endX2 = endXY.x - 1;
            textX = endX2 - sText.clientWidth-0.6;

            if (prevIsBig && prevLineY - endXY.y < 2) {
                endXY.y = prevLineY - 2;
            }
            prevIsBig = 1;
        }
        else {
            endX2 = endXY.x + 1;
            textX = endX2;
            if (endXY.y - prevLineY < 2) {
                endXY.y = prevLineY + 2;
            }
            prevIsBig = 0;
        }


        sLinePath.setAttribute('d', 'M' + xy.x + ' ' + xy.y + 'L' + endXY.x + ' ' + endXY.y + 'L' + endX2 + ' ' + endXY.y);

        sText.setAttribute('x', textX);

        sText.setAttribute('y', endXY.y);

        prevLineY = endXY.y;
    }

    // 根据弧度半径算出 结束边末端XY
    function getXY(radian, r) {
        var x = Math.sin(radian) * r + center,
            y = center - Math.cos(radian) * r;
        return {x: x, y: y};
    }
}


function radian(angle) {
    return angle * Math.PI / 180;
}