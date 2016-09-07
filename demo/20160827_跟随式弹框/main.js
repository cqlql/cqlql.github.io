/**
 * Created by CQL on 2016/8/27.
 */
var c = commonInit();
var followPopup = new FollowPopup({
    event: function (elem) {

        if (elem.classList.contains('caution')) {
            followPopup.hide();
            return false;
        }
        if (elem.classList.contains('button')) {
            console.log('确定');
            return false;
        }

    },
    html: '<div class="confirm-cont"><p>确认删除？？</p><div class="btns"><a class="button">确认</a><a class="button caution">取消</a></div></div>',
    onInit: function (params) {
        params.eMsgBox.classList.add('confirm');
    }
});

document.addEventListener('click', function (e) {

    c.scopeElements(e.target, function (elem) {
        if (!elem || elem === document.body) {
            return false;
        }

        if (elem.className.indexOf('pbtn') > -1) {


            var xy = relativeXY(elem),
                w = elem.clientWidth,
                h = elem.clientHeight;

            followPopup.show({
                x: xy.x - pageXOffset,
                y: xy.y - pageYOffset,
                w: w,
                h: h,
                ml: 4,
                mt: (elem.className.indexOf('center') > -1 ? -(66-h) / 2 : 4),
                d: elem.className.split(' ')[0]
            });
            return false;
        }
    });
});

/*
 * @params event
 * @params content
 * @params onInit
 *
 * # FollowPopup.eMsgBox
 *
 * # FollowPopup.hide
 *
 * # FollowPopup.show
 * @params d t 上 r 右 b 下 l 左
 * 考虑滚动条情况
 followPopup.show({
 y: y - window.pageYOffset,
 });
 *
 * */
function FollowPopup(params) {

    var
        event = params.event || function () {
            },
        html = params.html,
        onInit = params.onInit || function () {
            },

        transform,
        eMsgBox, outsideClose;

    this.show = show;
    this.hide = hide;
    this.eMsgBox = eMsgBox;

    function init() {

        transform = getRightCssName('transform')[1];

        eMsgBox = document.createElement('div');
        eMsgBox.className = 'follow-popup';
        document.body.appendChild(eMsgBox);

        eMsgBox.addEventListener('click', function (e) {
            outsideClose.inside();
            c.scopeElements(e.target, function (elem) {
                if (elem === eMsgBox)return false;
                return event(elem);
            });
        });


        outsideClose = new OutsideClose(hide);

        if (html) eMsgBox.innerHTML = html;

        onInit({
            eMsgBox: eMsgBox
        });

        init = function () {
        };

    }

    function show(params) {
        init();

        outsideClose.inside();

        var
            ox = params.x, oy = params.y, // 某参照元素左上角坐标
            ml = params.ml || 0, mt = params.mt || 0,
            w = params.w || 0, h = params.h || 0, // 参照元素高宽
            x = ox + ml, y = oy + mt,
            d = params.d || 'rb',
            html = params.html;

        var endX, endY, boxW, boxH, xd = 'r', yd = 'b',
            winW = window.innerWidth, winH = window.innerHeight;

        if (html) eMsgBox.innerHTML = html;

        boxW = eMsgBox.offsetWidth;
        boxH = eMsgBox.offsetHeight;

        switch (d) {
            case 't': // 上
                top();
                break;
            case 'r': // 右
                right();
                break;
            case 'b': // 下
                bottom();
                break;
            case 'l': // 左
                left();
                break;
        }

        // 限制
        if (x < 0) {
            x = 0;
        }
        if (y < 0) {
            y = 0;
        }

        eMsgBox.classList.add('show');
        eMsgBox.style.setProperty(transform, 'translate3d(' + x + 'px,' + y + 'px,0)');

        function top() {
            y = oy - boxH - mt;

            endX = x + boxW;

            // 超出换向下显示
            if (y < 0) {
                bottom();
            }
            // 边界限制
            if (endX > winW) {
                x = winW - boxW;
            }
        }

        function right() {
            x = ox + w + ml;

            endX = x + boxW;
            endY = y + boxH;

            // 超出换向左显示
            if (endX > winW) {
                left();
            }
            // 边界限制
            if (endY > winH) {
                y = winH - boxH;
            }

        }

        function bottom() {
            y = oy + h + mt;

            endX = x + boxW;
            endY = y + boxH;

            // 超出换向上显示
            if (endY > winH) {
                top();
            }
            // 边界限制
            if (endX > winW) {
                x = winW - boxW;
            }

        }

        function left() {
            x = ox - boxW - ml;

            endY = y + boxH;

            // 超出换向右显示
            if (x < 0) {
                right();
            }
            // 边界限制
            if (endY > winH) {
                y = winH - boxH;
            }
        }
    }

    function hide() {
        eMsgBox.classList.remove('show');
    }

    function OutsideClose(close) {

        var inside = false;

        document.addEventListener('click', function () {
            if (inside) {
                inside = false;
            }
            else {
                close();
            }
        });

        this.inside = function () {
            inside = true;
        };

    }

    /// 基础功能
    function getRightCssName(cssPropertyName) {
        var
            firstLetter = cssPropertyName[0],
            firstLetterUpper = firstLetter.toUpperCase(),
            cssPrefixes = ["ms" + firstLetterUpper, "Moz" + firstLetterUpper, "webkit" + firstLetterUpper, firstLetter],
            cssPrefixesReal = ["-ms-", "-Moz-", "-webkit-", ''],
            style = document.body.style,
            name = cssPropertyName.replace(/-\w/g, function (d) {
                return d[1].toUpperCase();
            }).substr(1);

        for (var i = cssPrefixes.length, newName; i--;) {
            newName = cssPrefixes[i] + name;

            if (newName in style) {
                return [cssPrefixesReal[i] + cssPropertyName, newName];
            }
        }
        return null;
    }


}


function relativeXY(initial, target) {

    var x = 0, y = 0,
        _target = initial;
    target = target || document.body;

    while (_target !== target) {
        x += _target.offsetLeft;
        y += _target.offsetTop;

        _target = _target.offsetParent;
    }

    return {x: x, y: y};
}


function commonInit() {
    var c = {};

    c.scopeElements = function (targetElem, listener) {
        targetElem = targetElem.nodeType === 1 ? targetElem : targetElem.parentElement
        go(targetElem);
        function go(that, child) {
            if (listener(that, child) !== false) {
                go(that.parentElement, that);
            }
        }
    };


    return c;
}




