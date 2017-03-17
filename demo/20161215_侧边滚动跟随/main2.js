
var excuFrequency = new ExcuFrequency();


$(window).scroll(function () {
    //winScrollY = pageYOffset;

    // excuFrequency.excu(function () {
        sideSyn($('.main'), $('.right'));
    // },200);

});


function sideSyn(jMain, jSide) {
    var jWin = $(window);

    function excu(jMain, jSide) {
        // var eMain=params.eMain,
        //     jSide=params.jSide;

        jSide.css('position', 'relative');

        var anime = jMain.data('anime');
        if (!anime) {
            anime = new ChangeAnime(function (v) {
                jSide.css('top', v);
            });
            jMain.data('anime', anime);
        }

        var
            winHeight = jWin.height(),

            winTop = pageYOffset,
            winMaxTop = winTop + winHeight,

            mTop = jMain.offset().top,
            mHeight = jMain.innerHeight(),
            mMaxTop=mHeight + mTop,

            sTop = jSide.offset().top,
            // sTop = jSide.offset().top+70,
            sHeight = jSide.innerHeight();

        // 判断指定元素是否在显示区域

        if (mTop > winMaxTop || mMaxTop < winTop) {

        }
        else {

            if (sTop< winTop) {
                jSide.css({
                    position:'fixed',
                    top:0
                });
                if(winMaxTop>mMaxTop){
                    jSide.css({
                        top:'auto',
                        bottom:winMaxTop-mMaxTop
                    });
                }
            }

        }
    }

    sideSyn = excu;

    excu(jMain, jSide);
}

function ExcuFrequency() {
    var status = 0;
    this.excu = function (fn, time) {
        if (status) return;
        status = 1;
        setTimeout(function () {
            fn();
            status = 0;
        }, time === undefined ? 600 : time);
    }
}




