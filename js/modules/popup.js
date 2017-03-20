/**
 * Created by cql on 2017/3/20.
 */

import click from 'click';

class Popup {

    constructor({ePopup, ePopupMain, beforeClose}) {
        this.ePopup = ePopup;
        this.ePopupMain = ePopupMain;
        this.beforeClose = beforeClose;

        // 禁止操作 开关。关闭动画进行中标识
        this.no = false;
    }

    show({
        beforeShow = () => {
        }
    }={}) {

        beforeShow(this.ePopupMain);

        setTimeout(() => {
            this.ePopup.classList.add('show');
        }, 0);

        return this;
    }

    close() {
        if (this.no || this.beforeClose())return;
        this.no = true;

        this.ePopup.classList.remove('show');
        setTimeout(() => {
            this.no = false;
        }, 300);
    }
}

Popup._init = function ({title, content}) {
    let html = `<div class="full-page-popup">
    <div class="fgp-bg"></div>
    <div class="fgp-main">
        <div class="fgp-bd">
            <div class="fgp-top-bar">
                <div class="tit">${title}</div>
                <b class="close">✖</b></div>
            <div class="fgp-cont">${content}</div>
        </div>
    </div>
</div>`;

    let template = document.createElement('div');
    template.innerHTML = html;

    this.ePopup = template.children[0];
    this.ePopupMain = this.ePopup.children[1];

    document.body.appendChild(this.ePopup);
};

/**
 * @param cache
 * @param content
 * @param beforeShow
 * */
Popup.show = function ({
    cache = false,
    outsideClose = true,
    title = '',
    content = '',
    beforeShow = () => {
    },
    beforeClose = () => {
    }
}) {

    this._init({
        title,
        content
    });

    let that;

    if (cache) {
        // 新弹窗情况

        let p = that = new this({
            ePopup: this.ePopup,
            ePopupMain: this.ePopupMain,
            beforeClose
        });

        p.show({beforeShow});

    }
    else {
        // 全局弹窗情况

        that = this;

        this.beforeClose = beforeClose;

        beforeShow(this.ePopupMain);

        setTimeout(() => {
            this.ePopup.classList.add('show');
        }, 0);
    }

    // 公共部分
    click(that.ePopupMain, e => {
        let classList = e.target.classList;
        if (classList.contains('close')) {
            // 关闭按钮关闭

            that.close();
        }
        else if (outsideClose && classList.contains('fgp-main')) {
            // 点外面关闭

            that.close();
        }

    });


    return that;

};


// 禁止操作 开关。关闭动画进行中标识
let no = false;
/**
 * 全局关闭
 * */
Popup.close = function () {
    if (no || this.beforeClose() === false)return;
    no = true;

    this.ePopup.classList.remove('show');
    setTimeout(() => {
        this.ePopup.remove();
        no = false;
    }, 300);
};



export default Popup;