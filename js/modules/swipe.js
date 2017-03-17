/**
 * Created by cql on 2017/2/24.
 *
 * 左右滑动实现-移动端
 *
 * 不支持多点，固定使用touches中的第一个点
 *
 */

import dragBase from 'drag-base-mobile';
import SwipeBase from 'swipe-base';

export default function Swipe
    ({
        eDrag,
        swipeLeft = () => {
        },
        swipeRight = () => {
        },
        swipeNot = () => {
        },
        onDown=()=>{},
        onStart=()=>{},
        onMove = () => {
        },
        onChange = () => {
        }

    }) {

    let swipeBase = new SwipeBase();

    dragBase({
        eDrag,
        onMove (e) {
            let touche = e.touches[0];
            onMove(swipeBase.move(touche.pageX));
        },
        onDown,
        onStart(e){
            onStart();

            let touche = e.touches[0];
            swipeBase.start(touche.pageX);
        },
        onUp(){
            swipeBase.end({
                swipeLeft,
                swipeRight,
                swipeNot
            });
        }
    });

}
