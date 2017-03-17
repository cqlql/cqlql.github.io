
var excuFrequency = new ExcuFrequency();


$(window).scroll(function () {
    //winScrollY = pageYOffset;

    // excuFrequency.excu(function () {
        sideSyn($('.main'), $('.right'));
    // },200);

});


function sideSyn(jMain, jSide) {
    var jWin = $(window);

    function ChangeAnime(change, rate) {

        var o = this,

            //开关。 是否进行中。true 进行中
            sw = false;

        rate = rate ? rate : .2;

        function lastExcu() {

            sw = false;
        }

        // 参数2 可以是任意值，12px这种也是有效的，其他非数字将视为0
        function start(to, cur) {

            function baseExcu() {
                if (sw) {
                    var len = rate * (o.to - o.cur);

                    o.cur += len;

                    //最后一次
                    if (Math.abs(o.to - o.cur) < 1) {
                        o.cur = o.to;

                        lastExcu();
                    }

                    change(o.cur);

                    window.requestAnimationFrame(baseExcu);
                }
            }

            o.to = to;
            cur = parseFloat(cur);
            o.cur = cur ? cur : o.cur;

            if (sw) return;
            sw = true;

            window.requestAnimationFrame(baseExcu);
        }

        function stop() {
            sw = false;
        }

        this.start = start;
        this.stop = stop;
        this.cur = 0;
        this.to = 0;

        this.getState = function () {
            return sw;
        };
    }

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

            /*if ((sTop + sHeight) < winMaxTop) {
                var y = winMaxTop - sHeight - mTop;
                if (y > (mHeight - sHeight)) y = mHeight - sHeight;
                // jSide.css('top', y);
                anime.start(y);
            }
            else if (sTop > winTop) {
                // var y = winTop - mTop-70;
                var y = winTop - mTop;
                if (y < 0) y = 0;
                // jSide.css('top', y);
                anime.start(y);
            }*/
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




