/**
 * Created by cql on 2017/3/22.
 *
 * 其实就是 xy方向的实现 清掉 y方向相关代码
 *
 * 之所以不在xy方向实现中考虑单方向，主要避免代码冗余，还有追求最好性能
 *
 *
 *
 */


// import DragExchange from 'drag-exchange';
// import htmlToElems from 'dom/html-to-elems';
import drag, {Figure} from 'drag-base';
import offsetXY from 'dom/offsetxy';
import scopeElements from 'dom/scope-elements';
import htmlToElems from 'dom/html-to-elems';
import ExcuInterval from 'Excu-Interval';

function DragExchange(eBox) {

    /**
     * 范围判断
     *
     * @params {number} x,y
     * @params {number} w,h 此高宽包括 margin
     * @params rowsNum,colsNum;//行列总数
     * @param {object} margin 设置边界。指定项的有效触发范围
     * @return 项索引值，0起始
     *
     *
     * */
    function range({x, y, w, h,colsNum,rowsNum, margin}) {


        let
            // 当前行列
            col = Math.ceil(x / w),
            row = Math.ceil(y / h);

        // 是否超出指定边距
        if (margin) {

            let
                // 相对于当前项的xy
                offsetX = x % w,
                offsetY = y % h;

            if (offsetX < margin.left
                || offsetX > (w - margin.right)
                || offsetY < margin.top
                || offsetY > (h - margin.bottom)) {

                return -1;
            }
        }


        if (col > colsNum || row > rowsNum) {

            return -1;
        }

        return (row - 1) * colsNum + col - 1;
    }

    /**
     * 拖动识别
     *  允许点击的拖动
     *  支持双击选择
     *
     * @param {function} onDown  可通过 return false 阻止拖动触发
     * @param {function} onStart  传入的是 down 事件的event。可通过 return false 阻止拖动触发，onDown 之后的阻止
     * */
    function dragRecognition({
                                 eDrag,
                                 onDown,
                                 onStart,
                                 onMove,
                                 onUp
                             }) {

        let startX, startY,

            downEvent,

            // 是否开始
            isStart = false;


        drag({
            eDrag: eBox,
            onMove(e){

                if (!isStart) {
                    let lenX = e.pageX - startX,
                        lenY = e.pageY - startY;

                    if (Math.abs(lenX) > 2 || Math.abs(lenY) > 2) {
                        isStart = onStart(downEvent) === false ? false : true;
                    }
                }

                if (isStart) {
                    onMove(e);

                }
            },
            onDown(e){
                if (onDown(e) === false) return false;

                isStart = false;

                startX = e.pageX;
                startY = e.pageY;

                downEvent = e;

            },
            onUp(){
                if (isStart) onUp();
            }

        });
    }

    let rowsNum, colsNum;//行列总数



    // rowsNum = 20;
    // colsNum = 20;
    // console.log(range({
    //     x: 104,
    //     y: 10,
    //     w: 100,
    //     h: 40,
    //     colsNum:20,
    //     rowsNum:20,
    //     margin: {
    //         left: 5, right: 5,
    //         top: 5, bottom: 5
    //     }
    // }));


}

let eBox = document.querySelector('.drag-box');
let dragExchange = new DragExchange(eBox);

eBox.addEventListener('click', function (e) {
    if (e.target.classList.contains('del')) {
        dragExchange.delItem(e.target.parentElement.parentElement.dataset.index)
    }
});

add.addEventListener('click', function () {
    dragExchange.addItems(htmlToElems(`
    <div class="drag-item">
        <div class="drag-item-cont">
            <a href="javascript:console.log(\'可点击\');">text11111</a> <a class="del" title="删除" href="javascript:;">X</a>
        </div>        
    </div>
    <div class="drag-item">
        <div class="drag-item-cont">
            <a href="javascript:console.log(\'可点击\');">text222222222222222</a> <a class="del" title="删除" href="javascript:;">X</a>       
        </div>
    </div>`));
});
