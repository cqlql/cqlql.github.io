/**
 * 滑动手势判断算法
 *
 * 虽然代码中使用了X来命名，但不代表只限定X方向，因为只传入一个值，所以传入Y方向的值也就是Y方向了
 *
 * 移动端最稳定方式
 * 还可以用于pc端(根据情况可能要调节敏感度)
 *
 */


export default function Swipe() {

    let prevX, toX;
    let preTime;
    let track = [];
    let i = 0;

    this.start = function (x) {
        prevX = x;
        preTime = Date.now();
        // console.clear();
        i = 0;
    };

    this.move = function (x) {
        toX = x - prevX;
        prevX = x;

        let now = Date.now();

        track[i] = [toX, now - preTime];
        // console.log('move', track[i]);
        preTime = now;

        i++;

        return toX;

    };

    this.end = function (cb) {
        if (i) {
            let now = Date.now();

            track[i] = [toX, now - preTime];
            // console.log('end', track[i]);
            i++;

            let to = 0;
            let time = 0;
            let count = i;
            while (i--) {
                to += track[i][0];
                time += track[i][1];

                // 4 次将调出
                if (count - i >= 4) {
                    break;
                }
            }

            /// 敏感判断-新。新的判断方式将支持pc鼠标
            let r = to / time;

            cb(r)

        }
        else {
            // 模拟了click事件
        }
    };
}

