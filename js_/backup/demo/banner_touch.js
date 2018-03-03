/**
 * Created by SD01 on 2016/7/7.
 */

var


    eBox = document.querySelector('.banner-show'),
    eMove = eBox.children[0],
    boxW = eBox.clientWidth,

    eItems=eMove.children,

    currpage = 0,
    pageTotal = eItems.length,

    cssTransition = getRightCssName('transition')[0],
    cssTransform = getRightCssName('transform')[0],

    page = 0,//-1 则不进行数据加载

    isRun = false;



var sideslip=Sideslip({
    eBox: eBox,
    boxW: boxW,
    changeRight: function () {
        // 上一页
        prevPage();
    },
    changeLeft: function () {
        // 下一页
        nextPage();
    },
    moveX: function (x) {

        eMove.style.setProperty(cssTransform, 'translate3d(' + ( (-currpage * boxW) + x) + 'px,0,0)');
    },
    inplace: function () {
        anime(currpage);
    },
    resetStart: function () {
        eMove.style.setProperty(cssTransition, '0s');
    },
    getRunState: function () {
        return isRun;
    }
});

resize();

eMove.addEventListener("webkitTransitionEnd", transitionend);
eMove.addEventListener("transitionend", transitionend);

// 移动端在进行操作前需提前初始化，差不多开启硬件加速的意思
eMove.style.setProperty(cssTransform, 'translate3d(0,0,0)');

window.addEventListener('resize',resize);

eBox.children[1].addEventListener('click',function (e) {
    if( e.target.classList.contains('prev')){
        prevPage();
    }
    else{
        nextPage();
    }
});

function resize() {
    boxW = eBox.clientWidth;
    sideslip.setBoxW(boxW);
    for(var i=pageTotal;i--;){
        eItems[i].style.setProperty(cssTransform, 'translate3d(' + (i * boxW) + 'px,0,0)');
    }
    eMove.style.setProperty(cssTransform, 'translate3d(' + (-currpage * boxW) + 'px,0,0)');
}

function anime(index) {
    isRun = true;
    eMove.style.setProperty(cssTransition, '0.3s');

    setTimeout(function () {
        eMove.style.setProperty(cssTransform, 'translate3d(' + (-index * boxW) + 'px,0,0)');

        setTimeout(function () {
            isRun=false;
        }, 300);
    }, 1);

}

function nextPage() {
    var page = currpage;

    page++;

    if (page >= pageTotal) {
        page = currpage;
    }
    currpage = page;

    anime(currpage);

}

function prevPage() {
    var page = currpage;

    page--;
    if (page < 0) {
        page = 0;
    }
    currpage = page;
    anime(currpage);
}

function transitionend() {
    isRun = false;

    // eMove.style.setProperty(cssTransition, '0s');
    // eMove.style.setProperty(cssTransform, 'translate3d(0,0,0)');

}


function Sideslip(params) {

    var
        eBox = params.eBox,
        changeRight = params.changeRight || function () {
            },
        changeLeft = params.changeLeft || function () {
            },
        inplace = params.inplace || function () {
            },
        moveX = params.moveX || function () {
            },
        resetStart = params.resetStart || function () {
            },
        getRunState = params.getRunState || function () {
                return true;
            },

    // 禁用多点
        disableMultipoint = params.disableMultipoint || 0,

    //eMove = params.eMove,
    //change = params.change,
        boxW = params.boxW,
    //count = params.count,

        startX, startY,

    // 0 没反映，1 x 方向，2 y 方向
        status = 0,

    // 拖动情况 松开时 进行滑动的最大偏移值
        offset = boxW / 3,

        currentX = 0,

        curIndex = 0,

    // disableMultipoint=0,

        isMultipoint = 0,

        xVel = new Velocity();

    eBox.addEventListener('touchstart', function (e) {
        if (e.touches.length > 1) {
            isMultipoint = 1;
        }

        if (disableMultipoint && isMultipoint)return;

        if (getRunState()) return;

        if (status === 1) {
            resetStart();
        }

        var touche = e.touches[0];

        startX = touche.pageX;
        startY = touche.pageY;

        xVel.start();

        status = 0;
    });

    eBox.addEventListener('touchmove', function (e) {
        if (disableMultipoint && isMultipoint)return;

        if (getRunState()) return;
        var touche = e.touches[0],
            y = touche.pageY - startY;

        currentX = touche.pageX - startX;

        if (status === 0) {

            if (Math.abs(currentX) > Math.abs(y)) {
                status = 1;
            }
            else {
                status = 2;
            }
        }

        if (status === 1) {

            xVel.change(currentX);

            moveX((currentX - (curIndex * boxW)));

            e.preventDefault();

        }

    });

    eBox.addEventListener('touchend', function (e) {
        if (e.touches.length === 0) {
            isMultipoint = 0;
        }
        if (getRunState()) return;
        if (status === 1) {
            var val = xVel.end();

            //滑动情况
            if (Math.abs(val) > 40) {

                if (val < 0) {
                    // 左滑
                    changeLeft();

                } else {
                    // 右滑
                    changeRight();
                }
            }
            //移动情况
            else {

                // 超过一般情况 滑动
                if (Math.abs(currentX) > offset) {

                    if (currentX > 0) {
                        /// 向右
                        changeRight();
                    }
                    else {
                        /// 左
                        changeLeft();
                    }
                }
                else {
                    // 复位
                    inplace();
                }
            }
        }

    });

    return {
        setBoxW: function (v) {
            boxW = v;
        }

    };

}

function Velocity() {

    var startTime,
        moveTimesArr = [],
        target = this;

    function getSustainTimes() {
        return (new Date()).getTime() - startTime;
    }

    //速率计时
    this.start = function () {
        moveTimesArr = [[0, 0]];
        startTime = (new Date()).getTime();
    };
    this.end = function () {
        var lastIndex = moveTimesArr.length - 1;

        if (lastIndex < 1) return 0;

        //间隔时间
        var intervalTime = getSustainTimes() - moveTimesArr[lastIndex][0];

        //有惯性情况。间隔时间
        if (intervalTime < 200) {
            // 滑动情况一般不会超过50毫秒。如果不够敏感，不应调节这里。条件end 返回的值，往小里调

            return (moveTimesArr[0][1] - moveTimesArr[lastIndex][1]) / intervalTime * 1000;
        }
        //无惯性
        else {
            return 0;
        }
    };

    this.change = function (val) {

        moveTimesArr.unshift([getSustainTimes(), val]);

        if (moveTimesArr.length > 4) moveTimesArr.length = 4;
    };
}

function getRightCssName(cssPropertyName) {
    var
        firstLetter = cssPropertyName[0],
        firstLetterUpper = firstLetter.toUpperCase(),
        cssPrefixes = ["ms" + firstLetterUpper, "Moz" + firstLetterUpper, "webkit" + firstLetterUpper, firstLetter],
        cssPrefixesReal = ["-ms-", "-Moz-", "-webkit-", ''],
        style = document.body.style,
        name = toStyleName(cssPropertyName).substr(1);

    for (var i = cssPrefixes.length, newName; i--;) {
        newName = cssPrefixes[i] + name;

        if (newName in style) {
            return [cssPrefixesReal[i] + cssPropertyName, newName];
        }
    }
    return null;
}

function toStyleName(cssPropertyName) {
    return cssPropertyName.replace(/-\w/g, function (d) {
        return d[1].toUpperCase();
    });
}


