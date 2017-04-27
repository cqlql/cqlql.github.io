/**
 * Created by cql on 2017/4/17.
 */

import {
    pictureZoomPopup,
    PictureZoom,
    pictureClipPopup,
    PictureClipPopup,
    PictureClip,
    ZoomRotateTouch,
    ZoomTouch
} from './zoom-touch.js';
// import {pictureZoomPopup,PictureZoom,pictureClipPopup,PictureClipPopup,PictureClip,ZoomTouch} from './main3.js';
import {imgSizeComplete} from 'dom/img-handle';
import autoPrefix from 'dom/autoprefix'
import click from 'dom/click'
import {debugMsg} from 'msg-mobile'
import htmlToElems from 'dom/html-to-elems'
import toFragment from 'dom/to-fragment'


let transform = autoPrefix('transform')[1];

let testSrc = '../imgs/test.jpg';


// 放大demo
function pictureZoomDemo() {


    let zoom = new PictureZoom({
        eBox: document.querySelector('.picture-zoom')
    });
    zoom.initImg(testSrc);

    click(pictureZoomPopupBtn, function () {
        pictureZoomPopup.show(testSrc);
    });
    window.addEventListener('resize', function () {

        setTimeout(function () {
            pictureZoomPopup.resize && pictureZoomPopup.resize();
        }, 1000);

    });

}


// 裁剪demo
function pictureClipDemo() {
    let clip = new PictureClip({
        eBox: document.querySelector('.picture-clip')
    });
    clip.initImg(testSrc);

    // 弹窗
    click(popupbtn, function () {
        pictureClipPopup.show(testSrc, function ({x, y, w, h}) {
            debugMsg('裁剪参数：',x, y, w, h);
            console.log('裁剪参数：',x, y, w, h);
        }, 1.6);
    });
    window.onresize = function () {
        pictureClipPopup.resize && pictureClipPopup.resize();
    };


}


/**
 * 基础放大使用*/
function normaTest() {

    let eBox = document,
        eImg = document.querySelector('img');

    let transform = autoPrefix('transform')[1];
    let transformOrigin = autoPrefix('transform-origin')[1];

    let is1 = 1;
    let zoomTouch = new ZoomTouch({
        eBox,
        onZoom(x, y, w, h, scale){
            // eImg.style[transform] = 'translate3d(' + x + 'px,' + y + 'px,0)';
            // eImg.style.width = w + 'px';
            // eImg.style.height = h + 'px';
            // debugMsg(px,py);

            // 使用 scale 自动Origin 偏移坐标
            let
                ox = .5, oy = .5,
                otherX = this.imgWidth * ox * (scale - 1),
                otherY = this.imgHeight * oy * (scale - 1);

            eImg.style[transform] = 'translate3d(' + (x + otherX) + 'px,' + (y + otherY) + 'px,0) scale(' + scale + ', ' + scale + ')';

            // eImg.style[transformOrigin]='90% 90%';


        }
    });

    imgSizeComplete('../imgs/test.jpg', (img) => {
        eImg.src = img.src;
        zoomTouch.zoomInit(img.width, img.height);
    }, () => {

    });
}

function rotateTest() {

    let eBox = document.querySelector('.zoom-rotate'),
        eImg = eBox.querySelector('img');

    let transform = autoPrefix('transform')[1];
    let transformOrigin = autoPrefix('transform-origin')[1];

    let zoomTouch = new ZoomRotateTouch({
        eBox,
        onZoom(x, y, w, h, scale, radian, ox, oy){
            // eImg.style[transform] = 'translate3d(' + x + 'px,' + y + 'px,0)';
            // eImg.style.width = w + 'px';
            // eImg.style.height = h + 'px';
            // debugMsg(px,py);

            // 使用 scale 自动Origin 偏移坐标
            let

                otherX = this.imgWidth * ox * (scale - 1),
                otherY = this.imgHeight * oy * (scale - 1);

            eImg.style[transform] = 'translate3d(' + (x + otherX) + 'px,' + (y + otherY) + 'px,0) scale(' + scale + ', ' + scale + ') rotate(' + radian + 'rad)';

            eImg.style[transformOrigin] = (ox * 100) + '% ' + (oy * 100) + '%';

            // eImg.style[transformOrigin]='90% 90%';


        }
    });

    imgSizeComplete('../imgs/test.jpg', (img) => {
        eImg.src = img.src;
        zoomTouch.zoomInit(img.width, img.height);
    }, () => {

    });
}


pictureZoomDemo();
pictureClipDemo();
rotateTest();


