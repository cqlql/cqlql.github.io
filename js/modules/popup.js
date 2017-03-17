/**
 * Created by cql on 2017/2/18.
 *
 * 每次弹窗都将重新创建元素，绑定事件等
 * 关闭将删除元素
 *
 * 通过 css 控制窗口大小，内容滚动条等
 * 内容css选择器：.full-page-popup .fgp-ctn
 *
 * var popup = new Popup();
 *
 * 弹窗
 * popup.show();
 *
 * 关闭
 * popup.close();
 *
 * 钩子事件参考
 create

 open

 focus

 dragStart

 drag

 dragStop

 resizeStart

 resize

 resizeStop

 beforeClose

 close

 *
 *
 */

import click from 'click';


class Popup {

    constructor() {

    }

    remove() {
        this.ePopup.remove();
    }

    close() {

        this.ePopup.classList.remove('show');

        // 关闭动画完成后
        setTimeout(e => this.remove(), 300);
    }

    show({
        content = '没有内容',
        oncreate = () => {
        }

    }
        ={}) {

        let html = `<div class="full-page-popup">
    <div class="fgp-bg"></div>
    <div class="fgp-main">
        <div class="fgp-ctn">${content}</div>
    </div>
</div>`;

        let template = document.createElement('div');

        template.innerHTML = html;

        let ePopup = this.ePopup = template.children[0];
        let ePopupMain = this.ePopupMain = ePopup.children[1];

        click(ePopupMain,e=>{
            if (e.target.classList.contains('fgp-main')) {
                this.close();
            }
        });


        document.body.appendChild(ePopup);

        oncreate(this);

        setTimeout(function () {
            ePopup.classList.add('show');
        }, 0);

    }

}

export default Popup;