/**
 * Created by cql on 2017/4/15.
 */

import preloaderFull from './full-preloader';

showBtn.addEventListener('click',function () {
    // 显示
    preloaderFull.show();

    setTimeout(function () {
        // 关闭
        preloaderFull.close();

    },1000);
});
