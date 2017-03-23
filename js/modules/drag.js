/**
 * Created by cql on 2017/1/6.
 *
 *
 *
 * 针对pc鼠标事件实现
 *
 * 此处使用了点点相加处理，如需更加灵活，请使用drag-base
 *
 * 兼容性：ie9+
 *
 *
 *
 *
 *
 */

import dargBase from 'drag-base';

// 计算坐标
// 点与点相加
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

let figure = new Figure;

export default function drag({eDrag, onMove, onDown=()=>{}, onUp=()=>{}}) {

    dargBase({
        eDrag,
        onMove(event){
            figure.move(event.pageX, event.pageY, function (x, y) {
                onMove({x, y, event});
            });
        },
        onDown(e){

            if(onDown()===false)return false;

            figure.start(e.pageX, e.pageY);

        },
        onUp
    })
}
