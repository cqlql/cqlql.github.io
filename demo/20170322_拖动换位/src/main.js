/**
 * Created by cql on 2017/3/22.
 */

import DragExchange from 'drag-exchange';
import htmlToElems from 'dom/html-to-elems';

let eBox = document.querySelector('.drag-box');
let dragExchange = new DragExchange(eBox);

eBox.addEventListener('click', function (e) {
    if (e.target.classList.contains('del')) {
        dragExchange.delItem(e.target.parentElement.parentElement.dataset.index)
    }
});

add.addEventListener('click', function () {
    dragExchange.addItems(htmlToElems(`
    <div class="drag-item">
        <div class="drag-item-cont">
            <a href="javascript:console.log(\'可点击\');">text11111</a> <a class="del" title="删除" href="javascript:;">X</a>
        </div>        
    </div>
    <div class="drag-item">
        <div class="drag-item-cont">
            <a href="javascript:console.log(\'可点击\');">text222222222222222</a> <a class="del" title="删除" href="javascript:;">X</a>       
        </div>
    </div>`));
});
