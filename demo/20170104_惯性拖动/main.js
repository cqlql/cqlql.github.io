/**
 * Created by cql on 2017/1/6.
 */

// import drag from 'drag';
import drag from 'drag-mobile';
import Animation from 'animation';
import easing from 'easing';


let animation = new Animation;
animation.easing = easing.easeOutCubic;

let eDrag = document.querySelector('.drag');
let x = 0, y = 0, speedX, speedY;
let preTime;

drag({
    eDrag,
    onMove ({x:toX, y:toY,event}) {

        x += toX;
        y += toY;

        eDrag.style.transform = 'translate3d(' + ~~x + 'px,' + ~~y + 'px,0)';

        speedX = toX;
        speedY = toY;

        preTime = Date.now();

        event.preventDefault();

    },
    onDown () {
        speedY = speedX = 0;
        animation.stop();

    },
    onUp () {

        if (speedX || speedY) {
            let time = Date.now() - preTime + 1;
            let sx = speedX * 2 / time;
            let sy = speedY * 2 / time;

            animation.start(function (p) {

                x += (1 - p) * sx;
                y += (1 - p) * sy;

                eDrag.style.transform = 'translate3d(' + (~~x) + 'px,' + (~~y) + 'px,0)';

            }, 1400);
        }
    }
});