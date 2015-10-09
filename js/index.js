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
});

