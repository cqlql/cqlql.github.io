"use strict";


console.log(c.pager);

var ePager = document.getElementById('pager')
, pageData = ePager.getAttribute('data-page').split(',');


ePager.innerHTML = c.pager.getHtml({
    pageData: [pageData[0], pageData[1], pageData[2]],//当前页，数据总条数，每页显示数
    prevCssName: 'prev',//可选
    nextCssName: 'next',//可选
    //sideBtnNum: 2,//可选
    prevTxt: '&lt;',//可选
    nextTxt: '&gt;'//可选

    ,baseUrl: '/',//可选。默认为false。表示值为javascript:; 这种情况，pageUrl也可不选，即使选了也无效。
    pageUrl: '/page',//可选。默认 '?page='。如果baseUrl为false，pageUrl选了也无效
});

