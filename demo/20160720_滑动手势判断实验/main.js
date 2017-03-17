/**
 * Created by SD01 on 2016/7/21.
 */




'use strict';
(function () {

    var eBox1 = document.getElementById('test1');
    var eBox2 = document.getElementById('test2');

    var swipeBasePc = new SwipeBaseByTwo();
    var swipeBase1 = new SwipeBaseByTwo();
    var swipeBase2 = new SwipeBaseByThree();

    var pre, preTime;

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

    function drag(eDrag, onMove, onDown, onUp) {
        eDrag.addEventListener('mousedown', down);

        function down(e) {

            if (onDown && onDown(e.pageX, e.pageY) === false) return;

            document.addEventListener('mousemove', mousemove);
            document.addEventListener('mouseup', mouseup);

            e.preventDefault();

            function mousemove(moveEvent) {
                onMove(moveEvent.pageX, moveEvent.pageY);
            }

            function mouseup() {
                if (onUp) onUp();

                //解除所有事件
                document.removeEventListener('mousemove', mousemove);
                document.removeEventListener('mouseup', mouseup);

            }
        }
    }

    drag(eBox1, function (x,y) {
        swipeBasePc.move(x);
    }, function (x) {
        swipeBasePc.start(x);
    }, function () {
        swipeBasePc.end();
    });

    /*
    移动端最稳定方式
    还可以用于pc端(根据情况可能要调节敏感度)
    */
    function SwipeBaseByTwo() {

        var prevX, toX;

        var preTime;
        var track = [];
        var i = 0;
        this.start = function (x) {
            prevX = x;
            // toX = 0;

            preTime = Date.now();
            console.clear();
            i = 0;
        };

        this.move = function (x) {
            toX = x - prevX;
            prevX = x;

            var now = Date.now();

            track[i] = [toX, now - preTime];
            console.log('move', track[i]);
            preTime = now;

            i++;

        };
        this.end = function () {
            if (i || 1) {
                var now = Date.now();

                track[i] = [toX, now - preTime];
                console.log('end', track[i]);
                i++;

                var to = 0;
                var time = 0;
                var count = i;
                while (i--) {
                    to += track[i][0];
                    time += track[i][1];

                    // 3 次将调出
                    if (count - i >= 3) {
                        break;
                    }

                }

                if (time < 110) {// 时间敏感度

                    var s = 10;// 距离敏感度

                    if (to > s) {
                        eBox1.innerHTML = '右 滑动 ||距离:' + to + '||时间:' + time;
                    }
                    else if (to < -s) {
                        eBox1.innerHTML = '左 滑动 ||距离:' + to + '||时间:' + time;
                    }
                    else {
                        eBox1.innerHTML = '未发生 滑动 ||距离:' + to + '||时间:' + time;
                    }
                }
                else {
                    eBox1.innerHTML = '未发生 滑动 ||距离:' + to + '||时间:' + time;
                }

                console.log(eBox1.innerHTML);

            }
            else {
                // 模拟了click事件
            }
        };
    }


    /*

     移动端独有的一种方式

     虽然此种方式没有纳入时间计算。但不影响。

     因为在触摸屏，move事件触发后，松开手指的过程也会不经意触发多个move情况，这就避免了加速度突然静止松开因没纳入时间导致计算不正确

     */
    function SwipeBaseByThree() {

        var prevXData, toX, i;

        this.start = function (x) {
            toX = i = 0;
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