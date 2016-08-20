/**
 * Created by CQL on 2016/8/10.
 */



function transmitData(data) {
    data = JSON.parse(data);

    var c = commonInit(),

        eHeadLeft,
        eHeadRight,
        eQuesList,

        record = new Record,

        submitData = [];

    c.queryElements(document.body, '.h-main,.h-right,.as-list', function (elems) {
        eHeadLeft = elems[0];
        eHeadRight = elems[1];
        eQuesList = elems[2];
    });

    headLeftHtmlBuild();
    headRightHtmlBuild();
    quesListBuild();

    c.click(eQuesList, function (e) {
        var btn;
        c.scopeElements(e.target, function (elem) {

            if (elem === eQuesList)return false;

            if (btn && elem.classList.contains('choice')) {
                choice(btn, elem);
                return false;
            }
            if (btn && elem.classList.contains('judge')) {
                judge(btn, elem);
                return false;
            }
            if (btn && elem.classList.contains('short')) {
                short(btn, elem);
                return false;
            }
            if (elem.classList.contains('option')) {
                btn = elem;
            }
            if (elem.classList.contains('chose-img-btn')) {
                btn = elem;
            }
            if (elem.classList.contains('remove-btn')) {
                btn = elem;
            }
        });

        function choice(eBtn, eQuesBox) {
            var
                index = eQuesBox.dataset.index,
                qData = data.questions[eQuesBox.dataset.index],
                answerData;

            if (qData.answer.length === 1) {
                // 单选题

                answerData = submitData[index];

                if (answerData) {

                    var currBtn = eBtn.parentElement.children[c.letterToIndex(answerData.text)];

                    currBtn.classList.remove('selected');

                    if (currBtn === eBtn) {
                        // 同一个按钮

                        delete submitData[index];
                        record.add(index);
                    }
                    else {
                        // 换按钮

                        eBtn.classList.add('selected');
                        answerData.text = eBtn.innerHTML;
                        record.remove(index);
                    }
                }
                else {
                    // 第一次

                    eBtn.classList.add('selected');
                    submitData[index] = {
                        text: eBtn.innerHTML
                    };
                    record.remove(index);
                }


            }
            else {
                // 多选题

                answerData = submitData[index];

                if (answerData) {
                    var
                        answerText = answerData.text,
                        currOptionText = eBtn.innerHTML,
                        currOptionIndex = answerData.text.indexOf(currOptionText);

                    if (currOptionIndex > -1) {
                        // 此按钮已选

                        answerText = answerText.replace(new RegExp(currOptionText + '[,]{0,1}'), '');
                        eBtn.classList.remove('selected');
                        if (answerText) {
                            // 取消选择，但还有其他已选择的按钮
                            answerData.text = answerText;
                        }
                        else {
                            // 清空所有选择

                            delete submitData[index];
                            record.add(index);
                        }
                    }
                    else {
                        // 再选一个新按钮

                        eBtn.classList.add('selected');
                        var answerArr = answerText.split(',');
                        answerArr.push(currOptionText);
                        answerArr.sort();
                        answerData.text = answerArr.join(',');
                    }

                }
                else {
                    // 第一次

                    eBtn.classList.add('selected');
                    submitData[index] = {
                        text: eBtn.innerHTML
                    };
                    record.remove(index);
                }

            }

        }

        function judge(eBtn, eQuesBox) {
            var
                index = eQuesBox.dataset.index,
                qData = data.questions[eQuesBox.dataset.index],
                answerData;

            answerData = submitData[index];

            if (answerData) {

                var currBtn = eBtn.parentElement.children[answerData.text.indexOf('错') > -1 ? 1 : 0];

                currBtn.classList.remove('selected');

                if (currBtn === eBtn) {
                    // 同一个按钮

                    delete submitData[index];
                    record.add(index);
                }
                else {
                    // 换按钮

                    eBtn.classList.add('selected');
                    answerData.text = getAnswerText(eBtn.innerHTML);
                    record.remove(index);
                }
            }
            else {
                // 第一次

                eBtn.classList.add('selected');
                submitData[index] = {
                    text: getAnswerText(eBtn.innerHTML)
                };
                record.remove(index);
            }

            function getAnswerText(text) {
                return text.indexOf('错') > -1 ? '错' : '对'
            }
        }

        function short(eBtn, eQuesBox) {
            var
                index = eQuesBox.dataset.index,
                qData = data.questions[eQuesBox.dataset.index],
                answerData;

            answerData = submitData[index];

            if (eBtn.classList.contains('remove-btn')) {
                var item = eBtn.parentElement;

                answerData.images.splice(getItemIndex(item), 1);
                item.remove();

                if (answerData.images.length === 0) {
                    //已删完
                    record.add(index);
                }

            }
            else {
                // 新增

                if (!answerData) {

                    answerData = submitData[index] = {
                        images: []
                    };
                }

                c.insertBefore(eBtn, '<a class="img">\
<img src="" alt="" width="58" height="58">\
<b class="remove-btn"></b>\
</a>');

                answerData.images.push('http://placehold.it/36x36?');


                record.remove(index);
            }

            function getItemIndex(item) {
                var index = -1;
                while (item) {
                    index++;
                    item=item.previousElementSibling;
                }

                return index;
            }

        }

        console.log(submitData);
    });

    function headLeftHtmlBuild() {
        var html = '',
            audioHtml = '',
            imgHtml = '';

        data.remarks.forEach(function (n, i) {
            if (n.type === '1') {
                audioHtml += '<div class="audio"><audio src="' + n.url + '" controls="controls"></audio></div>';
            }
            else {
                imgHtml += '<a href=""><img src="' + n.url + '" alt="" width="58" height="58"></a>';
            }
        });

        html += '<div class="tit">' + data.assignment_name + '</div>';
        html += '<div class="date">' + data.begin_time + '</div>';
        html += '<div class="des">' + data.notice + '</div>';
        html += audioHtml;
        html += '<div class="imgs">' + imgHtml + '</div>';

        eHeadLeft.innerHTML = html;
    }

    function headRightHtmlBuild() {
        var html = '<div class="submit-num">已经提交 ' + data.submitted + '/' + data.class_student_num + '</div>';
        eHeadRight.innerHTML = html;
    }

    function quesListBuild() {
        var html = '';

        data.questions.forEach(function (n, i) {
            record.add(i);
            html += quesBuild(n.type, i);
        });
        eQuesList.innerHTML = html;
    }

    function quesBuild(type, i) {

        return ({
            // 选择题
            1: function () {

                return '<dl class="choice cf" data-index="' + i + '">\
<dt>' + (i + 1) + '.</dt>\
<dd>\
<div class="c-wrap">\
<a class="option">A</a>\
<a class="option">B</a>\
<a class="option">C</a>\
<a class="option">D</a>\
</div>\
</dd>\
</dl>';
            },
            // 判断
            2: function () {
                return '<dl class="judge cf" data-index="' + i + '">\
<dt>' + (i + 1) + '.</dt>\
<dd>\
<div class="c-wrap">\
<a class="option">正确</a>\
<a class="option">错误</a>\
</div>\
</dd>\
</dl>';
            },
            // 填空
            3: short,
            // 问答
            4: short
        })[type]();

        function short() {
            return '<dl class="short cf" data-index="' + i + '"><dt>' + (i + 1) + '.</dt><dd><div class="c-wrap"><a class="chose-img-btn"></a></div></dd></dl>';
        }
    }

//    记录是否做题
    function Record() {
        var data = {};

        // 取消一题调用
        this.add = function (i) {
            data[i] = 1;
        };

        // 做一题调用
        this.remove = function (i) {
            delete data[i];
        };

        // 是否完成。 1 完成；0 未完成
        this.isComplete = function () {

            for (var k in data) return 0;

            return 1;
        };

        this.getData = function () {
            return data;
        };
    }


}

function commonInit() {

    /**
     * 原型扩展
     * */
    (function () {
        if (!String.prototype.trim) {
            String.prototype.trim = function () {
                return this.replace(/(^[\s\uFEFF]*)|(\s*$)/g, '');
            }
        }

        if (!Element.prototype.remove) {
            Element.prototype.remove = function () {
                this.parentNode.removeChild(this);
            };
        }
    })();

    var c = {};

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

    c.hasClass = function (elem, className) {
        if (elem) return (' ' + elem.className + ' ').indexOf(' ' + className.trim() + ' ') > -1;
        return false;
    };
    c.addClass = function (elem, className) {

        if (elem.classList) {
            elem.classList.add(className);
        }
        else if (c.hasClass(elem, className) === false) {
            elem.className = c.trim((elem.className + ' ' + className).replace(/\s{2,}/g, ' '));
        }
    };

    c.removeClass = function (elem, className) {
        if (elem.classList) {
            elem.classList.remove(className);
        }
        else {
            elem.className = (' ' + elem.className + ' ').replace(' ' + c.trim(className) + ' ', '');
        }
    };

    c.toPercent = function (num) {
        return (num + '00').replace(/\.([\d]{2})/, '$1.') * 1;
    };

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

    c.SwitchSelect = function (className) {

        var currItem = document.createElement('div');

        className = className ? className : 'active';

        this.select = function (eItem, goOn, must) {

            if (currItem !== eItem || must) {
                c.removeClass(currItem, 'active');
                c.addClass(eItem, 'active');

                currItem = eItem;

                goOn && goOn();
            }
        };

        this.getCurr = function () {
            return currItem;
        };
    };

    c.scopeElements = function (targetElem, listener) {
        go(targetElem);
        function go(that) {
            if (listener(that) !== false) {
                go(that.parentElement);
            }
        }
    };

    c.letterToIndex = function (letter) {
        return letter.charCodeAt() - 65;
    };

    // HTMLCollection,NodeList,array,html -> fragment
    /*
     @param (HTMLCollection,NodeList,array,string) HTMLCollection,NodeList集合，或者元素数组，可以是多个。最上级html可以是文本标签组合，可以多个
     @regurn (array) 第一个是片段，第二个是多个节点的数组
     @兼容性 不支持ie67，ie67没有HTMLCollection,NodeList。如果要支持，需HTMLCollection,NodeList转数组

     */
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

    c.insertBefore = function (item, newItems) {
        var params = this.toFragment(newItems);
        item.parentNode.insertBefore(params[0], item);
        return params[1];
    };

    c.htmlToNodes = function (html) {
        var elem = document.createElement('div');
        elem.innerHTML = html;
        return elem.childNodes;
    };

    return c;
}