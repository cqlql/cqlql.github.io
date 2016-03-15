"use strict";

slideCrosswise();

function slideCrosswise() {

    var
        eBox,
        eMove,
        eLoad,
        ePages,

        boxW,

        loading,
        load=new Load(),

        cssTransition = c.addPrefix('transition'),
        cssTransform = c.addPrefix('transform'),

        pageTotal=6,
        currpage = 0,
        page,

        isRun = false;

    domQuery();

    loading =new c.Loading(function () {
        eLoad.style.opacity = 1;
    }, function () {
        eLoad.style.opacity = 0;
    });

    boxW = eBox.clientWidth;

    c.sideslip({
        eBox: eBox,
        boxW: boxW,
        changeRight: function () {
            // 上一页
            prevPage();
        },
        changeLeft: function () {
            // 下一页
            nextPage();
        },
        moveX: function (x) {
            eMove.style.setProperty(cssTransform, 'translate3d(' + x + 'px,0,0)');

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

    load.excu(currpage);

    function domQuery() {
        eBox = document.querySelector('.exam-box');
        eMove = eBox.children[0];
        eLoad = eMove.children[2];
        ePages = [eMove.children[4], eMove.children[5], eMove.children[6]];

    }
    
    function nextPage() {
        page = currpage;
        page++;
        if (page >= pageTotal) {
            anime(0);
            page = -1;
            return;
        }
        anime(1);
    }

    function prevPage() {
        page = currpage;
        page--;
        if (page < 0) {
            anime(0);
            page = -1;
            return;
        }
        anime(-1);
    }

    function anime(index) {
        isRun = true;
        eMove.style.setProperty(cssTransition, '0.3s');

        setTimeout(function () {
            eMove.style.setProperty(cssTransform, 'translate3d(' + (-index * boxW) + 'px,0,0)');
        }, 1);
    }

    function transitionend() {
        isRun = false;

        eMove.style.setProperty(cssTransition, '0s');
        eMove.style.setProperty(cssTransform, 'translate3d(0,0,0)');

        if (page > -1) {
            load.excu(page);
        }
    }

    function loadCallBack() {
        loading.close();
    }

    function Load() {
        var stopId;

        this.excu = function (page) {
            stop();

            loading.show();

            // test
            stopId = setTimeout(loadCallBack, 1000);

            // 当前页显示
            ePages[0].innerHTML = page + '/' + pageTotal;
            ePages[1].innerHTML = page + 1 + '/' + pageTotal;
            ePages[2].innerHTML = page + 2 + '/' + pageTotal;

            currpage = page;
        };

        function stop() {
            clearTimeout(stopId);
        }
    }
}  