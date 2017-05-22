/**
 * 时间处理，时间执行处理
 *
 * Created by cql on 2017/4/30.
 */


import ExcuDelay from 'excu-delay';

/**
 * 时间格式美化1
 *
 * 未来：2018/1/17 20:33
 * 过去某年：2015/1/17 20:33
 * 今年：1/17 20:33
 * 本周：周一 12：30
 * 昨天：昨天 12：30
 * 今天：12：30
 *
 * @param time 2017-04-12 16:58:11
 * */
export function timeBeautifyS1(time) {
    let t,
        n, nday,
        timeCont = '';

    t = new Date(time);
    n = new Date;
    nday = n.getDay();

    if (nday === 0) nday = 7;

    // 目前只处理2位
    let fill = (number) => {

        if (number < 10) {

            return '0' + number;
        }
        return number;
    };

    let getYYMMDD = (d) => {

        return d.getFullYear() + fill(d.getMonth()) + fill(d.getDate());
    };

    let getmmss = () => {
        return time.replace(/^[^\s]+|[\d\d]/, '');
    };

    let dif = getYYMMDD(n) - getYYMMDD(t);


    if (dif < 0) {
        // 未来某天
        timeCont = t.getFullYear() + '/' + (t.getMonth() + 1) + '/' + t.getDate() + getmmss();
    }
    else if (dif === 0) {
        // 今天
        timeCont = getmmss();
    }
    else if (dif === 1) {
        // 昨天
        timeCont = '昨天' + getmmss();
    }
    else if (dif < nday) {
        // 本周
        timeCont = '周' + ['', '一', '二', '三', '四', '五', '六', '末'][nday - dif] + getmmss();
    }
    else {
        let
            tY = t.getFullYear(),
            difY = n.getFullYear() - tY,
            yy = '';

        if (difY !== 0) {
            // 非今年
            yy = tY + '/'
        }

        timeCont = yy + (t.getMonth() + 1) + '/' + t.getDate() + getmmss();
    }

    return timeCont;
}


/**
 * 定时器*/
export class Timer {


    constructor({
                    callBack,
                    time = 3000
                }) {


        this.time = time;
        this.callBack = callBack;
        this.stopId = null;
    }


    // 停止情况调用无效
    start() {
        this.stop();

        let loop = () => {
            this.stopId = setTimeout( ()=> {
                this.callBack();
                loop();
            }, this.time);
        };

        loop();
    }

    stop() {
        clearTimeout(this.stopId);
    }


}


/**
 * 阻止频率执行。立即执行，并且保证执行一次
 * 先执行触发，后重复执行将不触发，除非时间到，或者手动终止计时
 * */
export function ExcuOne() {
    let timeId = null;

    this.excu=function (callBack,time) {

        if(timeId===null){
            callBack();
        }

        timeId  = setTimeout(function () {
            timeId = null;
        }, time || 200);
    };


    this.clear = function () {
        timeId = null;
    };
}


export {
    ExcuDelay
};