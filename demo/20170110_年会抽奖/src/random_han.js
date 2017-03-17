import Vue from 'vue'
import click from 'click'
import Animation from 'animation'
import autoPrefix from 'autoprefix'

document.documentElement.style.fontSize = (innerWidth / 300 * 30).toFixed(4) + 'px';

var transform = autoPrefix('transform')[1];

var text = '天地人你我他一二三四五上下口耳目手足站坐日月水火山石田禾对云雨风花鸟虫六七八九十爸妈马土不画打棋鸡字词语句子桌纸文数学音乐妹奶白皮小桥台雪儿草家是车羊走也秋气了树叶片大飞会个的船两头在里看见闪星江南可采莲鱼东西北尖说春蛙夏弯地就冬男女开关正反远有色近听无声去还来多少黄牛只猫边鸭苹果杏桃书包尺作业本笔刀课早校明力尘从众双木林森条心升国旗中红歌起么美丽立午晚昨今年影前后黑狗左右它好朋友比尾巴谁长短把伞兔最公写诗点要过给当串们以成数彩半空问到方没更绿出睡那海真老师吗同什才亮时候觉得自己很穿衣服快蓝又笑着向和贝娃挂活金哥姐弟叔爷群竹牙用几步为参加洞着乌鸦处找办旁许法放进高住孩玩吧发芽爬呀久回全变工厂医院生青';

var vm = new Vue({
    el: '.random-arr',
    data: {
        list: ['fe7d71', 'c28ee7'],
        text: text
    },
    computed: {
        items: function () {

            // 动画1
//                return '<li class="n-i">' + (this.text.split('')).join('</li><li class="n-i">') + '</li>' + '<li class="n-i">' + this.text[0] + '</li>';

            // 动画2
            return '<li class="n-i">'+(this.text.split('')).join('</li><li class="n-i">')+'</li>';
        }
    },
    directives: {
        click: {
            inserted: function (elem, obj, vnode) {

                click(elem, function () {
                    new Audio(startAudio.src).play();

                    var d = [];
                    for (let j = count; j--;) {
                        d[j] = j;
                    }
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
var count = vm.text.length;

var h = 1, fHgt = h * count;


function effect(animation, eMove, d, i) {

    // 可以在此设置圈数
    var length = fHgt * 1 + h * d[i];

    animation.stop();
    setTimeout(function () {
        animation.start(function (v) {

            v = v * length;

            if (v > fHgt) {
                v = v % fHgt;
            }

            eMove.style.marginTop = -v + 'rem';

        }, 1000);
    }, i * 100);
}

function effect2(animation, eMove, d, i) {

    // 可以在此设置圈数
    var length = count * 1 + i;

    animation.stop();

    setTimeout(function () {
        animation.start(function (v) {

            v = ~~(v * length);

            v = v % count;

            eMove.style[transform] = 'translate3d(0,' + (-d[v] * h) + 'rem,0)';

        }, 1000);
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
