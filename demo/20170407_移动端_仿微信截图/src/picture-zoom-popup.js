/**
 * 独立打包，单独调用
 *
 * Created by cql on 2017/5/11.
 */



import {
    PictureZoomPopup
} from 'zoom-touch.js';


mod.fullShowImg = {
    show(src, min, max){
        mod.fullShowImg = new PictureZoomPopup;

        mod.fullShowImg.show(src, min, max);
    }
};