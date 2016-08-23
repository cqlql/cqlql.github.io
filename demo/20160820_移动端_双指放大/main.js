/**
 * Created by CQL on 2016/8/17.
 */

'use strict';

(function () {
    var c = commonInit();

    (function () {
        document.getElementById('popupBtn').onclick = function () {
            zoomPicture('imgs/test.jpg');
        };
    })();

    function zoomPicture(src) {

        var eBox,
            eImg,
            zoomReady;

        zoomPicture = show;

        zoomPicture(src);

        function init(img) {
            eBox = document.createElement('div');
            eBox.className = 'picture-zoom';
            eBox.appendChild(img);
            document.body.appendChild(eBox);
            eImg = img;

            zoomReady = new ZoomReady({
                eBox: eBox,
                eImg: img
            });

            c.click(eBox, function () {
                eBox.classList.remove('show');
            });

            init = function () {
            };
        }

        function show(src) {
            c.imgSizeExcu(src, function (img) {

                init(img);

                zoomReady.reset({
                    oWinW: eBox.clientWidth,
                    oWinH: eBox.clientHeight,
                    oWidth: img.width,
                    oHeight: img.height
                });
                eImg.src = src;

                eBox.classList.add('show');
            });
        }
    }

    function ZoomReady(params) {

        var eBox = params.eBox,
            eImg = params.eImg,
            pinchZoom = new PinchZoom,

            transform = getRightCssName('transform')[1];

        zoom = new zoom;
        drag = new drag;

        eBox.addEventListener('touchstart', function (e) {
            zoom.touchstart(e);
            drag.touchstart(e);

        });

        eBox.addEventListener('touchmove', function (e) {
            zoom.touchmove(e);
            drag.touchmove(e);
        });

        eBox.addEventListener('touchend', function (e) {
            zoom.touchend(e);
            drag.touchend(e);
        });

        eBox.addEventListener('touchcancel', function (e) {
        });

        pinchZoom.zoom = function (x, y, scale) {

            var v = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ', ' + scale + ')';

            eImg.style.setProperty(transform, v);
        };

        this.reset = function (params) {
            pinchZoom.setInitParams(params);
        };


        function zoom() {
            var isStart = 0;

            this.touchstart = function (e) {
                var touche = e.touches;

                if (touche.length === 2) {
                    isStart = 1;
                    pinchZoom.zoomStart(touche[0], touche[1]);
                }
                else if (isStart) {
                    isStart = 0;
                    pinchZoom.zoomEnd();
                }
            };

            this.touchmove = function (e) {
                if (isStart) {
                    var touche = e.touches;
                    pinchZoom.zoomMove(touche[0], touche[1]);

                    e.preventDefault();
                }
            };

            this.touchend = function (e) {
                var touche = e.touches;

                if (touche.length === 2) {
                    isStart = 1;
                    pinchZoom.zoomStart(touche[0], touche[1]);
                }
                else {
                    isStart = 0;
                    pinchZoom.zoomEnd();
                }

            };

        }

        function drag() {
            var isStart = 0;

            this.touchstart = function (e) {
                var touche = e.touches;

                if (touche.length === 1) {
                    isStart = 1;
                    pinchZoom.dragStart(touche[0]);
                }
                else if (isStart) {
                    isStart = 0;
                    pinchZoom.zoomEnd();
                }
            };

            this.touchmove = function (e) {
                if (isStart) {
                    var touche = e.touches;

                    pinchZoom.dragMove(touche[0]);

                    e.preventDefault();
                }
            };

            this.touchend = function (e) {
                var touche = e.touches;

                if (touche.length === 1) {
                    isStart = 1;
                    pinchZoom.dragStart(touche[0]);
                }
                else {
                    isStart = 0;
                    pinchZoom.zoomEnd();
                }
            };

        }

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

    function PinchZoom(params) {

        var startDataXY
            , startX, startY // 单指记录开始坐标

            , currX = 0, currY = 0 // 当前坐标
            , toX, toY // 临时

            , winW, winH // 当前容器高宽
            , oWinW, oWinH// 初始的容器高宽
            , oWidth, oHeight// 图片原始高宽
            , toW, toH // 临时

            , currScale = 1
            , toScale // 临时

            , minScale, maxX, maxY, minW, minH

            , that = this;

        this.setInitParams = function (params) {
            winW = params.oWinW;
            winH = params.oWinH;
            oWinW = params.oWinW;
            oWinH = params.oWinH;
            oWidth = params.oWidth;
            oHeight = params.oHeight;

            restrictBuild();

            this.zoomConver({
                centerX: winW / 2,
                centerY: 0,
                moveX: (winW - oWinW) / 2,
                moveY: 0,
                scale: minScale
            });

            this.zoomEnd();
        };

        this.zoomStart = function (t1, t2) {
            startDataXY = getDataXY(t1, t2);
        };

        this.zoomMove = function (t1, t2) {
            var moveDateXY = getDataXY(t1, t2);

            var params = {
                centerX: moveDateXY.centerX,
                centerY: moveDateXY.centerY,
                moveX: moveDateXY.centerX - startDataXY.centerX,
                moveY: moveDateXY.centerY - startDataXY.centerY,
                scale: moveDateXY.diameter / startDataXY.diameter
            };

            ///# 参数转化 并执行放大
            this.zoomConver(params);

        };

        this.zoomEnd = function () {
            currX = toX;
            currY = toY;
            currScale = toScale;
        };

        this.zoomConver = function (params) {
            var s = params.scale;

            toScale = currScale * s;

            if (toScale < minScale) {
                toScale = minScale;
                s = toScale / currScale;
            }

            //# x y
            var offsetX = params.centerX - currX,
                offsetY = params.centerY - currY;
            toW = oWidth * toScale;
            toH = oHeight * toScale;
            var offsetXS = offsetX / toW,
                offsetYS = offsetY / toH;
            // 缩放了多少长度
            var zoomW = toW * (1 - s),
                zoomH = toH * (1 - s);
            // 使用 scale 自动中心偏移坐标
            var otherX = oWidth / 2 * (s - 1),
                otherY = oHeight / 2 * (s - 1);

            //
            toX = offsetXS * zoomW + params.moveX * s + currX + otherX;
            toY = offsetYS * zoomH + params.moveY * s + currY + otherY;

            //// 限制
            // 基本偏移
            var oX = oWidth / 2 * (toScale - 1),
                oY = oHeight / 2 * (toScale - 1);
            if (toX < oWinW - toW + oX) {
                toX = oWinW - toW + oX;
            }
            if (toX > oX) {
                toX = maxX - oWidth * (toScale - minScale ) / 2 + oX;
                if (toX < oX)toX = oX;
            }
            if (toY < oWinH - toH + oY) {
                toY = oWinH - toH + oY;
            }
            if (toY > oY) {

                toY = maxY - oHeight * (toScale - minScale ) / 2 + oY;
                if (toY < oY)toY = oY;
            }

            this.zoom(toX, toY, toScale);

        };

        this.dragStart = function (t) {
            startX = t.pageX;
            startY = t.pageY;
        };

        this.dragMove = function (t) {
            var x = t.pageX,
                y = t.pageY;

            this.zoomConver({
                centerX: x,
                centerY: y,
                moveX: x - startX,
                moveY: y - startY,
                scale: 1
            });
        };


        // 生成限制参数
        function restrictBuild() {
            var whs = oWidth / oHeight,
                whsWin = winW / winH;

            if (whs > whsWin) {
                minScale = winW / oWidth;
                minW = winW;
                minH = winW / whs;
                maxX = 0;
                maxY = (winH - minH) / 2;
            }
            else {
                minScale = winH / oHeight;
                minH = winH;
                minW = winH * whs;
                maxY = 0;
                maxX = (winW - minW) / 2;
            }
        }

        // 相当于浏览器内容窗口。如果是以div为窗口，且有滚动条情况下，centerXY需加上div滚动条卷去距离
        function getDataXY(touche1, touche2) {
            var
                xLen, yLen, centerX, centerY;

            xLen = Math.abs(touche1.pageX - touche2.pageX);
            yLen = Math.abs(touche1.pageY - touche2.pageY);

            if (touche1.pageX < touche2.pageX) {
                centerX = touche1.pageX + xLen / 2;
            } else {
                centerX = touche2.pageX + xLen / 2;
            }

            if (touche1.pageY < touche2.pageY) {
                centerY = touche1.pageY + yLen / 2;
            } else {
                centerY = touche2.pageY + yLen / 2;
            }

            return {
                centerX: centerX,
                centerY: centerY,
                diameter: Math.sqrt(Math.pow(xLen, 2) + Math.pow(yLen, 2))
            }
        }
    }

    function commonInit() {

        /**
         * 原型扩展
         * */
        (function () {

            window.requestAnimationFrame = (function () {
                return window.requestAnimationFrame ||
                    window.webkitRequestAnimationFrame ||
                    window.mozRequestAnimationFrame ||
                    window.msRequestAnimationFrame ||
                    function (callback, elem) {
                        return window.setTimeout(callback, 1000 / 60);
                    };
            })();
            window.cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.clearTimeout;

            if (!String.prototype.trim) {
                String.prototype.trim = function () {
                    return this.replace(/(^[\s\uFEFF]*)|(\s*$)/g, '');
                }
            }

        })();

        var c = {};

        c.isMobile = /Android|iPhone|iPad/.test(navigator.appVersion);
        c.isIOSMobile = /iPhone|iPad/.test(navigator.appVersion);

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

            if ((this.getAndroidVersion() && this.getAndroidVersion() < 4.4) || c.isIOSMobile) {
                c.click = function (elem, fn) {
                    var touchcancel;
                    elem.addEventListener('touchend', touchend);
                    elem.addEventListener('touchstart', touchstart);
                    elem.addEventListener('touchmove', touchmove);

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

                    return function () {
                        elem.removeEventListener('touchend', touchend);
                        elem.removeEventListener('touchstart', touchstart);
                        elem.removeEventListener('touchmove', touchmove);
                    };
                };

            }
            else {
                c.click = function (elem, fn) {
                    elem.addEventListener('click', fn);
                    return function () {
                        elem.removeEventListener('click', fn);
                    };
                }
            }

            c.click(elem, fn);
        };


        c.toFragment = function (newItems) {
            var fragment = document.createDocumentFragment(),
                elems = [];

            if (typeof newItems === 'string') {
                newItems = this.htmlToNodes(newItems);
            }

            // 单个元素情况
            if (newItems.length === undefined || newItems.nodeType === 3) {
                newItems = [newItems];
            }

            if (newItems.constructor === HTMLCollection || newItems.constructor === NodeList) {
                // HTMLCollection 集合情况。此集合特性将取一个就会少一个
                for (var i = 0, that, len = newItems.length; i < len; i++) {
                    that = newItems[0];
                    fragment.appendChild(that);
                    elems.push(that);
                }
            } else {
                // 此处考虑了类似jq集合情况
                base.each(newItems, function (i, that) {
                    fragment.appendChild(that);
                });
                elems = newItems;
            }

            return [fragment, elems];
        };

        c.imgSizeExcu = function (src, f, err) {
            var img = new Image(),
                iserror = false;

            img.onerror = function () {
                err && err(img);
                iserror = true;
            };

            img.src = src;

            //返回false 将跳出 循环
            tryExcu();

            function tryExcu() {
                if (iserror) return;
                if (img.complete || img.width) {
                    f(img);
                    return;
                }

                setTimeout(tryExcu, 100)
            }

        };
        return c;
    }
})();