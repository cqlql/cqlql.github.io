/**
 * Created by cql on 2017/5/9.
 */

import EditHistoryInput from './edit-history.js';
import {$, shortcutKey, scopeElements, htmlToElems,htmlToNodes, insertAfter, queryElements} from 'dom-handle';
import {ExcuDelay, ExcuOne} from 'time-handle';

let editCont = document.querySelector('.edit-cont'),
    eToolBar = document.querySelector('.tool-bar')
    , toolBtnUndo
    , toolBtnRedo;

queryElements(eToolBar, '.undo,.redo', function (elems) {
    toolBtnUndo = elems['.undo'];
    toolBtnRedo = elems['.redo'];
});

let editHistory = new EditHistoryInput({
    eBox: editCont,
    onChange(){

        let isFirst = this.currIndex === 0,
            isLast = this.currIndex === this.historyData.length - 1;

        if (isFirst) {
            toolBtnUndo.classList.add('disabled');
        }
        else {
            toolBtnUndo.classList.remove('disabled');
        }
        if (isLast) {
            toolBtnRedo.classList.add('disabled');
        }
        else {
            toolBtnRedo.classList.remove('disabled');
        }
    }
});

eToolBar.addEventListener('click', function (e) {
    let
        btn = e.target,
        set = tool[btn.getAttribute('type')];
    if (set) {
        set();
    }
});

// 快捷键
shortcutKey({
    elem: editCont,
    ctrl: function (code) {

        if (code === 89) {
            // ctrl + y

            editHistory.redo();
            return false;
        }
        else if (code === 90) {
            // ctrl + z

            editHistory.undo();
            return false;
        }
        else if (code === 83) {
            // ctrl + s
            return false;
        }
    },
    ctrlShift: function (code) {

        if (code === 90) {
            // ctrl + shift + z
            console.log('ctrl + shift + z');

            editHistory.redo();
            return false;
        }

    }
});


let tool = {
    // 设置粗体
    bold: function () {

    }

    // 删除线
    , strikeThrough: function () {

    }
    // 删除
    , delete: function () {

    }
    // 超链接
    , hyperlink: function () {

    }
    // 撤销
    , undo: function () {
        editHistory.undo();

    }
    // 重做
    , redo: function () {
        editHistory.redo();
    }

    // 重点1
    , 'em-red': function () {

    }

    // code-javascript
    , "code-javascript": function () {

    }

    , insertHxModule: function (text) {

    }
    , h1: function () {

    }
    , h2: function () {

    }
    , h3: function () {

    }
    , h4: function () {

    }
    , h5 () {

    },


    hx(){

        scopeElements(getAnchorNode(), function (elem, child) {

            if (!elem) {
                return false;
            }

            if (elem === editCont) {

                return false;
            }

            if (elem.tagName[0] === 'H') {

                return false;
            }

            if (elem.classList.contains('content')) {
                var result, parent = elem.parentElement;
                if (result = parent.className.match(/h(\d)-main/)) {

                    var level = result[1];

                    // 覆盖当前
                    editHistory.set();

                    var hx = htmlToElems('<div class="h' + level + '-main"><h' + level + '>' + (child.outerText.trim() ? child.outerText : '标题' + level) + '</h' + level + '><div class="content"></div></div>')[0];

                    hx.children[1].appendChild(getNextAllNode(child));

                    insertAfter(parent, hx);

                    child.remove();

                    getSelection().selectAllChildren(hx.children[0]);

                    // 增加历史
                    editHistory.add();

                    return false;
                }
            }

        });

        function getNextAllNode(elem) {

            var df = document.createDocumentFragment();

            excu();

            return df;

            function excu() {
                var next = elem.nextSibling;

                if (!next || (next.nodeType === 1 && next.className.match(/h\d-main/)))return;

                df.appendChild(next);

                excu();
            }

        }
    }

    , 'hx-child'(){

        scopeElements(getAnchorNode(), function (elem, child) {

            if (!elem) {
                return false;
            }

            if (elem === editCont) {
                add(2, child);
                return false;
            }

            if (elem.tagName[0] === 'H') {

                return false;
            }

            if (elem.classList.contains('content')) {
                var result;
                if (result = elem.parentElement.className.match(/h(\d)-main/)) {

                    add(result[1] * 1 + 1, child);

                    return false;
                }
            }

        });

        function add(level, child) {
            if (level <= 6) {
                // 覆盖当前
                editHistory.set();

                var hx = htmlToElems('<div class="h' + level + '-main"><h' + level + '>' + (child.outerText.trim() ? child.outerText : '标题' + level) + '</h' + level + '><div class="content"></div></div>')[0];

                hx.children[1].appendChild(getNextAllNode(child));

                insertAfter(child, hx);

                child.remove();

                getSelection().selectAllChildren(hx.children[0]);

                // 增加历史
                editHistory.add();
            }
        }

        function getNextAllNode(elem) {

            var df = document.createDocumentFragment();

            excu();

            return df;

            function excu() {
                var next = elem.nextSibling;

                if (!next || (next.nodeType === 1 && next.className.match(/h\d-main/)))return;

                df.appendChild(next);

                excu();
            }

        }
    }
    , 'hx-parent'(){
        scopeElements(getAnchorNode(), function (elem, child) {

            if (!elem) {
                return false;
            }

            if (elem === editCont) {
                return false;
            }

            if (elem.tagName[0] === 'H') {

                return false;
            }

            if (elem.classList.contains('content')) {
                var result, parent = elem.parentElement;
                if (result = parent.className.match(/h(\d)-main/)) {

                    add(result[1] * 1 - 1, child, parent);

                    return false;
                }
            }

        });

        function add(level, child, hMain) {
            if (level > 1) {
                // 覆盖当前
                editHistory.set();

                var hx = htmlToElems('<div class="h' + level + '-main"><h' + level + '>' + (child.outerText.trim() ? child.outerText : '标题' + level) + '</h' + level + '><div class="content"></div></div>')[0];

                hx.children[1].appendChild(getNextAllNode(child));

                insertAfter(hMain.parentElement.parentElement, hx);

                child.remove();

                getSelection().selectAllChildren(hx.children[0]);

                // 增加历史
                editHistory.add();
            }
        }

        function getNextAllNode(elem) {

            var df = document.createDocumentFragment();

            excu();

            return df;

            function excu() {
                var next = elem.nextSibling;

                if (!next || (next.nodeType === 1 && next.className.match(/h\d-main/)))return;

                df.appendChild(next);

                excu();
            }

        }
    }

    ,removeformat(){
        editHistory.set();

        var selection = window.getSelection(), range,
            elem;

        if (selection.isCollapsed) {

            elem = selection.anchorNode.parentElement;
            elem.removeAttribute('class');
            elem.removeAttribute('style');

            if (elem.tagName === 'SPAN') {
                var textNode = htmlToNodes(elem.innerText)[0];
                elem.remove();
                range = selection.getRangeAt(0);
                range.insertNode(textNode);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            else {
                editCont.focus();
            }
        }
        else {
            elem = htmlToNodes(selection.toString())[0];

            selection.deleteFromDocument();
            range = selection.getRangeAt(0);
            range.insertNode(elem);
            range.selectNode(elem);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        editHistory.add();
    }

    // 删除标题模块
    , delHx: function () {

    }

    // 小标题1
    , minh1: function () {


    }

    // 测试
    , test: function () {

    }
};


function getAnchorNode() {
    return window.getSelection().anchorNode;
}