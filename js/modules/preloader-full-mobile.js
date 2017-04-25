/**
 *
 * 满屏加载中指示
 *
 * Created by cql on 2017/4/24.
 */


import htmlToElems from 'dom/html-to-elems';

import {} from 'preloader-mobile.pcss';

let preloaderFull = {

    el:document.createElement('div'),

    init(){
        // 保证只执行一次
        this.init=function () {
        };


       this.el= htmlToElems(`
<div class="preloader-full">
    <div class="preloader-modal">
        <div class="preloader preloader-white"></div>
    </div>
</div>`)[0];

       document.body.appendChild(this.el);
    },

    // 公开
    show(){
        this.init();
        this.el.classList.add('show');
    },

    close(){
        this.el.classList.remove('show');
    }

};


export default preloaderFull;