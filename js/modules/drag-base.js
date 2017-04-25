/**
 * Created by cql on 2017/1/6.
 */


// 计算坐标
// 点与点相加
export function Figure() {
    this.start=function (x, y) {
        this.prevX = x;
        this.prevY = y;
    };

    this.move=function (x, y, fn) {
        fn(x - this.prevX, y - this.prevY);

        this.prevX = x;
        this.prevY = y;
    };
}


/**
 * 更基础的拖动
 *
 * 针对pc鼠标事件实现
 *
 * 兼容性：ie9+
 *
 *
 *
 * @param onDown 可通过 return false 阻止拖动发送
 *
 */
export default function drag({eDrag, onMove, onDown=()=>{}, onUp=()=>{}}) {
    eDrag.addEventListener('mousedown', down);

    function down(e) {

        if (onDown(e) === false) return;

        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);

        function mousemove(e) {
            onMove(e);
        }

        function mouseup() {
            onUp();

            //解除所有事件
            document.removeEventListener('mousemove', mousemove);
            document.removeEventListener('mouseup', mouseup);
        }
    }
}

