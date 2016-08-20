/**
 * Created by CQL on 2016/8/5.
 */


(function () {

    var c = commonInit(),
        eFullBanner = document.getElementById('fullBanner');


    c.queryElements(eFullBanner, '.list-select', function (elems) {
        var listSelect = new ListSelect({
            eBox: elems[0]
        });

    });


    function listSelect(params) {
        var

            eBox = params.eBox,
            eMove,
            eItems,

            showBoxW,

            count,
            currIndex,
            itemW = 114;

        c.queryElements(eBox, '.ls-wrap,.ls-show,ul', function (elems) {
            // eBox = elems[0];
            showBoxW = elems[1].clientWidth;
            eMove = elems[2];
            eItems = eMove.children;
        });

        c.click(eBox, function (e) {
            var target = e.target;

            c.scopeElements(target, function (elem) {

                if (elem === eBox)return false;
                if (elem.tagName === 'LI') {
                    go(elem.getAttribute('data-index'));
                    return false;
                }
            });
        });

        itemCountReset();

        function go(index) {

            if (index !== currIndex) {
                currIndex = index;
                move();
            }


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

        /**
         * 取居中坐标
         *
         * 涉及到的参数：
         * showBoxW 动画窗口宽
         * itemW 每项的宽度
         * index 项的索引，就是哪一项
         * cont 项总数，用来计算最大值，限制最大偏移。如果不需要可以不带
         *
         * 目前是 x 方向，变化一下就能实现 y 向了
         * */
        function getCenterValue(index) {
            var
                max = showBoxW - count * itemW,
                v = showBoxW / 2 - index * itemW - itemW / 2;

            if (v > 0)v = 0;
            else if (v < max)v = max;

            return v;
        }
    }

    function commonInit() {
        var c = {};

        c.click = function (elem, fn) {
            elem.addEventListener('click', fn);
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


})();
