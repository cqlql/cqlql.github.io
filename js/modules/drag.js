/**
 * Created by cql on 2017/1/6.
 *
 * 针对pc鼠标事件实现
 *
 * 兼容性：ie9+
 *
 *
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

export default function drag({eDrag, onMove, onDown, onUp}) {
    eDrag.addEventListener('mousedown', down);

    function down(e) {

        if (onDown && onDown(e) === false) return;

        let figure = (new Figure).start(e.pageX, e.pageY);

        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);

        e.preventDefault();

        function mousemove(event) {
            figure.move(event.pageX, event.pageY, function (x, y) {
                onMove({x, y, event});
            });
        }

        function mouseup() {
            if (onUp) onUp();

            //解除所有事件
            document.removeEventListener('mousemove', mousemove);
            document.removeEventListener('mouseup', mouseup);
        }
    }
}


