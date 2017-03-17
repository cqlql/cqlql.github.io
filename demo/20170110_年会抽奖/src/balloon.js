
import click from 'click';

document.documentElement.style.fontSize = (innerWidth / 300 * 20).toFixed(4) + 'px';

var mask = document.querySelector('.mask'),
    lantern = document.querySelector('.balloon'),
    text = document.querySelector('.text')
    ;

var show = false;

click(document,function () {

    if (show) {

        mask.classList.add('fadeOut');
        lantern.classList.add('bounceOutUp');
    }
    else {
        new Audio(startAudio.src).play();
        lantern.style.opacity = 1;
        mask.classList.remove('fadeOut');
        lantern.classList.remove('bounceOutUp');

        mask.classList.add('fadeIn');
        lantern.classList.add('bounceInUp');

        // 数字显示
        var num=~~(Math.random() * 35)+1;
        if(num>9){

            text.style.fontSize='1.6rem';
            text.style.paddingTop='8%';
        }
        else{
            text.style.fontSize='2rem';
            text.style.paddingTop='0';
        }
        text.textContent = num;

    }

    show = !show;

});