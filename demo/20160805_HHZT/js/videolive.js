/**
 * Created by CQL on 2016/8/12.
 */

'use strict';


(function () {



    var jVideoPlayList=$('#videoPlayList'),
        jBtn=jVideoPlayList.children('.unfold-bar'),
        jList=jVideoPlayList.children('.main'),
        isShow=0;

    jBtn.click(function () {
        if(isShow){
            jVideoPlayList.removeClass('show');
            
            //<span><<</span>

            isShow=0;
        }
        else{
            jVideoPlayList.addClass('show');
            isShow=1;
        }
    });
})();