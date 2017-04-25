/**
 * 弹窗 - v1.1.0
 *
 *
 * Created by cql on 2017/3/20.
 */

import click from 'dom/click';
import {} from 'popup.pcss';


class Popup {

    constructor({
                    title = '',
                    content = '',
                    width,
                    outsideClose = true,
                    hasTopBar = true,
                    created = () => {
                    },
                    beforeShow = () => {
                    },
                    beforeClose = () => {
                    },
                    afterClose = () => {
                    }
                } = {}) {

        this.title = title;
        this.content = content;
        this.outsideClose = outsideClose;
        this.width = width;
        this.hasTopBar = hasTopBar;
        this.created = created;
        this.beforeShow = beforeShow;
        this.beforeClose = beforeClose;
        this.afterClose = afterClose;

        // 禁止操作 开关。关闭动画进行中标识
        this.no = false;

        // 公开
        this.rootElem = null;// 根元素
        this.ePopupMain = null;// 居中内容的上一层
        this.ePopupCont = null;// 内容层，可控制窗口宽度
    }

    init() {
        this.init = function () {
        };


        let html = `<div class="full-page-popup">
    <div class="fgp-bg"></div>
    <div class="fgp-main">
        <div class="fgp-bd">
            ${this.hasTopBar ? '<div class="fgp-top-bar"><div class="tit">' + this.title + '</div><b class="close">✖</b></div>' : ''}
            <div class="fgp-cont">${this.content}</div>
        </div>
    </div>
</div>`;

        let template = document.createElement('div');
        template.innerHTML = html;

        this.rootElem = template.children[0];
        this.ePopupMain = this.rootElem.children[1];
        this.ePopupCont = this.ePopupMain.children[0];

        if (this.width) {
            this.ePopupCont.style.width = this.width + 'px';
        }

        document.body.appendChild(this.rootElem);

        // 关闭处理
        click(this.ePopupMain, e => {
            let classList = e.target.classList;
            if (classList.contains('close')) {
                // 关闭按钮关闭

                this.close();
            }
            else if (this.outsideClose && classList.contains('fgp-main')) {
                // 点外面关闭

                this.close();
            }

        });

        this.created();
    }

    show({width}={}) {

        this.init();

        if (width) {
            this.width = width;
            this.ePopupCont.style.width = width + 'px';
        }

        this.beforeShow();

        setTimeout(() => {
            this.rootElem.classList.add('show');
        }, 0);

    }

    close() {
        if (this.no || this.beforeClose())return;
        this.no = true;

        this.rootElem.classList.remove('show');
        setTimeout(() => {
            this.no = false;
            this.afterClose(this.rootElem);
        }, 300);
    }
}

export function popup({
                          title,
                          content,
                          beforeShow = () => {
                          },
                          beforeClose = () => {
                          },

                      }) {

    let newPopup = new Popup({
        title,
        content,
        beforeShow,
        beforeClose,
        afterClose(rootElem){
            // 清理元素
            rootElem.remove();
        }
    });

    newPopup.show();

    popup.close = function () {
        newPopup.close();
    };

    return newPopup;
}

// 避免还没调用过弹窗，此时弹窗未初始首先调用close报错
popup.close = function () {
};


export function confirmPopup({
                                 title, des,
                                 confirm = () => {
                                 },
                                 cancel = () => {
                                 }

                             }) {

    let popup,
        eTitle,
        eDes,
        gConfirm = confirm,
        gCancel = cancel;

    function init(mainElem) {
        init = function () {
        };
        eTitle = mainElem.querySelector('.tit');
        eDes = mainElem.querySelector('.des');

        click(mainElem.querySelector('.btns'), function (e) {


            let classList = e.target.classList;
            if (classList.contains('sure-btn')) {
                gConfirm();
            }
            else if (classList.contains('cancel-btn')) {
                popup.close();
                // gCancel();
            }
        });
    }

    confirmPopup = function ({
                                 title, des,
                                 confirm = () => {
                                 },
                                 cancel = () => {
                                 }
                             }) {
        gConfirm = confirm;
        gCancel = cancel;

        eTitle.textContent = title;
        eDes.textContent = des;

        popup.show();

    };
    popup = new Popup({

        title: title,
        content: `<div class="confirm-box">
<div class="des">${des}</div>
<div class="btns">
    <a class="button sure-btn" href="javascript:;">确认</a>
    <a class="button cancel-btn" href="javascript:;">取消</a>
</div>
</div>`,
        created(){
            init(this.ePopupMain);
        }

    });

    confirmPopup.close = function () {
        popup.close();
    };

    popup.show();
}
// 避免还没调用过弹窗，此时弹窗未初始首先调用close报错
confirmPopup.close = function () {
};

export default Popup;