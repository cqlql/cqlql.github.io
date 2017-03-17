import Vue from 'vue'
import click from 'click'
import Animation from 'animation'
import autoPrefix from 'auto_prefix'

document.documentElement.style.fontSize = (innerWidth / 300 * 30).toFixed(4) + 'px';

var transform = autoPrefix('transform')[1];

var vm = new Vue({
    el: '.random-arr',
    data: {
        list: ['78d0f0', 'fe7d71', '63b473', 'c28ee7', 'ecd775']
    },
    directives: {
        click: {
            inserted: function (elem, obj, vnode) {

                click(elem, function () {
                    new Audio(startAudio.src).play();

                    var d = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
                    shuffle(d);

                    let i = 0;
                    for (let eBox of vnode.context.$refs.list.children) {
                        let animation = new Animation,
                            eMove = eBox.children[0];

                        effect2(animation, eMove, d, i);
                        i++;
                    }

                });
            }
        }
    }
});
var h = 1, fHgt = h * 10;

function effect(animation, eMove, i) {


    // 可以在此设置圈数
    var length = fHgt * 1 + h * ~~(Math.random() * 10);

    animation.stop();
    setTimeout(function () {
        animation.start(function (v) {

            v = v * length;

            if (v > fHgt) {
                v = v % fHgt;
            }

            eMove.style.marginTop = -v + 'rem';

        }, 2000);
    }, i * 100);
}

function effect2(animation, eMove, d, i) {

    // 可以在此设置圈数
    var length = 21 * 1 + i;

    animation.stop();

    setTimeout(function () {
        animation.start(function (v) {

            v = ~~(v * length);

            v = v % 21;

            eMove.style[transform] = 'translate3d(0,' + (-d[v] * h) + 'rem,0)';

        }, 2000);
    }, i * 100);
}


// 洗牌
function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}
