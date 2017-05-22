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
                    eItems,
                    boxW,

                    // 总项数
                    count = 0,
                    // 滑动开始
                    onStart = () => {
                    },
                    // 项改变后回调
                    // 参数：上一项，当前项
                    onChange = (pre, index) => {
                    },
                    // 加载新项情况，有动画则在动画结束后回调。没动画则直接回调
                    onLoad = (index) => {
                    },
                    onAnimeEnd = (index) => {
                    }
                }) {


        this.eMove = eMove;
        this.eItems = eItems;
        this.eItemPre = null;
        this.eItemMid = null;
        this.eItemNext = null;
        this.itemsSyncIndex = [0, 1, 2];// 项同步索引,数组依次固定对应 左边 中间 右边项，数组值为项的文档索引，可被更换，即左边itemsSyncIndex[0]值可以是1，即对应项2
        this.isRun = false;
        this.isChange = false;// 是否有改变
        this.targetId = 0;// 方向标识  -1 往左  0原地  1 往右
        this.boxW = boxW;
        // 当前拖动的长度
        this.moveLength = 0;

        // 公开
        this.count = count;
        this.currIndex = -1;
        this.onChange = onChange;
        this.onLoad = onLoad;
        this.onAnimeEnd = onAnimeEnd;

        let

            // 拖动情况 松开时 是否进行滑动的最大偏移值
            offset = boxW / 3,

            // 两边情况移动的长度
            sideMoveLen = 0;

        new Swipe({
            eDrag: eBox,
            swipeLeft: () => {
                this._swipeLeft();
            },
            swipeRight: () => {
                this._swipeRight();
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
                if (this.isRun || this.count < 2) return false;
            },
            onStart: (e) => {
                onStart();

                this._swipeStart();
            },
            onMove: (toX) => {

                this.moveLength += toX;

                let moveLen = this.moveLength;

                this.move(moveLen);

                // 两边
                let index=this.currIndex;
                if (index === 0) {
                    if (moveLen > 0) {
                        sideMoveLen += toX * (1 - moveLen / this.boxW) / 2;
                        this.eItemMid.style[transform] = 'translate3d(' + sideMoveLen + 'px,0,0)';
                    }
                    else {
                        this.eItemMid.style[transform] = 'translate3d(0,0,0)';
                    }
                }
                else if(index=== this.count-1){
                    if (moveLen < 0) {
                        sideMoveLen += toX * (1 + moveLen / this.boxW) / 2;
                        this.eItemMid.style[transform] = 'translate3d(' + sideMoveLen + 'px,0,0)';
                    }
                    else {
                        this.eItemMid.style[transform] = 'translate3d(0,0,0)';
                    }
                }

            },
            onEnd: () => {
                sideMoveLen = this.moveLength = 0;
            }
        });

        let swipeNot = () => {
            this.targetId = 0;
            this.anime();
        };

        // eMove.addEventListener('transitionend', ()=>{ this.animeEnd();});
        // eMove.addEventListener('webkitTransitionEnd', ()=>{ this.animeEnd();});

    }

    move(x) {
        this.eItemPre.style[transform] = 'translate3d(' + x + 'px,0,0)';
        this.eItemNext.style[transform] = 'translate3d(' + x + 'px,0,0)';
        // this.eMove.style[transform] = 'translate3d(' + x + 'px,0,0)';
    }

    anime() {

        // 原地不动情况禁止动画
        if (this.targetId === 0 && this.moveLength === 0) {
            return
        }

        this.isRun = true; // 将开启 只有动画结束后才能进行下一步操作
        // this.eMove.style[transition] = '0.3s';
        this.eItemPre.style[transition] = this.eItemMid.style[transition] = this.eItemNext.style[transition] = '0.3s';
        this.move(-this.targetId * this.boxW);
        this.eItemMid.style[transform] = 'translate3d(0,0,0)';

        setTimeout(() => {
            this.animeEnd();
        }, 300);
    }

    animeEnd() {

        this.isRun = false;

        this.eItemPre.style[transition] = this.eItemMid.style[transition] = this.eItemNext.style[transition] = '0s';
        this.move(0);

        let eItems = this.eItems;
        this.itemsSyncIndex.forEach((n, i) => {
            eItems[n].style.left = i * 100 + '%';
        });

        this.onAnimeEnd();
        if (this.isChange) {
            this.isChange = false;
        }
    }

    // 执行改变
    change(i) {

        this.isChange = true;
        this.onChange(this.currIndex, i);

        // 更正同步索引
        let newItemsSyncIndex = [],
            targetId = this.targetId;
        this.itemsSyncIndex.forEach((n, i) => {
            let itemIndex = n + targetId;
            if (itemIndex < 0) {
                itemIndex = 2;
            }
            if (itemIndex > 2) {
                itemIndex = 0;
            }
            newItemsSyncIndex[i] = itemIndex;
        });
        this.itemsSyncIndex = newItemsSyncIndex;

        this.onLoad(i);
        this.currIndex = i;
    }

    _swipeLeft() {
        // 考虑手动调用情况：动画中跳出
        if (this.isRun)return;

        let i = this.currIndex;
        i++;
        if (i >= this.count) {
            i = this.count - 1;
            this.targetId = 0;
        }
        else {
            this.targetId = 1;
            this.change(i);
        }
        this.anime();
    }

    _swipeRight() {
        // 考虑手动调用情况：动画中跳出
        if (this.isRun)return;

        let i = this.currIndex;
        i--;
        if (i < 0) {
            i = 0;
            this.targetId = 0;
        }
        else {
            this.targetId = -1;
            this.change(i);
        }
        this.anime();

    }

    _swipeStart(){
        this.eItemPre = this.eItems[this.itemsSyncIndex[0]];
        this.eItemMid = this.eItems[this.itemsSyncIndex[1]];
        this.eItemNext = this.eItems[this.itemsSyncIndex[2]];

        this.eItemPre.style.zIndex = this.eItemNext.style.zIndex = 1;
        this.eItemMid.style.zIndex = 0;
    }

    //// 公开

    swipeLeft() {
        this._swipeStart();
        this._swipeLeft();
    }

    swipeRight() {
        this._swipeStart();
        this._swipeRight();
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
                    onStart = () => {
                    },
                    onLoad
                }) {
        let

            eMove = eBox.children[0],
            eItems = eMove.children,
            eContItem = eItems[1],

            boxW = eBox.clientWidth;

        super({
            eBox,
            eMove,
            eItems,
            boxW,
            count,
            onStart: () => {

                onStart();

                let ePreEmptyItem = eItems[this.itemsSyncIndex[0]],
                    eNextEmptyItem = eItems[this.itemsSyncIndex[2]];

                // 给侧边2项显示 loading
                if (this.currIndex === 0) {
                    ePreEmptyItem.classList.remove('preloader-show');
                    eNextEmptyItem.classList.add('preloader-show');

                    ePreEmptyItem.classList.add('none');
                }
                else if (this.currIndex === this.count - 1) {
                    ePreEmptyItem.classList.add('preloader-show');
                    eNextEmptyItem.classList.remove('preloader-show');

                    eNextEmptyItem.classList.add('none');
                }
                else {
                    ePreEmptyItem.classList.add('preloader-show');
                    eNextEmptyItem.classList.add('preloader-show');

                    eNextEmptyItem.classList.remove('none');
                    ePreEmptyItem.classList.remove('none');
                }

                eContItem.classList.remove('item-animate-in');
            },
            onChange(pre, index){
                // eContItem.classList.remove('item-animate-in');
            },
            onLoad: (index) => {
                eContItem = eItems[this.itemsSyncIndex[1]];

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
            },
            onAnimeEnd: () => {


            }
        });

        this.contAnimation = new Animation;

    }


    //////  公开


}