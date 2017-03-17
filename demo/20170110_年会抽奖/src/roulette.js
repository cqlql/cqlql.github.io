'use strict';

import Vue from 'vue'
import click from 'click'
import autoPrefix from 'autoprefix'

export default function roulette(dishType,count) {

    var
        prizeId = 0,

        // 盘子切分数据
        prizes = {},

        // 抽奖次数 。功能已注释
        lotteryNum = 10,

        dataNoLotter = true,// 是否可以抽奖

        isSuccess = false,//抽奖是否成功
        isRun = false,
        deg = 0,

        cssTransform = autoPrefix('transform')[1],

        flickerTime = 600,

        callName = 'Lottery',

        eStartBtn,
        eRotate,
        eFlicker,
        eNum, eLoading;

    var vm = new Vue({
        el: '.dish',

        data: {
            // 盘子类型
            dishType: dishType,

            // 盘子块数
            count: count,

        },
        computed: {
            dishImg: function () {
                return 'css/imgs/dish' + this.dishType + '.png'
            }
        },
        directives: {
            click: {
                inserted: function (eStartBtn) {
                    var vm=arguments[2].context;
                    click(eStartBtn, function () {
                        if (isRun === false) {
                            new Audio(startAudio.src).play();

                            if (dataNoLotter && lotteryNum > 0) {
                                isRun = true;
                                flickerTime = 200;
                                startRotate();
                            }

                            // 指定时间后终止
                            setTimeout(function () {
                                priceResult(~~(Math.random()*vm.count));
                            }, 200);

                        }
                    });
                }
            }
        },
        watch: {
            count: function () {
                this.countUpdate();
            }
        },
        methods: {
            countUpdate: function () {
                var count = this.count;

                // 切分盘子
                for (var i = 0; i < count; i++) {
                    prizes[i] = {
                        0: i * 360 / count,
                        1: 360 / count
                    };
                }
            }
        },
        mounted: function () {
            this.countUpdate();
        }
    });


    assignDoms();

    flicker();


    function startRotate() {
        var i = 0, len = 200, halfLen = len / 2
            , prev = 0, v, isFinish = false

            , turnNum = 120

            , goalDeg = 900;

        loop();

        // 返回中奖值
        window.priceResult = function (num) {

            if (num >= 0) {
                prizeId = num;
                isSuccess = true;
            }
            else {
                prizeId = 1;
                isSuccess = false;
            }

            isFinish = true;
        };

        function loop() {

            requestAnimationFrame(function () {

                i++;

                if ((i > halfLen && isFinish === false) || turnNum > 0) {
                    i = halfLen;
                }

                if (isFinish && i > halfLen) {
                    goalDegUpdate();
                    v = easeInOutQuad(null, i, 0, goalDeg, len);
                    prev = easeInOutQuad(null, i - 1, 0, goalDeg, len);

                    deg += v - prev;
                }
                else {
                    v = easeInOutQuad(null, i, 0, goalDeg, len);
                    prev = easeInOutQuad(null, i - 1, 0, goalDeg, len);

                    deg += v - prev;
                }

                vm.$refs.eRotate.style[cssTransform] = 'rotate3d(0,0,1,' + deg + 'deg)';

                turnNum--;

                if (i < len) loop();
                else endFn();

            });
        }

        function goalDegUpdate() {

            if (goalDegUpdate.noFirst === undefined) {

                var rDeg = deg - ~~(deg / 360) * 360,
                    easeDeg = (360 + prizes[prizeId][0] - rDeg );

                easeDeg %= 360;

                if (easeDeg < 226) {
                    easeDeg += 360;
                }

                goalDeg = easeDeg * 2;

                goalDegUpdate.noFirst = 1;
            }

        }

        function easeInOutQuad(x, t, b, c, d) {
            if ((t /= d / 2) < 1) return c / 2 * t * t + b;
            return -c / 2 * ((--t) * (t - 2) - 1) + b;
        }
    }

    // 抽奖结束
    function endFn() {

        isRun = false;

        flickerTime = 600;

        if (isSuccess) {
            //lotteryNum--;

            // eNum.innerHTML = lotteryNum;
        }
    }

    function flicker() {
        var is;

        loopFn();

        function loopFn() {
            if (is) {
                eFlicker.style[cssTransform] = 'rotate3d(0,0,1,35deg)';
                is = 0;
            }
            else {
                eFlicker.style[cssTransform] = 'rotate3d(0,0,1,0deg)';
                is = 1;
            }
            setTimeout(loopFn, flickerTime);
        }
    }

    function assignDoms() {
        var eBox = document.querySelector('.lottery-page'),
            eDish = eBox.querySelector('.dish'),
            child;

        child = eDish.children;

        eStartBtn = child[2];
        eRotate = child[0];
        eFlicker = child[1];

    }


}