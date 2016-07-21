/**
 * Created by SD01 on 2016/7/21.
 */
'use strict';
(function () {

    var eBox1=document.getElementById('test1');
    var eBox2=document.getElementById('test2');

    var swipeBase1 = new SwipeBaseByTwo();
    var swipeBase2 = new SwipeBaseByThree();

    ///
    eBox1.addEventListener('touchstart', function (e) {
        var touche = e.touches[0];
        swipeBase1.start(touche.pageX);
    });

    eBox1.addEventListener('touchmove', function (e) {
        var touche = e.touches[0];
        swipeBase1.move(touche.pageX);
        e.preventDefault();
    });

    eBox1.addEventListener('touchend', function (e) {
        swipeBase1.end();
    });

    ///
    eBox2.addEventListener('touchstart', function (e) {
        var touche = e.touches[0];
        swipeBase2.start(touche.pageX);
    });

    eBox2.addEventListener('touchmove', function (e) {
        var touche = e.touches[0];
        swipeBase2.move(touche.pageX);
        e.preventDefault();
    });

    eBox2.addEventListener('touchend', function (e) {
        swipeBase2.end();
    });


    function SwipeBaseByTwo() {

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

            var s = 10;// 此处调节敏感度
            if (toX > s) {
                eBox1.innerHTML = '<b>右</b> 滑动' + toX;
            }
            else if (toX < -s) {
                eBox1.innerHTML = '<b>左</b> 滑动' + toX;
            }
            else {
                eBox1.innerHTML = '<b>未发生</b> 滑动' + toX;
            }
        };
    }


    function SwipeBaseByThree() {

        var prevXData, toX, i;

        this.start = function (x) {
            i = 0;
            prevXData = {};
            prevXData[i] = x;
        };

        this.move = function (x) {
            i++;
            prevXData[i] = x;
        };
        this.end = function () {

            if (i) {
                if (i < 2) {
                    i++;
                    prevXData[i] = prevXData[i - 1];
                }

                var toX = prevXData[i] - prevXData[i - 2];

                var s = 10;// 此处调节敏感度
                if (toX > s) {
                    eBox2.innerHTML = '<b>右</b> 滑动' + toX;
                }
                else if (toX < -s) {
                    eBox2.innerHTML = '<b>左</b> 滑动' + toX;
                }
                else {
                    eBox2.innerHTML = '<b>未发生</b> 滑动' + toX;
                }

            }
            else {
                // 不小心模拟了click事件
            }
        };
    }
})();