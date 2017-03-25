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

import dargBase, {Figure} from 'drag-base';

let figure = new Figure;

export default function drag({
                                 eDrag, onMove, onDown = () => {
                                 }, onUp = () => {
                                 }
                             }) {

    dargBase({
        eDrag,
        onMove(event){
            figure.move(event.pageX, event.pageY, function (x, y) {
                onMove({x, y, event});
            });
        },
        onDown(e){

            if (onDown() === false)return false;

            figure.start(e.pageX, e.pageY);

        },
        onUp
    })
}
