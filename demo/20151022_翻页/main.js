"use strict";

(function () {
    var c = {};

    //#region 去两头空格
    // \uFEFF 为出现在开头的特殊字符
    c.trim = function (str) {
        return str.replace(/(^[\s\uFEFF]*)|(\s*$)/g, '');
    };
    //#endregion

    //#region 翻页
    c.pager = (function () {

        /*
        翻页基本
    
        pageData: [1, 200, 10],//当前页，数据总条数，每页显示数
        normalCssName: 'num_page',//可选
        prevCssName: 'num_page prev_page',//可选
        nextCssName: 'num_page next_page mr20',//可选
        activeCssName:'active',//可选。默认active
        noShow: true,//可选
        baseUrl: '/',//可选。默认为false。表示值为javascript:; 这种情况，pageUrl也可不选，即使选了也无效。
        pageUrl: '/page/',//可选。默认 '?page='。如果baseUrl为false，pageUrl选了也无效
        mainBtnNum: 5,//可选
        sideBtnNum: 1,//可选
        prevTxt: '«',//可选
        nextTxt: '»'//可选
    
        */
        function getHtml(params) {

            var
                //可选
                normalCssName = params.normalCssName ? params.normalCssName : '',
                prevCssName = params.prevCssName ? params.prevCssName : '',
                nextCssName = params.nextCssName ? params.nextCssName : '',
                activeCssName = params.activeCssName ? params.activeCssName : 'active',

                //是否 显示 上下 页 按钮。true 表示不显示。
                //可选。默认 false
                noShow = params.noShow ? params.noShow : false,

                //url
                //可选。 
                baseUrl = params.baseUrl ? params.baseUrl : false,//可选。默认为false。表示值为javascript:; 且pageUrl 无效。
                pageUrl = params.pageUrl ? params.pageUrl : '?page=',

                //可选
                buildBtnHref = params.buildBtnHref ? params.buildBtnHref : function (page) { return baseUrl ? baseUrl + pageUrl + page : 'javascript:;'; },

                //主要按钮 数量。..之间的按钮 包括..
                //可选 。默认5
                mainBtnNum = params.mainBtnNum ? params.mainBtnNum : 5,

                //两侧按钮数量。因为对称，只需指定一侧，且必须大于等于1。等于1 的情况就是 第一页，和最后一页
                //可选。默认1
                sideBtnNum = params.sideBtnNum ? params.sideBtnNum : 1,

                //上/下一个按钮 内容
                //可选。 
                prevTxt = params.prevTxt !== undefined ? params.prevTxt : '«',
                nextTxt = params.nextTxt !== undefined ? params.nextTxt : '»',

                //点点 按钮 内容
                //可选。 
                omitTxt = params.omitTxt ? params.omitTxt : '..',

                //当前页
                page = params.pageData[0] * 1,

                //总条数
                count = params.pageData[1] * 1,

                //每页显示数
                pageSize = params.pageData[2] * 1,

                //总页数
                pageCount = Math.ceil(count / pageSize);
            ;

            function hasCssName(targetName, cssName) {

                targetName = ' ' + targetName + ' ';
                cssName = ' ' + cssName + ' ';

                if (cssName.indexOf(targetName) > -1) return true;

                return false;
            }

            function getBtnHtml(options) {

                var tPage = options.page,
                    txt = options.txt !== undefined ? options.txt : options.page,
                    btnTagName = 'a',
                    cssName = c.trim(options.cssName + (page == tPage ? ' ' + activeCssName : '')),
                    url = buildBtnHref(tPage);

                url = 'href="' + url + '"';

                if (hasCssName('disabled', cssName) || hasCssName(activeCssName, cssName)) url = '';
                return '<' + btnTagName + ' class="' + cssName + '" ' + url + ' data-page="' + tPage + '">' + txt + '</' + btnTagName + '>'
            }

            function build() {
                var
                    prevBtn = '',
                    nextBtn = '',

                    leftSideBtn = '',
                    rightSideBtn = '',

                    mainBtn = '',

                    i;



                //不出现省略情况。即  按钮数>=总页数
                if (sideBtnNum * 2 + mainBtnNum >= pageCount) {
                    for (i = 0; i < pageCount; i++) {
                        mainBtn += getBtnHtml({
                            cssName: normalCssName,
                            page: i + 1
                        });
                    }
                }
                    //有省略情况
                else {

                    //** 两侧 按钮 html
                    for (i = 0; i < sideBtnNum; i++) {
                        leftSideBtn += getBtnHtml({
                            cssName: normalCssName,
                            page: i + 1

                        });
                    }
                    for (i = sideBtnNum; i--;) {
                        rightSideBtn += getBtnHtml({
                            cssName: normalCssName,
                            page: pageCount - i
                        });
                    }

                    //** 主要 按钮 html
                    //左边没省略情况 当然 右边就有省略 
                    if (page <= sideBtnNum + Math.ceil(mainBtnNum / 2)) {
                        for (i = 0; i < mainBtnNum - 1; i++) {
                            mainBtn += getBtnHtml({
                                cssName: normalCssName,
                                page: sideBtnNum + i + 1
                            });
                        }
                        mainBtn += getBtnHtml({
                            cssName: normalCssName,
                            txt: omitTxt,
                            page: sideBtnNum + mainBtnNum
                        });
                    }
                        //右边没省略情况 当然 左边边就有省略
                    else if (page > pageCount - sideBtnNum - Math.ceil(mainBtnNum / 2)) {
                        mainBtn += getBtnHtml({
                            cssName: normalCssName,
                            txt: omitTxt,
                            page: pageCount - sideBtnNum - mainBtnNum + 1
                        });
                        for (i = mainBtnNum - 1; i--;) {
                            mainBtn += getBtnHtml({
                                cssName: normalCssName,
                                page: pageCount - sideBtnNum - i
                            });
                        }
                    }
                        //两边都有省略
                    else {
                        mainBtn += getBtnHtml({
                            cssName: normalCssName,
                            txt: omitTxt,
                            page: page - Math.ceil(mainBtnNum / 2) + 1
                        });

                        for (i = 0; i < mainBtnNum - 2; i++) {
                            mainBtn += getBtnHtml({
                                cssName: normalCssName,
                                page: page - Math.floor((mainBtnNum - 2) / 2) + i
                            });
                        }
                        mainBtn += getBtnHtml({
                            cssName: normalCssName,
                            txt: omitTxt,
                            page: page + Math.ceil(mainBtnNum / 2) - 1
                        });
                    }
                }

                //上一页
                prevBtn = (page === 1 && noShow) ? '' : getBtnHtml({
                    cssName: prevCssName + (page == 1 ? ' disabled' : ' enable'),
                    page: page - 1,
                    txt: prevTxt
                });

                //下一页
                nextBtn = (page === pageCount && noShow) ? '' : getBtnHtml({
                    cssName: nextCssName + (page === pageCount ? ' disabled' : ' enable'),
                    page: page + 1,
                    txt: nextTxt
                });

                return prevBtn + leftSideBtn + mainBtn + rightSideBtn + nextBtn;
            }

            //** 初始
            //只有一页情况
            if (pageCount < 1) return '';

            return build();
        }

        return {
            getHtml: getHtml
        };
    })();
    //#endregion



    build(1);

    document.getElementById('pager').onclick = function (e) {
        e = event || e;
        var target = e.target || e.srcElement;

        if (target !== this) {
            build(target.getAttribute('data-page'));
        }

    };

    function build(page) {
        document.getElementById('pager').innerHTML = c.pager.getHtml({
            pageData: [page, 100, 10],//当前页，数据总条数，每页显示数
            prevCssName: 'prev',//可选
            nextCssName: 'next',//可选
            //sideBtnNum: 2,//可选
            prevTxt: '&lt;',//可选
            nextTxt: '&gt;'//可选
    
        });
    }

})();

