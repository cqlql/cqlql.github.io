/**
 * Created by cql on 2017/3/17.
 */

require('./imgs/dish1.png');

import imgsLoader from 'imgs-loader';
import {} from 'click-vue';
import autoPrefix from 'autoPrefix';
// import Animation from 'animation';
import Vue from 'vue';

let transform=autoPrefix('transform')[1];

window.transmitData = function (d) {
    if (typeof d === 'string') {
        d = JSON.parse(d);
    }

    let dataNum = d.chances,// 抽奖次数
        dataLevel = d.level,// 级别，据此更换饼图
        dataNoLotter = d.left == 0// 是否可以抽奖
        ;

    let imgsData = [
        'imgs/dish' + dataLevel + '.png'
        , 'imgs/dish-bg.png'
        , 'imgs/ico.png'
        , 'imgs/start.png'
    ];

    let animation = new Animation();
    let deg=0;

    imgsLoader(imgsData, function () {

        let easing = function (x, t, b, c, d) {
            return -c * (t /= d) * (t - 2) + b;
        };

      let vm=  new Vue({
            el: '.lottery-page',
            data: {
                rotateBg: 'url(' + imgsData[0] + ')'
            },
            methods: {
                start(){
                    animation.start(
                        function (p) {
                            deg+=10*p;
                            vm.$refs.rotate.style[transform] = 'rotate3d(0,0,1,' + deg+ 'deg)';
                        },
                        1000
                    );
                }
            }
        });
    });

};


class Animation {

    constructor() {
        // this.stopId=null;
    }

    //params: 反复执行的函数，动画持续时间(毫秒)，到达目标位置时回调
    start(callback, duration, complete) {

        duration = duration === undefined ? 400 : duration;
        complete = complete || function () {
            };

        var
            t = 0,//当前起始次数
            interval = 20,//帧间隔
            count = duration / interval,//总次数

            position = 0, // 起始位置
            endPosition = 100,//目标位置
            length = endPosition - position, //要走的总长度

            that = this;

        function run() {
            t++;
            if(t>=count/2){
                t=count/2
            }
            if (t < count) {

                callback(that.easing(null, t, position, length, count) / endPosition);

                that.stopId = requestAnimationFrame(run, interval);
            }
            else {
                // 最后一次

                callback(1);

                that.stopId = undefined;

                complete();
            }
        }

        run();
    }

    // 终止动画
    stop() {
        cancelAnimationFrame(this.stopId);
    }

    // 缓动类型：可进行更换
    easing(x, t, b, c, d) {
        return -c * (t /= d) * (t - 2) + b;
    }
}