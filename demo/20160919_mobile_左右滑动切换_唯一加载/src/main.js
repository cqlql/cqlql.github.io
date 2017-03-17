/**
 * Created by cql on 2016/9/19.
 *
 * 修改于 2017/03/2
 */

import autoPrefix from 'autoprefix';
import Slider from 'slider';

let
    eBox = document.querySelector('.slide-loader'),

    eMove = eBox.children[0],
    eItems = eMove.children,
    count = eItems.length,
    boxW = eBox.clientWidth,

    // eBtnBox = eBox.children[1],
    // eBtns = eBtnBox.children,

    transform = autoPrefix('transform')[1],
    transition = autoPrefix('transition')[1],
    btnHtml = '';

let slider = new Slider({
    eBox,
    count,
    boxW,
    index:1,
    change(prevIndex, index) {

    },
    complete(){
        slider.setIndex(1);
        eMove.style[transition] = '0s';
        eMove.style[transform] = 'translate3d(-' + boxW + 'px,0,0)';

    }
});