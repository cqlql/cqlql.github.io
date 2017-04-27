/**
 * 触摸放大
 *
 * Created by cql on 2017/4/17.
 */

import {imgSizeComplete} from 'dom/img-handle'
import autoPrefix from 'dom/autoprefix'
import htmlToElems from 'dom/html-to-elems'
import toFragment from 'dom/to-fragment'
import click from 'dom/click'
import {offsetXY} from 'dom-handle'
import {debugMsg} from 'msg-mobile'


let transform = autoPrefix('transform')[1];

/**
 * 触摸放大基础
 *
 * */
export class ZoomTouch {

    constructor({eBox, onZoom} = {}) {

        this.eBox = eBox;
        // this.eImg=eImg;
        if (onZoom) this.onZoom = onZoom;
        this.imgWidth = this.imgHeight = 0;// 图片原始高宽
        this.boxX = this.boxY = 0;// 容器相对于页面内容坐标。在zoomTouchInit 中被初始

        ///// 公开
        this.currW = this.currH = 0;// 当前图片高宽。核心实现是通过比例得到 高宽的，所以有比例就有高宽。此为被动字段
        this.currY = this.currX = 0;// 当前坐标
        this.currScale = 1;// 当前放大比例
        // 点击手势情况出发
        this.minScale = 0.5;// 最小比例
        this.maxScale = 10;// 最大比例
        // 点击手势情况出发
        this.onClick = () => {
        };

    }

    zoomTouchInit() {
        this.zoomTouchInit = () => {
        };// 清理，保证只会执行一次

        // 实现核心，双点坐标
        // 获取的是相对于浏览器内容窗口。如果是以偏离浏览器窗口的div为窗口实现效果，且有滚动条情况下，centerXY需加上div滚动条卷去距离
        function getDoubleToucheXY(touche1, touche2) {

            let
                xLen, yLen, centerX, centerY;

            xLen = Math.abs(touche1.pageX - touche2.pageX);
            yLen = Math.abs(touche1.pageY - touche2.pageY);

            if (touche1.pageX < touche2.pageX) {
                centerX = touche1.pageX + xLen / 2;
            } else {
                centerX = touche2.pageX + xLen / 2;
            }

            if (touche1.pageY < touche2.pageY) {
                centerY = touche1.pageY + yLen / 2;
            } else {
                centerY = touche2.pageY + yLen / 2;
            }

            return {
                centerX: centerX,
                centerY: centerY,

                // 两点连线长度
                diameter: Math.sqrt(Math.pow(xLen, 2) + Math.pow(yLen, 2))
            }
        }

        let zoomStart = (t1, t2) => {
            preX = this.currX;
            preY = this.currY;
            preScale = this.currScale;

            startDataXY = getDoubleToucheXY(t1, t2);
        };
        let zoomMove = (t1, t2) => {

            let moveDateXY = getDoubleToucheXY(t1, t2);

            let
                centerX = moveDateXY.centerX,
                centerY = moveDateXY.centerY,
                moveX = moveDateXY.centerX - startDataXY.centerX,
                moveY = moveDateXY.centerY - startDataXY.centerY,
                scale = moveDateXY.diameter / startDataXY.diameter;

            let toX, toY, toW, toH, toScale;

            // 算比例
            this.currScale = toScale = preScale * scale;

            // 限制比例
            if (toScale < this.minScale) {
                this.currScale = toScale = this.minScale;
                scale = toScale / preScale;
            }
            else if (toScale > this.maxScale) {
                this.currScale = toScale = this.maxScale;
                scale = toScale / preScale;
            }

            // 算高宽
            this.currW = toW = this.imgWidth * toScale;
            this.currH = toH = this.imgHeight * toScale;

            /// 算 x y
            // 中心点相对于图片坐标
            let offsetX = centerX - preX - this.boxX,
                offsetY = centerY - preY - this.boxY;
            // 中心点相对于图片坐标比例
            let offsetXS = offsetX / toW,
                offsetYS = offsetY / toH;
            // 缩放了多少长度
            let zoomW = toW * (1 - scale),
                zoomH = toH * (1 - scale);
            //
            this.currX = toX = offsetXS * zoomW + moveX * scale + preX;
            this.currY = toY = offsetYS * zoomH + moveY * scale + preY;

            this.onZoom(toX, toY, toW, toH, toScale);

        };
        let zoomEnd = () => {
        };


        // 单点移动 事件处理
        let singleStart = (touche) => {
            preX = this.currX;
            preY = this.currY;

            startX = touche.pageX;
            startY = touche.pageY;
        };
        let singleMove = (touche) => {

            let moveX = touche.pageX, moveY = touche.pageY;

            let toX, toY;

            this.currX = toX = moveX - startX + preX;
            this.currY = toY = moveY - startY + preY;

            this.onZoom(toX, toY, this.currW, this.currH, this.currScale);
        };
        let singleEnd = () => {
        };

        let startDataXY // 临时记录 多点记录开始坐标参数
            , startX, startY // 临时记录 单点记录开始坐标


            , preX, preY, preScale// 临时记录


            , isStart = 0 // 双点放大开始
            , isSingleStart = 0 // 单点拖动开始

            // 是否是点击
            , isClick = false
        ;

        this.eBox.addEventListener('touchstart', function (e) {
            let touches = e.touches,
                len = touches.length;

            if (len === 2) {
                isStart = 1;
                zoomStart(touches[0], touches[1]);
                e.preventDefault();

                isClick = false;
            }
            else {
                if (isStart) {
                    isStart = 0;
                    zoomEnd();
                }

                // 处理单点移动逻辑。2点以上也当单点处理
                isSingleStart = 1;
                singleStart(touches[0]);

                if (len === 1) {
                    isClick = true;
                }

                e.preventDefault();
            }


        });

        this.eBox.addEventListener('touchmove', function (e) {
            let touches = e.touches;
            if (isStart) {
                zoomMove(touches[0], touches[1]);
                e.preventDefault();
            }
            // 处理单点
            else if (isSingleStart) {
                singleMove(touches[0]);
            }

            // 有移动情况 判断不是点击事件。android 由于 preventDefault 原因，造成move误差大，需要移动的长度来精确
            if (isClick) {
                if (Math.abs(touches[0].pageX - startX > 1) || Math.abs(touches[0].pageY - startY > 1)) {
                    isClick = false;
                }
            }
        });

        this.eBox.addEventListener('touchend', (e) => {
            let touches = e.touches,
                len = touches.length;


            if (len === 2) {
                isStart = 1;
                zoomStart(touches[0], touches[1]);
            }
            else {
                if (isStart) {
                    isStart = 0;
                    zoomEnd();
                }

                // 处理单点
                if (len) {
                    isSingleStart = 1;
                    singleStart(touches[0]);
                }
                else {
                    if (isSingleStart) {
                        isSingleStart = 0;
                        singleEnd();
                    }

                    // 点击手势
                    if (isClick) {
                        this.onClick();
                    }
                }
            }
        });
    }

    // 容器高宽改变
    // 可以不给值，不给值将主动获取容器高宽。如此设计是为了利用现有高宽，节约效率
    sizeChange(w, h) {


    }

    // 放大开始，传入图片原始尺寸
    zoomInit(w, h) {
        this.zoomTouchInit();
        this.imgWidth = w;
        this.imgHeight = h;

        this.currW = w * this.currScale;
        this.currH = h * this.currScale;

        this.rexyBox();
    }

    rexyBox() {
        let boxXY = offsetXY(this.eBox);
        this.boxX = boxXY.left;
        this.boxY = boxXY.top;
    }

}

/**
 * 触摸放大基础。带旋转，待完善，核心已完成
 *
 * */
export class ZoomRotateTouch {

    constructor({eBox, onZoom} = {}) {

        this.eBox = eBox;
        // this.eImg=eImg;
        if (onZoom) this.onZoom = onZoom;
        this.imgWidth = this.imgHeight = 0;// 图片原始高宽
        this.boxX = this.boxY = 0;// 容器相对于页面内容坐标。在zoomTouchInit 中被初始

        ///// 公开
        this.currW = this.currH = 0;// 当前图片高宽。核心实现是通过比例得到 高宽的，所以有比例就有高宽。此为被动字段
        this.currY = this.currX = 0;// 当前坐标
        this.currScale = 1;// 当前放大比例
        // 点击手势情况出发
        this.currRadian = 0;// 当前角度
        // 点击手势情况出发
        this.currOriginX=this.currOriginY=0.5;//双点中心点相对于图片坐标比例
        this.minScale = 0.5;// 最小比例
        this.maxScale = 10;// 最大比例
        // 点击手势情况出发
        this.onClick = () => {
        };

        this.currRealX=this.currRealY=0;
    }

    zoomTouchInit() {
        this.zoomTouchInit = () => {
        };// 清理，保证只会执行一次

        // 实现核心，双点坐标
        // 获取的是相对于浏览器内容窗口。如果是以偏离浏览器窗口的div为窗口实现效果，且有滚动条情况下，centerXY需加上div滚动条卷去距离
        function getDoubleToucheXY(touche1, touche2) {
            let
                xLen, yLen, xLenPlus, yLenPlus, centerX, centerY;

            xLen = touche1.pageX - touche2.pageX;
            yLen = touche1.pageY - touche2.pageY;

            xLenPlus = Math.abs(xLen);
            yLenPlus = Math.abs(yLen);

            if (touche1.pageX < touche2.pageX) {
                centerX = touche1.pageX + xLenPlus / 2;
            } else {
                centerX = touche2.pageX + xLenPlus / 2;
            }

            if (touche1.pageY < touche2.pageY) {
                centerY = touche1.pageY + yLenPlus / 2;
            } else {
                centerY = touche2.pageY + yLenPlus / 2;
            }

            // 弧度计算
            let
                pi=Math.PI,
                radian = Math.atan(yLenPlus / xLenPlus);

            if (yLen < 0) {

                if (xLen > 0) {
                    radian = pi*2- Math.abs(radian);
                }
                else{
                    radian = pi + Math.abs(radian);
                }
            }
            else {
                if (xLen < 0) {
                    radian = pi- Math.abs(radian);
                }
            }

            return {
                centerX: centerX,
                centerY: centerY,
                radian:radian,
                // 两点连线长度
                diameter: Math.sqrt(Math.pow(xLenPlus, 2) + Math.pow(yLenPlus, 2))
            }
        }

        let currRealX,currRealY;
        let zoomStart = (t1, t2) => {
            preX = this.currX;
            preY = this.currY;
            preScale = this.currScale;
            preRadian = this.currRadian;

            preRealX = this.currRealX;
            preRealY = this.currRealY;

            startDataXY = getDoubleToucheXY(t1, t2);
        };
        let zoomMove = (t1, t2) => {
            let moveDateXY = getDoubleToucheXY(t1, t2);

            let
                centerX = moveDateXY.centerX,
                centerY = moveDateXY.centerY,
                moveX = moveDateXY.centerX - startDataXY.centerX,
                moveY = moveDateXY.centerY - startDataXY.centerY,
                scale = moveDateXY.diameter / startDataXY.diameter,
                radian=moveDateXY.radian - startDataXY.radian;

            let toX, toY, toW, toH, toScale,toRadian,toOriginX,toOriginY;

            // 算比例
            this.currScale = toScale = preScale * scale;

            // 限制比例
            if (toScale < this.minScale) {
                this.currScale = toScale = this.minScale;
                scale = toScale / preScale;
            }
            else if (toScale > this.maxScale) {
                this.currScale = toScale = this.maxScale;
                scale = toScale / preScale;
            }

            // 算角度
            this.currRadian = toRadian = radian + preRadian;

            // 算高宽
            this.currW = toW = this.imgWidth * toScale;
            this.currH = toH = this.imgHeight * toScale;

            /// 算 x y
            // 中心点相对于图片坐标
            let offsetX = centerX - preX - this.boxX,
                offsetY = centerY - preY - this.boxY;
            // 中心点相对于图片坐标比例
            let offsetXS = offsetX / toW,
                offsetYS = offsetY / toH;
            // 缩放了多少长度
            let zoomW = toW * (1 - scale),
                zoomH = toH * (1 - scale);
            //
            this.currX = toX = offsetXS * zoomW + moveX * scale + preX;
            this.currY = toY = offsetYS * zoomH + moveY * scale + preY;

            /// 算当前相对于图片坐标比例
            this.currOriginX=toOriginX=(centerX - toX - this.boxX)/toW;
            this.currOriginY=toOriginY=(centerY - toY - this.boxY)/toH;

            this.onZoom(toX, toY, toW, toH, toScale, toRadian,toOriginX,toOriginY);
            // this.onZoom(toX, toY, toW, toH, toScale, toRadian,centerX,centerY);
            // this.onZoom(toX, toY, toW, toH, toScale, toRadian);

        };
        let zoomEnd = () => {
        };


        // 单点移动 事件处理
        let singleStart = (touche) => {
            preX = this.currX;
            preY = this.currY;

            startX = touche.pageX;
            startY = touche.pageY;
        };
        let singleMove = (touche) => {

            let moveX = touche.pageX, moveY = touche.pageY;

            let toX, toY;

            this.currX = toX = moveX - startX + preX;
            this.currY = toY = moveY - startY + preY;

            this.onZoom(toX, toY, this.currW, this.currH, this.currScale, this.currRadian, this.currOriginX,this.currOriginY);
        };
        let singleEnd = () => {
        };

        let startDataXY // 临时记录 多点记录开始坐标参数
            , startX, startY // 临时记录 单点记录开始坐标


            , preX, preY, preScale,preRadian// 临时记录
            ,preRealX,preRealY


            , isStart = 0 // 双点放大开始
            , isSingleStart = 0 // 单点拖动开始

            // 是否是点击
            , isClick = false
        ;

        this.eBox.addEventListener('touchstart', function (e) {
            let touches = e.touches,
                len = touches.length;

            if (len === 2) {
                isStart = 1;
                zoomStart(touches[0], touches[1]);
                e.preventDefault();

                isClick = false;
            }
            else {
                if (isStart) {
                    isStart = 0;
                    zoomEnd();
                }

                // 处理单点移动逻辑。2点以上也当单点处理
                isSingleStart = 1;
                singleStart(touches[0]);

                if (len === 1) {
                    isClick = true;
                }

                e.preventDefault();
            }


        });

        this.eBox.addEventListener('touchmove', function (e) {
            let touches = e.touches;

            if (isStart) {
                zoomMove(touches[0], touches[1]);
                e.preventDefault();
            }
            // 处理单点
            else if (isSingleStart) {
                singleMove(touches[0]);
            }

            // 有移动情况 判断不是点击事件。android 由于 preventDefault 原因，造成move误差大，需要移动的长度来精确
            if (isClick) {
                if (Math.abs(touches[0].pageX - startX > 1) || Math.abs(touches[0].pageY - startY > 1)) {
                    isClick = false;
                }
            }
        });

        this.eBox.addEventListener('touchend', (e) => {
            let touches = e.touches,
                len = touches.length;


            if (len === 2) {
                isStart = 1;
                zoomStart(touches[0], touches[1]);
            }
            else {
                if (isStart) {
                    isStart = 0;
                    zoomEnd();
                }

                // 处理单点
                if (len) {
                    isSingleStart = 1;
                    singleStart(touches[0]);
                }
                else {
                    if (isSingleStart) {
                        isSingleStart = 0;
                        singleEnd();
                    }

                    // 点击手势
                    if (isClick) {
                        this.onClick();
                    }
                }
            }
        });
    }

    // 容器高宽改变
    // 可以不给值，不给值将主动获取容器高宽。如此设计是为了利用现有高宽，节约效率
    sizeChange(w, h) {


    }

    // 放大开始，传入图片原始尺寸
    zoomInit(w, h) {
        this.zoomTouchInit();
        this.imgWidth = w;
        this.imgHeight = h;

        this.currW = w * this.currScale;
        this.currH = h * this.currScale;

        this.rexyBox();
    }

    rexyBox() {
        let boxXY = offsetXY(this.eBox);
        this.boxX = boxXY.left;
        this.boxY = boxXY.top;
    }

}

/**
 * 放大看图
 *
 *
 *
 * */
export class PictureZoom extends ZoomTouch {
    constructor({eBox} = {}) {
        super({
            // 容器。事件范围
            eBox,

            // 放大回调，只要坐标尺寸改变就将调用
            // onZoom: (x, y, w, h, scale) => {
            //     this.zoom(x, y, w, h, scale);
            // }
        });

        this.boxW = this.boxH = 0;// 容器高宽
    }

    PictureZoomInit() {
        this.PictureZoomInit = () => {
        };// 清理，保证只会执行一次

        let childs = htmlToElems(`<img/>`);

        this.eImg = childs[0];
        this.eBox.appendChild(toFragment(childs));
    }


    // 更新容器尺寸坐标
    // 1、初始情况调用  2、当容器尺寸发生改变后调用
    resizeBox() {
        this.boxW = this.eBox.clientWidth;
        this.boxH = this.eBox.clientHeight;
    }

    // 放大执行
    onZoom(x, y, w, h, scale) {

        /// 限制。高宽限制已经通过最小比例控制，只需处理坐标限制
        // 坐标限制
        let minX = this.boxW - w,
            minY = this.boxH - h;
        if (x > 0) this.currX = x = 0;
        else if (x < minX) this.currX = x = minX;
        if (y > 0) this.currY = y = 0;
        else if (y < minY) this.currY = y = minY;
        // 居中情况
        if (w < this.boxW) {
            this.currX = x = (this.boxW - w) / 2
        }
        if (h < this.boxH) {
            this.currY = y = (this.boxH - h) / 2
        }

        // 使用 scale 自动中心偏移坐标
        let otherX = this.imgWidth / 2 * (scale - 1),
            otherY = this.imgHeight / 2 * (scale - 1);

        x = x + otherX;
        y = y + otherY;

        this.eImg.style[transform] = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ', ' + scale + ')';

    }

    ///// 公开


    // 更新容器尺寸坐标，更新选择框，更新 放大元素位置
    // 当容器尺寸改变时可直接调用
    resize() {
        this.resizeBox();

        this.toDefault();
    }

    // 只是单纯设置比例
    setScaleRestrict(min, max) {
        if (min !== undefined) {
            this.minScale = min;
        }
        if (max !== undefined) {
            this.maxScale = max;
        }
    }

    // 图片完整显示居中
    toFullCenter() {
        let boxRatio = this.boxW / this.boxH;
        let imgRatio = this.imgWidth / this.imgHeight;

        let x, y, w, h, scale;
        if (boxRatio > imgRatio) {
            this.currW = h = this.boxH;
            this.currH = w = h * imgRatio;
            this.currScale = scale = h / this.imgHeight;

        }
        else {
            this.currW = w = this.boxW;
            this.currH = h = w / imgRatio;
            this.currScale = scale = w / this.imgWidth;

        }
        console.log(this.onZoom);
        this.onZoom(0, 0, w, h, scale);

    }

    // 默认位置。数据生效。回到当前坐标尺寸数据
    // 当 图片换 或者 容器尺寸改变后可调用
    // 可反复调用
    toDefault() {
        this.onZoom(this.currX, this.currY, this.currW, this.currH, this.currScale);
    }

    // 初始或者更换图片，可以设置最大最小比例
    // 必须第一次执行
    initImg(src, min, max) {

        imgSizeComplete(src, (img) => {
            this.PictureZoomInit();
            this.eImg.src = src;
            this.zoomInit(img.width, img.height);
            this.resizeBox();
            this.setScaleRestrict(min, max);
            this.toFullCenter();
            // this.toDefault();
        }, () => {

        });
    }

}

/**
 * 放大看图弹窗*/
class PictureZoomPopup extends PictureZoom {
    constructor() {
        super();
    }

    // show 执行时才执行，只执行一次
    pictureZoomPopupInit() {
        // 清空。保证只执行一次
        this.pictureZoomPopupInit = function () {
        };

        this.eBox = htmlToElems(`<div class="picture-zoom picture-zoom-popup"></div>`)[0];

        // 点击关窗
        this.onClick = () => {
            this.eBox.classList.remove('show');
        };

        document.body.appendChild(this.eBox);

    }

    ///// 公共
    show(src, min, max) {
        this.pictureZoomPopupInit();

        this.initImg(src, min, max);

        this.eBox.classList.add('show');
    }
}

/**
 * 图片放大弹窗单实例*/
export let pictureZoomPopup = {
    show(src, min, max){
        pictureZoomPopup = new PictureZoomPopup;

        pictureZoomPopup.show(src, min, max);
    }
};

/**
 * 图片裁剪
 * */
export class PictureClip extends ZoomTouch {
    constructor({eBox} = {}) {

        super({
            // 容器。事件范围
            eBox,

            // 放大回调，只要坐标尺寸改变就将调用
            // onZoom: (x, y, w, h, scale) => {
            //     this.zoom(x, y, w, h, scale);
            // }
        });

        this.ratio = 1;// 选择框 宽/高比
        this.boxW = this.boxH = 0;// 容器高宽
        this.selectX = this.selectY = this.selectW = this.selectH = 0;// 选择框 高宽坐标
    }

    pictureClipInit() {
        // 清空。保证只执行一次
        this.pictureClipInit = function () {
        };

        let childs = htmlToElems(`
    <img/>
    <div class="picture-clip-mask"></div>
    <div class="picture-clip-select"><img/></div>
`);

        this.eImg = childs[0];
        this.eSelect = childs[2];
        this.eInImg = this.eSelect.children[0];

        this.eBox.appendChild(toFragment(childs));
    }


    // 更新容器尺寸坐标
    // 1、初始情况调用  2、当容器尺寸发生改变后调用
    resizeBox() {
        this.boxW = this.eBox.clientWidth;
        this.boxH = this.eBox.clientHeight;

    }

    // 放大执行
    onZoom(x, y, w, h, scale) {

        /// 限制。高宽限制已经通过最小比例控制，只需处理坐标限制
        // 坐标限制
        let minX = this.boxW - w - this.selectX,
            minY = this.boxH - h - this.selectY;
        if (x > this.selectX) this.currX = x = this.selectX;
        else if (x < minX) this.currX = x = minX;
        if (y > this.selectY) this.currY = y = this.selectY;
        else if (y < minY) this.currY = y = minY;

        // 使用 scale 自动中心偏移坐标
        let otherX = this.imgWidth / 2 * (scale - 1),
            otherY = this.imgHeight / 2 * (scale - 1);
        x = x + otherX;
        y = y + otherY;

        this.eImg.style[transform] = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ', ' + scale + ')';
        this.eInImg.style[transform] = 'translate3d(' + (x - this.selectX) + 'px,' + (y - this.selectY) + 'px,0) scale(' + scale + ', ' + scale + ')';

        // this.eImg.style.left = x + 'px';
        // this.eImg.style.top = y + 'px';
        // this.eImg.style.width = w + 'px';
        // this.eImg.style.height = h + 'px';
        // this.eInImg.style.left = x - this.selectX + 'px';
        // this.eInImg.style.top = y - this.selectY + 'px';
        // this.eInImg.style.width = w + 'px';
        // this.eInImg.style.height = h + 'px';
    }

    // 设置最小比例
    // 必须保证有了图片高宽后才执行
    setMinScale() {
        let imgRatio = this.imgWidth / this.imgHeight;
        if (this.ratio > imgRatio) {
            this.minScale = this.selectW / this.imgWidth;
        }
        else {
            this.minScale = this.selectH / this.imgHeight;
        }
    }

    ///// 公开

    // 设置选择框 宽/高 比例。默认1。并生更新选择框位置尺寸
    // ，调用前需先确保 clip.resizeBox已经执行
    setRatio(ratio) {
        if (ratio) this.ratio = ratio;
        ratio = this.ratio;

        let boxRatio = this.boxW / this.boxH;
        let selectX, selectY, selectW, selectH;

        if (ratio > boxRatio) {
            selectW = this.boxW;
            selectH = selectW / ratio;
            selectX = 0;
            selectY = (this.boxH - selectH) / 2;
        }
        else {
            selectH = this.boxH;
            selectW = selectH * ratio;
            selectY = 0;
            selectX = (this.boxW - selectW) / 2;

        }
        this.eSelect.style.width = selectW + 'px';
        this.eSelect.style.height = selectH + 'px';
        this.eSelect.style.top = selectY + 'px';
        this.eSelect.style.left = selectX + 'px';

        this.selectX = selectX;
        this.selectY = selectY;
        this.selectW = selectW;
        this.selectH = selectH;

        // 算最小比例
        let imgRatio = this.imgWidth / this.imgHeight;
        if (ratio > imgRatio) {
            this.minScale = selectW / this.imgWidth;
        }
        else {
            this.minScale = selectH / this.imgHeight;
        }
        console.log(selectW, this.imgWidth);
    }

    // 更新容器尺寸坐标，更新选择框，更新 放大元素位置
    // 当容器尺寸改变时可直接调用
    resize() {
        this.resizeBox();
        this.setRatio();
        this.setMinScale();
        this.toDefault();
    }

    // 最小居中位置。数据生效。回到居中位置坐标数据
    // 第一次调用前，需先执行 Clip.setBoxWH 、 Clip.setBoxWH
    // 也可反复调用，比Clip.reset 多了一步回到居中位置
    toMinCenter() {

        let imgRatio = this.imgWidth / this.imgHeight;
        let x, y, w, h, scale;

        if (this.ratio > imgRatio) {
            this.currW = w = this.selectW;
            this.currH = h = w / imgRatio;
            this.currX = x = 0;
            this.currY = y = (this.boxH - h) / 2;
        }
        else {
            this.currH = h = this.selectH;
            this.currW = w = h * imgRatio;
            this.currY = y = 0;
            this.currX = x = (this.boxW - w) / 2;
        }

        this.currScale = scale = w / this.imgWidth;

        this.onZoom(x, y, w, h, scale);
    }

    // 默认位置。数据生效。回到当前坐标尺寸数据
    // 当 图片换 或者 容器尺寸改变后可调用
    // 可反复调用
    toDefault() {
        this.onZoom(this.currX, this.currY, this.currW, this.currH, this.currScale);
    }

    // 初始或者更换图片，可以重新设置选择框比例
    // 必须第一次执行
    initImg(src, ratio) {


        imgSizeComplete(src, (img) => {
            this.pictureClipInit();
            this.eInImg.src = this.eImg.src = src;
            this.zoomInit(img.width, img.height);
            this.resizeBox();
            this.setRatio(ratio);
            this.setMinScale();
            this.toMinCenter();
            // this.toDefault();
        }, () => {

        });
    }

    // 取裁剪参数
    // 选择框相对于图片的  x y w h 。并且参照比例为原图尺寸
    getClipParams() {

        let scale = this.currScale;

        return {
            x: (this.selectX - this.currX) / scale,
            y: (this.selectY - this.currY) / scale,
            w: this.selectW / scale,
            h: this.selectH / scale
        }
    }
}

/**
 * 图片裁剪弹窗
 * */
export class PictureClipPopup extends PictureClip {
    constructor() {
        super();
    }

    // show 执行时才执行，只执行一次
    pictureClipPopupInit() {
        // 清空。保证只执行一次
        this.pictureClipPopupInit = function () {
        };

        this.eBox = htmlToElems(`<div class="picture-clip picture-clip-popup"><a class="cancel-btn">取消</a><a class="confirm-btn">确认</a></div>`)[0]

        ///// 新增按钮 并绑定事件
        let btns = this.eBox.children,
            cancelBtn = btns[0],
            confirmBtn = btns[1];

        click(cancelBtn, () => {
            this.eBox.classList.remove('show');
        });
        click(confirmBtn, () => {
            this.eBox.classList.remove('show');
            this.onConfirm(this.getClipParams());
        });

        document.body.appendChild(this.eBox);

    }

    ///// 公共
    show(src, onConfirm, ratio) {
        this.pictureClipPopupInit();

        this.initImg(src, ratio);

        this.onConfirm = onConfirm;

        this.eBox.classList.add('show');

    }
}


/**
 * 图片裁剪弹窗单实例*/
export let pictureClipPopup = {
    show(src, onConfirm, ratio){
        pictureClipPopup = new PictureClipPopup;

        pictureClipPopup.show(src, onConfirm, ratio);
    }
};


