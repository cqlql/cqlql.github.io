/**
 * Created by cql on 2017/4/21.
 */

import htmlToElems from 'dom/html-to-elems';


function debugMsg() {
    removeElem();
    debugMsg.html += '<p>' + ([].join.call(arguments, ' ')) + '</p>';

    debugMsg.$el = htmlToElems(`<div style="
position: fixed;
top: 0;
left: 0;right:0;
font-size: 16px;
background-color: #eee;
z-index: 999;
padding: 36px 6px 6px;
opacity: .8;
max-height:50%;
overflow: auto;
    "><i style="
padding: 4px 6px;
background-color: red;
color: #fff;
position: fixed;
right: 6px;
top: 6px;
font-style: normal;
    ">✖</i>${debugMsg.html}</div>`)[0];

    debugMsg.$el.children[0].onclick = function () {
        debugMsg.close();
    };

    document.body.appendChild(debugMsg.$el);

    // 滚动到底部
    debugMsg.$el.scrollTop = debugMsg.$el.scrollHeight;
}

debugMsg.html = '';
debugMsg.close = function () {
    removeElem();
    debugMsg.html = '';
};

function removeElem() {
    debugMsg.$el && debugMsg.$el.remove();
    debugMsg.$el = null;
}

export {debugMsg};