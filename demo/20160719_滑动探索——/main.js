/**
 * Created by SD01 on 2016/7/19.
 */

'use strict';
swipe({
    eBox: document,
    swipeLeft: function () {
        console.log('left');
    },
    swipeRight: function () {
        console.log('right');
    },
    reset: function () {

    },
    move: function (x) {

    }
});

// 代替 Velocity 的新方式
function SwipeBase() {

    var prevX, toX;

    this.start = function (x) {
        prevX = x;
        toX = 0;
    };

    this.move = function (x) {
        toX = x - prevX;
        prevX = x;
    };
    this.end = function () {

        if (toX > 15) {
            console.log('right');
        }
        else if (toX < -15) {
            console.log('left');
        }
    };
}

/*
 * 能够区分滚动条的滑动
 *
 * */
function swipe(params) {
    var
        eBox = params.eBox,
        swipeLeft = params.swipeLeft,
        swipeRight = params.swipeRight,
        reset = params.reset,
        move = params.move,

        startX, startY,

        // 0 没反映，1 x 方向，2 y 方向
        status = 0,

        currentX,

        xVel = new Velocity;

    eBox.addEventListener('touchstart', function (e) {

        var touche = e.touches[0];

        startX = touche.pageX;
        startY = touche.pageY;

        xVel.start();

        status = 0;
    });

    eBox.addEventListener('touchmove', function (e) {
        var touche = e.touches[0],
            x = touche.pageX - startX,
            y = touche.pageY - startY;

        if (status === 0) {

            if (Math.abs(x) > Math.abs(y)) {
                status = 1;
            }
            else {
                status = 2;
            }
        }

        if (status === 1) {

            xVel.change(x);

            move(x);

            e.preventDefault();

        }

        currentX = x;

    });

    eBox.addEventListener('touchend', function (e) {

        if (status === 1) {
            var val = xVel.end();

            //滑动情况
            if (Math.abs(val) > 40) {

                if (val < 0) {
                    // 左滑
                    swipeLeft();

                } else {
                    // 右滑
                    swipeRight();
                }
            }
            //移动情况
            else {

                // 超过一般情况 滑动
                if (Math.abs(currentX) > offset) {

                    if (currentX > 0) {
                        /// 向右
                        swipeRight();
                    }
                    else {
                        /// 左
                        swipeLeft();
                    }
                }
                else {
                    // 复位
                    reset();
                }
            }
        }
    });


}

function Velocity() {

    var startTime,
        moveTimesArr = [],
        target = this;

    function getSustainTimes() {
        return (new Date()).getTime() - startTime;
    }

    //速率计时
    this.start = function () {
        moveTimesArr = [[0, 0]];
        startTime = (new Date()).getTime();
    };
    this.end = function () {
        var lastIndex = moveTimesArr.length - 1;

        if (lastIndex < 1) return 0;

        //间隔时间
        var intervalTime = getSustainTimes() - moveTimesArr[lastIndex][0];

        //有惯性情况。间隔时间
        if (intervalTime < 200) {
            // 滑动情况一般不会超过50毫秒。如果不够敏感，不应调节这里。条件end 返回的值，往小里调

            return (moveTimesArr[0][1] - moveTimesArr[lastIndex][1]) / intervalTime * 1000;
        }
        //无惯性
        else {
            return 0;
        }
    };

    this.change = function (val) {

        moveTimesArr.unshift([getSustainTimes(), val]);

        if (moveTimesArr.length > 4) moveTimesArr.length = 4;
    };
}