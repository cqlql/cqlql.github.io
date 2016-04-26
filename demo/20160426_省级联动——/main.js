
"use strict";


var
    jBox,
    jIn, jTab,jConts,
    jProvinceBox,
    jCityBox,
    jSelectBox,
    jQueryList, jPopup,
    selectedValue='',
    selectedText = '';

domQuery();

var provinceClassify = {
        'A-G': [11, 34, 35, 44, 45, 50, 52, 62, 82]
        , 'H-K': [13, 22, 23, 32, 36, 41, 42, 46]
        , 'L-S': [14, 15, 21, 31, 37, 51, 61, 63, 64]
        , 'T-Z': [12, 33, 53, 54, 65, 71, 81]
    },
    noQueryCity = {11:1,12:1,31:1,50:1,81:1,82:1}
;

var contentHtmlBuild=new ContentHtmlBuild();

inputInit();

var tab = new Tab();

contentSelect();

queryList();

outsideClose(jIn, jPopup, function () {
    jPopup.hide();
    jIn.val(selectedText);
});



function inputInit() {
    var excuFrequency = new c.ExcuFrequency();

    var listBox = new ListBoxInit({});

    jIn.on({
        keydown: function (e) {
            excuFrequency.excu(function () {
             

                switch (e.keyCode) {

                    case 38:
                        listBox.hover();
                        break;
                    case 40:
                        listBox.hover(1);
                        break;
                    case 13:
                        
                        break;
                    case 39: case 37:
                        break;
                    case 27:
                        
                        break;
                    default:
                        jQueryList.show();
                        jSelectBox.hide();
                        filter();

                }
            });
        },
        click: function () {
            jQueryList.hide();
            jSelectBox.show();
        }
    });

    function filter() {
        var v = $.trim(jIn.val()),
                 html = '',
                 i = 0;

        $.each(areaModelTrees, function () {
            var name = this.name;
            if (name.indexOf(v) > -1) {
                html += '<a href="javascript:;" attr-id="' + this.id + '">' + name + '</a>';
                i++;

                if (i > 11) {
                    return false;
                }
            }

            if (!noQueryCity[this.id]) {
                $.each(this.citys, function () {
                    if (this.cityName.indexOf(v) > -1) {
                        html += '<a href="javascript:;" attr-id="' + this.cityId + '">' + name + ' / ' + this.cityName + '</a>';
                        i++;

                        if (i > 11) {
                            return false;
                        }
                    }
                });

                if (i > 11) {
                    return false;
                }
            }

        });

        if (html.length === 0) html = '<b>没有匹配项</b>';

            jQueryList.html(html);
     
    }
}

function contentSelect() {
    var jCurr = $(), jCurrCity = $();
    jProvinceBox.on('click', 'a', function () {

        if (jCurr[0] === this) return;

        jCurr.removeClass('active');

        jCurr=  $(this).addClass('active');

        selectedText = jCurr.html();
        selectedValue = jCurr.attr('attr-id');

        contentHtmlBuild.city(selectedValue);

        jIn.val(selectedText);

        tab.select(1);

    });

    jCityBox.on('click', 'a', function () {

        if (jCurrCity[0] === this) return;

        jCurrCity.removeClass('active');

        jCurrCity = $(this).addClass('active');
        
        selectedText = jCurr.html() + ' / ' + jCurrCity.html();
        selectedValue = jCurrCity.attr('attr-id');

        jIn.val(selectedText);

        jSelectBox.hide();

    });
}

function Tab() {
    var
        currIndex = 0,
        jBtns = jTab.children();

    jTab.on('click', 'a', function () {
        select($(this).index());
    });

    this.select = select;

    function select(index) {

        if (index === currIndex) return;

        jBtns.eq(currIndex).removeClass('active');
        jConts.eq(currIndex).hide();

        jBtns.eq(index).addClass('active');
        jConts.eq(index).show();

        currIndex = index;
    }
}

function ContentHtmlBuild() {
    var newAreaData = {};
    $.each(areaModelTrees, function () {
        newAreaData[this.id] = this;
    });

    var contentHtml = '';
    $.each(provinceClassify, function (k) {

        contentHtml += '<dt>' + k + '</dt><dd>';

        $.each(this, function () {
            var d = newAreaData[this];

            contentHtml += '<a title="' + d.name + '" attr-id="' + d.id + '" href="javascript:;">' + d.name + '</a>';
        });

        contentHtml += '</dd>';

    });
    jProvinceBox.html(contentHtml);

    this.city = function (id) {
        var cityHtml = '';
        $.each(newAreaData[id].citys, function () {
            cityHtml += '<a title="' + this.cityName + '" attr-id="' + this.cityId + '" href="javascript:;">' + this.cityName + '</a>';
        });

        jCityBox.html(cityHtml);

    };
}

function queryList() {
    jQueryList.on('click', 'a', function () {

        selectedText = this.innerHTML;
        selectedValue = this.getAttribute('attr-id');

        jIn.val(selectedText);
        
        jQueryList.hide();
    });
}

function domQuery() {
    var child, child2;

    jBox = $('.area-select');

    child = jBox.children();

    child2 = child.eq(1).children();

    jIn = child.eq(0);
    jSelectBox = child.eq(1);
    jQueryList = child.eq(2);

    jTab = child2.eq(0);
    jConts = child2.eq(1).children();

    jProvinceBox = jConts.eq(0);
    jCityBox = jConts.eq(1);
    
    jPopup = jSelectBox.add(jQueryList);
}

// 点外面关闭实现
function outsideClose(jBtn, jPopup, close) {
    var inside = false;
    jBtn
    .on('click', function () {
        inside = true;
    });

    jPopup
    .on('click', function () {
        inside = true;
    });

    $(window).on('click', function () {
        if (inside) {
            inside = false;
        }
        else {
            close();
        }
    });
}

function ListBoxInit(params) {
    var
        jIn = params.jIn,

        jStyleList, jUl, jItems,

        selectedIndex,
        currActiveLi, currHoverLi,
        count,

        hoverData,

        once = 0,
        isShow = 0,

        that = this;

    this.hover = hover;
    this.close = function () { };
    this.filter = function () { };

    function hover(isDown) {
       

    }



}