/**
 * Created by CQL on 2016/8/8.
 */




(function () {
    var c = commonInit();

    var eBox = document.querySelector('.select-rect'),
        boxW = eBox.clientWidth,
        boxH = eBox.clientHeight,
        // boxX=eBox.offsetLeft,boxY=eBox.offsetTop,
        boxX = 0, boxY = 0,

        dragBase = new DragBase,
        isStart = 0,

        transform = c.getRightCssName('transform')[1],

        currBar;

    console.log(eBox.offsetLeft);

    touchBind(window);

    function touchBind() {
        eBox.addEventListener('touchstart', function (e) {

            // console.log('touchstart', e);

            var touches = e.touches;

            if (touches.length === 1) {
                start(e, touches[0]);
            }
        });

        eBox.addEventListener('touchmove', function (e) {
            // console.log('touchmove');

            if (isStart) {
                var touches = e.touches;

                if (touches.length === 1) {
                    move(touches[0]);
                    e.preventDefault();
                }
            }

        });

        eBox.addEventListener('touchend', function (e) {

            var touches = e.touches,
                len = touches.length;

            if (len === 1) {
                // start(e, touches[0]);
            }
            else if(len===0) {
                end();
            }
        });

        eBox.addEventListener('touchcancel', function (e) {
            console.log('touchcancel');
        });

    }

    function DragBase() {
        var
            prevX, prevY,
            toX, toY;

        this.start = function (x, y) {
            prevX = x;
            prevY = y;
            toX = 0;
            toY = 0;
        };

        this.move = function (x, y, fn) {
            toX = x - prevX;
            toY = y - prevY;

            fn(toX, toY);

            prevX = x;
            prevY = y;
        };
    }


    function start(e, touche) {
        var type = e.target.dataset.type;

        if (type !== 'close') {
            isStart = true;
            dragBase.start(touche.pageX, touche.pageY);
            currBar = barFn[type || 'move'];
        }
    }

    function move(touche) {
        dragBase.move(touche.pageX, touche.pageY, function (toX, toY) {
            currBar(toX, toY);
        });
    }

    function end() {
        isStart = false;
    }

    // bar 功能
    var barFn = {
        t: function (toX, toY) {
            boxH -= toY;
            boxY += toY;
            eBox.style.height = boxH + 'px';
            // eBox.style.top=boxY+'px';
            eBox.style[transform] = 'translate3d(' + boxX + 'px,' + boxY + 'px,0)';
        },
        r: function (toX, toY) {
            boxW += toX;
            eBox.style.width = boxW + 'px';

        },
        b: function (toX, toY) {
            boxH += toY;
            eBox.style.height = boxH + 'px';
        },
        l: function (toX, toY) {
            boxW -= toX;
            boxX += toX;
            eBox.style.width = boxW + 'px';
            // eBox.style.left=boxX+'px';
            eBox.style[transform] = 'translate3d(' + boxX + 'px,' + boxY + 'px,0)';
        },

        lt: function (toX, toY) {
            barFn.l(toX, toY);
            barFn.t(toX, toY);
        },
        rt: function (toX, toY) {
            barFn.r(toX, toY);
            barFn.t(toX, toY);
        },
        rb: function (toX, toY) {
            barFn.r(toX, toY);
            barFn.b(toX, toY);
        },
        lb: function (toX, toY) {
            barFn.l(toX, toY);
            barFn.b(toX, toY);
        },
        close: function () {

        },
        move: function (toX, toY) {
            boxX += toX;
            boxY += toY;
            // eBox.style.left=boxX +'px';
            // eBox.style.top=boxY+'px';
            eBox.style[transform] = 'translate3d(' + boxX + 'px,' + boxY + 'px,0)';
        }
    };

    // c.queryElements(eBox, '.t-bar,.r-bar', function (elems) {
    //     rBarFn.prototype.eBar = elems[1];
    // });


})();


//
// c.click(eBox,function () {
//
//
// });

function commonInit() {
    var c = {};
    // 系统判断
    c.isIOS = navigator.appVersion.indexOf('Mac OS') > -1;
    c.isAndroid = navigator.appVersion.indexOf('Android') > -1;
    c.isWX = /micromessenger/i.test(navigator.appVersion);

// 取安卓版本
    c.getAndroidVersion = function () {
        var v;
        return function () {

            if (v === undefined) {
                var r = window.navigator.userAgent.match(/Android (\d.\d)/);
                v = r && r[1];
            }

            return v;
        };
    }();

// click 重写。解决 1、4.4以下webview 原始click灰色；2、ios原始click问题
    c.click = function (elem, fn) {
        var
            touchcancel,
            outmoded = (this.getAndroidVersion() && this.getAndroidVersion() < 4.4) || (this.isIOS);

        if (outmoded) {
            elem.addEventListener('touchend', touchend);
            elem.addEventListener('touchstart', touchstart);
            elem.addEventListener('touchmove', touchmove);
        }
        else {
            elem.addEventListener('click', fn);
        }

        return function () {
            if (outmoded) {
                elem.removeEventListener('touchend', touchend);
                elem.removeEventListener('touchstart', touchstart);
                elem.removeEventListener('touchmove', touchmove);
            }
            else {
                elem.removeEventListener('click', fn);
            }
        };

        function touchend(e) {
            if (touchcancel) return;
            fn.call(this, e);
        }

        function touchstart() {
            touchcancel = false;
        }

        function touchmove() {
            touchcancel = true;
        }
    };

    c.each = function (obj, fn) {
        var
            key,
            len = obj && obj.length;

        if (len === undefined) {
            for (key in obj) {
                if (fn(key, obj[key]) === false) {
                    break;
                }
            }
        } else {
            for (key = 0; key < len; key++) {
                if (fn(key, obj[key], len) === false) {
                    break;
                }
            }
        }
    };

    c.hasClass = function (elem, className) {
        if (elem) return (' ' + elem.className + ' ').indexOf(' ' + className.trim() + ' ') > -1;
        return false;
    };

    c.queryElements = function (rootElem, names, callback) {
        var name,
            resultElems = [],
            test;

        if (typeof names === 'string') names = names.split(',');

        setName();

        go(rootElem.children);

        callback(resultElems);

        function go(childs) {

            c.each(childs, function (i, elem) {
                if (!name) {
                    return false;
                }

                if (test(elem)) {
                    setName();

                    resultElems.push(elem);
                }

                go(elem.children);

            });
        }

        function setName() {
            name = names.shift();

            if (name) {
                if (name.substr(0, 1) === '.') {
                    test = function (elem) {
                        return c.hasClass(elem, name.substr(1));
                    };
                }
                else {
                    test = function (elem) {
                        // html标签 tagName 大写，但svg标签 tagName 小写
                        return elem.tagName.toUpperCase() === name.toUpperCase();
                    };
                }
            }
        }
    };

    c.getRightCssName = function (cssPropertyName) {
        var
            firstLetter = cssPropertyName[0],
            firstLetterUpper = firstLetter.toUpperCase(),
            cssPrefixes = ["ms" + firstLetterUpper, "Moz" + firstLetterUpper, "webkit" + firstLetterUpper, firstLetter],
            cssPrefixesReal = ["-ms-", "-Moz-", "-webkit-", ''],
            style = document.body.style,
            name = c.toStyleName(cssPropertyName).substr(1);

        for (var i = cssPrefixes.length, newName; i--;) {
            newName = cssPrefixes[i] + name;

            if (newName in style) {
                return [cssPrefixesReal[i] + cssPropertyName, newName];
            }
        }
        return [];
    };

    c.toStyleName = function (cssPropertyName) {
        return cssPropertyName.replace(/-\w/g, function (d) {
            return d[1].toUpperCase();
        });
    };

    return c;
}


