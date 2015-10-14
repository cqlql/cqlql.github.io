"use strict";
//功能拆分

var eBox = document.getElementById('demo1'),
    eCont = eBox.children[0],
    type='top',
    currContXY = {
        left: 0,
        top:0
    },
    tempContXY={};

//moveCont(100);


c.drag(eBox, function (xy) {
    currContXY[type] = tempContXY[type]+xy[type];

    moveCont(currContXY[type]);

}, function () {
    tempContXY[type] = currContXY[type];

}, function () {

});

function moveCont(v) {
    eCont.style[type] = v + 'px';
}