
"use strict";
var core = {},
    common = {};
//#region 有效执行
/*
指定时间内再次调用。将重新计时
实现 快速更新 情况 实现在 在最后结束后再更新


@使用举例
var validLoad = new validExcu();
validLoad.excu(function () { showLoad(left) },300);
*/
core.validExcu=function () {
    var timeId = null;

    function clear() {
        if (timeId) {
            clearTimeout(timeId);
            timeId = null;
        }
    }

    this.excu = function (callBack, time) {
        clear();

        timeId = setTimeout(function () {
            timeId = null;
            callBack();
        }, time || 200);
    };

    this.clear = clear;

};
//#endregion
/*
** 图片加载

参数--
1：图片url
2：加载完 后执行，返回当前图片dom
3：错误执行

*/
core.imgLoad = function (src, f, f2) {
    var img = new Image();
    img.onload = function () {
        f(img);
    };
    if (f2) img.onerror = f2;
    img.src = src;
};
core.mouseWheel = function (dom, f) {
    if (dom.addEventListener) {
        if (dom.onmousewheel === undefined) dom.addEventListener('DOMMouseScroll', f, false);//firefox
        else dom.addEventListener('mousewheel', f, false);
    } else {
        dom.attachEvent('onmousewheel', f);//ie678
    }
};
core.imageSizeExcu = function (src, f) {
    var img = new Image(),
    iserror = false;

    img.onerror = function () {
        f({ w: 0, h: 0, img: img });
        iserror = true;
    };

    img.src = src;

    //返回false 将跳出 循环
    core.loopTry(function () {
        if (iserror) return false;
        if (img.complete || img.width) {

            f({ w: img.width, h: img.height, img: img });
            return false;
        }
    });
};
core.loopTry = function (tryFn, time) {
    time = time === undefined ? 100 : time
    function fn() {
        if (tryFn() !== false) {
            setTimeout(fn, time);
        }
    }
    setTimeout(fn, time);
};
common.imgFullByBox_v1 = function (params) {

    var
        boxWidth = params.boxWidth,
        boxHeight = params.boxHeight,
        width = params.width,
        height = params.height,
        PR = params.PR === undefined ? '' : 'margin-',

        boxRatio = boxWidth / boxHeight,
        ratio = width / height,
        w, h, x, y, whxy;

    if (boxRatio > ratio) {
        w = boxWidth;
        h = boxWidth / ratio;
        x = 0;
        y = -(h - boxHeight) / 4;
    }
    else {

        w = boxHeight * ratio;
        h = boxHeight;
        x = -(w - boxWidth) / 2;
        y = 0;
    }

    whxy = { width: w || boxWidth, height: h || boxHeight };


    whxy[PR + 'left'] = x || 0;
    whxy[PR + 'top'] = y || 0;

    return whxy;
}
jQuery.easing["jswing"]=jQuery.easing["swing"];jQuery.extend(jQuery.easing,{def:"easeOutQuad",swing:function(x,t,b,c,d){return jQuery.easing[jQuery.easing.def](x,t,b,c,d)},easeInQuad:function(x,t,b,c,d){return c*(t/=d)*t+b},easeOutQuad:function(x,t,b,c,d){return -c*(t/=d)*(t-2)+b},easeInOutQuad:function(x,t,b,c,d){if((t/=d/2)<1){return c/2*t*t+b}return -c/2*((--t)*(t-2)-1)+b},easeInCubic:function(x,t,b,c,d){return c*(t/=d)*t*t+b},easeOutCubic:function(x,t,b,c,d){return c*((t=t/d-1)*t*t+1)+b},easeInOutCubic:function(x,t,b,c,d){if((t/=d/2)<1){return c/2*t*t*t+b}return c/2*((t-=2)*t*t+2)+b},easeInQuart:function(x,t,b,c,d){return c*(t/=d)*t*t*t+b},easeOutQuart:function(x,t,b,c,d){return -c*((t=t/d-1)*t*t*t-1)+b},easeInOutQuart:function(x,t,b,c,d){if((t/=d/2)<1){return c/2*t*t*t*t+b}return -c/2*((t-=2)*t*t*t-2)+b},easeInQuint:function(x,t,b,c,d){return c*(t/=d)*t*t*t*t+b},easeOutQuint:function(x,t,b,c,d){return c*((t=t/d-1)*t*t*t*t+1)+b},easeInOutQuint:function(x,t,b,c,d){if((t/=d/2)<1){return c/2*t*t*t*t*t+b}return c/2*((t-=2)*t*t*t*t+2)+b},easeInSine:function(x,t,b,c,d){return -c*Math.cos(t/d*(Math.PI/2))+c+b},easeOutSine:function(x,t,b,c,d){return c*Math.sin(t/d*(Math.PI/2))+b},easeInOutSine:function(x,t,b,c,d){return -c/2*(Math.cos(Math.PI*t/d)-1)+b},easeInExpo:function(x,t,b,c,d){return(t==0)?b:c*Math.pow(2,10*(t/d-1))+b},easeOutExpo:function(x,t,b,c,d){return(t==d)?b+c:c*(-Math.pow(2,-10*t/d)+1)+b},easeInOutExpo:function(x,t,b,c,d){if(t==0){return b}if(t==d){return b+c}if((t/=d/2)<1){return c/2*Math.pow(2,10*(t-1))+b}return c/2*(-Math.pow(2,-10*--t)+2)+b},easeInCirc:function(x,t,b,c,d){return -c*(Math.sqrt(1-(t/=d)*t)-1)+b},easeOutCirc:function(x,t,b,c,d){return c*Math.sqrt(1-(t=t/d-1)*t)+b},easeInOutCirc:function(x,t,b,c,d){if((t/=d/2)<1){return -c/2*(Math.sqrt(1-t*t)-1)+b}return c/2*(Math.sqrt(1-(t-=2)*t)+1)+b},easeInElastic:function(x,t,b,c,d){var s=1.70158;var p=0;var a=c;if(t==0){return b}if((t/=d)==1){return b+c}if(!p){p=d*0.3}if(a<Math.abs(c)){a=c;var s=p/4}else{var s=p/(2*Math.PI)*Math.asin(c/a)}return -(a*Math.pow(2,10*(t-=1))*Math.sin((t*d-s)*(2*Math.PI)/p))+b},easeOutElastic:function(x,t,b,c,d){var s=1.70158;var p=0;var a=c;if(t==0){return b}if((t/=d)==1){return b+c}if(!p){p=d*0.3}if(a<Math.abs(c)){a=c;var s=p/4}else{var s=p/(2*Math.PI)*Math.asin(c/a)}return a*Math.pow(2,-10*t)*Math.sin((t*d-s)*(2*Math.PI)/p)+c+b},easeInOutElastic:function(x,t,b,c,d){var s=1.70158;var p=0;var a=c;if(t==0){return b}if((t/=d/2)==2){return b+c}if(!p){p=d*(0.3*1.5)}if(a<Math.abs(c)){a=c;var s=p/4}else{var s=p/(2*Math.PI)*Math.asin(c/a)}if(t<1){return -0.5*(a*Math.pow(2,10*(t-=1))*Math.sin((t*d-s)*(2*Math.PI)/p))+b}return a*Math.pow(2,-10*(t-=1))*Math.sin((t*d-s)*(2*Math.PI)/p)*0.5+c+b},easeInBack:function(x,t,b,c,d,s){if(s==undefined){s=1.70158}return c*(t/=d)*t*((s+1)*t-s)+b},easeOutBack:function(x,t,b,c,d,s){if(s==undefined){s=1.70158}return c*((t=t/d-1)*t*((s+1)*t+s)+1)+b},easeInOutBack:function(x,t,b,c,d,s){if(s==undefined){s=1.70158}if((t/=d/2)<1){return c/2*(t*t*(((s*=(1.525))+1)*t-s))+b}return c/2*((t-=2)*t*(((s*=(1.525))+1)*t+s)+2)+b},easeInBounce:function(x,t,b,c,d){return c-jQuery.easing.easeOutBounce(x,d-t,0,c,d)+b},easeOutBounce:function(x,t,b,c,d){if((t/=d)<(1/2.75)){return c*(7.5625*t*t)+b}else{if(t<(2/2.75)){return c*(7.5625*(t-=(1.5/2.75))*t+0.75)+b}else{if(t<(2.5/2.75)){return c*(7.5625*(t-=(2.25/2.75))*t+0.9375)+b}else{return c*(7.5625*(t-=(2.625/2.75))*t+0.984375)+b}}}},easeInOutBounce:function(x,t,b,c,d){if(t<d/2){return jQuery.easing.easeInBounce(x,t*2,0,c,d)*0.5+b}return jQuery.easing.easeOutBounce(x,t*2-d,0,c,d)*0.5+c*0.5+b}});

function pictureShow(jBox) {

    function getData(succeed) {

        var data = {
            status: true
        };

        succeed(specialData);

    }

    function groupsHandle() {
        var jGroups = [];


    }

    function getGroup(count) {
        var group = [];
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
                group = [1, 2, 3];
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
                group = [2, 3, 5, 7, 5, 1];
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
            top = 82,
            bottom = 2,

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

        positionData.width = width;
        positionData.height = height;


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
                type: gd.count
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
                jThat = $(this),
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
        groupData = [],
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


$(function () {

    
    window.specialData=[{"id":"26","title":"承古开今魂系美玉 崇玉尚德誉满宛城——华夏玉文化大讲堂专题","thumb":"imgs/1/dfd1b38c93324e1036fcb1a2413676c4.jpg","banner":"imgs/1/dfd1b38c93324e1036fcb1a2413676c4.jpg","keyword":"独山玉 南阳玉雕 宛派玉雕 ","description":"2014年11月7日至8日，“中国·南阳首届华夏玉文化大讲堂”在南阳师范学院东区演播厅成功举办，群贤毕至，共襄盛举，向世人再一次展示了南阳，展示了“宛派玉雕”。","template":"s6","sign":null,"dateline":"1416902942","ob":"1","status":"Y"},{"id":"27","title":"国色精粹 南红玛瑙——以色迷人的玉石新秀","thumb":"imgs/1/3842d3d0880a2c00d1ef35d5d372c24d.jpg","banner":"imgs/1/8d9d8076a05a6666cb77e92a6bbf9a4a.jpg","keyword":"南红玛瑙 南红玛瑙种类 南红玛瑙鉴赏 南红玛瑙保养 南红玛瑙价值","description":"现代意义上的南红玛瑙历史并不久远，却在近几年里以“井喷”的速度在国内玉石市场牢牢占据一席之地，其中到底有着怎样的奥妙？在这一期专题里，就让我们一起来探寻南红玛瑙名下的秘密。","template":"s7","sign":null,"dateline":"1420335494","ob":"1","status":"Y"},{"id":"21","title":"风雅之最 石艳天下","thumb":"imgs/1/b6e95997a4a3bd5890cb0516dac62011.jpg","banner":"","keyword":null,"description":" 青田石，因色之高雅，质之温润，性之中庸，广为篆刻家所青睐，尤为文人雅士所好，古往今来，赞美诗文不断，可谓风雅至极。青田之地，久负盛名。有着“石艳天下”的美称，创造了灿烂的石雕文化，素有“国之瑰宝”、“天下第一雕”、“在石头上绣花”等众多美誉，加上“斧凿夺神工，人巧胜天然”的技艺，上升至口碑上的“高海拔”，同时唤起了人们心中探秘的兴趣。","template":"m2","sign":null,"dateline":"1407476740","ob":"2","status":"Y"},{"id":"22","title":"志归完璞","thumb":"imgs/1/69901aebb3eb3774bc3bcd8be2206669.jpg","banner":"imgs/1/f0f4bc54b2800f7c4d14b43656561c27.jpg","keyword":null,"description":"导语：陈礼忠，是福建首位在中国国家博物馆举办个人作品展的艺术家。他的作品，打破了寿山石雕传统工艺的“陈旧感”，从现代的人文审美视角出发，释放出一种审美情境下的自然状态和心灵的自由感，赋予了作品鲜明的人文色彩。面对广阔的艺术空间，陈礼忠坦言：“中国工艺美术大师不是我的目标，国际大师才是我的终身追求。”","template":"s4","sign":null,"dateline":"1409211295","ob":"2","status":"Y"},{"id":"24","title":"   怀德雅韵   ","thumb":"imgs/1/064b6d15be9dd3d1eeeab271cd906afb.jpg","banner":"imgs/1/faf5e4864465017c019f563a76fadb41.png","keyword":null,"description":"白玉自古就有无瑕洁白如玉之说，象征着美好、高贵和吉祥。质感温润、细腻无暇、晶凝如脂，高贵不失典雅，于静谧之中彰显富贵之态。在中国历代文物中，白玉玉料雕琢而成的皆为“国宝”，一直被世人称道。如今，白玉精品层出不穷、众彩纷呈，更是备受瞩目。","template":"m1","sign":null,"dateline":"1411026089","ob":"2","status":"Y"},{"id":"25","title":"碧玉  四大当家花旦","thumb":"imgs/1/3eb4c831355c9f54400f6de0d871aeaf.jpg","banner":"imgs/1/74938aed9502b7edcc6f380a4eeb8ba7.jpg","keyword":"","description":"古代人爱玉以白为上，碧玉的价值被大大低估。现代人审美观点改变，加上和田白玉价值飙升太快，碧玉反而成为越来越多玉石爱好者和收藏家们关注的焦点。世界著名碧玉产地主要有新疆、加拿大、新西兰、俄罗斯。不同的国度，形成了不同的碧玉风尚，渐渐成为了现代文明与时尚的一大象征。","template":"s5","sign":null,"dateline":"1414118566","ob":"2","status":"Y"},{"id":"20","title":"天工记忆——走进中国工艺美术大师","thumb":"imgs/1/4afe996524bc6935dff80cbf91893ac5.jpg","banner":"","keyword":null,"description":"\"君子比德于玉\"，是中国人一句古训，是中国人与玉一见倾心的真情流泻，中国人活着，像玉一样，去世了，神圣的悼念，也是生刍一束，其人如玉。从过去的玉器业祖师、工匠、匠人，到如今的玉石雕大师，在玉石文化这条历史长河中，凝聚着他们无数的心血和智慧,每一件艺术品，都是他们生命的奠基，为着一个“活”字，用手中的刻刀活化了艺术的永恒，和对生命的无限热爱。","template":"s3","sign":null,"dateline":"1406685643","ob":"3","status":"Y"},{"id":"19","title":"人物空间·中国工艺美术大师（玉石）特辑","thumb":"imgs/1/90e34da78e83a1013e2fd618a5d5a2b5.jpg","banner":"","keyword":null,"description":"导语：他们过去一直被叫做“匠人”，人们只认识从他们手中诞生的巧夺天工之物，却忽略了他们的存在。当下，在反省文化和重估价值的同时，让我们把目光靠近一些，莫忘了站在民族文化前沿的“传承人”，莫忘了他们的名字、他们的贡献、他们语言背后的无限力量……","template":"s2","sign":null,"dateline":"1403860467","ob":"4","status":"Y"},{"id":"18","title":"博生说玉之原料篇","thumb":"imgs/1/7876811c6d4a78ccf66405fb56220f4c.jpg","banner":"","keyword":null,"description":"","template":"s1","sign":null,"dateline":"1403259350","ob":"5","status":"Y"},{"id":"17","title":"艺术的黑色体——珠宝玉石类图书、期刊集锦","thumb":"imgs/1/f19248a618e902d98fe37f0026998e4c.jpg","banner":"imgs/1/c19638e0f97b0dfa8957bd2f06ac43a8.jpg","keyword":null,"description":"“每一本书都是一个用黑字印在白纸上的灵魂”，每一件珠宝、玉石艺术品都是刀尖上的思想者，我们需要从书籍中去寻找……新石器网站汇编有关业内的经典书籍、期刊，供广大读者阅览。","template":"a","sign":null,"dateline":"1402479651","ob":"6","status":"Y"},{"id":"14","title":"第二届广东省“玉魂奖”玉雕艺术精品展","thumb":"imgs/1/b70f35bb1010217cadc8de014d2222bf.jpg","banner":"/attachments/article_special/201406/4d8b23f049f00c2916d2b162765f97a5.jpg","keyword":null,"description":"广东省玉雕作品“玉魂奖”玉雕大赛创办于2012年，是入围中国珠宝玉石行业最高奖项“天工奖”的初评，此届评选的优秀工艺精品的颁奖典礼于2013年9月10日在东方宾馆举行。","template":"a","sign":null,"dateline":"1402367588","ob":"7","status":"Y"},{"id":"12","title":"走十年文博之路，展文化产业之精华","thumb":"imgs/1/f555c9e81f1cc61a78df61067c3a21bb.jpg","banner":"/attachments/article_special/201406/af92b682b6f089ce4f1b2475a209c7a5.jpg","keyword":null,"description":"第十届文博会设立的一个主会场，以及54个分\r\n会场，丰富多姿的文化色彩。更是广纳全球特\r\n色文化产业。与科技、金融、贸易理念的相结\r\n合的全新理念也是本次展会的一大特色点。","template":"a","sign":null,"dateline":"1401938663","ob":"8","status":"Y"},{"id":"16","title":"沈德盛：晶玉之间 在动与静中均衡","thumb":"imgs/1/38dd7897bddf08f03ff859485cab2c98.jpg","banner":"/attachments/article_special/201406/c176a4129d1a100fe510608f404607fc.jpg","keyword":null,"description":"素有玉雕界“晶科状元”之称的沈德盛大师。水晶玉材的设计雕刻，采用老题新解、新做，新题老做，并巧妙利用水晶透明质感与材料底部的白雾，让人感觉神明在雾中升腾，从外形上的稳重到意象上的轻灵","template":"a","sign":null,"dateline":"1402389835","ob":"9","status":"Y"},{"id":"5","title":"缅甸翡翠公盘2013资本战争的集结号","thumb":"imgs/1/0c0ee74f17cb24ad698dc9c385500154.jpg","banner":"imgs/1/6afc7820f88a0dc654321673629df923.jpg","keyword":null,"description":"作为全球品质最好、数量最大的翡翠原石产地，缅甸一直是全球翡翠的主要输出地，缅甸翡翠公盘也因此聚焦了全球翡翠爱好者和商家的目光。回顾缅甸翡翠公盘发展历程，从缅甸翡翠公盘看翡翠市场发展趋势，让我们来看本期专题报道：","template":"a","sign":null,"dateline":"1372608000","ob":"10","status":"Y"},{"id":"28","title":"来自史前生灵的馈赠——琥珀","thumb":"imgs/1/a3110f6a0f48f9443e6e60db9a04dbbc.jpg","banner":"imgs/1/0842f213245199d3758b035754c790a5.jpg","keyword":"琥珀 蜜蜡 琥珀保养 琥珀原石 琥珀价格 蜜蜡鉴别 老蜜蜡","description":"琥珀是广受喜爱的有机宝石，琥珀具有极高的收藏价值，尤其是琥珀中的蜜蜡、老蜜蜡，收藏价值极高。本专题就琥珀原石的分布，琥珀保养，蜜蜡鉴别等相关知识做一一解析。","template":"s8","sign":null,"dateline":"1422410539","ob":"255","status":"Y"},{"id":"29","title":"高端翡翠投资鉴赏沙龙赵玉谦专场 ","thumb":"imgs/1/62039b38eb0cb73190fd734208e6452b.jpg","banner":"imgs/1/cf4cad848de8c45def6e8f098d68934f.jpg","keyword":"赵玉谦 四会玉雕 翡翠玉雕 高端翡翠摆件 翡翠价格","description":"在近年来的艺术收藏品中，色艳质美的收藏级翡翠异军突起，价格上涨迅速，翡翠收藏者数量也日益增多，但是，很多翡翠收藏者也许并不知道，真正的收藏级翡翠不到全部翡翠的万分之一，是不是所有的翡翠都升值惊人?买翡翠升值幅度有多少?什么样的翡翠才能够升值?收藏者又如何才能选到具有升值潜力的收藏级翡翠呢?这是许多刚刚开始接触翡翠的人最为关心的问题。","template":"s9","sign":null,"dateline":"1422953326","ob":"255","status":"Y"},{"id":"30","title":"华夏传玉韵 名玉出独山——南阳独山玉知识专题","thumb":"imgs/1/78da955321893bab0a9448a34733dc7b.jpg","banner":"imgs/1/330a506c71f88868a081d4695f088670.jpg","keyword":"独山玉 独山玉雕 独山玉鉴别 独山玉收藏 独山玉器 玉石雕刻 玉雕师","description":"难考证中国的玉文化到底始于何种玉石，但是可以确定的是最早被用于制作玉器的石头里一定有独山玉。润泽艳丽的色彩，厚重悠远的历史让独山玉始终在中华玉文化的传承中占据一席之地。本期专题就让我们通过一些基础的知识来领略独山玉的魅力。","template":"s10","sign":null,"dateline":"1429975524","ob":"255","status":"Y"}];
    window.wJq = $(window);

    pictureShow($('.picture_show'));

});
