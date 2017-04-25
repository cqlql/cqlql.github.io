/**
 * Created by cql on 2017/2/24.
 *
 * 左右滑动实现-移动端
 *
 * 待扩张为 上下滑动，目测只要对将 pageX 处理成动态的可指定字符串即可
 *
 * 不支持多点，固定使用touches中的第一个点
 *
 * 增加对手势冲突处理：比如绑定左右滑动情况，支持上下滑动滚动条而不冲突
 *
 */

import dragBase from 'drag-base-mobile';
import SwipeBase from 'swipe-base';
import {debugMsg} from 'msg-mobile';

export default function Swipe
    ({
         eDrag,
         swipeLeft = () => {
         },
         swipeRight = () => {
         },
         swipeNot = () => {
         },
         // 按下即触发
         onDown = () => {
         },
         // 拖动开始
         onStart = () => {
         },
         onMove = () => {
         },
         // 拖动结束
         onEnd = () => {
         }

     }) {

    let swipeBase = new SwipeBase();

    let

        startX,
        startY,

        //
        isStart = false,

        // 滑动手势取消，不会再触发
        isCancel = false;

    dragBase({
        eDrag,
        onMove (e) {
            if (isCancel)return;

            let touche = e.touches[0],
                moveX = touche.pageX, moveY = touche.pageY;

            if (isStart === false) {

                let
                    xlen = moveX - startX,
                    ylen = moveY - startY;

                // 手势相对于x轴 小于 57 度情况滑动才开始。1位弧度值
                // xlen为0，即除数为0，此时是90度，Math.atan是否支持，测试结果 Math.atan(1 / 0)*180/Math.PI => 90 。说明Math.atan支持
                if (Math.abs(Math.atan(ylen / xlen)) < 1) {
                    isStart = true;
                    onStart(e);
                    swipeBase.start(startX);
                }
                else {
                    isCancel = true;
                }
                // 调试，微调弧度值，直到最稳定
                // debugMsg(Math.abs(Math.atan(ylen / xlen)) + ' ' + (Math.abs(Math.atan(ylen / xlen)) < 1.2) + '  ' + isStart);
            }

            if (isStart) {
                onMove(swipeBase.move(moveX));

                e.preventDefault();
            }

        },
        onDown,
        onStart(e){

            if (isCancel)return;

            let touche = e.touches[0];

            startX = touche.pageX;
            startY = touche.pageY;

        },
        onEnd(e){
            if (isStart) {
                swipeBase.end({
                    swipeLeft,
                    swipeRight,
                    swipeNot
                });
                onEnd();
            }
            isCancel = isStart = false;
        }
    });

}
