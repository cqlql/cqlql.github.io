/**
 * Created by cql on 2017/3/17.
 */

require('./imgs/dish1.png');
require('./imgs/dish2.png');
require('./imgs/dish3.png');
require('./imgs/dish4.png');
require('./imgs/dish5.png');
require('./imgs/dish6.png');
require('./imgs/dish7.png');

import imgsLoader from 'imgs-loader';
import {} from 'click-vue';
import autoPrefix from 'autoPrefix';
import {deviceCallback} from 'device';
import textMarquee from 'text-marquee';
import Vue from 'vue';

let transform = autoPrefix('transform')[1];

window.transmitData = function (d) {
    if (typeof d === 'string') {
        d = JSON.parse(d);
    }

    /*
     d.chances,// 抽奖次数
     d.level,// 级别，据此更换饼图

     */
    let

        dataNoLotter = d.left == 0,// 是否可以抽奖

        callName = 'Lottery';

    let imgsData = [
        'imgs/dish' + d.level + '.png'
        , 'imgs/dish-bg.png'
        , 'imgs/ico.png'
        , 'imgs/start.png'
    ];

    let wheelSurf = new WheelSurf;
    let vm;


    imgsLoader(imgsData, function () {

        let easing = function (x, t, b, c, d) {
            return -c * (t /= d) * (t - 2) + b;
        };

        vm = new Vue({
            el: '.lottery-page',
            data: {
                rotateBg: 'url(' + imgsData[0] + ')',
                nominates: d.nominates,
                chances: d.chances,
                flickerTime: 600,
                isSuccess: false//抽奖是否成功
            },
            mounted(){
                this.flicker();

                textMarquee({
                    eBox: this.$refs.textMarquee,
                    eText: this.$refs.textMarquee.children[0],
                    type: 1
                })
            },
            methods: {
                start(){
                    if (!wheelSurf.isRun) {

                        // 开始抽奖、次数用完
                        deviceCallback([callName, 'getLottery'], 'getLottery:0');

                        if (dataNoLotter && this.chances > 0) {

                            this.flickerTime = 200;
                            wheelSurf.start(deg => {
                                vm.$refs.rotate.style[transform] = 'rotate3d(0,0,1,' + deg + 'deg)';
                            }, () => {
                                // 一轮抽奖结束

                                deviceCallback([callName, 'showResult'], 'showResult:0');

                                this.flickerTime = 600;

                                // 抽奖成功，减次数
                                if (this.isSuccess) {
                                    vm.chances--;
                                }
                            });
                        }

                    }
                },

                // 灯闪烁
                flicker(){
                    let is;
                    let eFlicker = this.$refs.flicker;

                    let loopFn = () => {

                        if (is) {
                            eFlicker.style[transform] = 'rotate3d(0,0,1,35deg)';
                        }
                        else {
                            eFlicker.style[transform] = 'rotate3d(0,0,1,0deg)';
                        }
                        is = !is;
                        setTimeout(loopFn, this.flickerTime);
                    };

                    loopFn();
                }
            }
        });
    });

    window.priceResult = function (t) {

        if (t > 0) {
            // 抽奖成功。
            vm.isSuccess = true;

            /*
             5 1
             0 2
             1 3
             2 4
             3 5
             4 6
             */

            if (t == 1) {
                t = 6 - 1;
            }
            else {
                t = t - 2;
            }
        }
        else {
            // 抽奖失败
            t = 6 - 1;
            vm.isSuccess = false;
        }

        wheelSurf.stop(t);

    };

};


class WheelSurf {

    constructor() {
        this.animation = new Animation;

        this.deg = 0;
        this.pre = 0;//加速情况的上一个角度
        this.targetDeg = 0;
        this.result = 0;// 是否返回结果

        this.isRun = false;

        // 此处参数可能会根据实际情况有所调整
        this.count = 6;// 盘数
        this.pieDeg = 360 / this.count;
        // 最大的角度。根据减速运动的距离来调整，必需大于减速所累加的距离，必须是360的整数倍
        // 比如下面减速运动的距离味390，那么maxDeg 则为720
        this.maxDeg = 360 * 2;
        this.extraDeg = this.maxDeg - 390;//额外的角度。可根据实际情况调整。390 根据 animation.start 参数2所得
        this.maxSpeed = 20;// 最高速度，单位deg
        this.time = 1600;

    }

    // 减速距离计算
    slowCalculate() {
        let run = p => {
            this.deg = this.deg + this.maxSpeed * p;
            return this.deg;
        };
        console.log('计算中，请等待结果');

        this.animation.start(
            p => {
                p = 1 - p;

                this.deg = run(p);

                if (p === 0) {

                    console.log('减速运动的距离:' + this.deg);
                    this.deg = 0;
                    return 2;
                }
            },
            function () {

            },
            this.time
        );
    }

    // @params cb 动画完成回调
    start(f, cb = () => {
    }) {

        if (this.isRun) {
            return;
        }
        this.isRun = true;

        let run = p => {
            this.deg = (this.deg + this.maxSpeed * p) % this.maxDeg;

            f(this.deg);

            return this.deg;
        };

        this.animation.start(
            p => {

                this.deg = run(p);

                if (this.result && this.deg > this.targetDeg && this.pre < this.targetDeg && p === 1) {
                    return 1;
                }

                this.pre = this.deg;

            },
            // 已这个函数作为第一个参数即可得到 extraDeg
            p => {
                p = 1 - p;

                this.deg = run(p);

                if (p === 0) {
                    return 2
                }
            },
            this.time,
            () => {
                this.isRun = false;
                cb();
            }
        );

    }

    stop(t) {
        this.result = 1;
        this.targetDeg = (t * this.pieDeg + this.extraDeg ) % this.maxDeg;
    }
}

class Animation {

    constructor() {

    }

    //params: 反复执行的函数，动画持续时间(毫秒)，到达目标位置时回调
    start(callback, rCallback, duration = 400, complete = () => {
    }) {


        let
            t = 0,//当前起始次数
            interval = 20,//帧间隔
            count = duration / interval,//总次数

            position = 0, // 起始位置
            endPosition = 100,//目标位置
            length = endPosition - position, //要走的总长度

            that = this;

        function run() {
            t++;

            if (t >= count) {
                t = count;
            }

            let on = true;
            switch (callback(that.easing(null, t, position, length, count) / endPosition)) {
                case 1:
                    t = 0;
                    callback = rCallback;

                    that.easing = function (x, t, b, c, d) {
                        return -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b;
                    };
                    break;

                case 2:
                    that.easing = function (x, t, b, c, d) {
                        return c * ((t = t / d - 1) * t * t + 1) + b;
                    };
                    on = false;
                    complete();
                    break;
            }

            if (on) that.stopId = requestAnimationFrame(run, interval);

        }

        run();
    }

    // 终止动画
    stop() {
        cancelAnimationFrame(this.stopId);
    }

    // 缓动类型：可进行更换
    easing(x, t, b, c, d) {
        return c * ((t = t / d - 1) * t * t + 1) + b;
    }
}