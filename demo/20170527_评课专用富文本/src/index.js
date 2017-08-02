/**
 * Created by cql on 2017/5/27.
 */

import {click, htmlToElems, insertAfter, insertBefore, queryElements, scopeElements} from "dom-handle";
import {dMsg} from "msg-mobile";
import {isIOS} from "device";
import ExcuInterval from "excu-interval";
require("click-vue");

let global = window;

global.js = {

    saveData(){
        let d = [];
        let child = eEdit.children;

        for (let i = 0, len = child.length, item; i < len; i++) {
            item = child[i];

            switch (item.dataset.type) {

                case '1':
                    d.push({
                        "content": item.children[0].src,
                        "content_type": 1,
                        "label": item.dataset.label*1,
                        "display_order": 2,
                        "time_length": "2"
                    });
                    break;
                case '2':
                    // child.push({
                    //     "content": item.innerText,
                    //     "content_type": 0,
                    //     "label": item.dataset.label*1,
                    //     "display_order": 2,
                    //     "time_length": "2"
                    // });
                    break;
                default:
                    d.push({
                        "content": item.innerText,
                        "content_type": 0,
                        "label": item.dataset.label*1,
                        "display_order": 2,
                        "time_length": "2"
                    });
            }

        }

        global.webjs.saveData(d);
    },

    addPicture(){

        addBox({
            className:'suggest',
            html:'<img src="//www.baidu.com/img/bd_logo1.png" width="100%">&nbsp;',
            type:1,
            label:activeBox.dataset.label*1
        });
    },

    addAudio(time){
        addBox({
            className: 'suggest',
            html: '<p></p><a class="audio">'+time+'s</a>',
            type: 2,
            label:activeBox.dataset.label*1
        });

    }
};


// 有点，建议框
function addBox({
                    html,
                    type,
                    label
                }) {

    let className='general';
    switch (label){
        case 0:
            className='merit';
            break;
        case 1:
            className='suggest';
            break;
    }

    let eRecordBox = htmlToElems(`<div class="${className}" contenteditable="true" data-type="${type}" data-label="${label}">${html}</div>`)[0];

    insertBefore(eBlankRecordBox, eRecordBox);

    delHandle(eRecordBox);

    eRecordBox.onfocus=function () {
        activeBox=this;
    };

    if (isIOS) {
        eRecordBox.focus();
    }
    else {
        setTimeout(function () {
            eRecordBox.focus();
        }, 10)
    }

    setTimeout(function () {
        eRecordBox.focus();
        let selection = global.getSelection();
        let range = document.createRange();
        range.selectNode(eRecordBox.lastChild);
        range.collapse(false);

        selection.removeAllRanges();
        selection.addRange(range);
    }, 20);
}


let eBox,
    eEdit, eToolBar,
    eBlankRecordBox,
    activeBox;

queryElements(document.body, '.classes-estimate-editor,.cee-edit,.general,.cee-bottom-tool-bar', function (elems) {

    eBox = elems[0];
    eEdit = elems[1];
    eBlankRecordBox = elems[2];
    eToolBar = elems[3];

    activeBox = eBlankRecordBox;
});

click(eToolBar, function (e) {

    scopeElements(e.target, function (elem) {
        if (eToolBar === elem) return false;

        if (elem.className === 'item') {
            let eRecordBox, selection, range;
            switch (elem.children[0].classList[0]) {
                case 'merit-btn':
                    // 优点

                    addBox({
                        html: '&nbsp;',
                        type: 0,
                        label:0
                    });

                    break;
                case 'suggest-btn':
                    // 建议

                    addBox({
                        html: '&nbsp;',
                        type: 0,
                        label:1
                    });

                    break;
                // case 'key-btn':
                //     // 键盘
                //     break;
                case 'enamel-btn':
                    //

                    global.webjs.draw();
                    break;
                case 'camera-btn':
                    console.log(123)
                    global.webjs.camera();
                    break;
                case 'voice-btn':
                    global.webjs.voice();
                    break;
            }

            return false;
        }

    });
});

/*eBlankRecordBox.oninput = function () {
 let eRecordBox = htmlToElems(`
 <div class="general" contenteditable="true">${eBlankRecordBox.innerHTML}</div>
 `)[0];

 eBlankRecordBox.innerHTML = '';

 delHandle(eRecordBox);

 insertBefore(eBlankRecordBox, eRecordBox);

 let selection = window.getSelection();
 let range = document.createRange();
 range.selectNode(eRecordBox.lastChild);
 selection.removeAllRanges();
 selection.addRange(range);
 selection.collapseToEnd();

 }*/

eBlankRecordBox.oninput = function () {

    let eRecordBox = htmlToElems(`<div class="general none" contenteditable="true" data-label="2"></div>`)[0];

    eRecordBox.oninput = eBlankRecordBox.oninput;

    eEdit.appendChild(eRecordBox);
    eBlankRecordBox.className = 'general';
    delHandle(eBlankRecordBox);

    eBlankRecordBox = eRecordBox;

    eBlankRecordBox.onfocus=function () {
        activeBox=this;
    };
};

eBlankRecordBox.onfocus=function () {
    activeBox=this;
};

function delHandle(elem) {
    let excuInterval = new ExcuInterval(),
        isDel = 0;

    elem.addEventListener('keydown', function (e) {

        switch (elem.dataset.type){
            case '1':
            case '2':
                // 其它附件
                if (e.keyCode === 8) {
                    elem.remove();
                }

                e.preventDefault();
                break;
            default:
                // 文本删除

                if (e.keyCode === 8) {
                    isDel = 1;
                }
        }

    });

    elem.oninput = function (e) {

        if (isDel) {
            excuInterval.excu(function () {
                if (elem.innerText.trim().length) {

                }
                else {
                    elem.remove();
                }
            });
        }
    };

}

// 编辑情况
global.transmitData=function (data) {

    data.forEach(function (d) {
        let
            type=d.content_type,
            html='';

        switch (type){
            case 1:case 3:
            html='<img src="'+d.content+'" width="100%">&nbsp;';
                break;
            case 2:
            html='<p></p><a class="audio">16s</a>';
            break;
            default:
                html=d.content;
        }

        addBox({
            html,
            type,
            label:d.label
        });
    });
};
