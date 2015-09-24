
(function () {
    
    //#region 首页
    function index() {

        function banner() {
            var box = $('.news_index_banner'),
                jItems = box.find('li'),
                boxW = box.width(), boxH = box.height();

            common.banner({
                jBox: box,
                jItems: jItems,
                itemW: boxW,
                itemH: boxH,
                callBack: function (index) {
                    var jItem = jItems.eq(index),
                        src= jItem.attr('data-src');
                    if (jItem[0].d_finish === undefined) {
                        common.imgFullShowExcu({
                            src:src,
                            imgJq: jItem.find('img'),
                            boxW: boxW,
                            boxH: boxH,
                            config: 'imgFullByBox',
                            finishFunc: function () {
                                if (src) jItem.find('img')[0].src = jItem.attr('data-src');
                            }
                        });
                        jItem[0].d_finish = true;
                    }
                },
                correctImg: function () {}
            });
        }


        ///
        banner();
    }

    //#endregion
    
    //#region 列表页
    function list() {
        common.banner({
            jBox: $('.news_top_banner').children()
        });

    }

    //#endregion

    //#region 视频
    function video() {

        function videoBanner() {
            var jBox = $('.picture_show'),
            jItems = jBox.find('.p_win li'),
            jBtnItems = jBox.find('.p_list li'),
            jIntrItem = jBox.find('.p_intr li'),
            jArraws = jBox.find('.p_arrows'),

            showW = 740,
            showH = 310,
            intrItemW = 260,


            count = jItems.length,

            curIndex = 0,

            time;

            if (count === 0) return;

            function anime(params) {

                var
                    jBox = params.jBox,
                    itemW = params.itemW,
                    itemH = params.itemH,

                    jAnime = null,

                    referWidth = 100,
                    referHeight = 100;

                function getToThree() {
                    return Math.floor(Math.random() * 10) % 3;
                }

                function getToTwo() {
                    return Math.floor(Math.random() * 10) % 2;
                }

                //纵横
                function colRow(index) {
                    var
                        curSrc = jItems.eq(curIndex).attr('data-src'),
                        src = jItems.eq(index).attr('data-src'),

                    c = Math.ceil(itemW / referWidth),
                    shuttersWidth = Math.round(itemW / c),

                    r = Math.ceil(itemH / referHeight),
                    shuttersHeight = Math.round(itemH / r),

                    shuttersCount = c * r,

                    html = '',

                    i, _r, _c, _w, _h, css, imgcss;

                    function getWidth(i) {
                        return i !== c - 1 ? shuttersWidth : itemW - (shuttersWidth * (c - 1));
                    }

                    function getHeight(i) {
                        return i !== r - 1 ? shuttersHeight : itemH - (shuttersHeight * (r - 1));
                    }

                    for (i = 0; i < shuttersCount; i++) {

                        //当前列
                        _c = Math.floor(i % c);

                        //当前行
                        _r = Math.floor(i / c);

                        _w = getWidth(_c);
                        _h = getHeight(_r);

                        css = 'position:absolute;top:' + _r * shuttersHeight + 'px;left:' + _c * shuttersWidth + 'px;overflow: hidden;width:' + _w + 'px;height:' + _h + 'px;';
                        imgcss = 'position:absolute;top:' + (-_r * shuttersHeight) + 'px;left:' + (-_c * shuttersWidth) + 'px;';

                        html += '<div style="' + css + '"><img src="' + src + '" style="' + imgcss + '"/></div>';
                    }

                    html = '<div class="p_anime"><img src="' + curSrc + '"/><div class="p_a_list">' + html + '</div></div>';

                    stop();
                    CRsizeAnime(html, c, getWidth, getHeight);

                }

                //纵横 独有高宽动画
                function CRsizeAnime(html, c, getWidth, getHeight) {
                    var _box, _items, count;

                    _box = jAnime = $(html);

                    _items = jAnime.prependTo(jBox).children().eq(1).children();

                    count = _items.length;

                    _items.each(function (i) {
                        var _jCur = $(this);

                        var
                            //当前列
                            _c = Math.floor(i % c),
                            //当前行
                            _r = Math.floor(i / c),

                            _w = getWidth(_c),
                            _h = getHeight(_r);

                        _jCur.css({ width: 0, height: 0 }).hide();
                        setTimeout(function () {
                            _jCur.animate({ width: _w, height: _h }, 600, function () {
                                if (i >= count - 1) _box.remove();
                            }).fadeIn({ queue: false });
                        }, i * 10);
                    });
                }

                function stop() {

                    if (jAnime !== null) {
                        jAnime.fadeOut(400, function () { $(this).remove(); });
                        jAnime = null;
                    }
                }

                function excu(index) {
                    colRow(index);

                    return;
                    switch (index % 3) {
                        case 0:
                            colRow(index);
                            break;
                        case 1:
                            col(index);
                            break;
                        default:
                            row(index);
                    }
                }
                return { excu: excu };
            }

            function imgShow(index) {
                var _jItem;
                jItems.eq(curIndex).hide();
                _jItem = jItems.eq(index).show();

                if (_jItem.data('hasImg')) return;

                _jItem.html('<img src="' + _jItem.attr('data-src') + '"/>');

                _jItem.data('hasImg', true);
            }

            function intrShow(index) {
                var left = intrItemW;
                if (index > curIndex) left = -left;

                jIntrItem.eq(curIndex).animate({ left: left });
                jIntrItem.eq(index).stop().css({ left: -left, display: 'none' }).animate({ left: 0 }, 400, 'easeOutBack').fadeIn({ queue: false });
            }

            function btnChange(index) {
                jBtnItems.eq(curIndex).removeClass('active');
                jBtnItems.eq(index).addClass('active');
            }

            function excuChange(index) {
                anime.excu(index);

                btnChange(index);
                imgShow(index);
                intrShow(index);

                curIndex = index;
            }

            function indexChange(is) {
                var index = curIndex;

                if (is) {
                    //加情况

                    index++;

                    if (index >= count) index = 0;

                    excuChange(index);
                }
                else {
                    index--;

                    if (index < 0) index = count - 1;

                    excuChange(index);
                }
            }

            function oneIni() {
                var _jItem = jItems.eq(curIndex).show();
                _jItem.data('hasImg', true);
                _jItem.html('<img src="' + _jItem.attr('data-src') + '"/>');
                jBtnItems.eq(curIndex).addClass('active');
                jIntrItem.eq(curIndex).show();
            }

            ///

            oneIni();

            anime = anime({
                jBox: jBox,
                itemW: showW,
                itemH: showH
            });

            jBtnItems.click(function () {
                var index = jBtnItems.index(this);

                if (index === curIndex) return;

                excuChange(index);
            });

            jArraws.click(function () {

                if (jArraws.index(this)) {
                    indexChange(1);
                }
                else {
                    indexChange();
                }
            });

            common.bannerTimeIni(jBox, function () { indexChange(1); }, 5000);
       
        }

        ///
        videoBanner();

        

    }
    //#endregion

    //#region 专题
    
    function special() {

        /* 参数举例：
        bigChange =(function () {
            var jCurBigImg = $(),
                jShow;
            return function (src,jDoms) {
                jCurBigImg.stop().fadeOut(400, function () { $(this).remove(); });

                jCurBigImg = $('<img src="' + src + '"/>').prependTo(jShow).hide().fadeIn();
            };
        })();
        */
        function pictureShow_s1(params) {
            function moveCenter(index, showNum, itemW) {
                //得到 ul 的位移
                return (~~(showNum / 2) - index) * itemW;
            }

            function show(index) {
                var selItem;

                if (index === curIndex) return;

                arrowsHandle(index);

                jSelItems.eq(curIndex).removeClass('active');
                selItem = jSelItems.eq(index).addClass('active');

                anime(index);

                change(index, { count: count, curIndex: curIndex });

                curIndex = index;
                
                validLoad.excu(function () {

                    loadImgByIndex(index);

                    bigChange(index,selItem.attr('data-bigsrc'), {});
                });
            }

            function loadImgByIndex(index) {

                var a = Math.floor(showNum / 2),
                    b,
                    jItem,
                    _showNum = showNum + ((showNum % 2 === 0) ? 1 : 0);

                if (index > count - a - 1) {
                    index = count - a-1;
                }

                if (index < a) {
                    index = a;
                }

                for (var i = 0; i < _showNum ; i++) {
                    b = index - a + i;

                    if (b >= count) break;

                    jItem = jSelItems.eq(b);

                    if (jItem.data('isFinish') === undefined) {

                        jItem.removeClass('loading');
                        jItem.data('isFinish', true);

                        selImgLoad(jItem);
                    }
                }
            }

            function anime(index) {
                var x = moveCenter(index, showNum, selItemW);
                if (x < -maxMoveLen) x = -maxMoveLen;
                if (x > 0) x = 0;
                jSelMove.animate({ marginLeft: x + leftAvertence });
            }

            function arrowsHandle(index) {
                jArrows.removeClass('disabled');
                if (index === 0) {
                    jArrows.eq(0).addClass('disabled');
                }
                if (index === count - 1) {
                    jArrows.eq(1).addClass('disabled');
                }
            }
            
            function selImgLoad(jItem) {
                var imageSize = new core.imageSize();

                imageSize.excu(jItem.attr('data-src'), function (size, img) {

                    jItem.html('<div style="height:' + selBoxH + 'px;overflow:hidden;"><img src="' + img.src + '"/></div>').children().hide().fadeIn()
                        .children().css(common.imgFullByBox_v1({ boxWidth: selBoxW, boxHeight: selBoxH, width: img.width, height: img.height }))
                });
            }

            var jBox = params.jBox,
                jSelShow = jBox.find('.p_show_sel'),
                jSelMove = jSelShow.children('ul'),
                jSelLis = jSelMove.children(),
                jSelItems = jSelLis.children(),

                jArrowChange = jBox.find('.p_arrow'),

                jArrows = jBox.find('.l_l,.l_r'),

                selBoxW =  params.selBoxW,
                selBoxH =  params.selBoxH,
                selShowW = params.selShowW === undefined ? 295 : params.selShowW,
                selItemW = params.selItemW === undefined ? 59 : params.selItemW,
                leftAvertence = params.leftAvertence === undefined ? 0 : params.leftAvertence,

                bigChange = params.bigChange === undefined ? function () { } : params.bigChange,
                change = params.change === undefined ? function () { } : params.change,

                showNum = Math.round(selShowW / selItemW),

                count = jSelItems.length,

                maxMoveLen = count * selItemW - selShowW,

                curIndex,

                validLoad = new core.validExcu(),
                imageSize = new core.imageSize();

            if (count === 0) return;

            selImgLoad = params.selImgLoad === undefined ? selImgLoad : params.selImgLoad

            jSelMove.width(count * selItemW);
                        
            jArrowChange.length && jArrowChange.click(function () {
                var index = curIndex;

                if (jArrowChange.index(this)) {
                    if (index === count - 1) {
                        common.msg('已到最后');
                        return;
                    }
                    index++;
                    
                }
                else {
                    if (index === 0) {
                        common.msg('已到最前');
                        return;
                    }
                    index--;
                    
                }
               
                show(index);
            });

            jArrows.click(function () {
                var index = curIndex;

                if (jArrows.index(this)) {
                    if (index === count-1) {
                        common.msg('已到最后');
                        return;
                    }

                    index += showNum;

                    if (index > count - 1) { index = count - 1; }
                    
                }
                else {
                    if (index === 0) {
                        common.msg('已到最前');
                        return;
                    }
                    index -= showNum;
                    if (index < 0) { index = 0; }
                    
                }

                show(index);
            });

            jSelItems.click(function () {
                show(jSelItems.index(this));
            });

            show(0);

        }

        function pictureShow(jBox) {

            function getData(succeed) {
                
                var data = {
                    status:true
                };
                //for (var i = 0; i < 17; i++) {
                //    specialData = specialData.concat(specialData[i % 3]);
                //}
                succeed(specialData);
                //setTimeout(function () {
                //    if (data.status) {
                        
                //    }
                //    else {

                //    }

                //}, 200);

                
            }
            
            function groupsHandle() {
                var jGroups = [];


            }

            function getGroup(count) {
              var  group = [];
                switch (count) {
                    case 1:
                        group = [1];
                        break;
                    case 2:
                        group = [2];
                        break;
                    case 3:
                        group = [1, 2];
                        break;
                    case 4:
                        group = [1, 3];
                        break;
                    case 5:
                        group = [2, 3];
                        break;
                    case 6:
                        group = [1,2, 3];
                        break;
                    case 7:
                        group = [2, 3, 2];
                        break;
                    case 8:
                        group = [2, 3, 3];
                        break;
                    case 9:
                        group = [5, 1, 3];
                        break;
                    case 10:
                        group = [3, 2, 5];
                        break;
                    case 11:
                        group = [3, 1, 2, 5];
                        break;
                    case 12:
                        group = [1, 2, 5, 3, 1];
                        break;
                    case 13:
                        group = [2, 2, 5, 3, 1];
                        break;
                    case 13:
                        group = [3, 2, 5, 1, 2];
                        break;
                    case 14:
                        group = [2, 5, 1, 3, 3];
                        break;
                    case 15:
                        group = [2, 5, 2, 3, 3];
                        break;
                    case 16:
                        group = [2, 1, 5, 2, 3, 3];
                        break;
                    case 17:
                        group = [2, 5, 3, 7];
                        break;
                    case 18:
                        group = [1, 2, 5, 3, 7];
                        break;
                    case 19:
                        group = [1, 7, 5, 3, 3];
                        break;
                    case 20:
                        group = [2, 7, 5, 3, 3];
                        break;
                    case 21:
                        group = [3, 7, 5, 3, 3];
                        break;
                    case 22:
                        group = [2, 3, 5, 7, 5];
                        break;
                    case 23:
                        group = [2, 3, 5, 7, 5,1];
                        break;
                    case 24:
                        group = [2, 3, 5, 7, 5, 2];
                        break;
                    case 25:
                        group = [2, 3, 5, 7, 5, 3];
                        break;
                    case 26:
                        group = [1, 2, 3, 5, 7, 5, 3];
                        break;
                }

                return group;
            }

            //指定 更新 具体 模块组合 参数
            function getPositionData(params) {
                var
                    left = 0,
                    right = 0,
                    top = 48,
                    bottom = 38,

                    minWidth = 1000,
                    minHeight = 400,

                    width = params.winW - left - right,
                    height = params.winH - top - bottom,
                    type = params.type,

                    space = 3,

                    positionData = [];

                if (width < minWidth) width = minWidth;
                if (height < minHeight) height = minHeight;

                switch (type) {

                    case 1:
                        positionData[0] = { width: width, height: height, top: 0, left: 0 };
                        break;
                    case 2:
                        positionData[0] = { width: Math.floor((width - space) / 2) };
                        positionData[0].left = 0;
                        positionData[0].height = height;
                        positionData[0].top = 0;

                        positionData[1] = clone(positionData[0]);
                        positionData[1].left = positionData[0].width + space;

                        break;
                    case 3:
                        positionData[0] = { width: Math.floor((width - space) / 2.5 * 1.5) };
                        positionData[0].left = 0;
                        positionData[0].height = height;
                        positionData[0].top = 0;

                        positionData[1] = { width: width - positionData[0].width - space };
                        positionData[1].left = positionData[0].width + space;
                        positionData[1].height = Math.floor((height - space) / 3 * 2);
                        positionData[1].top = 0;

                        positionData[2] = clone(positionData[1]);
                        positionData[2].height = height - positionData[1].height - space;
                        positionData[2].top = positionData[1].height + space;
                        break;
                    case 5:
                        positionData[0] = { width: Math.floor((width - space) / 2.5 * 1.5) };
                        positionData[0].left = 0;
                        positionData[0].height = Math.floor((height - space) / 3 * 2);
                        positionData[0].top = 0;

                        positionData[1] = { width: width - positionData[0].width - space };
                        positionData[1].left = positionData[0].width + space;
                        positionData[1].height = positionData[0].height;
                        positionData[1].top = 0;

                        positionData[2] = { width: Math.floor(positionData[0].width / 2) };
                        positionData[2].height = height - positionData[0].height - space;
                        positionData[2].left = 0;
                        positionData[2].top = positionData[0].height + space;

                        positionData[3] = clone(positionData[2]);
                        positionData[3].width = positionData[0].width - positionData[2].width - space;
                        positionData[3].left = positionData[2].width + space;

                        positionData[4] = clone(positionData[2]);
                        positionData[4].left = positionData[3].left + positionData[3].width + space;
                        positionData[4].width = positionData[1].width;

                        break;
                    case 7:
                        positionData[0] = { width: Math.floor((width - space) / 2.5 * 1.5) };
                        positionData[0].left = 0;
                        positionData[0].height = Math.floor((height - space) / 3 * 2);
                        positionData[0].top = 0;

                        positionData[1] = { width: Math.floor((positionData[0].width - space * 2) / 3) };
                        positionData[1].height = height - positionData[0].height - space;
                        positionData[1].left = 0;
                        positionData[1].top = positionData[0].height + space;

                        positionData[2] = clone(positionData[1]);
                        positionData[2].left = positionData[1].width + space;

                        positionData[3] = clone(positionData[1]);
                        positionData[3].width = positionData[0].width - (positionData[1].width + space) * 2;
                        positionData[3].left = positionData[1].width + space + positionData[2].left;

                        positionData[4] = { width: Math.floor((width - positionData[0].width - space * 2) / 2) };
                        positionData[4].height = positionData[1].height;
                        positionData[4].top = 0;
                        positionData[4].left = positionData[0].width + space;

                        positionData[5] = clone(positionData[4]);
                        positionData[5].width = width - positionData[4].left - positionData[4].width;
                        positionData[5].left = positionData[4].left + space + positionData[4].width;

                        positionData[6] = { width: width - positionData[4].left };
                        positionData[6].left = positionData[4].left;
                        positionData[6].height = height - space - positionData[4].height;
                        positionData[6].top = positionData[5].height + space;

                        break;
                }

                positionData.width=width;
                positionData.height=height;


                return positionData;
            }

            function domHandle() {

                function createHtml(data) {

                    var
                        group = getGroup(data.length),
                        jItem, jImgBoxs,
                        html, d,
                        i, j, k, len1, len2;
                    for (i = k = 0, len1 = group.length; i < len1; i++) {

                        html = '<li>';
                        for (j = 0, len2 = group[i]; j < len2; j++) {
                            d = data[k];
                            html += '<div class="imgFullShow"><a title="' + d.title + '" href="/news/special/view/id/' + d.id + '" target="_blank"><img alt="' + d.title + '" data-src="' + d.thumb + '"/></a><span><a class="a_type1" href="/news/special/view/id/' + d.id + '" target="_blank">' + d.title + '</a></span></div>';
                            k++;
                        }
                        html += '</li>';

                        jItem = $(html).appendTo(jMove);
                        jImgBoxs = jItem.children();

                        groupData.push({
                            jItem: jItem,
                            jImgBoxs: jImgBoxs,
                            jImgs: jImgBoxs.find('img'),
                            count: jImgBoxs.length
                        });
                    }
                }

                ///
                this.createHtml = createHtml;
            }

            function updatePosition(index) {

                var gd = groupData[index],
                    positionData = getPositionData({
                        winW: wJq.width(),
                        winH: wJq.height(),
                        type:gd.count
                    });

                itemW = positionData.width;
                jBox.height(positionData.height);
                jMove.css({
                        width: groupData.length * positionData.width,
                        marginLeft: -itemW * index
                    })
                    .children().css({
                        width: positionData.width,
                        height: positionData.height
                    });


                //容器更新
                gd.jImgBoxs.each(function (i) {
                    var
                        jThat=$(this),
                        jImg = gd.jImgs.eq(i),
                        pd = positionData[i],
                        src;

                    $(this).css(pd);

                    if (jImg.data('firstEnd')) {
                        jImg.css(common.imgFullByBox_v1({
                            boxWidth: pd.width,
                            boxHeight: pd.height,
                            width: jImg[0].width,
                            height: jImg[0].height, PR: 1
                        }));
                    }
                    else {
                        src = jImg.attr('data-src');
                        jThat.addClass('imgFullShow');
                        core.imgLoad(src, function (img) {
                            jThat.removeClass('imgFullShow');
                            jImg.css(common.imgFullByBox_v1({
                                boxWidth: pd.width,
                                boxHeight: pd.height,
                                width: img.width,
                                height: img.height, PR: 1
                            })).hide().fadeIn().data('firstEnd', true)[0].src = src;

                            
                        }, function () {
                            jThat.removeClass('imgFullShow');
                        });

                    }
                });

            }

            function move(index) {

                if (index < 0) {
                    index = 0;
                }
                else if (index >= groupData.length) {
                    index = groupData.length - 1;
                }

                if (curIndex === index) {
                    if (isEnd) {
                        jMove.stop();
                        if (index === 0) {
                            jCenterTip.show().html('已到最前');
                            jMove.animate({ marginLeft: 100 }, 400, 'easeOutQuint', function () {
                                jMove.animate({ marginLeft: 0 }, 400, 'easeOutQuint', function () {
                                    jCenterTip.hide();
                                });
                            });
                        }
                        else if (index === groupData.length - 1) {
                            jCenterTip.show().html('已到最后');
                            jMove.animate({ marginLeft: -itemW * index - 100 }, 400, 'easeOutQuint', function () {
                                jMove.animate({ marginLeft: -itemW * index }, 400, 'easeOutQuint', function () {
                                    jCenterTip.hide();
                                });
                            });
                        }
                    }
                    validLoad.excu(function () { isEnd = true; }, 400);
                }
                else {
                    isEnd = false;
                    jMove.stop().animate({ marginLeft: -itemW * index }, 600, 'easeOutQuint', function () {
                        updatePosition(index);
                    });

                    jCenterTip.hide();
                }

                curIndex = index;

                
            }

            //箭头+滚轮
            function arrowHandle() {
                var jArrows = $('<a class="p_arrows l" href="javascript:;"></a><a class="p_arrows" href="javascript:;"></a>').appendTo(jBox);

                jCenterTip = $('<div class="p_c_t"></div>').insertAfter(jArrows.eq(1));

                jArrows.click(function () {

                    var index = curIndex;
                    if (jArrows.index(this)) {
                        index++;
                    }
                    else {
                        index--;
                    }

                    move(index);
                });

                core.mouseWheel(jBox[0], function (e) {
                    var pre = false, index = curIndex;
                    if (e.wheelDelta) {//前120 ，后-120
                        if (e.wheelDelta > 0) pre = true;
                    }
                    else {//firefox
                        if (e.detail < 0) pre = true;
                    }
                    
                    if (pre) {
                        //*往上滚
                        index--;
                        
                    } else {
                        //*往下滚
                        
                        index++;

                    }
                    
                    move(index);

                    //阻止滚动条滚动
                    if (e.cancelable) e.preventDefault();
                    return false;
                });
            }

            function winResize() {
                validLoad.excu(function () { updatePosition(curIndex); }, 400);
            }

            function clone(obj) {
                var o = {};
                for (var key in obj) {
                    o[key] = obj[key];
                }
                return o;
            }

            ///
            var
                groupData=[],
                curIndex = 0,
                jMove = $('<ul></ul>').appendTo(jBox),
                jCenterTip,
                domHandle = new domHandle(),
                itemW,
                isEnd = true,
                validLoad = new core.validExcu();

            getData(function (data) {
                domHandle.createHtml(data);
                updatePosition(0);

                if (groupData.length > 1) arrowHandle();
            });

            wJq.resize(winResize);
        }

        function index() {
            function banner() {

                var jBox = $('.banner_show'),
                    w = jBox.width(),
                    h = jBox.height();

                common.banner({
                    jBox: jBox,
                    jItems: jBox.find('li'),
                    itemW: w,
                    itemH: h
                });
            }

            function flicker(jDom) {
                var loopTry,
                    color,
                    i=0;

                if (jDom.data('_flicker')) {
                    jDom.data('_flicker').stop();
                    loopTry = jDom.data('_flicker');
                    color = jDom.data('_flicker_color');
                }
                else {
                    loopTry = new core.loopTry_v2();
                    color = jDom.css('background-color');
                    jDom.css('transition','0.2s ease');
                    jDom.data('_flicker', loopTry);
                    jDom.data('_flicker_color', color);
                }

                function to() {
                    jDom.css('background-color', '#FAFF83');
                    setTimeout(function () {
                        jDom.css('background-color', color);
                    }, 200);

                }

                to();
                loopTry.excu(function () {
                    if (i > 1) return;

                    to();

                    i++;
                }, 400);
                
            }

            function imgShow() {
                function bigHandle() {
                    var jCurBig = $(),
                        imageSize = new core.imageSize(),
                        sizeData = [],
                        boxW = 335,
                        boxH = 265,
                        delayExcu = new core.delayExcu();;

                    this.change = function (index, src, jDoms) {
                        var size = sizeData[index],
                            jBox;


                        if (size) {

                            jCurBig.stop().fadeOut(400, function () { $(this).remove(); });

                            jBox = $('<div style="width:100%;height:100%;overflow:hidden;position:absolute;top:0;left:0;"><img src="' + src + '"/></div>'),

                            jCurBig = jBox.prependTo(jShow).hide().fadeIn();

                            common.imgFullShowSlide({
                                jBox: jBox,
                                jImg: jBox.children(),
                                imgW: size.width,
                                imgH: size.height,
                                boxW: boxW,
                                boxH: boxH
                            });

                        }
                        else {
                            imageSize.stop();

                            jCurBig.stop().fadeOut(400, function () { $(this).remove(); });
                                                        
                            delayExcu.excu(function () { jShow.addClass('loading'); });
                            imageSize.excu(src, function (size, img) {
                                if (delayExcu.clear()) jShow.removeClass('loading');

                                var jImg = $(img);

                                jBox = $('<div style="width:100%;height:100%;overflow:hidden;position:absolute;top:0;left:0;"></div>');

                                jCurBig = jBox.append(jImg).prependTo(jShow).hide().fadeIn();

                                common.imgFullShowSlide({
                                    jBox: jBox,
                                    jImg: jImg,
                                    imgW: size.width,
                                    imgH: size.height,
                                    boxW: boxW,
                                    boxH: boxH
                                });

                                sizeData[index] = size;
                            });

                            
                        }
                    };
                }

                ///
                var
                    jBox = $('.picture_show'),
                    jShow = jBox.children('.p_show'),
                    bigHandle = new bigHandle();

                pictureShow_s1({
                    jBox: $('.picture_show'),
                    bigChange: bigHandle.change,
                    selBoxW: 51,
                    selBoxH: 50
                });


            }

            function comment() {

                

                function getHtml(params) {


                   return '<li>'
                           + '            <div class="com_photo fl">'
                           + '                <img src="' + params.gravatar + '" alt="">'
                           + '            </div>'
                           + '            <div class="com_txt">'
                           + '                <div class="p_mess">'
                           + '                    <span>' + params.name + '</span>'
                           + '                    &nbsp;&nbsp;&nbsp;&nbsp;'
                           + '            <span>' + params.dateline + '</span>'
                           + '        </div>'
                           + '        <div class="c_mess">' + params.content + '</div>'
                           + '    </div>'
                           + '</li>';
                }

                function toComment() {
                    var loading = false;
                    function to() {

                        var p = {
                            member_id: CONFIG.member.uid,
                            type: 'S',
                            name:CONFIG.member.username
                        };


                        //是否请求中
                        if (loading) return false;

                        //构建参数
                        p.content = $.trim(jIn.val());
                        p.relation_id = CONFIG.special_id;

                        //验证
                        if (p.content === '') {
                            jIn.focus();
                            common.msg({ text: '不能为空' });
                            return false;
                        }

                        jTo.addClass('loading');
                        $.post(url.create, p, function (d) {
                            jTo.removeClass('loading');
                            if (d.status) {
                                if (d.comment_switch === 'Y') {
                                    //动态增加
                                    domUpdate({
                                        id: d.data.id,
                                        comment_id: d.data.comment_id,
                                        name: CONFIG.member.username,
                                        member_id: CONFIG.member.uid,
                                        gravatar: CONFIG.member.member.gravatar,
                                        content: p.content,
                                        dateline: '刚刚'
                                    });
                                    
                                }
                                else {
                                    d.msg += '!等待审核';
                                }

                                common.msg(d);

                                jIn.val('');
                            }
                            else {
                                common.msg({ text: d.msg });
                            }
                        }, 'json');
                    }

                    function domUpdate(params) {
                        $('#noComment').remove();

                        var jItems = jCommentCon.children();

                        flicker($(getHtml(params)).prependTo(jCommentCon));
                        jItems.eq(1).remove();
                    }

                    ///
                    jTo.click(function () {
                        to();
                    });

                }

                function commentDomIni() {
                    jCommentBox.addClass('loading');
                    $.post(url.view + '/type/S/relation_id/' + CONFIG.special_id + '/pageSize/2?page=1', function (d) {
                        var html = '';
                        jCommentBox.removeClass('loading');
                        if (d.status) {
                            for (var i = 0; i < d.data.length; i++) {
                                html +=getHtml(d.data[i]);
                            }
                            jCommentCon.prepend(html).children().eq(1).addClass('last');
                        }
                        else {
                            jCommentCon.html('<span id="noComment">暂无评论</span>');
                        }
                    }, 'json');
                }
                
                var jBox = $('.comment'),
                    jInBox = jBox.find('.post_mess'),
                    jInHint = jBox.find('.warn'),
                    jIn = jBox.find('textarea'),
                    jTo = jBox.find('.button'),
                    jCommentBox = jBox.find('.comment_con'),
                    jCommentCon = jCommentBox.children('.com_list').children(),
                    jIniLoad = jCommentBox.find('.c_loading'),
                    url={
                        view: '/comment/default/view',
                        create: '/comment/default/create'
                    },
                    
                    isRegister=true;

                

                if (isRegister === false && CONFIG.member === undefined) {
                    CONFIG.member = {
                        username: '',
                        uid: '',
                        member: {
                            gravatar: ''
                        }
                    };
                }

                if (isRegister === false || CONFIG.member) {
                    jInBox.click(function () {
                        jInHint.hide();
                    });

                    jIn.blur(function () {
                        if ($.trim(jIn.val()).length === 0) jInHint.show();
                    });
                    toComment();
                }

                

                commentDomIni();
            }

            ///
            banner();
            imgShow();

            //comment();

            //分享
            common.share();

        }

        function imageView(jBox) {

            function bigHandle() {
                var jCurBig = $(),
                    imageSize = new core.imageSize(),
                    sizeData = [],
                    delayExcu = new core.delayExcu(),
                        multiple;

                this.change = function (index, src, jDoms) {
                    var size = sizeData[index],
                        imgCss;
                    if (sizeData.length > 0) wJq.scrollRun(topHeight);
                    if (size) {

                        jCurBig.stop().fadeOut(400, function () { $(this).remove(); });

                        //是否加载放大
                        multiple = size.width / boxW;

                        imgCss = common.imgCenterByBox_v1({
                            boxWidth: boxW,
                            boxHeight: multiple > 1 ? boxW / (size.width / size.height) : size.height,
                            width: size.width,
                            height: size.height
                        });

                        jCurBig = $('<img src="' + src + '"/>').prependTo(jShow).hide().fadeIn().css(imgCss);

                        jShow.animate({ height: imgCss.height });
                        jArrows.height(imgCss.height);

                        arrowHandle.update(imgCss.height);

                        if (multiple > 1) {
                            zoomLoad(true, {
                                src: src,
                                multiple: multiple,
                                boxW: imgCss.width,
                                boxH: imgCss.height
                            });
                        }
                        else {
                            zoomLoad(false);
                        }
                    }
                    else {
                        imageSize.stop();

                        jCurBig.stop().fadeOut(400, function () { $(this).remove(); });

                        delayExcu.excu(function () { jShow.addClass('loading'); });

                        imageSize.excu(src, function (size, img) {
                            delayExcu.clear();
                            
                            jShow.removeClass('loading');

                            if (size.height <= 0) size.height = 300;

                            //加载放大
                            multiple = size.width / boxW;

                            imgCss = common.imgCenterByBox_v1({
                                boxWidth: boxW,
                                boxHeight: multiple > 1 ? boxW / (size.width / size.height) : size.height,
                                width: size.width,
                                height: size.height
                            });

                            jCurBig = $(img).prependTo(jShow).hide().fadeIn().css(imgCss);

                            jShow.animate({ height: imgCss.height });

                            jArrows.height(imgCss.height);
                            console.log(imgCss.height+":=====");
                            sizeData[index] = size;

                            arrowHandle.update(imgCss.height);

                            if (multiple > 1) {

                                zoomLoad(true, {
                                    src: src,
                                    multiple: multiple,
                                    boxW: imgCss.width,
                                    boxH: imgCss.height
                                });
                            }
                            else {
                                zoomLoad(false);
                            }

                        });




                    }
                };
            }
            
            if (jBox.length === 0) return;

            var jShow = jBox.children('.p_show'),
                jPageBox = jBox.find('.page_box'),
                jTxt = jBox.find('.descri'),
                jTxtItems = jTxt.children(),
                jArrows = jBox.children('.p_arrow'),
                topHeight = jBox.offset().top - $('#header .header_fixed').height(),

                boxW = jBox.width(),

                bigHandle = new bigHandle(),
                arrowHandle = new common.arrowCenter({ jArrows: jArrows.children('i'), boxTop: jBox.offset().top }),
                zoomLoad = common.zoomHandle(jShow);

            pictureShow_s1({
                jBox: jBox,
                selShowW: boxW-62,
                selItemW: 117,
                selBoxW: 100,
                selBoxH: 80,
                bigChange: bigHandle.change,
                change: function (index, otherData) {
                    jTxtItems.eq(otherData.curIndex).hide();
                    jTxtItems.eq(index).show();
                    jPageBox.html('<span class="curr">' + (index + 1) + '</span>/<span class="total_page">' + otherData.count + '</span>');
                }
            });

            //分享
            common.share();
        }

        function list() {

        }

        function index_v2() {

        }
        
        function bottomRollShow() {
            
            var isIni = false,
                fnHandle,
                curST=0;

            function getHtml() {
                return '<div class="bottom_roll_show loading">\
        <div class="tit">过往专题</div>\
        <div class="sw"><ul></ul><div class="sb"><b></b></div></div>\
        <a class="close" href="javascript:;"></a>\
    </div>';

            }

            function fnIni(jBox) {

                var
                    jShow = jBox.children('.sw'),
                    jClose = jBox.children('.close'),
                    jMove = jShow.children('ul'),

                    jBarBox = jShow.children('.sb'),
                    jBar = jBarBox.children(),

                    itemW = 232,

                    jItems,
                    count,
                    moveW,

                    showW,
                    sb,
                    validLoad = new core.validExcu(),
                    showData = {},

                    loadItems = new LoadItems({
                        count: count,
                        callBack: function (i) {
                            ////var jItem = jItems.eq(i),
                            ////    jImg = jItem.find('img');

                            jItems.eq(i).children('.i_b').imgFullShow(false);
                        }
                    }),

                    isShow = false;

                /*
                依次回调当前显示索引
                实现 见到才加载
                */
                function loadIndex(params) {
                    var
                        x = params.x,//当前隐藏距离。也就是move的x坐标
                        itemW = params.itemW,
                        showW = params.showW,
                        callBack = params.callBack,

                        showCount,
                        showIndex;

                    //显示总数
                    showCount = Math.ceil(showW / itemW);

                    //显示容器第一个 的索引
                    showIndex = Math.floor(Math.abs(x) / itemW);

                    for (var i = 0; i < showCount; i++) {
                        if (callBack(i + showIndex) === false) break;
                    }
                }

                /*
                保护加载，提高效率加载
                每项只加载一次，重复索引将不加载
                索引超过保护
                全部加载完后状态 改变
                */
                function LoadItems(params) {
                    var
                        that = this,

                        count = params.count,
                        callBack = params.callBack,

                        isFinish = false,

                        loadedNum = 0,

                        loadData = {};

                    function load(i) {
                        if (i >= count) return false;

                        if (loadData[i] === undefined) {

                            loadData[i] = true;

                            loadedNum++;

                            callBack(i);

                            if (loadedNum === count) {
                                isFinish = true;
                            }
                        }
                    }

                    function getStatus() {
                        return isFinish;
                    }

                    this.load = load;
                    this.getStatus = getStatus;
                }

                function sizeUpdate() {
                    showW = winWH.width - 40;

                    sb.update({
                        boxS: showW,
                        conS: moveW,
                        barBoxS: showW
                    });
                }

                function show() {
                    if (isShow === false) {
                        isShow = true;
                        jBox.animate({ bottom: 0 }, { queue: false });
                    }

                }

                function hide() {
                    if (isShow === true) {
                        isShow = false;
                        jBox.animate({ bottom: -230 }, { queue: false });
                    }
                }

                function dataIni() {

                    $.post('/news/special/listspecial', function (d) {
                        var html;
                        jBox.removeClass('loading');
                        if (d instanceof Array) {
                            html = ''
                            $.each(d, function (i, n) {

                                html += '<li><div class="i_b imgFullShow"><a href="/news/special/view/id/' + n.id + '" title="' + n.title + '"><img alt="' + n.title + '" data-src="' + common.getThumb(n.thumb, 350) + '" alt=""></a></div>\
<div class="des"><a href="/news/special/view/id/' + n.id + '" title="' + n.title + '">' + n.title + '</div></a></li>';
                            });
                            jMove.html(html);

                            ///变量初始
                            jItems = jMove.children();
                            count = jItems.length;
                            moveW = count * itemW;

                            //
                            jMove.width(moveW);
                            sb = new common.scrollBar({
                                jBox: jBox,
                                jCon: jMove,
                                jBarBox: jBarBox,
                                jBar: jBar,
                                type: 'left'
                            });

                            sizeUpdate();

                            wJq.resize(function () {
                                sizeUpdate();
                            });

                            sb.change = function (conX) {

                                if (loadItems.getStatus() === true) return;

                                validLoad.excu(function () {
                                    loadIndex({
                                        x: conX,
                                        itemW: itemW,
                                        showW: showW,
                                        callBack: function (i) {
                                            return loadItems.load(i);
                                        }
                                    });
                                }, 200);
                            };

                            sb.change(0);
                        }
                    }, 'json');
                }

                jClose.click(hide);

                dataIni();

                this.show = show;
                this.hide = hide;
            }

            function bottomShow() {
                var st = wJq.scrollTop();

                if (isIni === false) {
                    isIni = true;

                    fnHandle = new fnIni($(getHtml()).appendTo(bJq));
                }

                if (st < curST) {
                    fnHandle.hide();
                }
                else if (winWH.height + st >= bJq.height() - 200) {
                    fnHandle.show();
                }

                curST = st;
            }

            function ini() {

                wJq.scroll(bottomShow);

                bottomShow();
            }

            ini();
        }

        var bannerFn = {
            leftRightSwitch: function (index,isRight,count) {
                if (isRight) {
                    index++;

                    if (index >= count) index = 0;

                }
                else {
                    index--;
                    if (index < 0) index = count - 1;
                }

                return index;
            }
        };

        //通用版主页
        function indexV201408() {
            var jIndexBox = $('#specialIndex201408');

            if (jIndexBox.length === 0) return;

            function loopChange(params) {
                var
                    jMove=params.jMove,
                    isRight = params.isRight,
                    curLeft = params.curLeft,
                    itemW = params.itemW,
                    count = params.count,
                    callBack = params.callBack,
                        
                        _jItem,
                        _jChils,
                        _cCount;


                if (isRight) {
                    
                    if (curLeft === -itemW) jMove.css('left', 0).children().eq(0).appendTo(jMove);

                    jMove.animate({
                        left: -itemW
                    }, 600);

                    curLeft = -itemW;
                }
                else {

                    if (curLeft === 0) jMove.css('left', -itemW).children().eq(count - 1).prependTo(jMove);

                    jMove.animate({
                        left: 0
                    }, 600);

                    curLeft = 0;
                }

                if (curLeft === 0) {
                    _jItem = jMove.children().eq(0);

                }
                else {
                    _jItem = jMove.children().eq(1);
                }

                _jChils=_jItem.children();

                _cCount = _jChils.length;
                _jChils.each(function (i) {
                    var jThat = $(this);
                    jThat.css({
                        position: 'relative',
                        left: isRight ? 500 : -500
                    });
                    setTimeout(function () {
                        jThat.animate({ left: 0 }, 600, 'easeOutCubic', function () {
                            if (isRight) {
                                if (i === _cCount - 1) callBack();
                            }
                            else {
                                if (i === 0) callBack();
                            }
                        });
                    }, (isRight ? (i+1) : (_cCount - i)) * 100);

                });

                return { curLeft: curLeft, jItem: _jItem };
            }

            function LoadImg(jItems) {
                var
                    data = {};

                jItems.each(function (i) {
                    $(this).data('index', i);
                });

                this.load = function (jItem) {
                    var index = jItem.data('index');
                    if (data[index] === undefined) {

                        jItem.find('.imgLoading').removeClass('imgLoading').find('img').each(function () {
                            this.src = $(this).attr('data-src');
                        });
                        
                        data[index] = 1;
                    }
                };
            }

            //左上 切换
            function leftTopBanner() {
                var jBox = $('#leftTopBanner'),
                    jShow = jBox.children('.sw'),
                    jMove = jShow.children('ul'),
                    jItems = jMove.children(),
                    jImgs = jItems.find('img'),
                    jBtnBox = jBox.children('.btn').children(),
                    jArrows = jShow.children('.arrow'),
                    jBtns,

                    count = jItems.length,
                    itemW = 356,

                    curIndex = 0,

                    jDoms = {},
                        
                    loadingData = {0:1};

                function anime(index) {
                    var jCurItem = jItems.eq(curIndex).fadeIn(),

                        jChils;

                    jItems.eq(index).fadeOut();

                    if (jDoms[curIndex] === undefined) {
                        jChils = jCurItem.find('.txt').children();
                        jDoms[curIndex] = {
                            jTit: jChils.eq(0).css({ position: 'relative' }),
                            jName: jChils.eq(1).css({ position: 'relative' })
                        };
                    }

                    jDoms[curIndex].jTit.css('top', 150).animate({ top: 0 });
                    jDoms[curIndex].jName.css('top', 100).animate({ top: 0 });
                    
                }

                function imgLoading() {
                    if (loadingData[curIndex] === undefined) {
                        var jImg = jImgs.eq(curIndex);

                        jImg[0].src = jImg.attr('data-src');

                        loadingData[curIndex] = 1;
                    }
                }

                function btnIni() {
                    var html = '';
                    for (var i = 0; i < count; i++) {
                        html += '<li data-index="'+i+'"></li>';
                    }
                    jBtnBox.html(html);

                    jBtns = jBtnBox.children();

                    jBtns.on({
                        mouseenter: btnEvent,
                        click: btnEvent
                    }).eq(curIndex).addClass('active');

                    function btnEvent() {
                        var index = curIndex;

                        if (this === jBtns[index]) return;

                        curIndex = $(this).attr('data-index');

                        change(index);
                    }
                }

                function change(index) {
                    jBtns.eq(index).removeClass('active');
                    jBtns.eq(curIndex).addClass('active');

                    anime(index);

                    imgLoading();
                }

                function arrowEvent(isRight) {
                    var index = curIndex;
                    curIndex = bannerFn.leftRightSwitch(index, isRight, count);

                    change(index);
                }

                function arrowHandle() {

                    jArrows.click(function () {
                        arrowEvent(jArrows.index(this));
                    });

                    jBox.hover(function () {
                        jArrows.eq(0).animate({ left: 0 });
                        jArrows.eq(1).animate({ right: 0 });
                    }, function () {
                        jArrows.eq(0).animate({ left: -34 });
                        jArrows.eq(1).animate({ right: -34 });
                    });
                }
                

                ///
                if (count <= 1) return;

                jMove.width(itemW * count).css({
                    position: 'relative'
                });
                                
                btnIni();
                arrowHandle();

            }

            //右上 切换
            function rightTopBanner() {
                var jBox = $('#rightTopBanner'),
                    jShow = jBox,
                    jMove = jShow.children('ul'),
                    jItems = jMove.children(),
                    jArrows = jBox.children('.arrow'),

                    count = jItems.length,
                    itemW = 585,

                    curLeft = 0,
                    isAnime = false,
                    loadImg;

                function arrowEvent(isRight) {
                    var d = loopChange({
                        jMove: jMove,
                        isRight: isRight,
                        curLeft: curLeft,
                        itemW: itemW,
                        count: count,
                        callBack: function () {
                            isAnime = false;
                        }
                    });

                    curLeft = d.curLeft;

                    loadImg.load(d.jItem);
                }

                ///
                if (count <= 1) return;

                loadImg = new LoadImg(jItems);

                jMove.width(itemW * count).css({
                    position: 'relative'
                });

                jArrows.click(function () {
                    if (isAnime) return;
                    isAnime = true;

                    arrowEvent(jArrows.index(this));


                }).show();

                jItems.each(function (i) {
                    $(this).data('index', i);
                });

                loadImg.load(jItems.eq(0));

            }

            //中间
            function midBanner(jBox) {
                var 
                    jShow = jBox.children('.sw'),
                    jMove = jShow.children('ul'),
                    jItems = jMove.children(),
                    jArrows = jBox.children('.arrow'),

                    count = jItems.length,
                    itemW = 1024,
                        
                    curLeft=0,
                    isAnime = false,

                    loadImg;

                function arrowEvent(isRight) {

                     var d = loopChange({
                        jMove: jMove,
                        isRight: isRight,
                        curLeft: curLeft,
                        itemW: itemW,
                        count: count,
                        callBack: function () {
                            isAnime = false;
                        }
                     });

                     curLeft = d.curLeft;

                     loadImg.load(d.jItem);
                }

                if (count <= 1) return;

                loadImg = new LoadImg(jItems);

                function btnUpdateX() {
                    var
                        btnW = 66,
                        x = btnW;
                    if (winWH.width < itemW + btnW * 2) {
                        x = (winWH.width - itemW) / 2;

                        if (x < 20) x = 20;
                    }
                    jArrows.eq(0).css('left', -x);
                    jArrows.eq(1).css('right', -x);
                }

                jMove.width(itemW * count).css({
                    position: 'relative'
                });

                jArrows.click(function () {
                    if (isAnime) return;
                    isAnime = true;

                    arrowEvent(jArrows.index(this));

                }).show();

                jBox.hover(function () {
                    jArrows.stop().animate({opacity:1,width:66},{queue:false});
                }, function () {
                    jArrows.animate({ opacity: 0, width: 0 }, 1000);
                });

                wJq.resize(btnUpdateX);

                btnUpdateX();

                loadImg.load(jItems.eq(0));
            }

            //中间两个 执行
            function midBannerIni() {
                var jBox1 = $('#midBanner1'),
                    jBox2 = $('#midBanner2');
                common.rollExcu({
                    jElem: jBox1,
                    callBack: function () {
                        midBanner(jBox1);
                    }
                });
                common.rollExcu({
                    jElem: jBox2,
                    callBack: function () {
                        midBanner(jBox2);
                    }
                });
            }

            //底部
            function bannerShowStack() {

                var jBox = $('#bannerShowStack'),
                    jConBox = jBox.children('ul'),
                    jItems = jConBox.children(),
                    jArrows = jBox.children('a'),
                    count = jItems.length,
                    cssParams,
                    curIndex = 0,
                    centerIndex = Math.floor(count / 2),
                    animing = false;

                cssParams = xyGenerate({
                    width: 360,
                    height: 540,
                    zoom: 0.8,
                    spaceX: -120,
                    spaceTop: 54,
                    w: 1024,
                    h: 540,
                    num: count,
                    centerId: centerIndex
                });

                function xyGenerate(param) {

                    var
                        //中心索引
                        centerId = param.centerId,

                        w = param.w,
                        h = param.h,
                        width = param.width,
                        height = param.height,

                        spaceX = param.spaceX,
                        spaceTop = param.spaceTop,
                        num = param.num,
                        zoom = param.zoom,

                        rotateY = 40,


                        data = [],

                        centre_xy = [w / 2, h / 2];


                    var centre_xy = [w / 2, h / 2];

                    data[centerId] = [centre_xy[0] - width / 2, centre_xy[1] - height / 2, width, height, centerId *2+2, 0, 0];

                    var i, _d, _x, _y, _w, _h, _o;
                    //左半
                    for (i = centerId; i--;) {
                        _d = data[i + 1];
                        _w = _d[2] * zoom;
                        _h = _d[3] * zoom;
                        _o = 0.8;
                        data[i] = [_d[0] - _w - spaceX, _d[1] + spaceTop, _w, _h, i + 2, _o, rotateY];
                    }
                    //右半
                    for (i = centerId + 1; i < num; i++) {
                        _d = data[i - 1];
                        _w = _d[2] * zoom;
                        _h = _d[3] * zoom;
                        _o = 0.8;
                        data[i] = [_d[0] + _d[2] + spaceX, _d[1] + spaceTop, _w, _h, centerId * 2 - i + 3, _o, -rotateY];
                    }

                    return data;
                }

                function anime(isAnime, isPrev) {
                    $.each(cssParams, function (i, n) {

                        var
                            jItem,
                            animeCss,
                            oCss,
                            v = (i + curIndex - centerIndex) % count;

                        if (v < 0) v = count + v;

                        jItem = jItems.eq(v);

                        jItem.data('dataIndex', i);

                        if (isAnime) {
                            oCss = { zIndex: n[4] };
                            animeCss = { left: n[0], top: n[1], width: n[2], height: n[3] };

                            
                            if (i === centerIndex) {
                                jItem.css({ zIndex: n[4]+1 });

                            }
                            
                            else if (isPrev) {
                                if (i < centerIndex) {
                                    jItem.css({
                                        zIndex: oCss.zIndex - 1
                                    });
                                }
                                else {
                                    jItem.css({
                                        zIndex: oCss.zIndex + 1
                                    });
                                }
                            }
                            else {
                                if (i < centerIndex) {
                                    jItem.css({
                                        zIndex: oCss.zIndex + 1
                                    });
                                }
                                else {
                                    jItem.css({
                                        zIndex: oCss.zIndex - 1
                                    });
                                }
                            }


                        //else{
                        //        setTimeout(function () {
                        //            jItem.css(oCss);
                        //        },600);
                        //}
                            

                            jItem.animate(animeCss, 800, 'easeOutQuart',function () {
                                jItem.css(oCss);
                                animing = false;
                            });

                        }
                        else {
                            oCss = { left: n[0], top: n[1], width: n[2], height: n[3], zIndex: n[4] };
                            jItem.css(oCss);
                            animing = false;
                        }

                        if (!core.isIE) {

                            jItem.children().css({
                                transform: 'rotateY(' + n[6] + 'deg)'
                            });
                        }

                    });
                }

                function arrowEvent(isRight) {

                    var index = curIndex,
                        isPrev;

                    if (isRight) {
                        index++;

                        if (index >= count) index = 0;
                        isPrev = false;
                    }
                    else {
                        index--;
                        if (index < 0) index = count - 1;
                        isPrev = true;
                    }
                    curIndex = index;

                    anime(true, isPrev);
                }

                ///
                jItems.each(function (i) {
                    var jThat = $(this);
                    jThat.click(function () {
                        if (animing === true) return;

                        animing = true;


                        if (i === curIndex) return;

                        curIndex = i;

                        anime(true, jThat.data('dataIndex') < centerIndex);
                    });
                });

                jArrows.click(function () {
                    if (animing === true) return;

                    animing = true;

                    arrowEvent(jArrows.index(this))

                });

                anime();

                common.rollExcu({
                    jElem: jBox,
                    callBack: function () {
                        jItems.each(function () {
                            var jImg = $(this).find('img');
                            jImg[0].src = jImg.attr('data-src');
                        });
                    }
                });

            }

            ///
            leftTopBanner();
            rightTopBanner();
            midBannerIni();
            bannerShowStack();
        }

        switch (window.pageType) {
            case 'special_index_v1':
                //一般 主页
                index();
                
                break;

            default:


        }

        //列表 主页
        if (core.determinePage('special', 1)) pictureShow($('.picture_show'));
        else bottomRollShow();

        //图集
        common.rollExcu({
            jElem: $('#imageView'),
            callBack: function (jBox) {

                imageView(jBox);

            }
        });

        
        //列表主页
        if (core.determinePage('news/special/list')) {
            list();
        }

        //通用版
        indexV201408();
    }

    //#endregion

    //#region 公共

    function other() {

        function sideFollow() {

            var jBox = $('#side_follow');

            if (!jBox.length) return;

            function follow() {

                var anime = new common.changeAnime_v2(function (v) {
                    jBox.css('top', v);
                });

                function refresh() {
                    
                    var v = wJq.scrollTop() + 20;

                    var tv = wJq.height() / 2 + v - 100;

                    if (tv < v) tv = v;

                    anime.start(tv);
                }

                wJq.scroll(refresh);
                wJq.resize(refresh);
                refresh();
            }

            function sfHandle() {
                var chils = jBox.children();

                chils.hover(function () {
                    var w, h = 38, curr = $(this);

                    switch (chils.index(curr)) {
                        case 0:
                            w = 328;
                            //h = 219;
                            curr = curr.children();
                            break;
                        case 1:
                            w = 170;
                            break;
                        case 2:
                            w = 210;
                            break;
                        case 3:
                            w = 130;
                            break;
                        case 4:
                            w = 160;
                            h = 198;
                            break;
                        case 5:
                            return;
                            break;
                    }

                    curr.stop().animate({ width: w, height: h });
                }, function () {
                    var w, h = 38, curr = $(this);

                    switch (chils.index(this)) {
                        case 1: case 2: case 3:
                            w = 36;
                            break;
                        case 4:
                            w = 36;
                            h = 38;
                            break;
                        case 0:
                            w = 36;
                            h = 38;
                            curr = curr.children();
                            break;
                        case 5:
                            return;
                            break;
                    }
                    curr.stop().animate({ width: w, height: h });

                    //
                    if (!chils.index(this)) {
                        $(this).find('textarea').stop().animate({ left: 31, top: -40, width: 255, height: 15 });
                    }
                });

                //“还没想好” 按钮
                jBox.find('.sf_suggest .sfsc_bott a').click(function () {
                    chils.first().mouseleave();
                });

                (function () {
                    function textHandle() {
                        jBox.find('.sf_suggest .sfs_show').stop().animate({ height: 219 });
                        $(this).stop().animate({ left: 0, top: 0, width: 294, height: 111 });
                    }

                    jBox.find('.sf_suggest .sfs_con textarea').focus(textHandle).click(textHandle);

                }());



                //回顶部 效果
                (function () {
                    var go_top_dom = chils.eq(5);

                    wJq.scroll(function () {

                        if (wJq.scrollTop() > 500) {

                            go_top_dom.css({
                                height: 36,
                                top: -36
                            });
                        }
                        else {
                            go_top_dom.css({
                                height: 0,
                                top: 0
                            });
                        }
                    });

                    chils.eq(5).click(function () {
                        wJq.scrollRun(0);
                    });

                }());
            }

            //反馈建议
            function goAdvice() {
                var reg_nonull = /^\s+$/ig;

                var content = $("#advice").val();


                if (content == "" || reg_nonull.test(content)) {

                    alert("请填写内容再提交");

                    return false;
                }

                $.ajax({
                    url: 'http://news.newshiqi.com/advice.php',
                    type: 'post',
                    data: { content: content },
                    datatype: 'json',
                    success: function (data) {
                        $("#advice").val('');
                        if (data.flag) {
                            alert("成功");
                        }
                        else {
                            alert("提交成功");
                        }

                    }

                });

            }

          
            ///
            follow();
            sfHandle();
            window.goAdvice = goAdvice;
        }

        function search() {
            var li = $('.h_search li');
            li.click(function () {
                var v = 1;
                li.removeClass('active');
                $(this).addClass('active');
                switch (li.index(this)) {
                    case 1:
                        v = 'exhibition';
                        break;
                    case 2:
                        v = 'news_video';
                        break;
                }

                $('#type').val(v);

            }).mousedown(function () { return false; });

            var type = location.href.match(/type=([^&]*)/);
            if (type) {
                li.removeClass('active');
                switch (type[1]) {
                    case '1':
                        li.eq(0).addClass('active');
                        break;
                    case 'exhibition':
                        li.eq(1).addClass('active');
                        break;
                    case 'news_video':
                        li.eq(2).addClass('active');
                        break;
                }
            }
        }

        function rightBanner() {
            var jBoxs = $('.c_right .banner_show');
            jBoxs.each(function () {

                var
                    jBox = $(this),
                    jMove = jBox.children('.b_list'),
                    jItems = jMove.children();

                core.imageSizeExcu(jItems.eq(0).attr('data-src'), function (d) {
                    jBox.height(d.h);
                    common.banner({
                        jBox: jBox,
                        jMove: jMove,
                        jItem: jItems
                    });
                });


            });
        }

        

        ///
        //sideFollow();
        //search();

        //右侧 移入移出
        $('#content .cc_hotnews .cch_con,.list_effect').each(function () {

            $(this).children().mouseenter(function () {
                var jLi = $(this),
                    jBox,
                    jImg,
                    src;

                $(this).parent().children('.cch_show,.le_item').removeClass('cch_show').removeClass('open');

                $(this).addClass('cch_show').addClass('open');

                if (jLi.data('finish') === undefined) {
                    jLi.data('finish', true);
                    jBox = jLi.children('i');
                    jImg = jBox.find('img');
                    src = jImg.attr('data-src');
                    common.imgFullShowExcu({
                        src: src,
                        imgJq: jImg,
                        boxW: 105,
                        boxH: 70,
                        config: 'imgFullByBox',
                        finishFunc: function () { jBox.removeClass('loading'); }
                    });
                }

            }).first().mouseenter();

        });

        //翻页
        if (core.determinePage('news/search/index')) {

            common.pager.callCommon_v2($('.page2'), location.href.replace(/[?&]page=[^&]*/, ''), '&page=');
        }
        else {
            var jPage = $('.page2');
            if (jPage.length) common.pager.callCommon_v2(jPage.css('padding-top', 20), location.href.replace(/\/page\/[\d]+/, ''), '/page/');
        }

        rightBanner();
       
    }

    //#endregion
    
    $(function () {
        
        //主页情况
        if (core.determinePage('news',1)) index();

        if (core.determinePage('category/list') || core.determinePage('exhibition/list')) {
            list();
        }

        if (core.determinePage('video/list')) video();

        
        if (core.determinePage('special')) special();

        other();

        if (core.determinePage('news/special/show/id') ||
            core.determinePage('news/article/view/id') ||
            core.determinePage('news/exhibition/view/id')) common.share();


        if ($('#boShengSaidJade').length) {

            $(".b_tip").click(function () {
                alert("近期发布，敬请期待！")
            });
            common.share();
        }

        ///新
        switch ($('#pageScript').attr('data-pageId')) {
            case 'specialJadeCulturalTour':
                common.share();
                break;

            default:
        }

        //华夏玉文化大讲堂专题 banner
        (function () {
            var jBox = $('#bannerShowJca');
            if (jBox.length) {
                common.banner_v3({
                    jBox: jBox,
                    animeType: 'move',
                    arrow: 1,
                    //listBtn: 1,
                    time: 5000
                });
            }
        })();
    });

})();