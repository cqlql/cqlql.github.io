/**
 * Created by cql on 2017/4/11.
 *
 * 浏览器窗口滚动条 动画 滚动到顶部
 *
 */

import Animation from 'animation';

export default function goTop() {

    let animation = new Animation,
        isRun = 0;

    goTop = function () {

        let y = pageYOffset;
        if (y && !isRun) {

            isRun = 1;
            animation.start(function (p) {
                window.scrollTo(0, y * (1 - p));
            }, 400, function () {
                isRun = 0;
            });
        }
    };

    goTop();
}