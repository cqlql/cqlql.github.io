"use strict";


var eBox = document.getElementById('demo1'),
    eCont = eBox.children[0];

moveCont(100);

c.drag(eBox, function (xy) {
    console.log(xy);
}, function () {

}, function () {

});

function moveCont(v) {
    eCont.style.top = v+'px';
}