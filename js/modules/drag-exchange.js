/**
 * Created by cql on 2017/3/22.
 *
 * 拖动换位 v1.0.1
 */

import drag, {Figure} from 'drag-base';
import offsetXY from 'dom/offsetxy';
import scopeElements from 'dom/scope-elements';
import htmlToElems from 'dom/html-to-elems';
import ExcuInterval from 'Excu-Interval';

export default function DragExchange(eBox) {

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
     * 拖动识别
     *  允许点击的拖动
     *  支持双击选择
     *
     * @param {function} onDown  可通过 return false 阻止拖动触发
     * @param {function} onStart  传入的是 down 事件的event。可通过 return false 阻止拖动触发，onDown 之后的阻止
     * */
    function dragRecognition({
                                 eDrag,
                                 onDown,
                                 onStart,
                                 onMove,
                                 onUp
                             }) {

        let startX, startY,

            downEvent,

            // 是否开始
            isStart = false;


        drag({
            eDrag: eBox,
            onMove(e){

                if (!isStart) {
                    let lenX = e.pageX - startX,
                        lenY = e.pageY - startY;

                    if (Math.abs(lenX) > 2 || Math.abs(lenY) > 2) {
                        isStart = onStart(downEvent) === false ? false : true;
                    }
                }

                if (isStart) {
                    onMove(e);

                }
            },
            onDown(e){
                if (onDown(e) === false) return false;

                isStart = false;

                startX = e.pageX;
                startY = e.pageY;

                downEvent = e;

            },
            onUp(){
                if (isStart) onUp();
            }

        });
    }

    /**
     * 重排。指定数据项索引之后全部重排
     *
     * 注意：没有拖动项的情况不能调用。即 如果删除仅有的一个项后，不能调用
     *
     * darg-item 元素的 data-index 标签属性：用来找数据项，当数据项索引改变时，需更正此值保持对应关系
     *
     * 拖动生效：发生改变的最前面数据项后的所有数据项重新生成xy，并设置到元素，并更正元素 data-index
     *
     * @param starIndex 要么是0，要么是一个更改项之前的索引，兼容负数
     *
     * */
    function reset(startIndex) {
        function setElemItem(d, index) {
            let item = items[d.i];

            // 坐标设置到元素
            item.style.left = d.x + 'px';
            item.style.top = d.y + 'px';

            // 并更正元素 data-index
            items[d.i].dataset.index = index;
        }

        let startData = data[startIndex];

        // 删除第一个情况，即 startIndex 负数
        if (startData === undefined) {// 负数情况全等undefined

            startIndex = 0;

            startData = data[startIndex];

            startData.x = startData.y = 0;
            setElemItem(startData, 0);
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

            setElemItem(d, index);

        }

        // 动态更正容器高度
        eBox.style.height = currY + itemH + 'px';

    }

    // 将初始 count itemH，考虑初始有项或者无项
    function init() {
        let eItems = eBox.children;

        count = eItems.length;

        if (count > 0) {
            that.initNewItems(0, 0, eItems);
        }

        eBox.classList.add('animate');

    }

    // 初始项高，只会执行一次
    function initItemH() {
        itemH = eBox.children[0].clientHeight;
        initItemH=function () { };
    }

    // 返回项数据，能对应正确的位置
    this.getData = function () {

        return data;
    };

    // 返回项元素，不能对应正确的位置
    this.getItems = function () {

        return items;
    };

    // 删除项，根据指定数据索引项删除，删除单个
    this.delItem = function (dataIndex) {
        let d = data[dataIndex],
            itemIndex = d.i;

        items[itemIndex].remove();
        items[itemIndex] = undefined;

        data.splice(dataIndex, 1);
        count--;

        // 避免没有项之后调用
        if (count) {
            reset(dataIndex - 1);
        }
    };

    // 增加项，支持多个。元素集合，可以是装载元素的数组,或者是jq对象，或者 HTMLCollection
    this.addItems = function (newitems) {

        let newitemsArray = [];
        let df = document.createDocumentFragment();
        let itemStartIndex = items.length;
        let newCount = newitems.length;

        /// 1 先处理第一个，识别 HTMLCollection 与 数组、jq对象
        let getItem = function (i) {
            return newitems[i]
        };
        let item = newitems[0];
        df.appendChild(item);
        newitemsArray[0] = item;
        // HTMLCollection 情况
        if (newitems.length < newCount) {
            getItem = function () {
                return newitems[0]
            }
        }
        // 处理剩下的
        for (let i = 1; i < newCount; i++) {
            let item = getItem(i);
            df.appendChild(item);
            newitemsArray[i] = item;
        }

        eBox.appendChild(df);

        this.initNewItems(count, itemStartIndex, newitemsArray);

        // 更正数据项总数
        count += newCount;
    };

    /**
     * 新增项初始化
     *
     *
     * @param startIndexData 开始索引，data数据索引
     * @param startIndexItem 开始索引，items元素项索引
     * @param newitems 元素集合，可以是装载元素的数组,或者是jq对象，或者 HTMLCollection
     *
     * */
    this.initNewItems = function (dataStartIndex, itemStartIndex, newitems) {
        initItemH();

        let
            preEndX,
            currY;

        if (dataStartIndex) {
            let preData = data[dataStartIndex - 1];
            preEndX = preData.w + preData.x;
            currY = preData.y;
        }
        else {
            preEndX = 0;
            currY = 0;
        }

        let
            dataIndex = dataStartIndex,
            itemIndex = itemStartIndex;

        for (let j = 0, len = newitems.length; j < len; j++) {

            let item = newitems[j];

            let d = {
                x: preEndX,
                y: currY,
                w: item.offsetWidth,
                h: itemH,
                i: itemIndex
            };

            let endX = d.x + d.w;
            if (endX > boxW) {
                d.x = 0;
                currY = d.y = d.y + d.h;
            }

            preEndX = d.x + d.w;
            data[dataIndex] = d;
            items[itemIndex] = item;

            item.dataset.index = dataIndex;
            item.style.left = d.x + 'px';
            item.style.top = d.y + 'px';

            itemIndex++;
            dataIndex++;
        }

        eBox.style.height = currY + itemH + 'px';

    };

    // 拖动累加计算
    let figure = new Figure;
    // 方向计算
    let dFigure = new Figure;

    let
        // 元素对应的数据
        data = [],

        //items = [].slice.call(eBox.children, 0),// [...document.querySelector('.box').children],
        items = [],
        count = 0,// 数据项总数

        itemH = 0,
        boxW = eBox.clientWidth,

        that = this;

    init();

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

    dragRecognition({
        eDrag: eBox,
        onDown(){
            // 第一段阻止
            if (count === 0) return false;
        },
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
                    // 角度判断 。当偏向左下角或者右上角时，以y轴判断方向
                    if (Math.atan(ylen / xlen) < -0.2) {
                        isLeft = ylen < 0;
                    }
                    else {
                        isLeft = xlen < 0;
                    }
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

                    }
                    else {
                        /// 元素向前移动
                        // 删除拖动原始位置数据
                        data.splice(dragIndex, 1);
                        // 拖动位置数据增加到指定位置
                        data.splice(i, 0, dragData);

                        startIndex = i - 1;

                    }

                    // 更正并设置
                    reset(startIndex);

                    // 更正当前拖动索引
                    dragIndex = i;

                });

            }, 80);

            e.preventDefault();
        },
        onStart(e){
            // 是否开启拖动
            let isDrag = false;

            scopeElements(e.target, function (elem) {

                if (elem === eBox)return false;
                if (elem.classList.contains('drag-item-cont')) {
                    dragItem = elem.parentElement;

                    ///// 拖动开始

                    dragIndex = dragItem.dataset.index * 1;
                    dragData = data[dragIndex];

                    // 跟随项起始坐标
                    moveItemX = dragData.x;
                    moveItemY = dragData.y;

                    // 跟随项创建
                    moveItem = htmlToElems(dragItem.outerHTML)[0];
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
}