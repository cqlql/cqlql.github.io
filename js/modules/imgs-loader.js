/**
 * Created by cql on 2017/3/17.
 */

/**
 * 图片加载，完成回调
 *
 * 针对多图
 *
 * 使用onload，所以会在图片完全加载出来后才会回调
 * 使用onerror所以出错或者有缓存也会认为加载完成
 *
 * @param paths(Array) 图片路径数组
 * @param complete(fun) 加载完回调
 * */
export default function imgsLoader(paths, complete) {
    let count = paths.length;
    let j = 0;

    function imgComplete(img) {
        j++;
        // 所有图片加载完成
        if (j === count) {
            complete();
        }
    }

    for (let i = count; i--;) {
        let path = paths[i];
        let img=new Image();

        img.onload = function () {
            imgComplete(img);
        };
        img.onerror = function () {
            imgComplete(img);
        };

        img.src = path;
    }
}