/**
 * Created by cql on 2017/3/22.
 */

import drag from 'drag-base';
import offsetXY from 'dom/offsetxy';
import scopeElements from 'dom/scope-elements';

/**
 * 范围判断
 *
 * @param {index} 当前拖动元素索引
 *
 *
 * Test:
 *
 let data = [
 {x: 0, y: 0, w: 91, h: 32},
 {x: 91, y: 0, w: 155, h: 32},
 {x: 0, y: 32, w: 114, h: 32},
 {x: 91, y: 32, w: 160, h: 32}
 ];
 range(3, 30, 36);

 *
 *
 * */
function range(index, x, y) {

    // 公用单个方向
    function singleJudge(v, start, csize) {
        if (v > start && v < (start + csize)) {
            return true;
        }
    }

    // 两个方向
    function judge(x, y, d) {

        return singleJudge(x, d.x, d.w) && singleJudge(y, d.y, d.h);
    }

    let d;
    while (index--) {
        d = data[index];

        if (judge(x, y, d)) {
            console.log(index, d);
        }
    }
}

/**
 * 元素排列
 * 此处排列是2个方向，宽度不定，高度固定
 * 间距由css处理。多加一个div包裹即可，无需js中计算
 *
 *
 * 为了考虑动画和性能，更好兼容移动端，使用坐标换位，而不是改不元素文档位置。所以，不仅可使用left、top，也可以使用 translate3d
 *
 * 首先所有元素初始位置都为0，重叠隐藏，隐藏使用opacity，这样方能获取高宽，进而计算坐标
 *
 * */

function initArrange() {
    let data = [],
        preEndX = 0, currY = 0;

    items.forEach(function (item, i) {
        let d = {
            x: preEndX,
            y: currY,
            w: item.offsetWidth,
            h: itemH
        };

        // 换行处理
        let endX = d.x + d.w;
        if (endX > boxW) {
            d.x = 0;
            currY = d.y = d.y + d.h;
        }

        data[i] = d;
        preEndX = d.x + d.w;

        item.dataset.index = i;
        item.style.left = d.x + 'px';
        item.style.top = d.y + 'px';

    });
    eBox.style.height = currY + itemH + 'px';

}

let
    eBox = document.querySelector('.box'),

    items = [].slice.call(document.querySelector('.box').children, 0),// [...document.querySelector('.box').children],
    count = items.length,

    itemH = items[0].clientHeight,
    boxW = eBox.clientWidth;

initArrange();

let boxXY = offsetXY(eBox);

drag({
    eDrag: eBox,
    onMove(e){
        console.log(e.pageX - boxXY.left, e.pageY - boxXY.top);
    },
    onDown(e){

        scopeElements(e.target, function (elem) {

            if (elem === eBox)return false;
            if (elem.classList.contains('item')) {
                let index=elem.dataset.index;

                console.log(elem.dataset.index);
                return false;
            }

        });
    },
    onUp(){

    }

});


// 换位后需重新排列前面改变项后面的所有元素
function arrange() {

}




