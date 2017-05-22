webpackJsonp([0],[
/* 0 */,
/* 1 */
/***/ function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

"use strict";


function to(radian) {
    var x = Math.sin(radian) * r + startX;
    var y = r - Math.cos(radian) * r + startY;

    if (radian === 2 * Math.PI) x -= 0.001;

    sPath.setAttribute('d', 'M' + startX + ' ' + startY + ' A ' + r + ' ' + r + ', 0, ' + (radian > Math.PI ? 1 : 0) + ', 1, ' + x + ' ' + y);
}

var sPath = document.querySelectorAll('path')[1];

var r = 30 - 6,
    startX = 30,
    startY = 6,
    fullAngle = 270;

to(fullAngle * 0.5 * Math.PI / 180);

/***/ },
/* 3 */,
/* 4 */
/***/ function(module, exports, __webpack_require__) {

__webpack_require__(1);
module.exports = __webpack_require__(2);


/***/ }
],[4]);