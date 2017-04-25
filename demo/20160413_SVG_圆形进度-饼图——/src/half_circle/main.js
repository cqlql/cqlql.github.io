/**
 * 半圆进度
 *
 * Created by cql on 2017/3/16.
 */

// 弧度单位
function to(radian) {
    var x = Math.sin(radian) * r + startX;
    var y = r - Math.cos(radian) * r + startY;

    if (radian === 2 * Math.PI) x -= 0.001;

    sPath.setAttribute('d', 'M' + startX + ' ' + startY + ' A ' + r + ' ' + r + ', 0, ' + (radian > Math.PI ? 1 : 0) + ', 1, ' + x + ' ' + y);
}


let sPath=document.querySelectorAll('path')[1];

var r =30-6,
    startX = 30,
    startY = 6,
    fullAngle=270;

to(fullAngle*0.5* Math.PI / 180);