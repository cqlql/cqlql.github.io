/**
 * 方式1：非常精准，但加速到减速过渡不完美，但影响极小
 */

require('./imgs/dish1.png');
require('./imgs/dish2.png');
require('./imgs/dish3.png');
require('./imgs/dish4.png');
require('./imgs/dish5.png');
require('./imgs/dish6.png');
require('./imgs/dish7.png');

import {imgsLoader,autoPrefix}from 'corejs';
import 'vue-basejs/dist/click.cjs.js';
import textMarquee from 'text-marquee';
import Vue from 'vue';

let transform = autoPrefix('transform')[1];
let global = window;

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
                });
            },
            methods: {
                start(){
                    if (!wheelSurf.isRun) {

                        // 开始抽奖、次数用完
                        global[callName].getLottery();

                        if (dataNoLotter && this.chances > 0) {

                            this.flickerTime = 200;
                            wheelSurf.start(deg => {
                                vm.$refs.rotate.style[transform] = 'rotate3d(0,0,1,' + deg + 'deg)';
                            }, () => {

                                // 一轮抽奖结束
                                global[callName].showResult();

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

            t++;
        }
        else {
            // 抽奖失败
            t = 1;
            vm.isSuccess = false;
        }

        wheelSurf.stop(t);

    };

};

class WheelSurf {

    constructor() {
        this.animation = new Animation;

        this.deg = 0;
        this.targetDeg = 0;
        this.result = 0;// 是否返回结果

        this.isRun = false;

        // 此处参数可能会根据实际情况有所调整
        this.count = 6;// 盘数
        this.pieDeg = 360 / this.count;
        // 最大的角度
        this.maxDeg = 360;
        this.maxSpeed = 16;// 最高速度，单位deg
        this.time = 1600;

        // 偏差角度，转盘图片所致
        this.offsetDeg=15;
    }

    // @params cb 动画完成回调
    start(f, cb = () => {
    }) {

        if (this.isRun) {
            return;
        }
        this.isRun = true;
        this.result = 0;

        let dp;// 减速比例。强行衔接最高加速

        this.animation.start(
            p => {

                this.deg = (this.deg + this.maxSpeed * p) % this.maxDeg;

                f(this.deg);

                if (this.result && p === 1) {

                    dp = this.deg / this.targetDeg;

                    return 1;
                }

            },
            p => {
                this.deg = (dp + (1 - dp) * p) * this.targetDeg;

                f(this.deg);

                if (p === 1) {
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

    // 0起始
    stop(t) {
        this.result = 1;
        this.targetDeg = t * this.pieDeg + this.offsetDeg + this.maxDeg;
    }
}

class Animation {

    constructor() {

    }

    // 加速缓动
    // aeasing(x, t, b, c, d) {
    //     return c * ((t = t / d - 1) * t * t + 1) + b;
    //
    // }

    // 减速缓动
    // deasing(x, t, b, c, d) {
    //     return -c *(t/=d)*(t-2) + b;
    //
    // };

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

        // 切换到加速
        // that.easing = this.aeasing;

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

                    // 切换到减速
                    // that.easing =that.deasing;

                    break;

                case 2:
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
