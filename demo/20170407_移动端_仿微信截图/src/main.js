/**
 * Created by cql on 2017/4/17.
 */

import {pictureZoomPopup,PictureZoom,pictureClipPopup,PictureClipPopup,PictureClip,ZoomTouch} from './zoom-touch.js';
// import {pictureZoomPopup,PictureZoom,pictureClipPopup,PictureClipPopup,PictureClip,ZoomTouch} from './main3.js';
import {imgSizeComplete} from 'dom/img-handle';
import autoPrefix from 'dom/autoprefix'
import click from 'dom/click'
import {debugMsg} from 'msg-mobile'
import htmlToElems from 'dom/html-to-elems'
import toFragment from 'dom/to-fragment'


let transform = autoPrefix('transform')[1];

let testSrc='../imgs/test.jpg';


// 放大
let zoom=new PictureZoom({
    eBox:document.querySelector('.picture-zoom')
});
zoom.initImg(testSrc);

click(pictureZoomPopupBtn,function () {
    pictureZoomPopup.show(testSrc);
});
window.addEventListener('resize',function () {

    setTimeout(function () {
        pictureZoomPopup.resize&&pictureZoomPopup.resize();
    },1000);

});


console.log(123);
// 裁剪demo
function pictureClipDemo() {
    let clip=new PictureClip({
        eBox:document.querySelector('.picture-clip')
    });
    clip.initImg(testSrc);

    // 弹窗
    click(popupbtn,function () {
        pictureClipPopup.show(testSrc,function ({x,y,w,h}) {
            debugMsg(x,y,w,h);
            console.log(x,y,w,h);
        },1.6);
    });
    window.onresize=function () {
        pictureClipPopup.resize&&pictureClipPopup.resize();
    };


}
pictureClipDemo();

// otherTest();