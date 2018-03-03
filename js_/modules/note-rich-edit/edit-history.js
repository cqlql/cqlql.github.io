/**
 *
 * 富文本，历史栈管理
 *
 * ms-edge 浏览器 同样的内容，缓存后，在通过innerHTML重新覆盖设置，nodeText数量会不一样
 *
 * Created by cql on 2017/5/9.
 */
import {ExcuDelay, ExcuOne} from 'time-handle';

class EditHistory {

    constructor({
                    eBox,
                    onChange=()=>{}
    }) {

        this.eBox = eBox;

        // 当前历史索引
        this.currIndex = 0;

        // 历史数据
        this.historyData = [];

        this.onChange = onChange;
    }

    // 取节点，根据位置,参数2为容器元素
    getNodeByPosition(position, eBox) {

        let allElems = eBox.getElementsByTagName('*'),
            elem,

            elemIndex = position[0],
            nodeIndex = position[1];

        elem = allElems[elemIndex];
        if (!elem) {
            elem = eBox;
        }
        let node = elem.childNodes[nodeIndex];

        if (!node) {
            node = eBox;
        }

        return node;
    }

    // 取节点位置
    getNodePosition(node, eBox) {
        let elemIndex = 0,
            nodeIndex = 0;

        if (node) {

            let allElems = eBox.getElementsByTagName('*'),
                elem = node.parentElement,
                childNodes = elem.childNodes;

            for (let i = 0, len = allElems.length; i < len; i++) {
                if (allElems[i] === elem) {
                    elemIndex = i;
                }
            }

            for (let i = 0, len = childNodes.length; i < len; i++) {
                if (childNodes[i] === node) {
                    nodeIndex = i;
                }
            }
        }

        return [elemIndex, nodeIndex];
    }

    // 编辑历史数据。默认使用当前数据覆盖当前
    set({index = this.currIndex, data = this.createData()} = {}) {

        this.historyData[index] = data;
    }

    // 生成当前数据
    createData() {

        let {eBox, getNodePosition} = this;

        let
            selection = window.getSelection(),
            anchorNode = selection.anchorNode,
            focusNode,

            anchorOffset = selection.anchorOffset,
            focusOffset,

            isCollapsed = selection.isCollapsed,

            anchorNodePosition = getNodePosition(anchorNode, eBox),
            focusNodePosition;

        if (isCollapsed === false) {
            focusNode = selection.focusNode;
            focusOffset = selection.focusOffset;
            focusNodePosition = getNodePosition(focusNode, eBox);
        }

        return {
            anchorNodePosition,
            focusNodePosition,
            anchorNode,
            anchorNodeValue: anchorNode.textContent,
            anchorOffset,
            focusOffset,
            isCollapsed,
            content: eBox.innerHTML
        };
    }


    // 选择展示指定历史
    select(index) {

        let {eBox, historyData, getNodeByPosition} = this;

        let {
            anchorNodePosition,
            focusNodePosition,
            anchorOffset,
            focusOffset,
            isCollapsed,
            content
        } = historyData[index];

        eBox.innerHTML = content;

        /*
         * 针对ms-edge加的tyy catch，至少保留不丢失
         * chrome没问题，firefox待测
         *
         * */
        try {
            let selection = window.getSelection(),
                range = document.createRange()
                , anchorNode, focusNode;

            if (isCollapsed) {// 光标情况
                anchorNode = getNodeByPosition(anchorNodePosition, eBox);
                range.setStart(anchorNode, anchorOffset);
            }
            else {// 拖蓝情况
                anchorNode = getNodeByPosition(anchorNodePosition, eBox);
                focusNode = getNodeByPosition(focusNodePosition, eBox);

                range.setStart(anchorNode, anchorOffset);
                range.setEnd(focusNode, focusOffset);

                if (range.collapsed) {
                    range.setStart(focusNode, focusOffset);
                    range.setEnd(anchorNode, anchorOffset);
                }
            }

            selection.removeAllRanges();
            selection.addRange(range);
        }
        catch (e) {

        }

        this.currIndex = index;

    }

    // 新增历史
    add() {
        let {historyData, currIndex} = this;

        let index = currIndex + 1;

        let currData = historyData[currIndex],
            data = this.createData()
        ;

        // 解决中文输入法 生成多条空白记录问题
        if (currData.anchorNode === data.anchorNode && currData.anchorNodeValue === data.anchorNodeValue) return;
        else if (currData.anchorNodeValue !== null && data.anchorNodeValue !== null && currData.anchorNodeValue.trim().length === 0 && data.anchorNodeValue.trim().length === 0)return;

        this.set({index, data});

        // 非追加情况情况需去掉剩下的
        this.historyData.length = index + 1;

        this.currIndex = index;

        this.onChange();
    }

    // 撤销
    undo() {
        let index = this.currIndex - 1;
        if (index > -1) {
            this.select(index);

            this.onChange();

        }
    }

    // 重做
    redo() {

        let index = this.currIndex + 1,
            count=this.historyData.length;
        if (index < count) {
            this.select(index);

            this.onChange();
        }
    }


}


/**
 * 针对PC输入处理
 * 效率处理，避免高频执行
 * */
export default class EditHistoryInput extends EditHistory {
    constructor({eBox,onChange}) {
        super({eBox,onChange});

        let data;

        let excuOne = new ExcuOne();
        let excuDelay = new ExcuDelay();

        let recordCurrent = () => {
            if (excuDelay.getStatus() === false) {
                // 阻止频率触发
                excuOne.excu(() => {
                    data = this.createData();
                });
            }
        };

        let input = () => {
            excuDelay.excu(() => {
                this.set({data});// 覆盖当前记录
                this.add();
                excuOne.clear();
            });
        };

        eBox.addEventListener('keydown', function (e) {
            recordCurrent();
        });
        eBox.addEventListener('mousedown', function (e) {
            eBox.focus();
            recordCurrent();
        });

        eBox.addEventListener('input', function (e) {
            input();
        });

    }

}