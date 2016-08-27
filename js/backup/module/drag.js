/**
 * Created by SD01 on 2016/6/17.
 */

function drag(eDrag, onMove, onDown, onUp) {
    var isIE678 = !-[1,];

    eDrag.addEventListener('mousedown', down);

    function down(e) {

        if (onDown(e) === false) return;

        //IE678 执行捕捉 来 避免 图片文字等默认选择事件
        if (isIE678) eDrag.setCapture();

        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);

        if (e.cancelable) e.preventDefault();
        return false;

        function mousemove(moveEvent) {
            onMove({x: moveEvent.pageX - e.pageX, y: moveEvent.pageY - e.pageY, event: moveEvent});
        }

        function mouseup() {
            if (onUp) onUp();

            if (isIE678) eDrag.releaseCapture();

            //解除所有事件
            document.removeEventListener('mousemove', mousemove);
            document.removeEventListener('mouseup', mouseup);
        }
    }

}

module.exports = drag;
