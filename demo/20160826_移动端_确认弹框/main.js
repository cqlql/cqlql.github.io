/**
 * Created by CQL on 2016/8/26.
 */

'use strict';

(function () {
    var c = commonInit();

    c.click(document.querySelector('.popup-btn'), function () {
        confirm(function () {


            return false;
        });
    });

    /**
     *
     *
     * @param function sure 确认执行
     *  return false 将阻止关闭
     *
     *
     * */
    function confirm(sure) {

        var eBox;

        confirm = show;

        confirm.close = hide;

        init();

        function init() {
            eBox = document.createElement('div');
            eBox.className = 'full-page-popup';
            eBox.innerHTML = ' <div class="fgp-bg"></div>\
<div class="fgp-main">\
<div class="confirm-box">\
<div class="top-bar">\
<div class="tit">确认</div>\
<b class="close">✖</b></div><div class="cont">\
<div class="des">确定删除？</div><div class="btns">\
<a class="button sure-btn" href="javascript:;">确认</a>\
<a class="button cancel-btn" href="javascript:;">取消</a>\
</div></div></div></div>';

            document.body.appendChild(eBox);

            c.click(eBox, function (e) {
                var i = 0;
                c.scopeElements(e.target, function (elem) {
                    i++;
                    var classList = elem.classList;
                    if (i === 1 && classList.contains('fgp-main')) {
                        hide();
                        return false;
                    }
                    if (elem === eBox) {
                        return false;
                    }
                    if (classList.contains('close') || classList.contains('cancel-btn') || classList.contains('fgp-bg')) {
                        hide();
                        return false;
                    }
                    if (classList.contains('sure-btn')) {
                        if (onsure() !== false) {
                            hide();
                        }
                        return false;
                    }
                });
            });

            setTimeout(function () {
                show(sure)
            }, 10);
        }

        function show(sure) {
            eBox.classList.add('show');
            onsure = sure;
        }

        function hide() {
            eBox.classList.remove('show');
        }

        function onsure() {

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

        // 元素查找 目标元素逐个往上找 实现查找范围内的所有元素，或者说是赛选某元素内的所有元素
        /**
         使用
         dom.scopeElements(selection.anchorNode,function (elem) {

            if(elem===eEnd)return false;
            if(elem.tagName==='H2'){
                // do something...
                return false;
            }
            return otherFn();
         });
         */
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