/**
 * Created by cql on 2017/3/17.
 */


/**
 * 图片是否全部就绪，就绪则回调
 *
 *
 * 使用onload，所以会在图片完全加载出来后才会回调
 * 使用onerror、img.complete 所以出错或者有缓存也会认为加载完成
 *
 * @param imgs(elem) img对象
 * @param complete(fun) 加载完回调
 * */
export default function imgsComplete(imgs,complete) {
    let count = imgs.length,img,j = 0;

    function imgComplete() {
        j++;
        // 所有图片加载完成
        if (j === count) {
            complete();
        }
    }

    for (let i = count; i--;) {
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


