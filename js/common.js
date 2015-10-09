"use strict";
(function () {

    var c = {};

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

            function trim(str) {
                // 用正则表达式将前后空格  用空字符串替代。  
                return str.replace(/(^[\s\uFEFF]*)|(\s*$)/g, "");
            }

            function build() {
                var
                    prevBtn = '',
                    nextBtn = '',

                    leftSideBtn = '',
                    rightSideBtn = '',

                    mainBtn = '',

                    btnTagName = 'a',

                    i;

                function getBtnHtml(options) {

                    var tPage = options.page,
                        txt = options.txt !== undefined ? options.txt : options.page,
                        cssName = trim(options.cssName + (page == tPage ? ' ' + activeCssName : '')),
                        url = baseUrl ? baseUrl + pageUrl + tPage : 'javascript:;';

                    url = 'href="' + url + '"';

                    if (hasCssName('disabled', cssName) || hasCssName(activeCssName, cssName)) url = '';
                    return '<' + btnTagName + ' class="' + cssName + '" ' + url + ' data-page="' + tPage + '">' + txt + '</' + btnTagName + '>'
                }

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

        function commonAjax(jPageBox, pageData, getData, partial) {
            if (jPageBox.length === 0) return;

            pageData.page = pageData.page * 1;
            partial = partial === 1 ? 1 : 0;

            var
                jBtns,
                jTxt,//页 输入框
                pageCount = Math.ceil(pageData.total / pageData.pageSize);

            if (pageCount <= 0) {
                jPageBox.html('');
                return;
            }
            else if (pageCount === 1) {

            }

            jPageBox.html(getHtml({
                pageData: [pageData.page + partial, pageData.total, pageData.pageSize],//当前页，数据总条数，每页显示数
                prevCssName: 'prev',//可选
                nextCssName: 'next',//可选
                sideBtnNum: 2,//可选
                prevTxt: '&lt;',//可选
                nextTxt: '&gt;'//可选
            }) + '<span>跳转到：<input type="text" class="page_input" value="' + (pageData.page + partial) + '"/></span><a href="javascript:;" class="go">GO</a>');

            jTxt = $(jPageBox[0].getElementsByTagName('input')[0]);

            jTxt.ENTER(function () {
                goPage();
            });

            jBtns = jPageBox.children().click(function () {
                var jBtn = $(this);

                if (jBtn.hasClass('go')) {
                    goPage();
                    return;
                }
                if (jBtn.hasClass('disabled') || jBtn.hasClass('active') || this.tagName === 'SPAN') return;

                if (!jBtn.hasClass('prev') && !jBtn.hasClass('next')) {
                    jBtns.eq(pageData.page).removeClass('active');
                    jBtn.addClass('active');
                }
                getData(jBtn.attr('data-page') - partial);
            });

            function goPage() {
                var num = $.trim(jTxt.val());

                if (isNaN(num)) {
                    common.msg('请输入数字');
                }
                else if (num > pageCount) {
                    common.msg('当前只有' + pageCount + '页');
                }
                else if (num == pageData.page + partial) {
                    common.msg('当前就是第' + num + '页');
                }
                else {
                    getData(num - partial);
                }
            }
        }

        return {
            getHtml: getHtml,
            commonAjax: commonAjax
        };
    })();
    //#endregion


    window.c = window.common = c;

})();