/*
方案失败。过多js操作造成其他方面的性能下降
*/

var eTopHalf = document.querySelector('.top-half')
, eBottomHalf = document.querySelector('.bottom-half')
//, eTopHalfCont = eTopHalf.children[0]
//, eBottomHalfCont = eBottomHalf.children[0]
;

partitionShow({
    eDragBtn : document.querySelector('.drag-btn')
    , eTopHalf : document.querySelector('.top-half')
    , eBottomHalf: document.querySelector('.bottom-half')
    //, eTopHalfCont: eTopHalfCont
    //, eBottomHalfCont: eBottomHalfCont
    , boxH : 640
});

function partitionShow(params) {


    var eDragBtn = params.eDragBtn
        , eTopHalf = params.eTopHalf
        , eBottomHalf = params.eBottomHalf
        , boxH = params.boxH
        //, eTopHalfCont = params.eTopHalfCont
        //, eBottomHalfCont = params.eBottomHalfCont

        , eTopHalfCont = eTopHalf.children[0]
        , eBottomHalfCont = eBottomHalf.children[0]

        , topHalfContH = eTopHalfCont.clientHeight
        , bottomHalfContH = eBottomHalfCont.clientHeight

        , maxY = boxH - 15//最大拖动距离。 窗口高度减去 按钮高度
        , initY = 86//初始化坐标
        , topHalfContY = 0
        , bottomHalfContY = 0
        , topHalfContOffsetY
        , topHalfContMaxY, bottomHalfContMaxY
        , dragBtn, dragTop, dragButtom
    ;

    eBottomHalf.style.height = eTopHalf.style.height = boxH + 'px';

    dragBtn = drag(function (x, y) {
        move(y);
    }, function () { }, function () { }, {
        eDragBtn: eDragBtn,
        currentY: initY
    });

    dragTop = drag(eBottomHalf,function (x, y) {
        topHalfContY = y;
        topHalfContMove();
    }, function () { }, function () { }, {
        eDragBtn: eTopHalfCont,
        currentY: topHalfContY
    });

    dragButtom = drag(function (x, y) {
        bottomHalfContY = y;

        bottomHalfContMove();

    }, function () { }, function () { });

    move(initY);

    function topHalfContMove() {
        if (topHalfContY < topHalfContMaxY) topHalfContY = topHalfContMaxY;
        if (topHalfContY > 0) topHalfContY = 0;


        var y = topHalfContY + topHalfContOffsetY;
        eTopHalfCont.style.setProperty('-webkit-transform', 'translateY(' + y + 'px)');

        dragTop.setCurrentY(topHalfContY);
    }

    function bottomHalfContMove() {

        if (bottomHalfContY < bottomHalfContMaxY) bottomHalfContY = bottomHalfContMaxY;
        if (bottomHalfContY > 0) bottomHalfContY = 0;

        eBottomHalfCont.style.setProperty('-webkit-transform', 'translateY(' + bottomHalfContY + 'px)');

        dragButtom.setCurrentY(bottomHalfContY);
    }

    function move(y) {

        if (y < 0) {
            y = 0;
        } else if (y > maxY) {
            y = maxY;
        }



        var topY = y - boxH;

        topHalfContOffsetY = -topY;

        topHalfContMaxY = -topHalfContH + y;
        bottomHalfContMaxY = -bottomHalfContH - topY;

        eTopHalf.style.setProperty('-webkit-transform', 'translateY(' + topY + 'px)');
        eBottomHalf.style.setProperty('-webkit-transform', 'translateY(' + y + 'px)');
        eDragBtn.style.setProperty('-webkit-transform', 'translateY(' + y + 'px)');

        topHalfContMove();
        bottomHalfContMove();

        dragBtn.setCurrentY(y);
    }
}

//#region 拖动基础
function drag(eDrag, onMove, onDown, onUp, otherParams) {
    var
          currentY = otherParams ? (otherParams.currentY || 0) : 0
          , startY, _y;

    eDrag.addEventListener('touchstart', function (e) {

        var touche = e.touches[0];

        startY = touche.pageY;

        _y = currentY;

        onDown();

    });

    eDrag.addEventListener('touchmove', function (e) {
        var touche = e.touches[0],
            moveY = touche.pageY - startY
            , xy;

        currentY = _y + moveY;

        onMove(0, currentY);

        e.preventDefault();
    });

    eDrag.addEventListener('touchend', onUp);

    return {
        setCurrentY: function (y) {
            currentY = y;
        }
    };
};
//#endregion