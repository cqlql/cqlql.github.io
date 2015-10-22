"use strict";

//bannerFade({
//    eBox: document.getElementById('fadeDemo')
//    , change: function (index, eItems) {
//        var eLi = eItems[index], eImg;
//        if (!eLi.data_isLoading) {
//            eLi.data_isLoading = 1;
//            eImg = eLi.children[0];
//            eImg.src = eImg.getAttribute('data-src');
//        }
//    }
//});

function bannerFade(params) {
    var eBox = params.eBox
        , hasArrows = c.paramUn(params.hasArrows, 1)
        , hasBtns = c.paramUn(params.hasBtns, 1)
        , time = c.paramUn(params.time, 2000)
        // 接受三种值：不给(0索引)、false(不进行初始显示)、索引值
        , isInitShow = c.paramUn(params.isInitShow, 0)
        , change = c.paramUn(params.change, function () {})

        , eListBox=eBox.children[0]
        , eItems = eListBox.children

        , length=eItems.length

        , noneFn={ go: function () { } }

        , currIndex = 0
        , bannerArrowsHandle, bannerBtnsHandle, bannerTimer
        ;
    
    if (isInitShow !== false) initShow(isInitShow);

    bannerArrowsHandle =hasArrows?  new BannerArrowsHandle({
        eBox: eBox
        ,length: length
        , change: function (index) {
            go(index);
            bannerBtnsHandle.go(index);
            bannerTimer.go(index);
        }
        , initIndex: isInitShow
    }) : noneFn;

    bannerBtnsHandle = hasBtns ? new BannerBtnsHandle({
        eBox: eBox
        , length: length
        , change: function (index) {
            go(index);
            bannerArrowsHandle.go(index);
            bannerTimer.go(index);
        }
        , initIndex: isInitShow
    }): noneFn;

    bannerTimer = time ? new BannerTimer({
        eBox: eBox
        , length: length
        , change: function (index) {
            go(index);
            bannerArrowsHandle.go(index);
            bannerBtnsHandle.go(index);
        }
        , initIndex: isInitShow
        , time: time

    }) : noneFn;

    function go(index) {

        fadeIn(index);
        fadeOut(currIndex);
        change(index, eItems);
        currIndex = index;
    }

    function initShow(index) {
        fadeIn(index);
        change(index, eItems);
        currIndex = index;
    }

    function fade(eLi,o,callBack) {

        if (eLi.data_easing === undefined) {
            eLi.data_easing = new c.EasingBuild();
        }

        eLi.data_easing.excu({
            o: o
        }, {
            go: function (to) {
                eLi.style.opacity = to.o;
            },
            callBack: callBack,
            speed: 600
        });
    }

    function fadeIn(index) {
        var eLi = eItems[index];
        fade(eLi, 1);
        eLi.style.zIndex = 1;
    }

    function fadeOut(index) {
        var eLi = eItems[index];
        fade(eLi, 0);
        eLi.style.zIndex = 0;
    }

}

function bannerMove(params) {
    var eBox = params.eBox
        , hasArrows = c.paramUn(params.hasArrows, 1)
        , hasBtns = c.paramUn(params.hasBtns, 1)
        , time = c.paramUn(params.time, 2000)
        // 接受三种值：不给(0索引)、false(不进行初始显示)、索引值
        , isInitShow = c.paramUn(params.isInitShow, 0)
        , change = c.paramUn(params.change, function () { })

        , eListBox = eBox.children[0]
        , eItems = eListBox.children

        , length = eItems.length

        , noneFn = { go: function () { } }

        , currIndex = 0
        , bannerArrowsHandle, bannerBtnsHandle, bannerTimer
    ;

    if (isInitShow !== false) initShow(isInitShow);

    bannerArrowsHandle = hasArrows ? new BannerArrowsHandle({
        eBox: eBox
        , length: length
        , change: function (index) {
            go(index);
            bannerBtnsHandle.go(index);
            bannerTimer.go(index);
        }
        , initIndex: isInitShow
    }) : noneFn;

    bannerBtnsHandle = hasBtns ? new BannerBtnsHandle({
        eBox: eBox
        , length: length
        , change: function (index) {
            go(index);
            bannerArrowsHandle.go(index);
            bannerTimer.go(index);
        }
        , initIndex: isInitShow
    }) : noneFn;

    bannerTimer = time ? new BannerTimer({
        eBox: eBox
        , length: length
        , change: function (index) {
            go(index);
            bannerArrowsHandle.go(index);
            bannerBtnsHandle.go(index);
        }
        , initIndex: isInitShow
        , time: time

    }) : noneFn;

    function go(index) {

        fadeIn(index);
        fadeOut(currIndex);
        change(index, eItems);
        currIndex = index;
    }

    function initShow(index) {
        fadeIn(index);
        change(index, eItems);
        currIndex = index;
    }

    function fade(eLi, o, callBack) {

        if (eLi.data_easing === undefined) {
            eLi.data_easing = new c.EasingBuild();
        }

        eLi.data_easing.excu({
            o: o
        }, {
            go: function (to) {
                eLi.style.opacity = to.o;
            },
            callBack: callBack,
            speed: 600
        });
    }

    function fadeIn(index) {
        var eLi = eItems[index];
        fade(eLi, 1);
        eLi.style.zIndex = 1;
    }

    function fadeOut(index) {
        var eLi = eItems[index];
        fade(eLi, 0);
        eLi.style.zIndex = 0;
    }

}

function BannerArrowsHandle(params) {
    var
        eBox = params.eBox
        , eArrows
        , currIndex = c.paramUn(params.initIndex, 0)
        , length = params.length
        , change = params.change
        ;

    eArrows = c.appendChildHtml(eBox, '<a class="arrows l" href="javascript:;"></a><a class="arrows" href="javascript:;"></a>');

    c.eventBind(eArrows[0], 'click', function (e) {
        arrowEvent(e, 0);
    });

    c.eventBind(eArrows[1], 'click', function (e) {
        arrowEvent(e, 1);
    });

    this.go = function (index) {
        currIndex = index;
    };

    function arrowEvent(e, isRight) {
        var index = currIndex;
        if (isRight) {
            index++;

            if (index >= length) {
                index = 0;
            }
        }
        else {
            index--;

            if (index < 0) {
                index = length - 1;
            }
        }

        if (currIndex !== index) {
            currIndex = index;

            change(index);
        }
    }
}

function BannerBtnsHandle(params) {
    var
        eBox = params.eBox
        , length = params.length
        , change = c.paramUn(params.change, function () { })
        , initIndex = c.paramUn(params.initIndex, 0)
        , currIndex = -1


        , eBtnBox = document.createElement('div')
        , eBtns
        
        , html
    ;
    
    html = '<div class="btns">';
    for (var i = 0; i < length; i++) {
        html += '<a href="javascript:;" data-index="' + i + '"></a>';
    }
    html += '</div>';

    eBtnBox.innerHTML = html;
    eBtnBox = eBtnBox.children[0];

    eBox.appendChild(eBtnBox);

    eBtns = eBtnBox.children;

    go(initIndex);

    c.eventBind(eBtnBox, 'click', function (e) {
        if (e.target.tagName === 'A') {
            var index = e.target.getAttribute('data-index');
            
            change(index);

            go(index);
        }
    });

    this.go = go;

    function go(index) {
        if (index == currIndex) return;
        if(eBtns[currIndex]) c.removeClass(eBtns[currIndex], 'active');
        c.addClass(eBtns[index], 'active');
        
        currIndex = index;
    }

 

}

function BannerTimer(params) {
    var eBox = params.eBox
        , length = params.length
        , time = params.time
        , change = params.change
        , currIndex = c.paramUn(params.initIndex, 0)

        ,timer = new Timer({
            timeFunc: go,
            time: time
        })
        ,that=this;
    
    c.eventBind(eBox, 'mouseenter', function () {
        timer.stop();
    });

    c.eventBind(eBox, 'mouseleave', function () {
        timer.start();
    });

    this.change = function () { };
    this.go = function (index) {
        currIndex = index;
    };

    timer.start();

    function go() {
        var index = currIndex;

        index++;

        if (index >= length) {
            index = 0;
        }

        change(index);

        currIndex = index;
    }

    function Timer(params) {

        var timerId = null,
            time = params.time || 3000,
            timeFunc = params.timeFunc;

        //初始执行
        start();

        this.start = start;

        this.stop = function () {
            if (timerId !== null) {
                clearTimeout(timerId);
                timerId = null;
            }
        };

        function timerExcu() {

            timeFunc();

            timerId = null;

            start();
        }

        function start() {
            if (timerId === null) timerId = setTimeout(timerExcu, time);
        };

    }

}

