/**
 * Created by 陈桥黎 on 2017/1/9.
 */

import Vue from 'vue'
import Animation from 'animation'


document.documentElement.style.fontSize = (innerWidth / 300 * 30).toFixed(4) + 'px';

var transform = autoPrefix('transform')[1];

var vmData = {
    list: [],
    times: localStorage.getItem("times") || 1,
    loading: 0,
    num: 5,//
    finish: getQuotaData().arr[0].length === 0,
    count:getCount()
};

vmData.list = [];
for (var i = vmData.num; i--;) {
    vmData.list.push(
        {
            bc: '78d0f0',
            d: ['-1']
        }
    )
}

var vm = new Vue({
    el:'.random-arr',
    data: vmData,
    directives: {
        click: {
            inserted: function (elem, obj, vnode) {

            }
        }
    },
    watch: {
        times: function (val) {
            localStorage.setItem("times", val)
        },
        num: function (val) {
            if (!val) this.num = 5;
            vmData.list = [];

            var child = vm.$refs.list.children;
            for (var i = val; i--;) {

                vmData.list.push(
                    {
                        bc: '78d0f0',
                        d: [-1]
                    }
                );

               if(child[i]) child[i].children[0].style[transform] = 'translate3d(0,0,0)';
            }

        }
    },
    methods: {
        start: function () {
            new Audio(startAudio.src).play();

            var
                quota = getQuotaData(),
                randomArr = shuffle(quota.arr, this.num),
                showData;// 当前显示的数组

            showData = quota.arr.slice(0);
            showData.push(quota.arr[0]);

            var key = {};
            showData.forEach(function (k, i) {
                key[k] = i;
            });

            var

                curri = 0,
                that = this;

            this.loading = 1;

            that.list = [];
            randomArr.forEach(function (n, i) {

                that.list.push({
                    bc: '78d0f0',
                    d: showData
                });

                // 记录历史
                localStorage.setItem("history",localStorage.getItem("history")+','+(n*1+1));

                Vue.nextTick(function () {
                    var child = that.$refs.list.children;
                    var eMove = child[i].children[0];
                    var len = child.length;

                    effect({quota: quota, index: key[randomArr[n]]}, eMove, key[n], i, function () {
                        curri++;

                        // 此处进行删除
                        setQuotaData(quota, n);

                        // 名额总数
                        that.count=getCount();

                        if (curri === len) {

                            // 最后一次
                            that.loading = 0;

                            // 增加一轮
                            that.times++;

                            // 抽奖结束
                            that.finish = 1;
                            for (var k in quota.obj) {
                                that.finish = 0;
                            }

                            // 记录历史
                            localStorage.setItem("history",localStorage.getItem("history")+'||');
                        }
                    });
                });
            });
        }
    }
});

function getCount() {
    var quota = localStorage.getItem("quota"),
        count = 0;

    quota = (quota.replace(/:/g, function (v) {
        count++;
        return v;
    }));

    return count;
}

function getQuotaData() {

    var quota = localStorage.getItem("quota"),
        count = 0;

    if (!quota) {
        quota = '{}';
        localStorage.setItem("quota", quota);

    }

    var arr = (quota.replace(/("\d+":|{|})/g, '')).split(',');
    var obj = JSON.parse(quota);

    return {
        arr: arr,
        obj: obj
    };

}

function setQuotaData(quota, removeIndex) {

    delete quota.obj[removeIndex];

    localStorage.setItem("quota", JSON.stringify(quota.obj));

}

function effect(data, eMove, key, i, cb) {
    var animation = new Animation;
    var h = 1, fHgt = h * data.quota.arr.length;

    // 可以在此设置圈数
    var length = fHgt * 1 + h * key;

    animation.stop();
    setTimeout(function () {
        animation.start(function (v) {

            v = v * length;

            if (v > fHgt) {
                v = v % fHgt;
            }

            eMove.style[transform] = 'translate3d(0,-' + v + 'rem,0)';

        }, 2000, cb);
    }, i * 100);
}


// 自动前缀
function autoPrefix(cssPropertyName) {
    // 如果有直接返回
    var propertyName = autoPrefix[cssPropertyName];
    if (propertyName !== undefined) return propertyName;

    var
        firstLetter = cssPropertyName[0],
        firstLetterUpper = firstLetter.toUpperCase(),
        cssPrefixes = ["ms" + firstLetterUpper, "Moz" + firstLetterUpper, "webkit" + firstLetterUpper, firstLetter],
        cssPrefixesReal = ["-ms-", "-Moz-", "-webkit-", ''],
        style = document.body.style,
        // css名称转换
        name = cssPropertyName.replace(/-\w/g, function (d) {
            return d[1].toUpperCase();
        }).substr(1);

    for (var i = cssPrefixes.length, newName; i--;) {
        newName = cssPrefixes[i] + name;

        if (newName in style) {
            propertyName = [cssPrefixesReal[i] + cssPropertyName, newName];
            break;
        }
    }

    propertyName = propertyName || null;

    autoPrefix[cssPropertyName] = propertyName;

    return propertyName;
}

// 数组中随机抽取指定个数，返回一个新数组
function shuffle(array, count) {
    array = array.slice(0);

    var currentIndex = array.length, min = currentIndex - count + 1, temporaryValue, randomIndex,
        newArray = [];

    if (min < 1) min = 1;

    // While there remain elements to shuffle...
    while (min <= currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;

        newArray.push(array[currentIndex]);
    }

    return newArray;
}

// 缓动类型
Animation.prototype.easing = function easing(x, t, b, c, d) {
    return -c * (t /= d) * (t - 2) + b;
};




