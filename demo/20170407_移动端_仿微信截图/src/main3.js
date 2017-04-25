/**
 * Created by cql on 2017/4/17.
 */

import {imgSizeComplete} from 'dom/img-handle'
import autoPrefix from 'dom/autoprefix'
import htmlToElems from 'dom/html-to-elems'
import toFragment from 'dom/to-fragment'
import click from 'dom/click'
// import {debugMsg} from 'msg-mobile'

let transform = autoPrefix('transform')[1];

/**
 * 触摸放大基础*/
export class ZoomTouch {

    constructor({eBox, onZoom}) {

        this.eBox = eBox;
        // this.eImg=eImg;
        this.onZoom = onZoom;
        this.imgWidth = this.imgHeight = 0;// 图片原始高宽

        ///// 公开
        this.currW = this.currH = 0;// 当前图片高宽。核心实现是通过比例得到 高宽的，所以有比例就有高宽。此为被动字段
        this.currY = this.currX = 0;// 当前坐标
        this.currScale = 1;// 当前放大比例
    }

    init() {
        this.init = () => {
        };// 清理，实现只会执行一次

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

            let imgRatio = this.imgWidth / this.imgHeight;

            if(this.ratio<imgRatio){

            }

           let minScale = this.boxW / this.imgWidth;
           let minH = this.boxW  / (this.imgWidth / this.imgHeight );
           let maxX = 0;
            let maxY = (this.boxH - minH) / 2;

            if(toScale<minScale){
                this.currScale = toScale=minScale;
                scale = toScale / this.currScale;
            }

            // 算高宽
            this.currW = toW = this.imgWidth * toScale;
            this.currH = toH = this.imgHeight * toScale;

            // 算 x y
            let offsetX = centerX - preX,
                offsetY = centerY - preY;
            let offsetXS = offsetX / toW,
                offsetYS = offsetY / toH;
            // 缩放了多少长度
            let zoomW = toW * (1 - scale),
                zoomH = toH * (1 - scale);
            //
            this.currX = toX = offsetXS * zoomW + moveX * scale + preX;
            this.currY = toY = offsetYS * zoomH + moveY * scale + preY;
console.log(toY);

            if (toX < this.boxW - toW - this.selectX) {
                toX = this.boxW - toW - this.selectX;
            }
            if (toX > this.selectX) {
                toX = maxX - this.imgWidth * (toScale - minScale ) / 2;
                if (toX < this.selectX) toX = this.selectX;
            }
            if (toY < this.boxH - toH - this.selectY) {
                toY = this.boxH - toH - this.selectY;
            }
            if (toY > this.selectY) {
                toY = maxY - this.imgHeight * (toScale - minScale ) / 2;
                if (toY < this.selectY) toY = this.selectY;
            }

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
console.log('sing');
            this.onZoom(toX, toY, this.currW, this.currH, this.currScale);
        };
        let singleEnd = () => {
        };

        let startDataXY // 临时记录 多点记录开始坐标参数
            , startX, startY // 临时记录 单点记录开始坐标

            , preX, preY, preScale// 临时记录


            , isStart = 0 // 双点放大开始
            , isSingleStart = 0 // 单点拖动开始
        ;

        this.eBox.addEventListener('touchstart', function (e) {
            let touches = e.touches;

            if (touches.length === 2) {
                isStart = 1;
                zoomStart(touches[0], touches[1]);
                e.preventDefault();
            }
            else {
                if (isStart) {
                    isStart = 0;
                    zoomEnd();
                }

                // 处理单点移动逻辑。2点以上也当单点处理
                isSingleStart = 1;
                // singleStart(touches[0]);
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
                // singleMove(touches[0]);
            }
        });

        this.eBox.addEventListener('touchend', function (e) {
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
                    // singleStart(touches[0]);
                }
                else if (isSingleStart) {
                    isSingleStart = 0;
                    singleEnd();
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
        this.init();
        this.imgWidth = w;
        this.imgHeight = h;

        this.currW=w*this.currScale;
        this.currH=h*this.currScale;

    }

}

/**
 * 图片放大*/
class PictureZoom {
    constructor() {

    }
}


/**
 * 图片放大弹窗*/
class PictureZoomPopup {
    constructor() {

    }
}

/**
 * 图片放大弹窗单实例*/
export let pictureZoomPopup = {
    show(){
        pictureZoomPopup=new PictureZoomPopup;

        pictureZoomPopup.show(src);
    }
};


/**
 * 图片裁剪*/
export class PictureClip extends ZoomTouch {
    constructor({eBox}) {

        super({
            // 容器。事件范围
            eBox,

            // 放大回调，只要坐标尺寸改变就将调用
            onZoom: (x, y, w, h, scale) => {
                this.zoom(x, y, w, h, scale);
            }
        });

        eBox.innerHTML = `
    <img/>
    <div class="picture-clip-mask"></div>
    <div class="picture-clip-select"><img/></div>
`;

        this.eImg = eBox.children[0];
        this.eSelect = eBox.children[2];
        this.eInImg = this.eSelect.children[0];

        this.ratio = 1;// 选择框 宽/高比
        this.boxW = this.boxH = 0;// 容器高宽
        this.selectX = this.selectY = this.selectW = this.selectH = 0;// 选择框 高宽坐标

    }


    // 更新容器尺寸坐标
    // 1、初始情况调用  2、当容器尺寸发生改变后调用
    resizexyBox() {
        this.boxW = this.eBox.clientWidth;
        this.boxH = this.eBox.clientHeight;

    }

    // 放大执行
    zoom(x, y, w, h, scale) {
        let minScale;

        /// 限制
        // 高宽限制
        // if (w < this.selectW) {
        //     this.currW = w = this.selectW;
        //     this.currScale = scale = w / this.imgWidth;
        //     this.currH = h = this.imgHeight * scale;
        // }
        // if (h < this.selectH) {
        //     this.currH = h = this.selectH;
        //     this.currScale = scale = h / this.imgHeight;
        //     this.currW = w = this.imgWidth * scale;
        // }
        // // 坐标限制
        // if (x < this.boxW - w - this.selectX) {
        //     x = this.boxW - w - this.selectX;
        // }
        // if (x > this.selectX) {
        //     x = 0 - oWidth * (scale - minScale ) / 2;
        //     if (x < this.selectX) x = this.selectX;
        // }
        // if (toY < oWinH - toH - this.selectY) {
        //     toY = oWinH - toH - this.selectY;
        // }
        // if (toY > this.selectY) {
        //     toY = maxY - oHeight * (scale - minScale ) / 2;
        //     if (toY < this.selectY) toY = this.selectY;
        // }

        // let minX = this.boxW - w - this.selectX,
        //     minY = this.boxH - h - this.selectY;
        // if (x > this.selectX) this.currX = x = this.selectX;
        // else if (x < minX) this.currX = x = minX;
        // if (y > this.selectY) this.currY = y = this.selectY;
        // else if (y < minY) this.currY = y = minY;

        // 使用 scale 自动中心偏移坐标
        let otherX = this.imgWidth / 2 * (scale - 1),
            otherY = this.imgHeight / 2 * (scale - 1);

        x = x + otherX;
        y = y + otherY;
        this.eImg.style[transform] = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ', ' + scale + ')';
        this.eInImg.style[transform] = 'translate3d(' + (x - this.selectX) + 'px,' + (y - this.selectY) + 'px,0) scale(' + scale + ', ' + scale + ')';
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

    }

    // 更新容器尺寸坐标，更新选择框，更新 放大元素位置
    // 当容器尺寸改变时可直接调用
    resizexy() {
        this.resizexyBox();
        this.setRatio();
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

        this.zoom(x, y, w, h, scale);
    }

    // 默认位置。数据生效。回到当前坐标尺寸数据
    // 当 图片换 或者 容器尺寸改变后可调用
    // 可反复调用
    toDefault() {
        this.zoom(this.currX, this.currY, this.currW, this.currH, this.currScale);
    }

    // 初始或者更换图片，可以重新设置选择框比例
    initImg(src,ratio) {
        this.resizexyBox();
        this.setRatio(ratio);

        imgSizeComplete(src, (img) => {
            this.eInImg.src = this.eImg.src = src;
            this.zoomInit(img.width, img.height);
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
export class PictureClipPopup extends PictureClip{
    constructor(){

        let eBox=document.createElement('div');
        eBox.className='picture-clip picture-clip-popup';

        super({
            eBox
        });
    }

    // show 执行时才执行，只执行一次
    popupInit(){
        // 清空。保证只执行一次
        this.popupInit=function () {
        };

        ///// 新增按钮 并绑定事件
        let btns=htmlToElems('<a class="cancel-btn">取消</a>,<a class="confirm-btn">确认</a>'),
            cancelBtn=btns[0],
            confirmBtn=btns[1];
        this.eBox.appendChild(toFragment(btns));
        click(cancelBtn,()=> {
            this.eBox.classList.remove('show');
        });
        click(confirmBtn,()=> {
            this.eBox.classList.remove('show');
            this.onConfirm(this.getClipParams());
        });
        document.body.appendChild(this.eBox);

    }

    ///// 公共
    show(src,onConfirm,ratio){
        this.popupInit();

        this.initImg(src,ratio);

        this.onConfirm=onConfirm;

        this.eBox.classList.add('show');

    }
}


/**
 * 图片裁剪弹窗单实例*/
export let pictureClipPopup={
    show(src,onConfirm,ratio){
        pictureClipPopup=new PictureClipPopup;

        pictureClipPopup.show(src,onConfirm,ratio);
    }
};



function otherTest() {

    let eBox = document.querySelector('main'),
        eImg = eBox.children[0];

    let transform = autoPrefix('transform')[1];


    let zoomTouch = new ZoomTouch({
        eBox,
        onZoom(x, y, w, h, scale){
            // eImg.style[transform] = 'translate3d(' + x + 'px,' + y + 'px,0)';
            // eImg.style.width = w + 'px';
            // eImg.style.height = h + 'px';

            // 使用 scale 自动中心偏移坐标
            let otherX = zoomTouch.imgWidth / 2 * (scale - 1),
                otherY = zoomTouch.imgHeight / 2 * (scale - 1);

            eImg.style[transform] = 'translate3d(' + (x + otherX) + 'px,' + (y + otherY) + 'px,0) scale(' + scale + ', ' + scale + ')';
        }
    });

    imgSizeComplete('../imgs/test.jpg', (img) => {
        eImg.src = img.src;
        zoomTouch.zoomInit(img.width, img.height);
    }, () => {

    });
}

