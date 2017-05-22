/**
 * 左右滑动，唯一加载
 *
 * Created by cql on 2017/4/15.
 *
 *
 *
 * 可配合vue使用
 *
 *
 * 需求：
 * 1. count<=1时，触摸将不触发
 *
 */

import autoPrefix from 'dom/autoprefix';
import Swipe from 'swipe';
import Animation from 'animation';

import {} from 'preloader-mobile.pcss';
import {} from 'slider-one-load.pcss';

let transform = autoPrefix('transform')[1],
    transition = autoPrefix('transition')[1];

class SliderOneLoadBase {

    constructor({
                    eBox,
                    eMove,
                    boxW,

                    // 总项数
                    count=0,
                    // 滑动开始
                    onStart = () => {
                    },
                    // 项改变后回调
                    // 参数：上一项，当前项
                    onChange = (pre, index) => {
                    },
                    // 加载新项情况，有动画则在动画结束后回调。没动画则直接回调
                    onLoad = (index) => {

                    }
                }) {

        let

            // 拖动情况 松开时 是否进行滑动的最大偏移值
            offset = boxW / 3;

        this.eMove = eMove;
        this.isRun = false;
        this.isChange = false;// 是否有改变
        // 方向标识  0 往左  1 原地  2 往右
        this.targetId = 1;
        this.boxW = boxW;
        // 当前拖动的长度
        this.moveLength=0;

        // 公开
        this.count = count;
        this.currIndex = -1;
        this.onChange = onChange;
        this.onLoad = onLoad;

        new Swipe({
            eDrag: eBox,
            swipeLeft: () => {
                this.swipeLeft();
            },
            swipeRight: () => {
                this.swipeRight();
            },
            swipeNot: () => {
                // 未发生，但有移动;

                // 超过一般情况 滑动
                if (Math.abs(this.moveLength) > offset) {

                    if (this.moveLength > 0) {
                        this.swipeRight();
                    }
                    else {
                        this.swipeLeft();
                    }
                }
                else {
                    // 未发生切换
                    swipeNot();
                }
            },
            onDown: (e) => {
                // 阻止拖动触发
                if (this.isRun||this.count<2) return false;
            },
            onStart:(e)=>{
                onStart();
            },
            onMove: (toX) => {
                this.moveLength += toX;
                this.move(this.moveLength - boxW);
            },
            onEnd:()=>{
                this.moveLength = 0;
            }
        });

        let swipeNot = () => {
            this.targetId = 1;
            this.anime();
        };

        // eMove.addEventListener('transitionend', ()=>{ this.animeEnd();});
        // eMove.addEventListener('webkitTransitionEnd', ()=>{ this.animeEnd();});

    }

    move(x) {
        this.eMove.style[transform] = 'translate3d(' + x + 'px,0,0)';
    }

    anime() {

        // 原地不动情况禁止动画
        if(this.targetId===1&&this.moveLength===0){
            return
        }

        this.isRun = true; // 将开启 只有动画结束后才能进行下一步操作
        this.eMove.style[transition] = '0.3s';
        this.move(-this.targetId * this.boxW);

        setTimeout(() => {
            this.animeEnd();
        }, 300);
    }

    animeEnd() {

        this.isRun = false;

        this.eMove.style[transition] = '0s';
        this.move(-this.boxW);

        this.onAnimeEnd();
        if (this.isChange) {
            this.onLoad(this.currIndex);
            this.isChange = false;
        }
    }
    // 执行改变
    change(i) {
        this.isChange = true;
        this.onChange(this.currIndex, i);
        this.currIndex = i;
    }

    //// 公开

    swipeLeft() {
        // 考虑手动调用情况：动画中跳出
        if (this.isRun)return;

        let i = this.currIndex;
        i++;
        if (i >= this.count) {
            i = this.count - 1;
            this.targetId = 1;
        }
        else {
            this.targetId = 2;
            this.change(i);
        }
        this.anime();
    }

    swipeRight() {
        // 考虑手动调用情况：动画中跳出
        if (this.isRun)return;

        let i = this.currIndex;
        i--;
        if (i < 0) {
            i = 0;
            this.targetId = 1;
        }
        else {
            this.targetId = 0;
            this.change(i);
        }
        this.anime();

    }

    onChange(pre, index) {

    }

    onLoad(index) {

    }

    onAnimeEnd() {

    }

    // 直接加载
    load(index) {

        if (index !== this.currIndex) {
            this.change(index);
            this.onLoad(index);
            this.isChange = false;
        }
    }

    reset(count) {

        this.currIndex = -1;
        this.count = count;

    }


    // 动画加载
    animeLoad(index) {

        if (index > currIndex) {
            this.swipeLeft();
        }
        else if (index < currIndex) {
            this.swipeRight();
        }
    }
}

export default class SliderOneLoad extends SliderOneLoadBase {
    constructor({
                    eBox,
                    // 要加载的数据项总数
                    count = 0,
                    onStart=()=>{},
                    onLoad
                }) {
        let

            eMove = eBox.children[0],
            eItems = eMove.children,
            ePreEmptyItem = eItems[0],
            eNextEmptyItem = eItems[2],
            eContItem = eItems[1],

            boxW = eBox.clientWidth;

        super({
            eBox,
            eMove,
            boxW,
            count,
            onStart: () => {

                // 给侧边2项显示 loading
                if (this.currIndex === 0) {
                    ePreEmptyItem.classList.remove('preloader-show');
                    eNextEmptyItem.classList.add('preloader-show');
                }
                else if (this.currIndex === this.count - 1) {
                    ePreEmptyItem.classList.add('preloader-show');
                    eNextEmptyItem.classList.remove('preloader-show');
                }
                else {
                    ePreEmptyItem.classList.add('preloader-show');
                    eNextEmptyItem.classList.add('preloader-show');
                }
                onStart();

            },
            onChange(pre,index){
                eContItem.classList.remove('item-animate-in');
            },
            onLoad: (index) => {
                eContItem.classList.add('preloader-show');

                onLoad(index, () => {
                    eContItem.classList.remove('preloader-show');

                    // 渐变显示当项。推荐使用 Animate.css
                    // this.contAnimation.stop();
                    // this.contAnimation.start((p) => {
                    //     eContItem.style.opacity = 1 * p;
                    // }, 300);
                    eContItem.classList.add('item-animate-in');

                });
            }
        });

        this.contAnimation = new Animation;

    }


    //////  公开


}