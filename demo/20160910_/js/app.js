/**
 * Created by cql on 2016/9/10.
 */
let path = require('path');
const fs = require('fs');
// const Vue = require(__dirname + '/js/libr/vue.min.js');
const marked = require(__dirname + '/libr/marked.min.js');
var c = require(__dirname + '/common.js');
var flicker = require(__dirname + '/module/flicker.js');

var eContent = document.getElementById('content');

var menuArticleContent = new MenuArticleContent(document.getElementById('menu'), eContent);

var
    regH1 = /^#\s+(.+)$/gm,
    regH2 = /^##\s+(.+)$/gm,
    regH3 = /^###\s+(.+)$/gm,
    // regH2 = /^####\s+(\u5B9E\u73B0)[\s]*(?=\n)/gm,
    regH4 = /^####\s+(.+)$/gm,
    regJs = /^```\s*javascript([^]+?)\n```[\s]*(?=\n)/m;

fs.readFile(path.resolve(__dirname,'../test.md'), 'utf8', (err, data)=> {
    var html = marked(data);

    // html = html.replace(/(<\/h[\d]>)([^]+?)(<h[\d][^>]*>)/g, '$1<div class="des">$2</div>$3');

    eContent.innerHTML = html;

    // 代码高亮
    require(__dirname + '/libr/prism.js');

    menuArticleContent.rebuild();

    // buildHtml(data);
});

function compressorJs(code) {
    var ast = UglifyJS.parse(code);
    ast.figure_out_scope();
    ast.compute_char_frequency();
    ast.mangle_names();
    return ast.print_to_string();
}

function getFnName(jsText) {
    var regFnName1 = /\.[\s]*([^\s=]+)[\s]*=|^[\s]*function[\s]*([^\s\(]+)/,
        regFnName2 = /^[\s]*function[\s]*([^\s\(]+)/m;

    var resul1,
        resul2;

    if (resul1 = jsText.match(regFnName1)) {
        return resul1[1];
    }
    if (resul2 = jsText.match(regFnName2)) {
        return resul2[1];
    }
    return '';
}

function buildData(data, callback) {
    formatTextByHx(data, regH1, function (d) {
        formatTextByHx(d.content, regH2, function (childData, r) {
            // regJs.exec(d.content);

            if (/\u5B9E\u73B0/.test(childData.title)) {
                let jsText = regJs.exec(childData.content)[1];
                callback({
                    // title: getFnName(jsText) + ' ' + d.title,
                    title: d.title,
                    jsText: jsText
                });
            }
        });
    });
}

// 分割标题块
function formatTextByHx(text, reg, callback) {
    var
        r, prevR = reg.exec(text);

    while (prevR) {

        r = reg.exec(text);

        callback({
            title: prevR[1],
            content: prevR.input.substring(prevR.index + prevR[0].length, r ? r.index : undefined)
        }, prevR);

        prevR = r;
    }
}


function MenuArticleContent(eMenu, eContent) {

    var eMainBox,
        eMenuTool = eMenu.children[0],
        eMenuCont = eMenu.children[1],
        allHx,
        jsTxtData = {};

    this.rebuild = rebuild;

    var event = new Event();

    // 内容将同步选择
    // this.syncSelect = event.syncSelect;

    function rebuild() {

        var
            preLevel = 1,
            preItem = document.createElement('div'),
            preList,
            fragment = document.createDocumentFragment();

        allHx = eContent.querySelectorAll('h2,h3,h4');

        c.each(allHx, function (i, hx) {
            var level = hx.tagName.substr(1);

            if (level == 4) {
                if (hx.innerHTML.indexOf('实现') > -1) {

                    preItem.classList.add('have');
                    jsTxtData[preItem.getAttribute('data-index')] = getJsText(hx);
                }
                return;
            }

            var items = c.htmlToElems('<div class="item" data-index="' + i + '"><span class="txt">' + hx.innerHTML + '</span></div><div class="list"></div>'),
                item = items[0],
                list = items[1];

            hx._relateMenuItem = item;

            if (level > preLevel) {
                c.prependChild(preItem, '<i></i>');
            }
            else {
                for (var j = preLevel; j >= level; j--) {
                    preList = preList.parentElement;
                }
            }

            if (preList) {
                preList.appendChild(item);
                preList.appendChild(list);
            }
            else {
                fragment.appendChild(item);
                fragment.appendChild(list);
            }

            preItem = item;
            preList = list;
            preLevel = level;

        });

        eMenuCont.innerHTML = '';
        eMenuCont.appendChild(fragment);

        // event.initSelect();

    }

    function Event() {

        var switchSelect = new c.Multiselect,
            urlHandle = new UrlHandle;

        // 点击事件
        eMenu.addEventListener('click', function (e) {
            c.scopeElements(e.target, function (elem) {
                var eItem;
                if (elem === eMenu) {
                    // 祖先情况跳出
                    return false;
                }

                if (elem.tagName === 'A') {

                    eItem = elem.parentElement.parentElement;

                    if (eItem.classList.contains('m-tool')) {
                        // 顶部工具条情况
                        if (elem.classList.contains('copy')) {
                            // 复制按钮

                            var jsTxt = '';
                            switchSelect.eachSelect(function (elem) {
                                jsTxt += jsTxtData[elem.getAttribute('data-index')];
                            });

                            copy(compressorJs(jsTxt));

                        }
                        else if (elem.classList.contains('level')) {
                            triggerALl(elem.innerHTML);
                        }

                    }

                    return false;
                }
                if (elem.tagName === 'I') {
                    // 箭头情况
                    trigger(elem.parentElement);
                    return false;
                }
                if (elem.classList.contains('item')) {

                    if (!(elem.classList.contains('edit') || elem.classList.contains('tool'))) {
                        goTo(elem);
                    }

                    return false;
                }
            });
        });

        // 初始定位
        this.initSelect = urlHandle.initSelect;

        this.syncSelect = function (eItem) {
            switchSelect.select(eItem, function () {
                urlHandle.change(eItem.getAttribute('data-index'));
            }, 1);


        };

        function copyJsTxt() {
            var jsTxt = '';
            switchSelect.eachSelect(function (elem) {
                jsTxt += jsTxtData[elem.getAttribute('data-index')];
            });

            // copy(compressorJs(jsTxt));
            copy(jsTxt);
        }

        function trigger(eItem) {
            var eList = eItem.nextElementSibling,
                classList = eItem.classList;

            if (classList.contains('fold')) {
                eList.style.display = 'block';
                classList.remove('fold');
            } else {
                eList.style.display = 'none';
                classList.add('fold');
            }
        }

        function unfold(eItem) {
            var eList = eItem.nextElementSibling,
                classList = eItem.classList;
            if (classList.contains('fold')) {
                eList.style.display = 'block';
                classList.remove('fold');
            }
        }

        function triggerALl(max) {
            var num = 0;
            max = max * 1 - 1;

            query(eMenuCont);

            function query(eList) {
                c.each(eList.children, function (i, elem) {

                    if (elem.classList.contains('list')) {

                        var eItem = elem.previousElementSibling;

                        if (num < max) {
                            elem.style.display = 'block';
                            eItem.classList.remove('fold');
                        }
                        else {
                            elem.style.display = 'none';
                            eItem.classList.add('fold');
                        }

                        num++;

                        query(elem);
                    }
                });
                num--;
            }
        }

        function goTo(eItem) {
            if (eItem.classList.contains('have')) {
                switchSelect.select(eItem);
                copyJsTxt();
            }

            var
                index = eItem.getAttribute('data-index'),
                hx = allHx[index],
                xy = c.relativeXY(hx, eContent);

            eContent.scrollTop = xy.y;

            flicker({elem: hx, toBc: '#ffc'});

            // hxMainSwitchSelect(hx.parentElement);

            urlHandle.change(index);
        }

        function UrlHandle() {

            this.initSelect = function () {
                if (assignSelectArticleData > 0) {
                    goTo(eMenu.querySelectorAll('.item')[+assignSelectArticleData + 1]);
                    assignSelectArticleData = null;
                }
            };

            this.change = function (index) {

                var url = location.href,
                    have = 0;

                url = location.href.replace(/hindex=[^&]*/, function () {
                    have = 1;
                    return 'hindex=' + index;
                });

                if (have === 0) {
                    url = url + '&hindex=' + index
                }

                window.history.pushState('', '', url);
            };
        }
    }

    function getJsText(elem) {
        var jsTxt = '';
        var allNextElem = [];

        while (1) {
            elem = elem.nextElementSibling;
            if (/H[\d]/.test(elem.tagName)) {

                break;
            }
            allNextElem.push(elem);
        }

        c.each(allNextElem, function (i, elem) {
            var elems = elem.getElementsByTagName('*');
            for (var i = 0, len = elems.length; i < len; i++) {
                if (elems[i].classList.contains('lang-javascript')) {
                    jsTxt = elems[i].textContent;
                    return false;
                }
            }
        });

        return jsTxt;
    }

    function copy(content) {
        var textarea = document.createElement('textarea');

        textarea.value = content;

        document.body.appendChild(textarea);

        textarea.select();

        document.execCommand("copy");

        textarea.remove();
    }

}
