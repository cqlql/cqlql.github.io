/**
 *
 * 满屏加载中指示
 *
 */

let preloaderFull = {

    el:document.createElement('div'),

    init(){
        // 保证只执行一次
        this.init=function () {
        };


     let el= document.createElement('div');

      el.innerHTML = `
<div class="preloader-full">
    <div class="preloader-modal">
        <div class="preloader preloader-white"></div>
    </div>
</div>`;

      this.el = el = el.children[0]

       document.body.appendChild(el);
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
