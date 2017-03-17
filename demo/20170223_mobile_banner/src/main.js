/**
 * Created by cql on 2017/2/23.
 *
 * banner 普通常用
 * 主要元素：box move item bottomBtn
 *
 */

import autoPrefix from 'autoprefix';
import Slider from 'slider';

let
    eBox = document.querySelector('.banner'),

    eMove = eBox.children[0],
    eItems = eMove.children,
    count = eItems.length,
    boxW = eBox.clientWidth,

    eBtnBox = eBox.children[1],
    eBtns = eBtnBox.children,

    transform = autoPrefix('transform')[1],
    btnHtml = '';

for (let i = 0; i < count; i++) {
    // 初始化项的位置
    eItems[i].style[transform] = 'translateX(' + (i * 100) + '%)';

    // 拼接按钮
    btnHtml += '<li' + (i ? '' : ' class="active"') + '></li>';
}

eBtnBox.innerHTML = btnHtml;

let slider = new Slider({
    eBox,
    count,
    boxW,
    change(prevIndex, index) {
        let eItem = eItems[index];
        eBtns[prevIndex].classList.remove('active');
        eBtns[index].classList.add('active');
        // 按需加载
        if (!eItem._data_isComplete) {
            let img = eItem.children[0],
                imgUrl = img.dataset.src;
            if (imgUrl) img.src = imgUrl;
            eItem._data_isComplete = 1;
        }
    }
});