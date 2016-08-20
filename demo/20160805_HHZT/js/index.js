/**
 * Created by CQL on 2016/8/6.
 */
'use strict';

// banner
(function () {

    var
        transform = c.getRightCssName('transform')[1],
        transition = c.getRightCssName('transition')[1],
    // c = commonInit(),
        eFullBanner = document.getElementById('fullBanner'),
        eShowBox,
        eItems, eTit, eDes, eAwL, eAwR,
        listSelect,
        recordComplete = {};

    c.queryElements(eFullBanner, '.fb-show,.list-select,.tit,.des,.aw,.aw', function (elems) {
        eShowBox = elems[0];
        eItems = eShowBox.children;
        listSelect = new ListSelect({
            eBox: elems[1]
        });

        eTit = elems[2];
        eDes = elems[3];
    });

    eShowBox.innerHTML = '<li>' + new Array(listSelect.count()).join('</li><li>') + '</li>';

    listSelect.onchange = function (currIndex, index, items) {
        loadImg(index);

        anime(currIndex, index, items);

        slider.setIndex(index);

        textShow(items[index].getElementsByTagName('img')[0].getAttribute('data-des'));
    };

    // 触摸交互
    if (c.isMobile) {
        slider = slider({
            eBox: eFullBanner,
            onchange: function (eItem, prevIndex, index) {
                listSelect.active(prevIndex, index);
            }
        });
    }
    else {
        slider = {
            setIndex: function () {

            }
        }
    }

    // ie8 9
    if (!transition) {
        var easingBuild = new c.EasingBuild();

        anime = function (currIndex, index) {
            var currItem = eItems[currIndex],
                sideItem = eItems[index];

            if (currItem)  currItem.className = '';
            sideItem.className = 'curr';

            easingBuild.setCurParams({
                o: 0
            });

            easingBuild.excu({
                o: 1
            }, {
                go: function (to) {

                    var r = to.o, scale;
                    if (currItem) {
                        scale = 1 - r * .3;
                        currItem.style.filter = 'alpha(opacity=' + (1 - r) * 100 + ')';
                        currItem.style[transform] = 'scale(' + scale + ', ' + scale + ')';
                    }
                    var scale = .3 * r + .7;
                    sideItem.style.filter = 'alpha(opacity=' + r * 100 + ')';
                    sideItem.style[transform] = 'scale(' + scale + ', ' + scale + ')';
                },
                speed: 400
            });
        };
    }

    listSelect.go(0);

    function textShow(txt) {
        if (txt) {
            txt = txt.split(',');
        }
        else {
            txt = ['', ''];
        }

        eTit.innerHTML = txt[0];
        eDes.innerHTML = txt[1];
    }

    // 加载图片
    function loadImg(index) {
        if (!recordComplete[index]) {
            var
                item = listSelect.eItems[index].children[0].children[0],
                src = item.getAttribute('data-bigsrc'),
                href = item.getAttribute('data-bighref');

            href = href ? ' href="' + href + '"' : '';

            eItems[index].innerHTML = '<a' + href + '><img src="' + src + '"/></a>';
            recordComplete[index] = 1;
        }
    }

    function anime(currIndex, index) {

        var currItem = eItems[currIndex],
            sideItem = eItems[index];


        sideItem.className = 'curr';

        if (currItem) {
            currItem.className = '';
            currItem.style[transition] = '.4s';
            moveHide(currItem, 1);
        }

        sideItem.style[transition] = '.4s';
        moveShow(sideItem, 1);
    }

    function moveShow(item, r) {
        var scale = .3 * r + .7;
        // var scale = 1-r * .3;
        item.style.opacity = r * 1;
        item.style[transform] = 'scale(' + scale + ', ' + scale + ')';
    }

    function moveHide(item, r) {
        var scale = 1 - r * .3;
        // var scale = .3 * r + .7;
        item.style.opacity = 1 - r * 1;
        item.style[transform] = 'scale(' + scale + ', ' + scale + ')';
    }

    function ListSelect(params) {
        var

            eBox = params.eBox,
            eMove,
            eItems,

            showBoxW,

            count,
            currIndex,
            itemW = 114,
            that = this;

        c.queryElements(eBox, '.ls-wrap,.ls-show,ul', function (elems) {
            showBoxW = elems[1].clientWidth;
            eMove = elems[2];
            eItems = eMove.children;
        });

        c.click(eBox, function (e) {
            var target = e.target || e.srcElement;

            c.scopeElements(target, function (elem) {

                if (elem === eBox)return false;
                if (elem.tagName === 'LI') {
                    go(elem.getAttribute('data-index'));
                    return false;
                }
                if (c.hasClass(elem, 'aw')) {
                    if (elem.className.indexOf('r') > -1) {

                        var i = currIndex;
                        i++;
                        if (i >= count) {
                            i = 0;
                        }
                        go(i);
                    }
                    else {
                        var i = currIndex;
                        i--;
                        if (i < 0) {
                            i = count - 1;
                        }
                        go(i);
                    }
                    console.log(i);

                    return false;
                }
            });
        });

        itemCountReset();

        this.onchange = function () {
        };
        this.count = function () {
            return count;
        };
        this.go = go;
        this.eItems = eItems;
        this.active = active;
        this.setIndex = function (i) {
            currIndex = i;
        };

        function active(currIndex, index) {
            c.addClass(eItems[index], 'active');
            c.removeClass(eItems[currIndex], 'active');
        }


        function go(index) {

            if (index !== currIndex) {

                active(currIndex, index);

                change(currIndex, index);

                currIndex = index;

                move();
            }
        }

        function change(currIndex, index) {
            that.onchange(currIndex, index, eItems);
        }

        // 展示窗口 尺寸改变
        function showBoxResize(w) {
            showBoxW = w;
            move();
        }

        // 项个数改变后
        function itemCountReset() {
            count = eItems.length;
            eMove.style.width = count * itemW + 'px';
        }

        function move() {
            eMove.style.left = getCenterValue(currIndex) + 'px';
        }

        function getCenterValue(index) {
            var
                max = showBoxW - count * itemW,
                v = showBoxW / 2 - index * itemW - itemW / 2;

            if (v > 0)v = 0;
            else if (v < max)v = max;

            return v;
        }
    }

    function slider(params) {
        var eBox = params.eBox,
            each = params.each,
            onchange = params.onchange,
        // eMove = eBox.children[0],
        // eItems = eMove.children,
            count = eItems.length,

            boxW = eBox.clientWidth,

        // transform = c.getRightCssName('transform')[1],
        // transition = c.getRightCssName('transition')[1],

        // 拖动的长度
            moveLength = 0,

        // 拖动情况 松开时 是否进行滑动的最大偏移值
            offset = boxW / 3,

            rightItem, leftItem,
            sideItem,// 当前要动画出来的项
            currItem,// 当前项，也可能是上一个项，按下时才会被正确初始

        // 当前显示项索引
            index = 0;

        c.swipeXScroll({
            eBox: eBox,
            swipeLeft: swipeLeft,
            swipeRight: swipeRight,
            swipeNot: function () {
                // 未发生，但有移动;

                // 超过一般情况 滑动
                if (Math.abs(moveLength) > offset) {

                    if (moveLength > 0) {
                        swipeRight();
                    }
                    else {
                        swipeLeft();
                    }
                }
                else {
                    // 复位
                    reset();
                }
            },
            onstart: function () {

                moveLength = 0;
                currItem = eItems[index],
                    currItem.style[transition] = '0s';

                var i = index + 1;
                if (index + 1 >= count) i = 0;
                rightItem = eItems[i];
                loadImg(i);

                i = index - 1;
                if (index - 1 < 0)i = count - 1;
                leftItem = eItems[i];
                loadImg(i);

                rightItem.style[transition] = '0s';
                leftItem.style[transition] = '0s';
            },
            onmove: function (to) {
                moveLength += to;

                var r = Math.abs(moveLength) / (boxW / 2);

                if (r > 1)r = 1;

                moveHide(currItem, r);

                if (moveLength < 0) {
                    // 左滑
                    moveShow(leftItem, 0);
                    sideItem = rightItem;
                }
                else {
                    moveShow(rightItem, 0);
                    sideItem = leftItem;
                }

                moveShow(sideItem, r);
            }
        });

        return {
            setIndex: function (i) {
                index = i * 1;
            }
        };

        function swipeLeft() {
            var i = index;
            i++;
            if (i >= count) {
                i = 0;
            }

            change(i);
            anime();
        }

        function swipeRight() {
            var i = index;
            i--;
            if (i < 0) {
                i = count - 1;
            }
            change(i);
            anime();
        }

        function reset() {
            animeReset();
        }

        function change(i) {
            onchange(eItems[i], index, i);
            index = i;
            listSelect.setIndex(i);
        }

        function anime() {

            currItem.style[transition] = '.4s';
            sideItem.style[transition] = '.4s';
            moveHide(currItem, 1);
            moveShow(sideItem, 1);
        }

        function animeReset() {

            currItem.style[transition] = '.4s';
            sideItem.style[transition] = '.4s';

            moveShow(currItem, 1);
            moveHide(sideItem, 1);
        }

        function moveShow(item, r) {
            var scale = .3 * r + .7;
            item.style.opacity = r * 1;
            item.style[transform] = 'scale(' + scale + ', ' + scale + ')';
        }

        function moveHide(item, r) {
            var scale = 1 - r * .3;
            item.style.opacity = 1 - r * 1;
            item.style[transform] = 'scale(' + scale + ', ' + scale + ')';
        }
    }

})();

