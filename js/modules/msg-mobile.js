/**
 * Created by cql on 2017/4/21.
 */

import {} from 'common-mobile';
import htmlToElems from 'dom/html-to-elems';
import {click} from 'dom-handle';

import {} from 'msg-mobile.pcss';


function debugMsg() {
    debugMsg.removeElem();
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
padding: 6px;
width: 20px;
height: 20px;
background-color: red;
color: #fff;
position: fixed;
right: 5px;
top: 5px;
font-style: normal;
text-align: center;
    font-size: 22px;
    line-height: 1;
    ">✖</i>${debugMsg.html}</div>`)[0];

    click(debugMsg.$el.children[0], function () {
        debugMsg.close();
    });
    // debugMsg.$el.children[0].onclick = function () {
    //     debugMsg.$el.innerHTML=123;
    // debugMsg.close();
    // };

    document.body.appendChild(debugMsg.$el);

    // 滚动到底部
    debugMsg.$el.scrollTop = debugMsg.$el.scrollHeight;
}
debugMsg.html = '';
debugMsg.close = function () {
    this.removeElem();
    this.html = '';
};
debugMsg.removeElem = function () {
    this.$el && this.$el.remove();
    this.$el = null;
};


function simpleMsg(msgCont) {

    let msg = document.createElement('div');
    msg.className='simple-msg';
    msg.textContent=msgCont;
    document.body.appendChild(msg);

    msg.addEventListener("transitionend", function () {
        msg.remove();
    });
    msg.addEventListener("webkitTransitionEnd", function () {
        msg.remove();
    });

    setTimeout(function () {
        msg.classList.add('hide');
    }, 1200);

}

export {debugMsg as dMsg, simpleMsg};