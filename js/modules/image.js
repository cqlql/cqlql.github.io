/**
 * Created by cql on 2017/2/8.
 */


// 图片加载完成
function imgsLoadComplete(imgs,complete) {
    var count = imgs.length;
    var img;
    var j = 0;

    function imgComplete() {
        j++;
        // 所有图片加载完成
        if (j === count) {
            complete();
        }
    }

    for (var i = count; i--;) {
        img = imgs[i];
        if(img.complete){
            imgComplete();
        }
        else{
            img.onload = function () {
                imgComplete();
            };
            img.onerror = function () {
                imgComplete();
            };
        }
    }


}