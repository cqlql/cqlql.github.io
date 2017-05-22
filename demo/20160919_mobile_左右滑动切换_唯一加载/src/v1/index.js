/**
 * Created by cql on 2017/04/15.
 *
 *
 */

import SliderOneLoad from 'slider-one-load';


let eBox=document.querySelector('.ques-test');
let xhr;
let sliderOneLoad=new SliderOneLoad({
    eBox:document.querySelector('.slide-loader'),
    count:10,
    // 加载完成后必须执行 complete。
    onLoad(page,complete){

        clearTimeout(xhr);

        xhr=setTimeout(() => {

            eBox.textContent='当前加载页数'+(page+1);
            complete();

        }, 200);
    }
});

sliderOneLoad.load(0);