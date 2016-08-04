/**
 * Created by CQL on 2016/8/3.
 */

'use strict';

function FullPage(params) {
    var c = commonInit();

    var
        jBox = params.jBox,
        type = params.type,
        onchange = params.onchange || function () {
            },

        eBox = jBox[0],
        eMove = eBox.children[0],
        jMove = $(eMove),
        eItems = eMove.children,
        count = eItems.length,

        transform = c.getRightCssName('transform')[1],
        transition = c.getRightCssName('transition')[1],// 这里只被用于判断ie89...

        isIE89 = transition === undefined,

        btnHandle = new BtnHandle,

        isRun = false,// 是否动画进行中。只有动画结束后才能进行下一步操作

        index = 0;

    if (type === 'left') {
        leftType();
    }
    else {
        mouseWheel();
    }

    btnHandle.reset(0);

    this.jBox = jBox;
    this.getCurrItem = function () {
        return eItems[index];
    };
    this.getCurrIndex = function () {
        return index;
    };
    this.reset = function (i) {
        count = eItems.length;
        go(i || 0);
        btnHandle.reset(index);
    };

    function leftType() {

        jBox.addClass('left-type');

        anime = function () {

            if (isIE89) {
                anime = function () {
                    isRun = true; // 开启
                    jMove.animate({left: (-index * 100) + '%'}, 700, transitionend);
                };
            }
            else {

                eBox.addEventListener("webkitTransitionEnd", transitionend);
                eBox.addEventListener("mozTransitionEnd", transitionend);
                eBox.addEventListener("transitionend", transitionend);

                anime = function () {
                    isRun = true; // 开启
                    eMove.style[transform] = 'translate3d(' + (-index * 100) + '%,0,0)';
                };
            }

            anime();
        };
        if (isIE89) {
            $(eItems).each(function (i) {
                this.style.left = i * 100 + '%';
            });
        }
        else {
            $(eItems).each(function (i) {
                this.style[transform] = 'translate3d(' + (i * 100) + '%,0,0)';
            });
        }

        btnHandle.leftType();
    }

    function mouseWheel() {
        c.mouseWheel(window, function (e) {

            if (isRun) return;

            var pre;
            if (e.wheelDelta) //前120 ，后-120
                pre = e.wheelDelta > 0;
            else //firefox
                pre = e.detail < 0;

            if (pre) {
                //*往上滚
                prevPage();
            } else {
                //*往下滚
                nextPage();
            }


            //阻止滚动条滚动
            if (e.cancelable) e.preventDefault();
            return false;
        });
    }

    function transitionend() {
        isRun = false;
    }

    function go(i) {
        if (i * 1 !== index) {
            change(i);
            btnHandle.select(i);
        }
    }

    function prevPage() {
        var i = index;

        i--;
        if (i < 0) {
            i = 0;
        }
        else {
            go(i);
        }
    }

    function nextPage() {
        var i = index;
        i++;
        if (i >= count) {
            i = count - 1;
        }
        else {
            go(i);
        }
    }

    function change(i) {
        onchange(eItems[i], index, i);
        index = i;
        anime();
    }

    function anime() {

        if (isIE89) {
            anime = function () {
                isRun = true; // 开启
                jMove.animate({top: (-index * 100) + '%'}, 700, transitionend);
            };
        }
        else {

            eBox.addEventListener("webkitTransitionEnd", transitionend);
            eBox.addEventListener("mozTransitionEnd", transitionend);
            eBox.addEventListener("transitionend", transitionend);

            anime = function () {
                isRun = true; // 开启
                eMove.style[transform] = 'translate3d(0,' + (-index * 100) + '%,0)';
            };
        }
        anime();
    }

    function BtnHandle() {

        var
            jBtnBox = jBox.children('.fp-btns'),
            eChilds = jBtnBox[0].children,
            switchSelect = new c.SwitchSelect;

        jBtnBox.on('click', 'a', function () {
            var jBtn = $(this);
            switchSelect.select(jBtn, function () {
                change(jBtn.attr('data-index') * 1);
            });
        });

        this.reset = reset;
        this.select = function (i) {
            switchSelect.select($(eChilds[i]));
        };
        this.leftType = leftType;

        function leftType() {
            positionAuto = function () {
                jBtnBox.css('margin-left', -jBtnBox.width() / 2);
            }
        }

        function positionAuto() {
            jBtnBox.css('margin-top', -jBtnBox.height() / 2);
        }

        function reset(index) {
            var btnHtml = '';
            for (var i = count; i--;) {
                btnHtml += '<a href="javascript:;" data-index="' + (count - 1 - i) + '"><span></span></a>';
            }
            jBtnBox.html(btnHtml);

            switchSelect.select($(eChilds[index]));

            positionAuto();
        }
    }

    /**
     * 基础方法
     * */
    function commonInit() {
        var c = {};

        c.mouseWheel = function (dom, f) {
            if (dom.addEventListener) {
                this.mouseWheel = function (dom, f) {
                    if (dom.onmousewheel === undefined) dom.addEventListener('DOMMouseScroll', f, false);//firefox
                    else dom.addEventListener('mousewheel', f, false);
                }
            }
            else if (dom.attachEvent) {

                this.mouseWheel = function (dom, f) {
                    dom = dom === window ? document.documentElement : dom
                    dom.attachEvent('onmousewheel', f);//ie678
                }
            }

            this.mouseWheel(dom, f);

        };

        c.SwitchSelect = function (className) {

            var currItem = $();

            className = className ? className : 'active';

            this.select = function (jItem, goOn, must) {

                if (currItem[0] !== jItem[0] || must) {
                    currItem.removeClass('active');
                    jItem.addClass('active');

                    currItem = jItem;

                    goOn && goOn();
                }
            };

            this.getCurr = function () {
                return currItem;
            };
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
}

// demo
(function () {
    var fullPage = new FullPage({
        jBox: $('.fullpage-wrapper').eq(0)
    });


    fullPage.jBox.on('click', 'button', function () {
        var jNewItem = $('<div class="fp-item" style="background-color: #ddd;"><div class="fullpage-wrapper">\
            <div class="fp-move">\
            <div class="fp-item" style="background-color: #aaa;"><p>横向第一页</p>\
            </div>\
            <div class="fp-item" style="background-color: #aaa;"><p>横向第二页</p>\
            </div>\
            <div class="fp-item" style="background-color: #aaa;"><p>横向第三页</p>\
            </div>\
            </div>\
            <div class="fp-btns"></div>\
            </div></div>');
        $(fullPage.getCurrItem()).after(jNewItem);
        fullPage.reset(fullPage.getCurrIndex() + 1);

        // 初始 横向轮播
        new FullPage({
            jBox: jNewItem.children(),
            type: 'left'
        });
    });

})();

