
"use strict";

// 此处有超出范围的可封装写法

//#region 地区选择
c.AreaSelect = function (params) {

    var
        jBox = params.jBox,
        jIn, jTab, jConts,
        jProvinceBox,
        jCityBox,
        jSelectBox,
        jQueryList, jPopup,
        selectedValue = '',
        selectedText = '';

    domQuery();

    var provinceClassify = {
        'A-G': [11, 34, 35, 44, 45, 50, 52, 62, 82]
        , 'H-K': [13, 22, 23, 32, 36, 41, 42, 46]
        , 'L-S': [14, 15, 21, 31, 37, 51, 61, 63, 64]
        , 'T-Z': [12, 33, 53, 54, 65, 71, 81]
    },
        noQueryCity = { 11: 1, 12: 1, 31: 1, 50: 1, 81: 1, 82: 1 }
    ;

    var contentHtmlBuild = new ContentHtmlBuild();

    inputInit();

    var tab = new Tab();

    var contentSelect = new ContentSelect();

    queryList();

    outsideClose(jIn, jPopup, function () {
        if (jIn.val().length===0) {
            selectedValue = '';
            selectedText = '';
        }
        jPopup.hide();
        jIn.val(selectedText);

    });

    this.getValue = function () {
        return selectedValue;
    };

    this.setValue = function (v) {
        v += '';

        if (v.length === 2) {

            selectedText = contentHtmlBuild.getProvinceData(v).text;
        }
        else if (v.length === 4) {

            selectedText = contentHtmlBuild.getCityData(v).text;
        }
        selectedValue = v;

        jIn.val(selectedText);

    };

    function select(eItem) {
            selectedText = eItem.innerHTML;
            selectedValue = eItem.getAttribute('attr-id');
        jIn.val(selectedText);
    }

    function inputInit() {
        var excuFrequency = new c.ExcuFrequency();

        var eItems = jQueryList[0].children;

        var listBox = new ListBoxInit({
            jBox: jQueryList,
            eItems: eItems
        });

        jIn.on({
            keydown: function (e) {

                switch (e.keyCode) {

                    case 38:
                        listBox.hover();
                        return false;
                        break;
                    case 40:
                        listBox.hover(1);
                        return false;
                        break;
                    case 13:
                        // listBox.enterKey(select);
                        listBox.enterKey(function (eItem) {
                             if (eItem.tagName === 'A') {
                                 var id = eItem.getAttribute('attr-id');

                                 if(noQueryCity[id]){
                                     selectedValue = eItem.getAttribute('attr-id');
                                     selectedText = eItem.innerHTML+ ' / ' +  eItem.innerHTML;
                                     jIn.val(selectedText);
                                 }
                                 else{
                                     select(eItem);
                                 }
                             }
                        });
                        jQueryList.hide();
                        break;
                    case 39: case 37:
                        break;
                    case 27:

                        break;
                    default:
                        filter();

                }
            },
            click: function () {
                contentSelect.select(selectedValue);
                jQueryList.hide();
                jSelectBox.show();
            }
        });

        function filter() {
            excuFrequency.excu(function () {
                var v =$.trim( jIn.val());

                if (!v) return;

                v = v.split('/');
                var 
                    v1 = $.trim(v[0]),
                    v2 = $.trim(v[1]),
                         html = '',
                         i = 0;

                $.each(areaModelTrees, function () {
                    var name = this.name;
                    if ((v2 && name.indexOf(v2) > -1) || (v1 && name.indexOf(v1) > -1)) {
                        html += '<a href="javascript:;" attr-id="' + this.id + '">' + name + '</a>';
                        i++;

                        if (i > 11) {
                            return false;
                        }
                    }

                    if (!noQueryCity[this.id]) {
                        $.each(this.citys, function () {
                            if ((v2 && this.cityName.indexOf(v2) > -1) || (v1 && this.cityName.indexOf(v1) > -1)) {
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

                eItems[0].className = 'hover';

                listBox.reset();

                jQueryList.show();
                jSelectBox.hide();
            });
        }

        function ListBoxInit(params) {
            var
                jIn = params.jIn,
                eItems = params.eItems,
                jBox = params.jBox,

                jStyleList, jUl,

                hoverIndex = 0,

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
            this.reset = function () {
                hoverIndex = 0;
            };
            this.enterKey = function (fn) {
                fn(eItems[hoverIndex]);
            };

            function hover(isDown) {
                var index = hoverIndex;

                if (isDown) {
                    index++;
                }
                else {
                    index--;
                }

                if (index > -1 && index < eItems.length) {
                    eItems[hoverIndex].className = '';
                    eItems[index].className = 'hover';

                    showDown($(eItems[index]));

                    hoverIndex = index;
                }
            }

            function showDown(jItem) {
                var
                    boxST,
                    itemH,
                    itemTop,
                    minTop,
                    listH = jBox[0].clientHeight;

                if (jItem.length === 0) return;

                boxST = jBox.scrollTop();
                itemH = jItem.outerHeight();
                itemTop = jItem.position().top;
                minTop = listH - itemH;

                if (minTop < itemTop) {
                    jBox.scrollTop((boxST + itemTop + itemH - listH));
                }
                else if (itemTop < 0) {
                    jBox.scrollTop(boxST + itemTop);
                }
            }
        }
    }

    function ContentSelect() {
        var jCurr = $(), jCurrCity = $(), jProvinceItems = jProvinceBox.find('a');
        jProvinceBox.on('click', 'a', function () {

            if (jCurr[0] === this) return;

            jCurr.removeClass('active');

            jCurr = $(this).addClass('active');

            select(this);

            if (contentHtmlBuild.city(selectedValue)) {
                jCityBox.children().click();
            }

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

        function provinceActive(eItem) {
            jCurr.removeClass('active');

            jCurr = $(item).addClass('active');
        }


        // 根据id 手动选择
        this.select = function (id) {

            id += '';
            if (id.length === 2) {

                jCurr.removeClass('active');

                jCurr = jProvinceItems.eq(contentHtmlBuild.getProvinceItemIndex(id)).addClass('active');

                contentHtmlBuild.city(id);

                tab.select(1);

            }
            else if (id.length === 4) {
                var provinceId = id.substr(0, 2);
                jCurr.removeClass('active');

                jCurr = jProvinceItems.eq(contentHtmlBuild.getProvinceItemIndex(provinceId)).addClass('active');

                contentHtmlBuild.city(provinceId);

                jCurrCity.removeClass('active');

                jCurrCity = jCityBox.children().eq(contentHtmlBuild.getCityItemIndex(id)).addClass('active');

                tab.select(1);
            }
            else if (jCurr) {
                // 清空
                jCurr.removeClass('active');
                jCurrCity.removeClass('active');
                jCurrCity=jCurr = $();
                jCityBox.html('');
                tab.select(0);
            }
        };
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
        var newAreaData = {},
            provinceItemsKey = {},
            cityItemsKye = {};
        $.each(areaModelTrees, function () {
            newAreaData[this.id] = this;
        });

        var contentHtml = '', i = 0;
        $.each(provinceClassify, function (k) {

            contentHtml += '<dt>' + k + '</dt><dd>';

            $.each(this, function () {
                var d = newAreaData[this];

                contentHtml += '<a title="' + d.name + '" attr-id="' + d.id + '" href="javascript:;">' + d.name + '</a>';

                provinceItemsKey[d.id] = i++;

            });

            contentHtml += '</dd>';

        });
        jProvinceBox.html(contentHtml);

        // 根据id 取 a项 索引
        this.getProvinceItemIndex = function (id) {
            return provinceItemsKey[id];
        };
        this.getCityItemIndex = function (id) {
            return cityItemsKye[id];
        };

        // 根据id取数据
        this.getProvinceData = function (id) {
            var provinceData = newAreaData[id];

            if (noQueryCity[id])
                return {
                    text: provinceData.name + ' / ' + provinceData.name
                };

            return {
                text: provinceData.name
            }
        };
        this.getCityData = function (id) {

            var provinceId = id.substr(0, 2),
             provinceData = newAreaData[provinceId],
             cityData = provinceData.citys;

            if (getType(cityData) === 'array') {
                cityDataToDirEach(cityData, 0, provinceId);
            }
            return {
                provinceId: provinceId,
                text: provinceData.name + ' / ' + provinceData.citys[id].cityName
            };

        }

        // city 构建
        this.city = function (id) {
            var cityHtml = '',
                cityData, i = 0;

            cityItemsKye = {};

            if (noQueryCity[id]) {
                var d = newAreaData[id];
                jCityBox.html('<a class="active" title="' + d.name + '" attr-id="' + d.id + '" href="javascript:;">' + d.name + '</a>');
                cityItemsKye[d.id] = 0;
                return true;
            }

            cityData = newAreaData[id].citys;

            if (getType(cityData) === 'array') {

                cityDataToDirEach(cityData, function () {
                    cityHtml += '<a title="' + this.cityName + '" attr-id="' + this.cityId + '" href="javascript:;">' + this.cityName + '</a>';
                    cityItemsKye[this.cityId] = i++;

                }, id);
            }
            else {

                $.each(cityData, function () {
                    cityHtml += '<a title="' + this.cityName + '" attr-id="' + this.cityId + '" href="javascript:;">' + this.cityName + '</a>';
                    cityItemsKye[this.cityId] = i++;
                });
            }

            jCityBox.html(cityHtml);
        };

        // 带数组转字典对象的循环
        function cityDataToDirEach(cityData, fn, id) {
            var newCityData = {};
            $.each(cityData, function () {
                newCityData[this.cityId] = this;
                fn && fn.call(this);
            });
            newAreaData[id].citys = newCityData;
        }
    }

    function queryList() {
        jQueryList.on('click', 'a', function () {

            select(this);

            jQueryList.hide();
        });
    }

    function domQuery() {
        var child, child2;

        jBox.html('<input type=text placeholder=选择地区><div class=a-overlay style="display:none;"><div class=a-tab><a href="javascript:;" class=active>省份</a><a href="javascript:;">城市</a></div><div class=a-content><dl class=province></dl><dl class=city style="display:none;"></dl></div></div><div class=query-list style="display:none;"></div>');

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

    function getType(v) {

        var typeStr = typeof v,
            fullTypeStr;

        if (typeStr === 'object') {
            fullTypeStr = ({}).toString.call(v);
            return /\[object ([^\]]+)\]/.exec(fullTypeStr)[1].toLowerCase();
        }
        else {
            return typeStr;
        }
    }
};
//#endregion


var areaSelect = new c.AreaSelect({ jBox: $('.area-select') });