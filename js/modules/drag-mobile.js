/**
 * Created by cql on 2017/2/24.
 *
 * 针对移动端触摸事件实现
 *
 * 移动情况只针对touches的第一个触摸点做处理
 *
 * 兼容性：ie9+
 *
 * @param onDown 可选。retrun false 可使拖动不触发
 *
 */

// 计算坐标
function Figure() {
    let prevX, prevY;

    this.start = function (x, y) {
        prevX = x;
        prevY = y;

        return this;
    };

    this.move = function (x, y, fn) {

        fn(x - prevX, y - prevY);

        prevX = x;
        prevY = y;
    };
}


export default function dragMobile({eDrag, onMove, onDown, onUp}) {

    let isStart = false;
    let figure;

    eDrag.addEventListener('touchstart', function (e) {
        if (onDown && onDown(e) === false) {
            isStart = false;
            return;
        }

        isStart = true;

        let touche = e.touches[0];

        figure = (new Figure).start(touche.pageX, touche.pageY);

    });

    eDrag.addEventListener('touchmove', function (event) {
        if (isStart === false) return;

        let touche = event.touches[0];

        figure.move(touche.pageX, touche.pageY, function (x, y) {
            onMove({x, y, event});
        });


    });

    eDrag.addEventListener('touchend', function (e) {
        if (isStart === false) return;
        let touches = e.touches;

        if (touches.length === 0) {
            if (onUp) onUp();
        }
        else {
            let touche = e.touches[0];
            figure = (new Figure).start(touche.pageX, touche.pageY);
        }
    });
}


