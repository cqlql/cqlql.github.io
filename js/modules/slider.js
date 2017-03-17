/**
 * Created by cql on 2017/3/2.
 */

 import autoPrefix from 'autoprefix';
import Swipe from 'swipe';

/**
 * 滑动一般常用
 *
 * @param [index] 当前显示项索引。默认0
 * @param [complete] 成功切换，并且动画完成后调用
 *
 */
export default function Slider({
    eBox,
    eMove = eBox.children[0],
    count = eMove.children.length,
    boxW = eBox.clientWidth,
    index = 0,
    change = () => {
    },
    complete = () => {
    }

}) {

    let
        transform = autoPrefix('transform')[1],
        transition = autoPrefix('transition')[1],

        // 拖动的长度
        moveLength = 0,

        // 拖动情况 松开时 是否进行滑动的最大偏移值
        offset = boxW / 3,

        isRun = false,// 是否动画进行中

        isChange = false;//是否有更改



    let swipe = new Swipe({
        eDrag: eBox,
        swipeLeft,
        swipeRight,
        swipeNot,
        onDown(e){
            // 阻止拖动触发
            if (isRun) return false;
        },
        onStart(){
            // time.stop();
            isChange = false;
            moveLength = 0;
            eMove.style[transition] = '0s';
        },
        onMove(toX){
            moveLength += toX;
            eMove.style[transform] = 'translate3d(' + ((-index * boxW) + moveLength ) + 'px,0,0)';
        }
    });

    // eBox.addEventListener("webkitTransitionEnd", transitionend);
    // eBox.addEventListener("transitionend", transitionend);

    // 开启定时器
    // time();

    this.setIndex=function (i) {
        index=i;
    };

    function swipeLeft() {

        let i = index;
        i++;
        if (i >= count) {
            i = count - 1;
        }
        else {
            pChange(i);
        }
        anime();
    }

    function swipeRight() {

        let i = index;
        i--;
        if (i < 0) {
            i = 0;
        }
        else {
            pChange(i);
        }
        anime();

    }

    function swipeNot() {
        // 未发生，但有移动;

        // 超过一般情况 滑动
        if (Math.abs(moveLength) > offset) {

            if (moveLength > 0) {
                swipeRight();
            }
            else {
                swipeLeft();
            }
        }
        else {
            // 复位
            reset();
        }
    }

    function reset() {
        anime();
    }

    function pChange(i) {
        isChange = true;
        change(index, i);
        index = i;
    }

    function anime() {
        isRun = true; // 将开启 只有动画结束后才能进行下一步操作
        eMove.style[transition] = '0.3s';
        eMove.style[transform] = 'translate3d(' + (-index * boxW) + 'px,0,0)';

        setTimeout(transitionend, 300);
    }

    function transitionend() {
        isRun = false;

        if (isChange) complete();
    }

    // 定时器
    function time() {
        let stopId;

        time = function () {
            stop();
            stopId = setTimeout(function () {
                swipeLeft();
                time();
            }, 1000);
        };

        time.stop = stop;

        time();

        function stop() {
            clearTimeout(stopId);
        }

        function swipeLeft() {
            var i = index;
            i++;
            if (i >= count) {
                i = 0;
            }
            pChange(i);
            anime();
        }

    }
}

