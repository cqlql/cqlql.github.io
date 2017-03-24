/**
 * Created by cql on 2017/3/22.
 */

import drag, {figure} from 'drag-base';
import offsetXY from 'dom/offsetxy';
import scopeElements from 'dom/scope-elements';
import htmlToElem from 'dom/html-To-Elem';
import ExcuInterval from 'Excu-Interval';


// 方向计算
let dFigure = {
    start: function (x, y) {
        this.prevX = x;
        this.prevY = y;

        return this;
    },
    move: function (x, y, fn) {

        fn(x - this.prevX, y - this.prevY);

        this.prevX = x;
        this.prevY = y;
    }
};


/**
 * 范围判断
 *
 * @param {isLeft} true 表示左边，否则右边。范围遍历时要么只遍历左边，要么遍历右边
 * @param {index} 当前拖动元素索引。也是左右边分界索引
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
function range(isLeft, index, x, y, cb) {

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


    if (isLeft) {
        // 左边

        while (index--) {
            d = data[index];

            if (judge(x, y, d)) {
                cb(index, d);
            }
        }
    }
    else {
        // 右边
        for (index++; index < count; index++) {
            d = data[index];

            if (judge(x, y, d)) {
                cb(index, d);
            }
        }
    }

}

/**
 * 元素排列
 * 此处排列是2个方向，宽度不定，高度固定
 * 间距由css处理。多加一个div包裹即可，无需js中计算
 *
 *
 * 为了考虑动画和性能，更好兼容移动端，使用坐标换位，而不是改变元素文档位置，即显示数据分离。所以，不仅可使用left、top，也可以使用 translate3d
 *
 * 首先所有元素初始位置都为0，重叠隐藏，隐藏使用opacity，这样方能获取高宽，进而计算坐标
 *
 * */

function initArrange() {
    let //data = [],
        preEndX = 0, currY = 0;

    items.forEach(function (item, i) {
        let d = {
            x: preEndX,
            y: currY,
            w: item.offsetWidth,
            h: itemH,
            i
        };

        // 换行处理
        let endX = d.x + d.w;
        if (endX > boxW) {
            d.x = 0;
            currY = d.y = d.y + d.h;
        }
        preEndX = d.x + d.w;
        data[i] = d;

        item.dataset.index = i;
        item.style.left = d.x + 'px';
        item.style.top = d.y + 'px';

    });
    eBox.style.height = currY + itemH + 'px';

}

// 拖动生效：发生改变的最前面数据项后的所有数据项重新生成xy，并设置到元素，并更正元素 data-index
function reset(startIndex) {

    let startData = data[startIndex];

    if (startIndex === 0) {
        startData.x = startData.y = 0;

        let
            d = startData,
            item = items[d.i];

        // 坐标设置到元素
        item.style.left = d.x + 'px';
        item.style.top = d.y + 'px';

        // 并更正元素 data-index
        items[d.i].dataset.index = 0;
    }

    let preEndX = startData.x + startData.w, currY = startData.y;

    for (let index = startIndex + 1; index < count; index++) {

        let d = data[index];

        d.x = preEndX;
        d.y = currY;

        // 换行处理
        let endX = d.x + d.w;
        if (endX > boxW) {
            d.x = 0;
            currY = d.y = d.y + d.h;
        }
        preEndX = d.x + d.w;

        let item = items[d.i];

        // 坐标设置到元素
        item.style.left = d.x + 'px';
        item.style.top = d.y + 'px';

        // 并更正元素 data-index
        items[d.i].dataset.index = index;
    }
}


let
    // 元素对应的数据
    data = [],

    eBox = document.querySelector('.box'),

    items = [].slice.call(document.querySelector('.box').children, 0),// [...document.querySelector('.box').children],
    count = items.length,

    itemH = items[0].clientHeight,
    boxW = eBox.clientWidth;

initArrange();

setTimeout(function () {
    eBox.classList.add('animate');
}, 0);

let boxXY = offsetXY(eBox),

    excuInterval = new ExcuInterval,

    // 拖动项
    dragItem,
    // 跟随项
    moveItem,
    moveItemX,
    moveItemY,
    // 当前拖动项索引、以及对于的数据
    dragIndex,
    dragData;

drag({
    eDrag: eBox,
    onMove(e){

        // 跟随
        figure.move(e.pageX, e.pageY, function (x, y) {
            moveItemX += x;
            moveItemY += y;
            moveItem.style.left = moveItemX + 'px';
            moveItem.style.top = moveItemY + 'px';
        });

        // 间隔执行。效率优化，精准方向计算
        excuInterval.excu(function () {
            // 方向
            let isLeft;
            dFigure.move(e.pageX, e.pageY, function (xlen, ylen) {
                console.log(xlen, ylen);
                isLeft = xlen < 0;
            });

            let x = e.pageX - boxXY.left, y = e.pageY - boxXY.top;

            range(isLeft, dragIndex, x, y, function (i, d) {

                // 交换
                // 数据项移动 + xy重排(最小更换项后的)

                let startIndex;// 拖动生效开始索引

                if (dragIndex < i) {

                    /// 元素向后移动
                    // 拖动位置数据增加到指定位置
                    data.splice(i + 1, 0, dragData);
                    // 删除拖动原始位置数据
                    data.splice(dragIndex, 1);

                    startIndex = dragIndex - 1;
                    startIndex = startIndex < 0 ? 0 : startIndex;

                }
                else {
                    /// 元素向前移动
                    // 删除拖动原始位置数据
                    data.splice(dragIndex, 1);
                    // 拖动位置数据增加到指定位置
                    data.splice(i, 0, dragData);

                    startIndex = i - 1;
                    startIndex = startIndex < 0 ? 0 : startIndex;

                }

                // 更正并设置
                reset(startIndex);

                // 更正当前拖动索引
                dragIndex = i;

            });

        }, 100);

    },
    onDown(e){

        // 是否开启拖动
        let isDrag = false;

        scopeElements(e.target, function (elem) {

            if (elem === eBox)return false;
            if (elem.classList.contains('item-cont')) {
                dragItem = elem.parentElement;

                ///// 拖动开始

                dragIndex = dragItem.dataset.index * 1;
                dragData = data[dragIndex];

                // 跟随项起始坐标
                moveItemX = dragData.x;
                moveItemY = dragData.y;

                // 跟随项创建
                moveItem = htmlToElem(dragItem.outerHTML);
                eBox.appendChild(moveItem);

                moveItem.classList.add('move');
                dragItem.classList.add('drag');

                figure.start(e.pageX, e.pageY);// 拖动跟随计算
                dFigure.start(e.pageX, e.pageY);// 方向计算

                isDrag = true;

                return false;
            }

        });

        return isDrag;


    },
    onUp(){
        dragItem.classList.remove('drag');
        moveItem.remove();
    }

});





