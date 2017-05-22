/**
 * Created by cql on 2017/4/30.
 */

import autoPrefix from 'dom/autoprefix';
import Swipe from 'swipe';
import {Timer} from 'time-handle';

import {} from 'banner-mobile.pcss';

let
    transform = autoPrefix('transform')[1],
    transition = autoPrefix('transition')[1];

/**
 * 无掉头
 * */
export default class Banner {


    constructor({
                    eBox,
                    // 切换后，并且动画完成后回调
                    onComplete = function () {
                    },
                    // 加载图片
                    onLoadImg=function (eItem) {
                        // 按需加载
                        if (!eItem._data_isComplete) {
                            let img = eItem.children[0],
                                imgUrl = img.dataset.src;
                            if (imgUrl) img.src = imgUrl;
                            eItem._data_isComplete = 1;
                        }
                    }
                }) {

        let

            currFakeIndex = 0,

            timer = new Timer({
                // time:1000,
                callBack(){
                    swipeLeft();
                }
            }),

            eMove = eBox.children[0],
            eItems = eMove.children,
            count = eItems.length,
            fakeCount = count + 2,
            boxW = eBox.clientWidth,

            eBtnBox = eBox.children[1],
            eBtns = eBtnBox.children,
            btnHtml = '';


        // 头尾增加 li，不掉头 html实现
        eMove.innerHTML = eItems[count - 1].outerHTML + eMove.innerHTML + eItems[0].outerHTML;

        for (let i = 0; i < fakeCount; i++) {
            // 初始化项的位置
            eItems[i].style[transform] = 'translateX(' + (i * 100) + '%)';

            // 拼接按钮
            if (i < count) btnHtml += '<li' + (i ? '' : ' class="active"') + '></li>';
        }
        eBtnBox.innerHTML = btnHtml;

        directLoad(1);

        // 拖动的长度
        let moveLength = 0,

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
                timer.stop();
            },
            onMove(toX){
                moveLength += toX;
                eMove.style[transform] = 'translate3d(' + ((-currFakeIndex * boxW) + moveLength ) + 'px,0,0)';
            },
            onEnd(){
                timer.start();
            }
        });

        // eBox.addEventListener("webkitTransitionEnd", transitionend);
        // eBox.addEventListener("transitionend", transitionend);

        // 开启定时器
        timer.start();

        function swipeLeft() {

            let i = currFakeIndex;
            i++;

            change(i);
            anime();
        }

        function swipeRight() {

            let i = currFakeIndex;
            i--;

            change(i);

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

        function change(i) {
            isChange = true;

            changeBtn(i);
            loadImg(i);

            currFakeIndex = i;
        }

        /// 加载图片
        function loadImg(i) {

            // let eItem = eItems[i];
            // // 按需加载
            // if (!eItem._data_isComplete) {
            //     let img = eItem.children[0],
            //         imgUrl = img.dataset.src;
            //     if (imgUrl) img.src = imgUrl;
            //     eItem._data_isComplete = 1;
            // }

            onLoadImg(eItems[i]);
        }

        function changeBtn(i) {
            eBtns[getRealIndex(currFakeIndex)].classList.remove('active');
            eBtns[getRealIndex(i)].classList.add('active');
        }

        // 直接加载切换，不动画，不触发change。初始时可用
        function directLoad(i) {
            changeBtn(i);
            loadImg(i);
            move(-i * boxW);
            currFakeIndex = i;
        }

        // 真实索引
        function getRealIndex(fakeIndex) {
            if (fakeIndex > fakeCount - 2) {
                // 第一个情况

                return 0;
            }
            if (fakeIndex === 0) {
                // 最后一个情况
                return count - 1;
            }

            return fakeIndex - 1;

        }


        function anime() {
            isRun = true; // 将开启 只有动画结束后才能进行下一步操作
            eMove.style[transition] = '0.3s';
            eMove.style[transform] = 'translate3d(' + (-currFakeIndex * boxW) + 'px,0,0)';

            setTimeout(transitionend, 300);
        }

        function move(x) {
            eMove.style[transform] = 'translate3d(' + x + 'px,0,0)';
        }

        function transitionend() {
            isRun = false;
            moveLength = 0;
            eMove.style[transition] = '0s';

            if (isChange) {

                let i = currFakeIndex;

                if (currFakeIndex > count) {
                    // 第一个情况
                    loadImg(1);
                    move(-boxW);
                    currFakeIndex = 1;
                }
                else if (currFakeIndex === 0) {
                    // 最后一个情况
                    loadImg(count);
                    move(-boxW * count);
                    currFakeIndex = count;
                }

                onComplete();

                isChange = false;
            }


        }
    }
}