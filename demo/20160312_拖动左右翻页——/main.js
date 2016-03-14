"use strict";

slideCrosswise();

function slideCrosswise() {

    var
        eBox,
        eMove,

        boxW,

        cssTransition = c.addPrefix('transition'),
        cssTransform = c.addPrefix('transform'),
        currIndex = 0,

        isRun = false;

    domQuery();

    boxW = eBox.clientWidth;

    c.sideslip({
        eBox: eBox,
        boxW: boxW,
        changeRight: function () {
            console.log(1);
            anime(-1);
        },
        changeLeft: function () {
            console.log(2);
            anime(1);
        },
        moveX: function (x) {
            eMove.style.setProperty(cssTransform, 'translate3d(' + (x - (currIndex * boxW)) + 'px,0,0)');

        },
        inplace: function () {
            anime(0);
        },
        resetStart: function () {
            eMove.style.setProperty(cssTransition, '0s');
        },
        getRunState: function () {
            return isRun;
        }
    });

    eMove.addEventListener("webkitTransitionEnd", transitionend);
    eMove.addEventListener("transitionend", transitionend);

    function domQuery() {
        eBox = document.querySelector('.exam-box');
        eMove = eBox.children[0];

    }

    function anime(index) {
        isRun = true;
        eMove.style.setProperty(cssTransition, '0.3s');

        setTimeout(function () {
            eMove.style.setProperty(cssTransform, 'translate3d(' + (-index * boxW) + 'px,0,0)');
        }, 1);
    }

    function change() {

    }

    function transitionend() {
        isRun = false;

        eMove.style.setProperty(cssTransition, '0s');
        eMove.style.setProperty(cssTransform, 'translate3d(0,0,0)');
    }
}  