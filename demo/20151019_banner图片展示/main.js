"use strict";

bannerFade({
    eBox :document.getElementById('fadeDemo')
});

function bannerFade(params) {
    var eBox = params.eBox
        , eListBox=eBox.children[0]
        , eItems = eListBox.children

        , length=eItems.length

        // 接受三种值：不给(0索引)、false(不进行初始显示)、索引值
        , isInitShow =c.paramUn(0, params.isInitShow)

        , currIndex = 0
        ;
    
    if (isInitShow !== false) initShow(isInitShow);

    new BannerArrowsHandle({
        eArrows :c.filtrateElementsByClassName('arrows', eBox.children)
        ,length: length
        , change: go
        , currIndex: currIndex
    });

    bannerBtnsHandle({
        eBox: c.filtrateElementsByClassName('btns', eBox.children)[0]
        , length: length
    });

    function go(index) {

        fadeIn(index);
        fadeOut(currIndex);
        
        currIndex = index;
    }

    function initShow(index) {
        fadeIn(index);
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

function BannerArrowsHandle(params) {
    var
        eBox = params.eBox
        , eArrows = params.eArrows
        , currIndex = params.currIndex
        , length = params.length
        , change = params.change
    ;

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
    var eBox = params.eBox
        , eBtns = eBox.children
        , length = params.length

        , isInitShow = c.paramUn(0, params.isInitShow)

        , currIndex
        
        ,html=''
    ;

    initShow(isInitShow);

    for (var i = 0; i < length; i++) {
        html += '<a href="javascript:;" data-index="' + i + '"></a>';
    }

    eBox.innerHTML = html;


    c.eventBind(eBox, 'click', function (e) {
        if (e.target.tagName === 'A') {
            var index = e.target.getAttribute('data-index');

            if (index == currIndex) return;

            go(index);

            change();
        }
    });

    this.change = change;

    function go(index) {
        c.removeClass(eBtns[currIndex], 'active');
        c.addClass(eBtns[index], 'active');
        
        currIndex = index;
    }

    function change() {

    }

    function initShow(index) {
        go(index);
        currIndex = index;
    }
}