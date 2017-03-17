export default class Animation {

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