
"use strict";

var c = {};

//#region 频率执行
// 实现按指定间隔执行
c.ExcuFrequency = function () {
    var status = 0;
    this.excu = function (fn, time) {
        if (status) return;
        status = 1;
        setTimeout(function () {
            fn();
            status = 0;
        }, time === undefined ? 600 : time);
    }
};
//#endregion   

// #region 增加css 文本
c.addCssTxt = function (txt) {
    var eStyle = document.createElement('style');

    if ('textContent' in eStyle) {
        eStyle.textContent = txt;
        document.head.appendChild(eStyle);
    }
    else {
        // ie678
        eStyle.setAttribute("type", "text/css");
        eStyle.styleSheet.cssText = txt;
        document.body.appendChild(eStyle);
    }
};
// #endregion

//#region 自定义下拉

/*
 # 初始
## c.StyleSelect
    @example
        var styleSelect = c.StyleSelect({
        jSelect: $('select'),
        onChange: function () {
            console.log(123);
        }
    });
    @param (jq) jSelect 
    @param [function] onChange 

# method

## styleSelect.add 增加
    @example
        styleSelect.add('xxx'+i);
    @param (string) name option的标签值
    @param [string] value option的value属性值

## styleSelect.select 选中
    @example
        styleSelect.select('xxx' + i);
    @param (string) value option的value属性值，没有则标签值

 */

c.StyleSelect = function (params) {

    var

      jSelect = params.jSelect,
      eSelect = jSelect[0],
      jIn,
      onchange = params.onchange || function () { },
      listBox;

    inputInit();

    function inputInit() {
        jIn = $('<input type="text" style="width:' + jSelect.width() + 'px;"/>');

        jSelect.after(jIn);
        jSelect.hide();

        jIn.val(eSelect.options[eSelect.selectedIndex].innerHTML)
        .on({
            mousedown: function () {
                if (listBox === undefined) listBox = new ListBoxInit({ jIn: jIn });
                listBox.show();
            },
            keydown: function (e) {
                switch (e.keyCode) {

                    case 38:
                        if (listBox.isShow()) listBox.hover();
                        break;
                    case 40:
                        if (listBox.isShow()) listBox.hover(1);
                        break;
                    case 13:
                        listBox.enterKeyActive();
                        break;
                    case 39: case 37:
                        break;
                    case 27:
                        listBox.close();
                        break;
                    default:
                        listBox.show();
                        listBox.filter();
                }
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

        this.show = show;
        this.close = function () { };// 由closeInit初始
        this.filter = function () { };// 由FilterInit初始
        this.enterKeyActive = enterKeyActive;
        this.hover = hover;
        this.isShow = function () {
            return isShow;
        };
        this.add = function (name) {
            var jItem = $(('<li data-key="' + count + '">' + name + '</li>')).appendTo(jUl);

            jItems = jUl.children();
            count++;

            hoverData[hoverData.length] = jItem[0];
            hoverData.length++;
        }
        // 外部select接口
        this.select = function (index) {
            activeByIndex(index);
        };

        function show() {
            if (once === 0) {
                once = 1;
                init();

            }

            if (isShow === 0) {
                isShow = 1;

                jStyleList.show();

                activeByIndex(eSelect.selectedIndex);

                showDown(jItems.eq(selectedIndex));
            }
        }
        function close() {
            that.close();
        }

        function init() {
            var html = ''
                , options = eSelect.options
                , eIn = jIn[0]
            ;

            count = options.length;

            c.addCssTxt('.style-list-box{background:#fff;position:absolute;overflow:auto;border:2px solid #212121;max-height:200px;float:left;display:none}.style-list-box li{padding:0 2px;line-height:1.4}.style-list-box li.active{background:#26a0da;color:#fff}.style-list-box li.hover{background:#ADCA7A;color:#fff}');

            for (var i = 0; i < count; i++) {
                html += '<li data-key="' + i + '">' + options[i].innerHTML + '</li>';
            }

            jStyleList = $('<div class="style-list-box" tabindex="-1"><ul>' + html + '</ul></div>');
            jUl = jStyleList.children();
            hoverData = jItems = jUl.children();

            jIn.after(jStyleList);

            jStyleList.css({
                left: eIn.offsetLeft
                , top: eIn.offsetTop + eIn.offsetHeight - 1
                , width: eIn.offsetWidth - 4
            });

            closeInit();

            filterInit();

            eventInit();

            jStyleList.on({
                mouseup: function () {
                    jIn.focus();
                }
            });
        }

        function closeInit() {
            var bJq = $(document.body);

            jStyleList.add(jIn).hover(function () {
                bJq.off({ mousedown: close });
            }, function () {
                if (isShow) bJq.on({ mousedown: close });
            });

            function close() {
                if (isShow) {
                    jStyleList.hide();

                    bJq.off({ mousedown: close });

                    // 删除hover高亮
                    $(currHoverLi).removeClass('hover');
                    currHoverLi = undefined;

                    isShow = 0;

                    // 恢复输入框显示
                    jIn.val(eSelect.options[selectedIndex].innerHTML);

                    // 恢复项的显示(因搜索情况消失的项)
                    jItems.show();
                    hoverData = jItems;// 恢复上下键移动数据为完全
                }
            }

            that.close = close;
        }

        function filterInit() {
            var excuFrequency = new c.ExcuFrequency();

            that.filter = function () {
                excuFrequency.excu(function () {
                    var v = $.trim(jIn.val()),
                        i = 0;

                    hoverData = {
                        filter: true
                    };

                    jItems.each(function () {
                        if (this.innerHTML.indexOf(v) === -1) {
                            this.style.display = 'none';
                            this._data_hoverIndex = undefined;
                        }
                        else {
                            this.style.display = 'block';
                            this._data_hoverIndex = i;
                            hoverData[i] = this;
                            i++;
                        }
                    });

                    hoverData.length = i;

                });
            }
        }

        function eventInit() {

            jStyleList.on({
                mousemove: function (e) {
                    var target = e.target;

                    if (target.tagName === 'LI' && currHoverLi !== target) {

                        $(currHoverLi).removeClass('hover');
                        $(target).addClass('hover');

                        currHoverLi = target;

                    }
                },
                click: function (e) {
                    var target = e.target;

                    if (target.tagName === 'LI' && currActiveLi !== target) {

                        activeByElem(target);

                        eventActive(target);
                    }
                    else {
                        close();
                    }
                }
            });

        }

        function eventActive(target) {
            close();

            onchange();

            currActiveLi = target;
        }

        function activeByIndex(index) {

            jItems.eq(selectedIndex).removeClass('active');
            currActiveLi = jItems.eq(index).addClass('active')[0];

            selectedIndex = eSelect.selectedIndex = index;
        }

        function activeByElem(elem) {
            $(currActiveLi).removeClass('active');
            $(elem).addClass('active');

            selectedIndex = eSelect.selectedIndex = elem.getAttribute('data-key');
        }

        function hover(isDown) {
            var jItem,
                index;

            if (currHoverLi === undefined) {
                currHoverLi = currActiveLi;
            }

            index = hoverData.filter === true ? currHoverLi._data_hoverIndex : (currHoverLi.getAttribute('data-key') * 1);

            if (index === undefined) {
                index = 0;// isDown ?0:( hoverData.length - 1 );
            }
            else {
                if (isDown) {
                    index++;
                }
                else {
                    index--;
                }
            }

            if (index > -1 && index < hoverData.length) {
                $(currHoverLi).removeClass('hover');
                jItem = $(hoverData[index]).addClass('hover');

                currHoverLi = jItem[0];

                showDown(jItem)
            }
        }

        function enterKeyActive() {

            if (isShow) {
                if (currHoverLi) {
                    activeByElem(currHoverLi);
                    eventActive(currHoverLi);
                }
                else {
                    close();
                }
            }
            else {
                show();
            }
        }

        function showDown(jItem) {
            var
                boxST,
                itemH,
                itemTop,
                minTop,
                listH = jStyleList[0].clientHeight;

            if (jItem.length === 0) return;

            boxST = jStyleList.scrollTop();
            itemH = jItem.outerHeight();
            itemTop = jItem.position().top;
            minTop = listH - itemH;

            if (minTop < itemTop) {
                jStyleList.scrollTop((boxST + itemTop + itemH - listH));
            }
            else if (itemTop < 0) {
                jStyleList.scrollTop(boxST + itemTop);
            }
        }


    }

    function add(name, value) {
        value = value === undefined ? name : value
        jSelect.append("<option value='" + value + "'>" + name + "</option>");
        listBox && listBox.add(name);
    }

    function select(v) {
        var index;

        jSelect.val(v);

        index = eSelect.selectedIndex;

        if (index < 0) {
            eSelect.selectedIndex = index = 0;
        }

        if (listBox && listBox.isShow()) {
            listBox.select(index);
        }

        jIn.val(eSelect.options[index].innerHTML);
    }

    return {
        add: add,
        select: select
    };


};
//#endregion



$(function () {

    var styleSelect =  c.StyleSelect({
        jSelect: $('select'),
        onchange: function () {
            console.log(123);
        }
    });

    var i = 0;
    $('button').click(function () {
        i++;
        styleSelect.add('学校'+i);
        styleSelect.select('学校' + i);
    });
    //styleSelect.select();




});