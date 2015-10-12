//依赖core jq

var common = {};

//#region 动态动画效果
/*
**动态动画效果
目标位置 随便都可以改变的动画效果

--创建
var excu = common.changeAnime(function (v) {
    side_follow.css('top', v);
});
参数：
操作的元素
执行定位，将返回一个 位置值

--初始使用
参数：当前位置，目标位置
excu(parseFloat(side_follow.css('top')), t);
--未更改当前位置 使用
excu(excu.now_pos, t);
*/
common.changeAnime = function (excuPos, rate) {

    var win_jq = $(window),
        is_excu = false,
        rate = rate ? rate : .2,
        excu = function (t) {
            excu.target_pos = t;
            if (is_excu) return;

            //excu.now_pos = n;
            callBakeExcu();
        };

    excu.now_pos = 0;

    function callBakeExcu() {
        is_excu = true;

        var go_len = rate * (excu.target_pos - excu.now_pos);

        excu.now_pos += go_len;

        if (Math.abs(excu.target_pos - excu.now_pos) < 1) {
            excu.now_pos = excu.target_pos;
            is_excu = false;
        }

        excuPos(excu.now_pos);

        if (is_excu) window.requestAnimFrame(callBakeExcu);
    }
    return excu;
};

/*
*** 版本2
//创建
var anime = new common.changeAnime_v2(function (v) {
    side_follow.css('top', v);
});

//停止动画
anime.stop();

//开始动画
anime.start(100);//方式1 。只有目标位置
anime.start(100,0);//方式2。目标位置，初始位置

//取状态
anime.getState();
*/
common.changeAnime_v2 = function (change, rate) {

    var o = this,

        //开关。 是否进行中。true 进行中
        sw = false;

    rate = rate ? rate : .2;

    function lastExcu() {

        sw = false;
    }

    function start(to, cur) {

        function baseExcu() {

            var len = rate * (o.to - o.cur);

            o.cur += len;

            //最后一次
            if (Math.abs(o.to - o.cur) < 1) {
                o.cur = o.to;

                lastExcu();
            }
            console.log(o.cur);
            change(o.cur);

            if (sw) window.requestAnimFrame(baseExcu);
        }

        o.to = to;
        o.cur = cur ? cur : o.cur;

        if (sw) return;

        sw = true;

        window.requestAnimFrame(baseExcu);
    }

    function stop() {
        sw = false;
    }

    this.start = start;
    this.stop = stop;
    this.cur = 0;
    this.to = 0;

    this.getState = function () {
        return sw;
    };
};
//#endregion

//#region 位置检测

/*
剩下未查看的内容高度  是否低于 指定最小 高度。低于 返回 true
*/
common.notSeebodyHeight = function (minH) {
    return (bJq.height() - wJq.height() - wJq.scrollTop()) < minH;
};

/*
将要看到指定元素时执行

只执行一次

@使用举例
common.rollExcu({
    jElem: jt,
    callBack: function () {
        $.get('/hanjia/common', function (data) {
        }, 'json');
    }
});
*/
common.rollExcu = function (param) {
    var jElem = param.jElem,
        callBack = param.callBack,
        validLoad = new core.validExcu();

    var eve = {
        scroll: fn,
        resize: fn
    };

    function fn() {
        validLoad.excu(function () {
            var xy = jElem.offset(),
                h = jElem.height(),
                wst = wJq.scrollTop();

            if (wJq.height() + wst > xy.top && wst < xy.top + h) {

                wJq.off(eve);
                callBack();

            }
        });
    }

    wJq.on(eve);

    fn();
};

//#endregion

//#region 自定义滚动条
common.customScroll = function (p) {




};


//#endregion

//#region 功能弹窗
/*
*** 功能弹窗 
common.popWin({
    href: '/member/album/create',
                    
    idName: 'album_create',

    onComplete:function(){},

    con_jq:$(),
    //可重写关闭事件。关闭前执行，return false 将 不执行 自带关闭事件
    close: function () {

        common.popWin.close(0,1);
        return false;
    },

    tit:'相册',
    close_btn:false //默认是true。即有关闭按钮
});

** 关闭功能
//参数2：是否删除内容。true表示删除
common.popWin.close(function,true);

** 弹窗 居中
common.popWin.center();
*/
common.popWin = (function () {

    var wJq,
        bdJq,
        pop_win,
        pw,
        pw_w,
        delbtn,
        bg,
        tit,
        con,
        is_close = true;

    function cenUpd() {

        if (is_close) return;
        pw.css({ left: (wJq.width() - pw_w) / 2, top: (wJq.height() - pw.height()) / 4 });
    }

    function close(f, del) {
        pop_win.fadeOut(function () {
            is_close = true;
            if (del) con.children().remove();
            else bdJq.append(con.children().hide());
            if (f) f();
        });
    }

    function show(con_jq) {
        if (con_jq) { con.html(''); con.append(con_jq.show()); }
        else con.append('<div class="loading"></div>');

        pop_win.fadeIn();

        cenUpd();
    }

    function loadShow() {
        con.append('<div class="loading have"></div>');
    }
    function loadHide() {
        con.children('.loading').remove();
    }

    function popWin(params) {

        is_close = false;

        if (!wJq) {
            wJq = $(window);
            bdJq = $(document.body);

            pop_win = '<div class="pop_win">'
            + '    <div class="pw_bg">'
            + '    </div>'
            + '    <div class="pw_win">'
            + '        <div class="pw_tit"><em>创建相册</em><s><i></i></s></div>'
            + '        <div class="pw_con">'
            + '        </div>'
            + '    </div>'
            + '</div>';
            bdJq.append(pop_win);

            pop_win = bdJq.children('.pop_win').not('#pop_win').hide();

            bg = pop_win.children('.pw_bg');
            tit = pop_win.find('.pw_tit');
            delbtn = tit.find('s');
            con = pop_win.find('.pw_con');
            pw = pop_win.children('.pw_win');

            delbtn.click(function () {
                var _bool;
                if (params.close) _bool = params.close();
                if (_bool !== false) close();
            });

            //居中
            wJq.resize(cenUpd);
        }

        if (params.tit) tit.children('em').html(params.tit);

        //是否有关闭按钮
        params.close_btn = params.close_btn === undefined ? true : params.close_btn;
        if (params.close_btn) delbtn.show();
        else delbtn.hide();

        //
        pw_w = params.width ? params.width : 300;

        //ajax情况
        if (params.href) {
            if ($('#' + params.idName).length) {
                show($('#' + params.idName));
            }
            else {
                show();

                $.post(params.href, function (d) {
                    var html = '<div id="' + params.idName + '">' + d + '</div>';
                    show($(html));

                    params.onComplete();
                });
            }

            return;
        }

        //一般情况
        show(params.con_jq);
    }

    //
    popWin.close = close;
    popWin.loadShow = loadShow;
    popWin.loadHide = loadHide;
    popWin.center = cenUpd;

    return popWin;
})();

/**
 *  弹窗
 *  @param (jq) $con 弹窗装载的内容。可以是纯文本
 *  @param (function) onClose 完全关闭后执行         
 *  @param (function) onSucceed 弹窗成功执行
 *  @param (function) closeBtnFn 重写右上关闭按钮功能。将完全替换默认关闭功能
 *  @param (boolean) isDel 是否执行删除装载的内容。true即执行删除(可选。默认true)
 *         不删除可缓存内容。提高效率
 *  @param (boolean) hasCloseBtn 是否执行删除。true即有(可选。默认true)
 *  @param (string) title 标题
 *  @param (boolean) draggable 是否拖拽。true即可以拖(可选。默认true)
 *  @param (number) width 窗口宽度。(可选。默认462)
 *  
 *  实现的功能：
 *  弹窗就绪后 执行、是否有关闭按钮、关闭后是否删除内容、关闭后执行、绑定 拖动、居中
 *  
 *
 */
common.popWin_v1 = (function () {
    var $win,
        $popBox,
        $popWin,
        $conBox,
        $closeBtn,
        $title,

        //窗口宽度
        popWinWidth,

        //弹窗就绪后 执行
        onSucceed,

        //关闭后是否删除内容
        isDel,

        //关闭后执行。完全消失后执行
        onClose,

        //是否可以拖拽
        draggable;

    /**
     *  有条件的XY。 起始元素 到目标上级元素坐标
     *  约定：目标元素必须为参照元素
     *  @param (element) initial  起始元素
     *  @param (element) target 目标上级元素
     */
    function relativeXY(initial, target) {

        var x = 0, y = 0, _target = initial;

        while (_target !== target) {
            x += _target.offsetLeft;
            y += _target.offsetTop;

            _target = _target.offsetParent;
        }

        return { x: x, y: y };
    }

    /**
     *  有条件的XY。 起始元素 到目标祖先元素坐标
     *  约定：目标元素必须为参照元素
     *  关于兼容fireFox：拖动目标元素下的 所有子元素 都得相对定位。如 .target *{position:relative;} 。这是为了 e.offsetY || e.layerY  能同步
     *  @param (jq) jDom  拖动元素
     *  @param (function) onMove 拖动时执行，传递相对于浏览器内容窗口坐标
     */
    function drag(jDom, onMove) {
        var elem = jDom[0],
            isIE678 = !-[1, ];

        function mousedown(e) {
            e = e || window.event;

            //单击的子元素 相对于 jDom 坐标 
            var rXY = relativeXY(e.target || e.srcElement, elem);

            //光标相对于元素坐标
            var offsetY = (e.offsetY || e.layerY) + rXY.y,
                offsetX = (e.offsetX || e.layerX) + rXY.x;

            //IE678 执行捕捉 来 避免 图片默认选择事件
            if (isIE678) elem.setCapture();

            document.onmousemove = function (eve) {
                eve = eve || window.event;

                //光标相对 于 浏览器内容窗口 坐标
                var pageX = eve.pageX === undefined ? document.documentElement.scrollLeft + eve.clientX : eve.pageX,
                    pageY = eve.pageY === undefined ? document.documentElement.scrollTop + eve.clientY : eve.pageY,

                //计算出 dragDom元素 相对于 浏览器内容窗口 坐标
                    x = pageX - offsetX,
                    y = pageY - offsetY;

                //执行 定位，参数：元素 相对于窗口坐标
                onMove({ left: x, top: y });
            };

            //注册松开事件
            document.onmouseup = function () {
                if (isIE678) elem.releaseCapture();
                this.onmousemove = this.onmouseup = null;//解除所有事件
            };

            return false;
        }

        elem.onmousedown = mousedown;

    }

    //居中
    function center() {

        var w = $win.width(), h = $win.height(),

            xy = { left: (w - popWinWidth) / 2, top: (h - $popWin.height()) / 4 };

        if (xy.top < 0) xy.top = 0;

        $popWin.css(xy);

    }

    function getHtml() {
        return '<div id="pop_win" class="pop_win">'
            + '    <div class="pw_bg">'
            + '    </div>'
            + '    <div class="pw_win">'
            + '        <div class="pw_tit"><em></em><s><i></i></s></div>'
            + '        <div class="pw_con">'
            + '        </div>'
            + '    </div>'
            + '</div>';
    }

    /**
     *  关闭 功能
     *  @param () isDel 是否执行删除。可选。默认true，即执行删除
     */
    function close(isDel) {

        var conHandle;

        isDel = isDel === undefined ? true : isDel;

        //删除 情况
        if (isDel) {
            conHandle = function () {
                $conBox.children().remove();
            };
        }
            //隐藏情况
        else {
            conHandle = function () {
                $(document.body).append($conBox.children().hide());
            };
        }

        //执行
        $popBox.fadeOut(400, function () {
            conHandle();
            if (onClose) onClose();
        });
    }

    /**
     *  功能重置
     */
    function fnReset(param) {

        isDel = param.isDel === undefined ? true : isDel;

        closeBtnFn = param.closeBtnFn;

        //装载内容
        if (typeof param.$con === 'string') $conBox.html(param.$con); else $conBox.append(param.$con.show());

        //更正标题
        $title.html(param.title);

        onSucceed = param.onSucceed;
        onClose = param.onClose;

        //是否有关闭按钮 处理                
        if (param.hasCloseBtn === undefined ? true : param.hasCloseBtn) {
            $closeBtn.show();
        }
        else {
            $closeBtn.hide();
        }

        //是否拖拽
        draggable = param.draggable === undefined ? true : param.draggable;
        if (draggable) $titleBox.css('cursor', 'move');
        else $titleBox.css('cursor', 'default');

        //窗口宽度初始
        popWinWidth = param.width || 300;
        $popWin.width(popWinWidth);

    }

    //基础 dom初始
    function domIni() {
        $win = $(window);
        $popBox = $(getHtml()).appendTo(document.body).hide();
        $popWin = $popBox.children('.pw_win');
        $conBox = $popWin.children('.pw_con');
        $titleBox = $popWin.children('.pw_tit');
        $closeBtn = $titleBox.children('s');
        $title = $titleBox.children('em');

        //基础关闭
        $closeBtn.on('click', function () {
            if (closeBtnFn) closeBtnFn();
            else close(isDel);
        });

        //拖动
        drag($titleBox, function (xy) {

            if (draggable) {

                xy.top -= $win.scrollTop();

                $popWin.css(xy);
            }
        });

        //居中            
        $win.resize(center);
    }

    //主要
    function popWin(param) {
        $popBox = $('#pop_win');

        //不存在。需要初始 基础 功能
        if (!$popBox.length) {
            domIni();
        }

        //功能重置
        fnReset(param);

        //弹窗
        $popBox.fadeIn(400);

        //执行居中
        center();

        if (onSucceed) onSucceed($popBox);
    }


    //外部接口
    popWin.close = close;
    popWin.center = center;
    //popWin.getWidth = function () { return popWinWidth; };
    //popWin.getHeight = function () { return $popWin.height(); };


    return popWin;
})();
/**
 *  消息框
 *  @param (string) title 标题
 *  @param (string) describe 大概描述
 *  @param (string) btnsHtml 所有按钮 html 。可选。默认有两个
 *  @param (array function) onBtns 所有按钮对于的事件。一个数组。传递this为当前按钮
 *  @param (function) closeBtnFn 重写右上关闭按钮功能。将完全替换默认关闭功能

common.confirm_v1({
title: '您确认删除此条信息',

describe: '',

onBtns: [function () {

}, cancel],
closeBtnFn:cancel
});

 */
common.confirm_v1 = function (param) {

    var btnsHtml = param.btnsHtml ? param.btnsHtml : '<a class="button mr10" href="javascript:;">确认</a><a class="gray_btn" href="javascript:;">取消</a>',

        //所有按钮事件。一个数组
        onBtns = param.onBtns,

        //重写 关闭按钮执行
        closeBtnFn = param.closeBtnFn;

    function getHtml(data) {
        return '<div class="confirm_box">'
            + '    <div class="cb_ico"><i></i></div>'
            + '    <div class="cb_con">'
            + '        <b>' + data.title + '</b>'
            + '        <p>' + data.describe + '</p>'
            + '        <div class="cb_btn">' + btnsHtml + '</div>'
            + '    </div>'
            + '</div>'
    }

    //所有按钮事件
    function onAllBtn(btns) {
        btns.each(function (i) {
            $(this).on('click', onBtns[i]);
        });
    }

    common.popWin_v1({
        title: '提醒',
        $con: getHtml(param),
        onSucceed: function (popWin) {
            onAllBtn(popWin.find('.cb_btn').children());
        },
        closeBtnFn: closeBtnFn
    });
};

//#endregion

//#region 确认框
/*
*** 确认框
common.confirm({
    title: '您的作品已经发布成功！',
    describe: '我们将在2-4个工作日内进行审核，请耐心等待',
    left_btn: {
        html: '<a class="green_btn mr20" href="javascript:;">继续发布</a>',
        click: function () {
            //清空
            form_jq.find('input').val('');
            form_jq.find('select').each(function () {
                this.options[0].selected = true;
            });
            for (var key in items) items[key][0].remove();
            editor.setContent('');

            common.popWin.close(0, 1);
        }
    },
    right_btn: {
        html: '<a class="green_btn" href="javascript:;">查看作品</a>',
        click: function () {
            location.href = '/member/talentWork/index';
        }
    },
    sure:function(){},

    //** 关闭按钮相关
    //可重写关闭事件。关闭前执行，return false 将 不执行 自带关闭事件
    close: function () {

        common.popWin.close(0,1);
        return false;
    },
    //可选 。默认 true。即有关闭按钮
    close_btn:false
});
*/
common.confirm = (function () {

    function getHtml(d) {
        return '<div class="confirm_box">'
            + '    <div class="cb_ico"><i></i></div>'
            + '    <div class="cb_con">'
            + '        <b>' + d.title + '</b>'
            + '        <p>' + d.describe + '</p>'
            + '        <div class="cb_btn">'
            + '            <a class="button mr10" href="javascript:;">确认</a>'
            + '            <a class="gray_btn" href="javascript:;">取消</a>'
            + '        </div>'
            + '    </div>'
            + '</div>'
    }

    return function (params) {

        var main_jq, btns;

        main_jq = $(getHtml(params));

        btns = main_jq.find('a');

        //处理第一个按钮
        if (params.left_btn) {
            btns.eq(0).after($(params.left_btn.html).click(params.left_btn.click)).remove();
        }

        //处理第二个按钮
        if (params.right_btn) {
            btns.eq(1).after($(params.right_btn.html).click(params.right_btn.click)).remove();
        }

        btns.click(function () {

            if (btns.index(this)) {
                common.popWin.close(0, 1);
            }
            else {
                params.sure.call(this);
            }
        });

        common.popWin({
            con_jq: main_jq,
            close: params.close,
            close_btn: (params.close_btn === false) ? false : true,

            tit: '提醒'
        });
    };
})();
//#endregion

//#region 消息框
/*
*** 消息框
common.msg({
    is:true,
    text:'',
    offset:{left:1,top:2}//可选
});
common.msg(0,'正确消息')
common.msg(1,'错误消息')
common.msg('一般消息')
common.msg({msg:'错误消息'})
common.msg({status:true, msg:'正确消息'})

*/

common.msg = (function () {


    var jBox, jMain,
        boxIsHide = true,//是否已经 隐藏
        itemH = 53,
        queue = [],
        unnecessary = 0;

    function anime(jItem) {
        var winH = wJq.height();

        jItem.height(0).hide().fadeIn({ queue: false }).animate({
            height: itemH
        });
    }

    function animeHide(jItem, callBack) {
        jItem.fadeOut({ queue: false }).animate({
            height: 0
        }, 400, function () {
            callBack.call(jItem[0]);
        });
    }

    function delAll() {

        for (var i = 0, len = queue.length; i < len; i++) del.delExcu();
    }

    function del() {
        var isActive = false,

            stopId = null,

            time = 2000;

        function delExcu(callBack) {
            if (queue.length === 0) return;

            animeHide(queue.shift(), function () {
                $(this).remove();
                callBack && callBack();
            });

            if (queue.length === 0) {
                isActive = false;
                boxHide();
            }
        }

        function stop() {
            if (stopId !== null) {

                clearTimeout(stopId);

                isActive = false;

                stopId = null;
            }

        }

        function active() {

            if (queue.length === 0 || isActive) return;

            isActive = true;

            function fn() {
                stopId = setTimeout(function () {
                    delExcu(function () {
                        if (queue.length > 0) fn();
                        else isActive = false;
                    });
                }, time);
            }

            fn();
        }

        return { active: active, delExcu: delExcu, stop: stop };
    }

    function boxShow() {
        if (boxIsHide) {
            boxIsHide = false;
            jBox.show();
        }
    }

    function boxHide() {
        boxIsHide = true;
        delAll();
    }

    //随窗口大小删除
    function resize() {

        var winH = wJq.height();

        function test() {

            var num = ~~((3 / 5 * winH - unnecessary) / itemH);

            if (num < queue.length) {
                del.delExcu();
            }
        }

        wJq.resize(function () {

            winH = wJq.height();

            test();
        });

        return { test: test };

    }

    function ini() {
        jBox = $('<div class="msg_box"><ul class="m_m"></ul></div>').appendTo(document.body);
        jMain = jBox.children('ul');

        del = del();

        resize = resize();

        jBox.hover(function () {
            del.stop();
        }, function () {
            del.active();
        });
    }

    ///###
    return function (arg1, arg2) {

        var jItem,
            cssVal = '',
            status,
            msg;

        //参数兼容
        if (typeof arg1 === 'object') {
            status = arg1.is || arg1.status,
            msg = arg1.text || arg1.msg;
            status = status ? 0 : 1;
        }
        else {
            if (arg1 === 0 || arg1 === 1) {
                status = arg1;
                msg = arg2;
            }
            else {
                msg = arg1;
            }
        }

        //处理
        switch (status) {
            case 0:
                cssVal = 'correct';
                break;
            case 1:
                cssVal = 'err';
                break;
        }

        //第一次情况
        if (jBox === undefined) ini();

        boxShow();

        jItem = $('<li class="' + cssVal + '"><div class="m_txt">' + msg + '</div></li>').appendTo(jMain);

        queue.push(jItem);

        resize.test();

        anime(jItem);

        del.active();


    };
})();

//通过cookie。成功提醒。实现刷新页面提醒
common.succMsg = {
    show: function () {
        var msg = core.getCookie('succmsg');

        if (msg != 'null') {
            msg && common.msg(0, msg);
            document.cookie = 'succmsg=null;path=/';
        }
    },
    add: function (msg) {
        document.cookie = 'succmsg=' + msg + ';path=/';
    }
};
//#endregion

//#region 全局提醒
common.topAlert = (function () {

    function getHtml(t) {
        return '<div class="top_alert"><span>' + t + '</span></div>';
    }

    return function (t) {

        var dom = $(getHtml(t)).hide();
        dom.appendTo($(bJq)).slideDown(600);

        setTimeout(function () { dom.slideUp(600, function () { dom.remove(); }); }, 3000);
    };

})();

//#endregion

//#region 翻页功能处理
//翻页功能处理
/*
使用示例：
page_box.html(common.pager.generate({
    page_data: [page, d.count, 1],
    prev_txt: '<i></i>',
    next_txt: '<i></i>',
    page_btn_num: 9,
    omit_str: '..',
    base_url: false,
    css_name:'num_page',
    prev_css_name: 'go_up_page',
    next_css_name: 'go_down_page',
}))
*/
common.pager = (function () {

    function each(len, f) {
        for (var i = 0; i < len; i++) {
            f(i);
        }
    }

    //翻页参数 转  数组
    //当前页 | 总条数 | 每页显示数
    function pageData(s) {

        if (s) {
            s = s.split('|');
            //  s[1] = Math.ceil(s[1] / s[2]);
        }

        return s;
    }

    function refresh(domjq) {
        domjq.each(function () {
            var
                domjq = $(this),
                page_data,
                base_url;

            //**外界带参
            //当前页|总条数|每页显示数 --> 当前页|总页数|每页显示数
            page_data = pageData(domjq.attr('data-pager'));

            if (!page_data) return;

            //**直接给参
            base_url = (function () {
                var i = location.href.indexOf('?');
                return i > -1 ? location.href.substring(0, i) : location.href;
            })();


            domjq.html(pager({
                pageData: page_data,//当前页，总页数，每页显示数
                activeCssName: 'sel',
                //normalCssName: 'num_page',//可选
                //prevCssName: 'num_page prev_page',//可选
                //nextCssName: 'num_page next_page mr20',//可选
                //noShow: true,//可选
                baseUrl: base_url,//可选
                // pageUrl: '/page/',//可选
                mainBtnNum: 5,//可选
                sideBtnNum: 2//可选
                // prevTxt: '«',//可选
                //  nextTxt: '»'//可选
            }));

        });
    }

    //生成翻页a  
    //[当前页,总条数,每页显示数]
    //参数：{page_data:page_data,prev_txt:'«',next_txt:'»',page_btn_num:9,omit_str:'..',base_url:'' }
    //返回：html
    function generate(data) {

        var
            //**直接给参
            page_data = data.page_data,
            page_btn_num = data.page_btn_num,
            omit_str = data.omit_str,
            base_url = data.base_url,
            prev_txt = data.prev_txt,
            next_txt = data.next_txt,
            page_str = data.page_str ? data.page_str : '?page=',
            no_show = data.no_show,
            cur_page_cssname = data.cur_page_cssname ? data.cur_page_cssname : 'sel',

            //**计算公共
            mid_num = Math.ceil(page_btn_num / 2),

            //**后期公共
            html,

            //一些临时
            v, v2;

        function getHtml(params) {
            var p, is_cur, css_name, showTxt, href;

            p = {
                cssName: '',
                disabled: true,//默认激活。false表示 没激活  。
                showTxt: false//默认false。则将 直接显示 page
            };
            for (var key in params) { p[key] = params[key]; }

            if (!p.disabled) if (no_show) return '';

            is_cur = p.page == page_data[0];
            css_name = (p.disabled ? ((is_cur ? cur_page_cssname + ' ' : '') + 'enable') : 'disabled') + ' ' + p.cssName;
            showTxt = (p.showTxt === false) ? p.page : p.showTxt;
            href = (!is_cur && p.disabled && base_url) ? ' href="' + (base_url + page_str + p.page + '"') : ((!is_cur && p.disabled) ? ' href="javascript:;"' : '');

            return '<a class="' + css_name + '"' + href + ' data-page="' + p.page + '">' + showTxt + '</a>';
        }

        //--> 当前页|总页数|每页显示数
        page_data[1] = Math.ceil(page_data[1] / page_data[2]);

        if (page_data) {
            //**有参数情况

            //只有2页才显示
            if (page_data[1] < 2) { return ''; }

            //上一页
            v = (page_data[0] - 1) < 1 ? false : page_data[0] - 1;
            html = getHtml({ page: v, showTxt: prev_txt, disabled: v, cssName: data.prev_css_name });

            //总页数大于 按钮数(page_btn_num) 情况
            if (page_data[1] > page_btn_num) {

                //当前页是否大于中间按钮数
                if (page_data[0] > mid_num) {
                    //大于中间按钮情况

                    html += getHtml({ page: 1, cssName: data.css_name });

                    if (page_data[1] - page_data[0] < mid_num) {

                        html += getHtml({ page: page_data[1] - page_btn_num + 2, showTxt: omit_str, cssName: data.css_name });

                        v = page_data[1] - page_data[0] + 1;
                        v2 = page_btn_num - 2 - v;

                        each(v2, function (i) {
                            html += getHtml({ page: page_data[0] - v2 + i, cssName: data.css_name });
                        });

                        each(v, function (i) {
                            html += getHtml({ page: ~~page_data[0] + i, cssName: data.css_name });
                        });
                    }
                    else {
                        html += getHtml({ page: page_data[0] - mid_num + 2, showTxt: omit_str, cssName: data.css_name });

                        each(mid_num - 3, function (i) {
                            html += getHtml({ page: page_data[0] - mid_num + i + 3, cssName: data.css_name });
                        });

                        each(mid_num - 1, function (i) {
                            if (i === mid_num - 2) html += getHtml({ page: ~~page_data[0] + i, showTxt: omit_str, cssName: data.css_name });
                            else html += getHtml({ page: ~~page_data[0] + i, cssName: data.css_name });
                        });
                        html += getHtml({ page: page_data[1], cssName: data.css_name });
                    }

                }
                else {
                    each(page_btn_num - 2, function (i) {
                        html += getHtml({ page: i + 1, cssName: data.css_name });
                    });
                    html += getHtml({ page: page_btn_num - 1, showTxt: omit_str, cssName: data.css_name });
                    html += getHtml({ page: page_data[1], cssName: data.css_name });
                }

            }
            else {
                each(page_data[1], function (i) {
                    html += getHtml({ page: i + 1, cssName: data.css_name });
                });
            }

            //下一页
            v = (~~page_data[0] + 1) > page_data[1] ? false : ~~page_data[0] + 1;
            html += getHtml({ page: v, showTxt: next_txt, disabled: v, cssName: data.next_css_name });

            return html;
        }
    }

    /**
     *  翻页封装**新**
     当前页索引 从1开始

     *  @param (string) test 说明
     *  @param (string) test 说明
     *  @param (function) test 说明
     *  @param (boolean) test 说明
     *  @param (number) test 说明
     *  @param (object) test 说明
     *  @param (element) test 说明
     *  @return (function) 返回生成的翻页按钮

    {
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
    }
     */
    function pager(params) {

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
            page = ~~params.pageData[0],

            //总条数
            count = ~~params.pageData[1],

            //每页显示数
            pageSize = ~~params.pageData[2],

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

    //初始
    $(function () {
        //会员后台 一般翻页
        refresh($('.page1'));

        //视频列表的翻页
        (function () {
            if (!core.determinePage('talent/video/list')) return;

            var box,
                page_data,
                base_url;

            box = $('.video_page');
            if (!box.length) return;

            page_data = pageData(box.attr('data-pager'));

            //url处理
            base_url = location.href.replace(/\/pagenum\/[\d]+/, '');

            box.html(common.pager.generate({
                page_data: page_data,
                prev_txt: '<em><</em>',
                next_txt: '<em>></em>',
                page_btn_num: 9,
                omit_str: '..',
                css_name: 'num_page',
                prev_css_name: 'num_page prev_page',
                next_css_name: 'num_page next_page mr20',
                base_url: base_url,
                page_str: '/pagenum/',//可以不带，默认:   '?page='
                no_show: true
            }));
        })();
    });

    //常用1
    function callCommon_v1($pageBox, base_url, pageUrl) {
        $pageBox.html(pager({
            pageData: pageData($pageBox.attr('data-pager')),//当前页，总页数，每页显示数
            //normalCssName: 'p_num',//可选
            prevCssName: 'prev',//可选
            nextCssName: 'next',//可选
            baseUrl: base_url,//可选
            pageUrl: pageUrl ? pageUrl : '/page/',//可选
            mainBtnNum: 5,//可选
            sideBtnNum: 2,//可选
            prevTxt: '',//可选
            nextTxt: ''//可选
        }));
    }
    //常用2 页面刷新
    function callCommon_v2(jPageBox, baseUrl, pageUrl) {
        if (jPageBox.length === 0) return;

        var curPageData = pageData(jPageBox.attr('data-pager')),
            pageCount = Math.ceil(curPageData[1] / curPageData[2]);

        if (pageCount <= 0) {
            jPageBox.html('');
            return;
        }
        else if (pageCount === 1) {

        }

        pageUrl = pageUrl ? pageUrl : '?page=';

        jPageBox.html(pager({
            pageData: curPageData,//当前页，总页数，每页显示数
            prevCssName: 'prev',//可选
            nextCssName: 'next',//可选
            baseUrl: baseUrl,
            pageUrl: pageUrl,
            sideBtnNum: 2,
            prevTxt: '',
            nextTxt: ''
        }) + '<span>跳转到：<input  type="text"  class="page_input" value="' + curPageData[0] + '"/></span><a href="javascript:;" class="go">GO</a>');

        var jTxt = $(jPageBox[0].getElementsByTagName('input')[0]);

        function goPage() {
            var num = $.trim(jTxt.val());

            if (isNaN(num)) {
                common.msg(1, '请输入数字');
            }
            else if (num > pageCount) {
                common.msg(1, '当前只有' + pageCount + '页');
            }
            else if (num == curPageData[0]) {
                common.msg(1, '当前就是第' + num + '页');
            }
            else {
                location.href = baseUrl + pageUrl + num;
            }
        }

        jTxt.ENTER(goPage);
        jPageBox.children('.go').click(goPage);

    }

    //常用3 ajax 
    function callCommon_v3(jPageBox, pageData, getData, partial) {
        pageData.page -= 0;
        partial = partial === 1 ? 1 : 0;

        var jTxt,//页 输入框
            pageCount = Math.ceil(pageData.total / pageData.pageSize);

        if (pageCount <= 0) {
            jPageBox.html('');
            return;
        }
        else if (pageCount === 1) {

        }

        jPageBox.html(common.pager.pager({
            pageData: [pageData.page + partial, pageData.total, pageData.pageSize],//当前页，数据总条数，每页显示数
            prevCssName: 'prev',//可选
            nextCssName: 'next',//可选
            sideBtnNum: 2,//可选
            prevTxt: '',//可选
            nextTxt: ''//可选
        }) + '<span>跳转到：<input type="text" class="page_input" value="' + (pageData.page + partial) + '"/></span><a href="javascript:;" class="go">GO</a>');

        jTxt = $(jPageBox[0].getElementsByTagName('input')[0]);

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

        jTxt.ENTER(function () {
            goPage();
        });

        jPageBox.children().click(function () {
            if ($(this).hasClass('go')) {
                goPage();
                return;
            }
            if ($(this).hasClass('disabled') || $(this).hasClass('active') || this.tagName === 'SPAN') return;
            $(this).addClass('active');
            getData($(this).attr('data-page') - partial);
        });
    }

    return {
        refresh: refresh, generate: generate, pageData: pageData, pager: pager,
        callCommon_v1: callCommon_v1,
        callCommon_v2: callCommon_v2,
        callCommon_v3: callCommon_v3
    };
})();
//#endregion

//#region 全选功能
common.checkAll = function (allCheckBox, otherCheckBox) {

    if (!allCheckBox.length) return;

    otherCheckBox.add(allCheckBox).off('change');

    allCheckBox.on('change', function () {
        var ck = this.checked;
        otherCheckBox.each(function () { this.checked = ck; });
        allCheckBox[0].checked = ck;
    });
    otherCheckBox.on('change', function () {
        if (!this) return;
        if (this.checked) for (var i = otherCheckBox.length; i--;) if (!otherCheckBox[i].checked) return;
        allCheckBox[0].checked = this.checked;
    });
};
//#endregion

//#region 文本 宽度获取
/*
*** 文本 宽度获取
* 参数2：字体参数(当然，还可以其他css)   --可选  (默认 12px  宋体)
*/
common.getTextWidth = function (txt, p) {

    var div = $('<div style="width:2000px;font-size:12px SimSun,\5B8B\4F53"><span></span></div>');

    if (p) div.css(p);

    div.children().html(txt);

    $(document.body).append(div);

    var width = div.children().width();

    div.remove();

    return width;
};
//#endregion

//#region 图片 完全 适应 容器 居中
//图片整体 完全显示
/*
v = common.imgCenterByBox({ box_w: 114, box_h: 85, w: d.w, h: d.h });
$(d.img).css({ width: v.w, height: v.h, marginLeft: v.x, marginTop: v.y });
*/
common.imgCenterByBox = function (d) {
    //d.box_w d.box_h d.w d.h

    var box_r = d.box_w / d.box_h,
        r = d.w / d.h,

        img_w,
        img_h,
        x,
        y
    ;

    if (box_r > r) {
        img_h = d.box_h;

        img_w = img_h * r;

        x = (d.box_w - img_w) / 2;
        y = 0;
    }
    else {
        img_w = d.box_w;

        img_h = img_w / r;

        x = 0;
        y = (d.box_h - img_h) / 2;
    }
    return { w: img_w || d.box_w, h: img_h || d.box_h, x: x || 0, y: y || 0 };
};
//使用举例：common.imgCenterByBox_v1({ boxWidth: 90, boxHeight: 90, width: img.width, height: img.height });
//@param PR 是否使用 margin 前缀。默认不使用。非undefined 都将使用
common.imgCenterByBox_v1 = function (params) {

    var boxWidth = params.boxWidth,
        boxHeight = params.boxHeight,
        width = params.width,
        height = params.height,
        PR = params.PR === undefined ? '' : 'margin-',



        boxR = boxWidth / boxHeight,
        r = width / height,

        left, top, whxy;

    if (boxR > r) {
        height = boxHeight;

        width = height * r;

        left = (boxWidth - width) / 2;
        top = 0;
    }
    else {
        width = boxWidth;

        height = width / r;

        left = 0;
        top = (boxHeight - height) / 2;
    }

    whxy = { width: width, height: height };


    whxy[PR + 'left'] = left;
    whxy[PR + 'top'] = top;

    return whxy;

};

//平铺 铺满 居中 显示
common.imgFullByBox = function (d) {

    var
        box_r = d.box_w / d.box_h,
        r = d.w / d.h,
        img_w,
        img_h,
        x,
        y
    ;

    if (box_r > r) {
        img_w = d.box_w;
        img_h = d.box_w / r;
        x = 0;
        y = -(img_h - d.box_h) / 4;
    }
    else {

        img_w = d.box_h * r;
        img_h = d.box_h;
        x = -(img_w - d.box_w) / 2;
        y = 0;
    }

    return { w: img_w || d.box_w, h: img_h || d.box_h, x: x || 0, y: y || 0 };
}

//使用：common.imgFullByBox_v1({ boxWidth: 90, boxHeight: 90, width: img.width, height: img.height });
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

///图片整体 完全显示[imgCenterByBox]/平铺 铺满 居中 显示[imgFullByBox]  *执行
/*
common.imgFullShowExcu({
    src: img_src,//可选。有直接的src，表明imgJq 初始是没有src的。这样就避免的 图片的 错动
    boxJq: _curLi.find('.products_pic'),//可选。不选则不滑动查看。imgCenterByBox情况则直接不需要选
    imgJq: _curLi.find('.products_pic_box img'),
    boxW: 280,
    boxH: 210,
    config: 'imgFullByBox'
});
*/
common.imgFullShowExcu = (function () {

    return function (param) {
        var imgJq, boxJq, boxW, boxH, config, src, noSrc,
            loadFunc,//即将加载时执行。进入加载中的前一步
            finishFunc;//加载完成后执行

        imgJq = param.imgJq;
        if (!imgJq.length) return;

        boxJq = param.boxJq;
        boxW = param.boxW;
        boxH = param.boxH;
        config = param.config;
        loadFunc = param.loadFunc || (function () { });
        finishFunc = param.finishFunc || (function () { });

        //在有直接地址情况，img 是没有src的。须在后面给予
        //实现初始隐藏图片
        noSrc = param.src === undefined;
        src = noSrc ? imgJq[0].src : param.src;

        loadFunc();
        core.imageSizeExcu(src, function (d) {
            finishFunc();

            if (config === 'imgCenterByBox' || !boxJq) {
                imgJq.css(common.imgFullByBox_v1({
                    boxWidth: boxW,
                    boxHeight: boxH,
                    width: d.w,
                    height: d.h,
                    PR: 1
                }));

            }
            else {
                common.imgFullShowSlide({
                    jBox: boxJq,
                    jImg: imgJq,
                    imgW: d.w,
                    imgH: d.h,
                    boxW: boxW,
                    boxH: boxH
                });
            }

            //有地址情况
            if (!noSrc) imgJq[0].src = src;

        });
    };
})();
/*
common.imgFullShowSlide({
    jBox: jBox,
    jImg: jBox.children(),
    imgW: size.width,
    imgH: size.height,
    boxW: boxW,
    boxH: boxH
});
*/
common.imgFullShowSlide = function (params) {

    var
      jBox = params.jBox,
      jImg = params.jImg,
      imgW = params.imgW,
      imgH = params.imgH,
      boxW = params.boxW,
      boxH = params.boxH,

      imgCss, domXY, xLen, yLen, xR, yR, anime, isX;

    imgCss = common.imgFullByBox_v1({
        boxWidth: boxW,
        boxHeight: boxH,
        width: imgW,
        height: imgH,
        PR: 1
    });
    jImg.css(imgCss);

    isX = imgCss.width > boxW;

    if (isX) {
        xLen = imgCss.width - boxW;
        xR = xLen / boxW;
        anime = new common.changeAnime_v2(function (v) {
            jImg.css('marginLeft', v);
        });
        anime.cur = imgCss['margin-left'];
    }
    else {
        yLen = imgCss.height - boxH;

        yR = yLen / boxH;
        anime = new common.changeAnime_v2(function (v) {
            jImg.css('marginTop', v);
        });

        anime.cur = imgCss['margin-top'];
    }

    jBox.mousemove(function (e) {
        var domX, domY, x, y, v;

        domXY = domXY || jBox.offset();

        if (isX) {
            x = e.pageX - domXY.left;
            v = -x * xR;
        }
        else {
            y = e.pageY - domXY.top;
            v = -y * yR;
        }

        anime.start(v);

    });
};

/*整体显示之，图片宽度===容器宽度*/
common.imgFullByBox_s2 = function (params) {
    var
        boxWidth = params.boxWidth,
        width = params.width,
        height = params.height,
        ratio = width / height;

    return { width: boxWidth, height: boxWidth / ratio };
};

/*整合为jq扩展*/
jQuery.fn.extend({
    imgFullShowMove: function () {
        return this.each(function () {

            var jBox = $(this),
                jImg = jBox.find('img');

            common.rollExcu({
                jElem: jBox,
                callBack: function () {
                    jBox.addClass('imgFullShowMove');

                    common.imgFullShowExcu({
                        src: jImg.attr('data-src'),
                        boxJq: jBox,
                        imgJq: jImg,
                        boxW: jBox.width(),
                        boxH: jBox.height(),
                        config: 'imgFullByBox',
                        finishFunc: function () {
                            jBox.removeClass('imgFullShowMove').hide().fadeIn();
                        }
                    });
                }
            });


        });
    },
    imgFullShow: function () {
        return this.each(function () {

            var jBox = $(this),
                jImg = jBox.find('img');

            common.rollExcu({
                jElem: jBox,
                callBack: function () {
                    jBox.addClass('imgFullShow');

                    common.imgFullShowExcu({
                        src: jImg.attr('data-src'),
                        imgJq: jImg,
                        boxW: jBox.width(),
                        boxH: jBox.height(),
                        config: 'imgFullByBox',
                        finishFunc: function () {
                            jBox.removeClass('imgFullShow').hide().fadeIn();
                        }
                    });
                }
            });


        });
    }
});
//#endregion

//#region 密码强度实现
//新的密码强度 在 forgetpwd.js 里面
common.pwdStrength = function (jInput, jStrengthBox) {
    jInput.keydown(function () {
        var cur = $(this);

        setTimeout(function () {
            var v = cur.val(),
                a = 0,
                b = 0;

            //多少种字符 2 3
            if ((v.match(/[\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/) || '').length) a++;//符号 除开数字字母外的字符
            if ((v.match(/[0-9]/) || '').length) a++;
            if ((v.match(/[a-zA-Z]/) || '').length) a++;

            //长度 >9   >12   0
            if (v.length > 15) b = 3;
            else if (v.length > 9) b = 2;
            else if (v.length > 6) b = 1;

            jStrengthBox.removeClass('l1').removeClass('l2').removeClass('l3');
            switch (a + '' + b) {
                case '10': case '11': case '12': case '13': case '20':
                    jStrengthBox.addClass('l1');
                    break;
                case '21': case '22': case '30': case '31':
                    jStrengthBox.addClass('l2');
                    break;
                case '23': case '32': case '33':
                    jStrengthBox.addClass('l3');
                    break;
            }

        }, 20);
    });

};
//#endregion

//#region 定时数秒执行
/*
请使用 ：
core.timing(5, function (t) {
    s.innerHTML = t;
}, function () {
    m.style.color = '#ccc';
});

///
common.timer(5, function () {
    two2_time.show();
}, function (v) {
    two2_time.find('em').html(v);
}, function () {
    cur.removeClass('disabled');
    two2_time.hide();
});
*/
common.timer = function (time, f, f2, f3) {
    var t = time;

    f();

    function fu() {
        t--;

        if (t < 1) {

            f3();

            return;
        }

        f2(t);

        stop_id = setTimeout(fu, 1000);
    }

    setTimeout(fu, 1000);
};
//#endregion

//#region 身份证验证
common.IdentityCodeValid = function (code) {
    var city = { 11: "北京", 12: "天津", 13: "河北", 14: "山西", 15: "内蒙古", 21: "辽宁", 22: "吉林", 23: "黑龙江 ", 31: "上海", 32: "江苏", 33: "浙江", 34: "安徽", 35: "福建", 36: "江西", 37: "山东", 41: "河南", 42: "湖北 ", 43: "湖南", 44: "广东", 45: "广西", 46: "海南", 50: "重庆", 51: "四川", 52: "贵州", 53: "云南", 54: "西藏 ", 61: "陕西", 62: "甘肃", 63: "青海", 64: "宁夏", 65: "新疆", 71: "台湾", 81: "香港", 82: "澳门", 91: "国外 " };
    var tip = "";
    var pass = true;

    if (!code || !/^\d{6}(18|19|20)?\d{2}(0[1-9]|1[12])(0[1-9]|[12]\d|3[01])\d{3}(\d|X)$/i.test(code)) {
        tip = "身份证号格式错误";
        pass = false;
    }

    else if (!city[code.substr(0, 2)]) {
        tip = "地址编码错误";
        pass = false;
    }
    return { pass: pass, tip: tip };
};
//#endregion

//#region ajax
common.ajax = function (p) {
    var type, data, cssName;

    type = p.type || 'POST';
    data = p.data || '';
    cssName = p.cssName || '';

    p.domJq && p.domJq.addClass(cssName);
    $.ajax({
        type: type,
        url: p.url,
        data: data,
        success: function (d) {
            p.domJq && p.domJq.removeClass(cssName);
            p.success(d);
        }
    });

};
//#endregion

//#region 表单重置
common.fromReset = function (jForm) {
    if (jForm[0].tagName === 'FORM') {
        jForm.find('input').filter('input[type=text]').val('');
        jForm.find('textarea').val('');
        jForm.find('select').each(function () {
            this.options[0].selected = true;
        });
    }
    else {
        jForm.each(function () {
            if (this.tagName === 'SELECT') {
                this.options[0].selected = true;
                return;
            }

            this.value = '';
        });
    }

    //jForm.find('input').val('');
    //jForm.find('select').each(function () {
    //    this.options[0].selected = true;
    //});
};
//#endregion

//#region 验证
/*
 -- 执行验证
 requiredValidator.excu();
 返回false 表示不通过

 -- 自定义提示字符串
 this.data_emptyTxt = '不能为空';
 原生 element 对象 的 data_emptyTxt 属性

 */
common.verify = (function () {

    function idCreate(domIn) {
        return domIn.tagName + domIn.id;
    }

    function addErrMsg(jIn, text, id) {
        var box = jIn.addClass('err').parent();
        $('#' + id).remove();
        box.append('<div id="' + id + '" class="errorMessage">' + text + '</div>');
    }

    function removeErrMsg(jIn, id) {
        jIn.removeClass('err');
        $('#' + id).remove();
    }

    function isEmpty(str) {
        return !str.trim().length;
    }

    /// 非空验证
    /// 处理了包括input[type=text] select 元素
    function requiredValidator(jIn) {
        var oId = 'empty', params;

        if (!(jIn instanceof $)) {
            params = jIn;
            jIn = params.jIn;
            addErrMsg = params.addErrMsg;
            removeErrMsg = params.removeErrMsg;

        }

        jIn.each(function () {
            $(this)[this.tagName === 'INPUT' ? 'keyup' : 'change'](function () {
                if (!isEmpty(this.value)) removeErrMsg($(this), idCreate(this) + oId);
            });
        });

        function excu() {
            var isErr = false;

            jIn.each(function (i) {
                var jCur = $(this);

                if (isEmpty(this.value)) {
                    isErr = true;
                    addErrMsg($(this), this.data_emptyTxt, idCreate(this) + oId);
                }
            });

            return !isErr;
        }

        return { excu: excu };
    }

    // 邮箱 验证
    function emailValidator(jIn) {
        var oId = 'email';

        jIn.keyup(function () {
            if (core.email_reg.test(this.value)) removeErrMsg($(this), idCreate(this) + oId);
        });
        function excu() {
            var isErr = false;

            jIn.each(function (i) {
                var jCur = $(this);

                if (!core.email_reg.test(this.value)) {
                    isErr = true;
                    addErrMsg($(this), this.data_emailTxt, idCreate(this) + oId);
                }

            });

            return !isErr;
        }

        return { excu: excu };

    }

    //限制输入。只能是数字
    function numberValidator(jIn) {
        var oId = 'number',
            number_reg = /[\d]+/;

        jIn.keyup(function () {
            if (number_reg.test(this.value)) removeErrMsg($(this), idCreate(this) + oId);
        });
        function excu() {
            var isErr = false;

            jIn.each(function (i) {
                var jCur = $(this);

                if (!number_reg.test(this.value)) {
                    isErr = true;
                    addErrMsg($(this), this.data_emailTxt, idCreate(this) + oId);
                }

            });

            return !isErr;
        }

        return { excu: excu };
    }

    return {
        requiredValidator: requiredValidator,
        emailValidator: emailValidator,
        numberValidator: numberValidator
    };

})();
//#endregion

//#region 下拉 展开 功能、img绑定本地图片文件
core.extend(common, {

    /**
     *  下拉 展开 功能
     *  @param (jq) $selBox 选择框祖先元素
     *  @param (jq) $clickItem 展开事件元素
     *  @param (function) onClick 单击前执行。return false可阻止默认行为。可选
     *  @param (string) downCssName 展开状态的className。可选，默认"down"
     *  @return (function) 关闭函数
     */
    selectDown: function (param) {
        var $selBox = param.$selBox,
            $clickItem = param.$clickItem,
            downCssName = param.downCssName ? param.downCssName : 'down',
            onClick = param.onClick;

        function unfold() {
            $selBox.removeClass(downCssName);
        }

        $selBox.hover(function () {
            bJq.off('click', unfold);
        }, function () {
            bJq.on('click', unfold);
        });

        $clickItem.click(function () {
            if (onClick === undefined || onClick() !== false)
                $selBox.toggleClass('down');
        });

        return unfold;
    },

    /*
        img绑定本地图片文件
        html5 支持
        @param (js文件对象) file 当个js文件对象
        @param (function) onsure 文件读取成功后 触发。返回绑定好的img对象

        @使用例子
        common.bindImg(fileDt.file, function (img) {
            jElem.find('.img_d img').replaceWith(img);
        });
     */
    bindImg: function (file, onsure) {

        var oReader = new FileReader();

        //文件读取 事件 完后触发
        oReader.onload = function (e) {

            //取数据
            var img = new Image();
            img.src = e.target.result;

            onsure(img, e.target.result);
        }

        //文件绑定
        oReader.readAsDataURL(file);

    },
    /*
    common.bindImg_v2(fd.file, function (urlData) {
        //取数据
        $img[0].src = urlData;
    });
    */
    bindImg_v2: function (file, onsure) {

        var oReader = new FileReader();

        //文件读取 事件 完后触发
        oReader.onload = function (e) {
            onsure(e.target.result);
        }

        //文件绑定
        oReader.readAsDataURL(file);
    },

    bindImg_v3: (function () {


        var arr = [],
            isExcu = false;

        function load(file, onsure, params) {
            var oReader = new FileReader();

            //文件读取 事件 完后触发
            oReader.onload = function (e) {
                var jElem = params.jElem,
                    boxW = params.boxW,
                    boxH = params.boxH,

                    eImg = new Image(), v, c, ctx,
                    urlData = e.target.result;

                //取数据
                eImg.src = urlData;

                v = common.imgCenterByBox({ box_w: boxW, box_h: boxH, w: eImg.width, h: eImg.height });
                c = $('<canvas></canvas>')[0];
                ctx = c.getContext("2d");

                ctx.drawImage(eImg, v.x, v.y, v.w, v.h);
                $(eImg).removeAttr('src');
                jElem.replaceWith(c);

                onsure();
            }

            //文件绑定
            oReader.readAsDataURL(file);
        }

        function excu() {

            item = arr.shift();

            if (item === undefined) {
                isExcu = false;
                return;
            }

            load(item[0], function () {
                excu();
            }, item[1]);
        }

        return function (file, params) {
            var item;

            arr.push([file, params]);

            if (isExcu) return;
            isExcu = true;

            excu();

        };
    })()
});
//#endregion

//#region 文件上传
core.extend(common, {
    /*
    文件选择 框  
    html5
    @param (function) onSure 选择后执行， 传入 files 文件集合
    @param (bool) multiple 是否多选。true为多选。(可选。默认true)
    @param (string) fileTypes 文件类型。如：image/*
    
    @一些说明
    在选择文件后，会删除file
    如果没选择任何文件，但是弹出选择框了，会保留。这点不重要。已经处理好了
    
    @使用例子
    jSelBtn.click(function () {
        common.fileSel({
            multiple: false,
            fileTypes: 'image/jpeg,image/x-png,image/gif',
            onSure: function (files) {
                console.log(files);
            }
        });
    });
    */
    fileSel: function (param) {

        function removeNode(node) {
            if (node.remove) node.remove();
            else { node.parentNode.removeChild(node); }
        }


        function ini() {

            inFile = document.getElementById('_tempFile');

            if (inFile === null) {
                inFile = document.createElement('input');
                document.body.appendChild(inFile);
            }

            return inFile;
        }

        function set() {
            for (var n in options) {
                if (options[n] !== inFile[n]) {
                    inFile[n] = options[n];
                }
            }
        }

        var
            multiple = param.multiple === undefined ? true : param.multiple,
            onSure = param.onSure,
            fileTypes = param.fileTypes === undefined ? '' : param.fileTypes,

            inFile,

            options = {
                id: '_tempFile',
                type: 'file',
                className: 'hide',
                multiple: multiple,
                accept: fileTypes,
                onchange: function () {
                    onSure(inFile.files);

                    removeNode(inFile);
                }
            };

        //if (inFile === null)
        inFile = ini();

        //设置属性
        set();

        inFile.click();
    },

    /*
    执行上传
    html5
    @param (file)  js 文件对象
    @param (string) url 请求地址。(可选。默认 mod.requestUrl.uploadUrl)
    @param (function) onSuccess 上传成功执行。传入字符串
    @param (function) onProress 进度条触发 onProress(loaded, total);

    @使用举例

    common.startUpload({
        url: mod.requestUrl.uploadUrl + '?type=companyBrand',
        file: file,
        onProress: function (loaded, total) {
            var v = ~~(loaded / total * 100),
                v2 = v + '%',
                str = v2;
            if (v === 100) str = '处理中..';

            $bar.css('width', v2);
            $txt.html(str);
        },
        onSuccess: function (data) {

            //二次写表
            common.setUpload({
                data: core.parseJSON(data),

                onSuccess: function (d, d2) {
                    $btn.removeClass('loading');
                    $btn.html('重新选择');
                    if (d2.status) {
                        bindLogoId(d2.id);
                        $bar.hide();
                        $txt.html('成功');
                    }
                    else {
                        $txt.html('上传失败。请重新选择');
                    }
                }
            });

        }

    });

     */
    startUpload: function (param) {
        var
            url = param.url === undefined ? mod.requestUrl.uploadUrl : param.url,
            file = param.file,
            onSuccess = param.onSuccess,
            onProress = param.onProress,
            onError = param.onError === undefined ? function () { } : param.onError,

            xhr,
            vfd;

        function uploadProgress(e) {

            if (e.lengthComputable) {
                onProress(e.loaded, e.total);
            }
        }
        function uploadError(e) {
            console.log(e);
        }
        function uploadSuccess(e) {

            if (xhr.readyState === 4 && xhr.status === 200) {
                onSuccess(xhr.responseText);
            }
            else if (xhr.readyState === 4 && xhr.status === 0) {

                //上传终止
                //html5DomHandle.uploadError(fData);
            }
            else if (xhr.readyState === 4) {
                onError({
                    status: false
                });
            }

        }

        xhr = new XMLHttpRequest();
        vfd = new FormData();

        vfd.append("Filedata", file);

        xhr.upload.addEventListener('progress', uploadProgress, false);
        xhr.addEventListener('error', uploadError, false);
        xhr.addEventListener('readystatechange', uploadSuccess, false);

        xhr.open("post", url);

        xhr.send(vfd);

        return xhr;

    },

    /**
     *  二次上传写表
     *  @param (object) data  上传的数据
     *  @param (function) onSuccess 成功执行
     */
    setUpload: function (param) {
        var data = param.data,
            onSuccess = param.onSuccess,
            url = param.url ? param.url : mod.createUrl('setUpload');

        return $.post(url, data, function (data2) {

            onSuccess(data, data2);

        }, 'json');
    },


    /**
     *  flash上传
     *  @param (function) addItem 说明
     *  @param (function) dialogComplete 说明
     *  @param (function) progress 说明
     *  @param (function) success 说明
     *  @param (number) test 说明
     *  @param (object) test 说明
     *  @param (element) test 说明
     *  @return (function) 返回说明
     */


    //#region js使用
    /*

    //flash 上传初始

    function upload(){

        function addItem(file) {

        }

        function dialogComplete(number, filesNumber) {
            if (filesNumber === 0) return;

            this.setPostParams({ type: 'companyBrand' });

            this.startUpload();
        }
        function progress(file, bytesLoaded, bytesTotal) {
            var v = ~~(bytesLoaded / bytesTotal * 100);

            $bar.css('width', v + '%');
        }
        function success(file, data) {

            data = core.parseJSON(data);
            data.status = 'Y';

            common.setUpload({
                data: data, onSuccess: function (d, d2) {

                    if (d2.status) {

                    }
                    else {

                    }
                }
            });
        }

        //** 初始
        //flash 上传初始
        window.swfUpload = new common.swfUpload({
            addItem: addItem,
            dialogComplete: dialogComplete,
            progress: progress,
            success: success
        });
        
    }
    */
    //#endregion

    swfUpload: function (domHandle) {

        var addItem = domHandle.addItem,
            dialogComplete = domHandle.dialogComplete,
            progress = domHandle.progress,
            success = domHandle.success,
            uploadError = domHandle.uploadError === undefined ? function () { } : domHandle.uploadError;

        //重写swf 调用
        function ini() {
            //队列完成后动作
            //对话框关闭后 根据选择的文件触发。增加了多少个文件便触发多少次
            window.fileQueued = function (file) {
                swfUpload.addItem.call(this, file);
            }

            //选择框 关闭后触发
            window.fileDialogComplete = function (number, filesNumber) {
                swfUpload.dialogComplete.call(this, number, filesNumber);
            }

            //进度条触发。针对具体文件
            window.uploadProgress = function (file, bytesLoaded, bytesTotal) {
                swfUpload.progress.call(this, file, bytesLoaded, bytesTotal);
            }

            //上传成功后动作。针对具体文件
            //上传成功，且有后台成功返回 时执行
            window.uploadSuccess = function (file, data) {
                swfUpload.success.call(this, file, data);
            }

            //文件上传完成后动作。针对具体文件
            window.uploadComplete = function (file) { }

            //上传错误
            window.uploadError = function (file, errorCode, message) {
                swfUpload.error.call(this, file, errorCode, message);
            }

            //队列错误，文件选择对话框关闭后的一些错误，比如文件太大，类型错误，还有其他一些未知错误
            window.fileQueueError = function (file, errorCode, message) {
                swfUpload.fileQueueError.call(this, file, errorCode, message);
            }
        }

        //队列完成后动作
        //每选择文件后触发。针对具体文件
        this.addItem = function (file) {
            addItem.call(this, file);
        };

        //选择框 关闭后触发
        this.dialogComplete = function (number, files) {

            dialogComplete.call(this, number, files);
        };

        //进度条触发。针对具体文件
        this.progress = function (file, bytesLoaded, bytesTotal) {
            progress.call(this, file, bytesLoaded, bytesTotal);
        };

        //上传成功后动作。针对具体文件
        //上传成功，且有后台成功返回 时执行
        this.success = function (file, data) {

            success.call(this, file, data);
        };

        //文件上传完成后动作。针对具体文件
        this.uploadComplete = function (file) {

        };

        //上传错误
        this.error = function (file, errorCode, message) {
            switch (errorCode) {
                case SWFUpload.UPLOAD_ERROR.HTTP_ERROR:
                    common.msg({ msg: "Upload Error: " + message });
                    common.msg({ msg: "Error Code: HTTP Error, File name: " + file.name + ", Message: " + message });
                    break;
                case SWFUpload.UPLOAD_ERROR.UPLOAD_FAILED:
                    common.msg({ msg: "Upload Failed." });
                    common.msg({ msg: "Error Code: Upload Failed, File name: " + file.name + ", File size: " + file.size + ", Message: " + message });
                    break;
                case SWFUpload.UPLOAD_ERROR.IO_ERROR:
                    common.msg({ msg: "Server (IO) Error" });
                    common.msg({ msg: "Error Code: IO Error, File name: " + file.name + ", Message: " + message });
                    break;
                case SWFUpload.UPLOAD_ERROR.SECURITY_ERROR:
                    common.msg({ msg: "Security Error" });
                    common.msg({ msg: "Error Code: Security Error, File name: " + file.name + ", Message: " + message });
                    break;
                case SWFUpload.UPLOAD_ERROR.UPLOAD_LIMIT_EXCEEDED:
                    common.msg({ msg: "Upload limit exceeded." });
                    common.msg({ msg: "Error Code: Upload Limit Exceeded, File name: " + file.name + ", File size: " + file.size + ", Message: " + message });
                    break;
                case SWFUpload.UPLOAD_ERROR.FILE_VALIDATION_FAILED:
                    common.msg({ msg: "Failed Validation.  Upload skipped." });
                    common.msg({ msg: "Error Code: File Validation Failed, File name: " + file.name + ", File size: " + file.size + ", Message: " + message });
                    break;
                case SWFUpload.UPLOAD_ERROR.FILE_CANCELLED:
                    common.msg({ msg: "上传取消" });
                    break;
                case SWFUpload.UPLOAD_ERROR.UPLOAD_STOPPED:
                    common.msg({ msg: "Stopped" });
                    break;
                default:
                    common.msg({ msg: "Unhandled Error: " + errorCode });
                    common.msg({ msg: "Error Code: " + errorCode + ", File name: " + file.name + ", File size: " + file.size + ", Message: " + message });
                    break;
            }

            uploadError.call(this, file, message);
        };

        //队列错误，文件选择对话框关闭后的一些错误，比如文件太大，类型错误，还有其他一些未知错误
        this.fileQueueError = function (file, errorCode, message) {
            switch (errorCode) {
                case SWFUpload.QUEUE_ERROR.FILE_EXCEEDS_SIZE_LIMIT:
                    common.msg({ text: '请上传小于' + this.settings.file_size_limit + '的文件~' });
                    break;
                case SWFUpload.QUEUE_ERROR.ZERO_BYTE_FILE:
                    common.msg({ text: '不能上传大小为0的文件~' });
                    break;
                case SWFUpload.QUEUE_ERROR.INVALID_FILETYPE:
                    common.msg({ text: '文件类型错误~' });
                    break;
                case SWFUpload.QUEUE_ERROR.QUEUE_LIMIT_EXCEEDED:
                    common.msg({ text: '文件数不能大于' + this.settings.file_queue_limit + '~' });
                    break;
                default:

                    common.msg({ text: '未知错误~' });
                    break;
            }
        };

        ini();
    }

});
//#endregion

//#region banner

/*
关于定时器 配置
'config'=>'fade;timer,5000;'
fade ：渐变动画
timer,0 ：表示 关闭定时器

<div class="banner_show" data-timer-date="5000" data-has-btn="">
    <ul class="b_list">
        <li data-src="/test.jpg" target="_blank">
            <a href="//www.feicuiwuyu.com" target="_blank" title="翡翠物语">
                <img alt="翡翠物语">
            </a>
            <div class="b_txt"><div class="b_tn"><a href="">翡翠物语翡翠物语</a></div></div>
        </li>
    </ul>
</div>
*/

core.extend(common, (function () {

    function bannerTimer(params) {

        var timerId, time, timeFunc;

        function timerExcu() {

            timeFunc();

            timerId = null;

            start();
        }

        function start() {
            if (timerId === null) timerId = setTimeout(timerExcu, time);
        };

        timerId = null;
        time = params.time || 3000;
        timeFunc = params.timeFunc;

        this.start = start;

        this.stop = function () {
            if (timerId !== null) {
                clearTimeout(timerId);
                timerId = null;
            }
        };

        //初始执行
        start();

    }
    function bannerTimeIni(jBox, fn, time) {

        var timer = new bannerTimer({
            timeFunc: fn,
            time: time
        });
        jBox.hover(function () {
            timer.stop();
        }, function () {
            timer.start();
        });
    }

    //#region banner最初版本

    function bannerAnime(p) {
        var

            conBox = p.conBox,
            items = p.items,
            change = p.change === undefined ? function () { } : p.change,

            btns,
            curShowId,
            count
        ;

        var changeExcu = p.fadeAnime ? function (index) {
            var nowItem = items.eq(index), curImg;

            if (curShowId !== undefined) {
                if (curShowId === index) return;

                items.eq(curShowId).css('zIndex', 1).fadeOut(400, function () {
                    $(this).css('zIndex', 0);
                });

                btns.eq(curShowId).removeClass(p.selClassName);
            }

            curImg = nowItem.fadeIn(400, function () {
            }).find('img')[0];
            if (!curImg.src) curImg.src = nowItem.attr('data-src');

            btns.eq(index).addClass(p.selClassName);

            change(index);

            curShowId = index;

        } : function (index) {
            var nowItem = items.eq(index), curImg;

            if (curShowId !== undefined) {
                if (curShowId === index) return;

                btns.eq(curShowId).removeClass(p.selClassName);
            }

            conBox.animate({ marginLeft: -index * p.w }, 400);
            curImg = nowItem.find('img')[0];
            if (!curImg.src) curImg.src = nowItem.attr('data-src');

            btns.eq(index).addClass(p.selClassName);

            curShowId = index;
        };

        //
        count = items.length;

        if (count <= 1) {

            (function () {
                var curImg = items.find('img')[0];

                if (count && !curImg.src) curImg.src = items.attr('data-src');
            })();


            return;
        }

        //初始
        (function () {

            //按钮初始
            var html = '';
            for (var i = 0; i < count; i++) {
                html += p.btnTag;
            }
            p.btnBox.html(html);
            btns = p.btnBox.children();

            //
            p.fadeAnime || conBox.width(p.w * count);

            if (p.fadeAnime) items.hide();
            changeExcu(0);

            //定时器
            var timer = new common.bannerTimer({
                //time: 1000,
                timeFunc: function () {
                    var _index = curShowId + 1;

                    if (_index > count - 1) _index = 0;

                    changeExcu(_index);
                }
            });
            p.box.hover(function () {
                timer.stop();
            }, function () {
                timer.start();
            });


        })();

        btns.mouseenter(function () {
            changeExcu(btns.index(this));
        });

        p.arrows && p.arrows.click(function () {

            var _curId;

            if (p.arrows.index(this)) {
                _curId = curShowId + 1;

                _curId = (_curId >= count) ? 0 : _curId;
            }
            else {
                _curId = curShowId - 1;
                _curId = (_curId < 0) ? count - 1 : _curId;
            }

            changeExcu(_curId);
        });
    }

    //#endregion

    //#region banner版本1
    /**
     *  banner 动画
     *  @param (string) animeMode 动画方式 fullMove、 move、opacity[可选。默认opacity]
     *  @param (jq) box 动画窗
     *  @param (jq) conBox 图片 [ul] 盒子
     *  @param (jq) items 图片 [li] 成员 项
     *  @param (jq) btnBox 按钮 [ul] 盒子 [可选 。不选则 没有按钮]
     *  @param (jq) arrows jq对象。[可选，默认没有箭头]
     *  @param (string) btnTag 按钮标签  [可选 。默认 <a href="javascript:;"></a>]
     *  @param (string) btnActiveCssName 按钮标签  [可选 。默认 active]
     *  @param (function) changeCallBack 切换是执行。传入两个参数，当前显示索引，要更改的索引  [可选]

     bannerAnime({
        animeMode: 'opacity',
        box: box,
        items: items,
        conBox: conBox,
        btnBox: btnBox,
        arrows: arrows,
        changeCallBack: function (curIndex, index) {
            itemsInfo.eq(curIndex).hide();
            itemsInfo.eq(index).show();

        }
    });
 */
    function bannerAnime_v1(params) {

        var animeMode = params.animeMode === undefined ? 'opacity' : params.animeMode,

            box = params.box,
            conBox = params.conBox,
            items = params.items,
            btnBox = params.btnBox,
            arrows = params.arrows,
            btnTag = params.btnTag === undefined ? '<a href="javascript:;"></a>' : params.btnTag,
            btnActiveCssName = params.btnActiveCssName === undefined ? 'active' : params.btnActiveCssName,
            changeCallBack = params.changeCallBack === undefined ? function () { } : params.changeCallBack,

            ///
            count = items.length,

            //当前显示的 索引
            activeIndex = -1,

            anime;

        function btnHandle() {
            var btns;

            //html 初始 。并 赋值 btns
            function buildHtml() {
                var html = '';

                for (var i = count; i--;) html += btnTag;

                btns = btnBox.html(html).children();
            }

            function changle(index) {
                btns.eq(activeIndex).removeClass(btnActiveCssName);
                btns.eq(index).addClass(btnActiveCssName);
            }


            //功能 初始
            function excu() {
                btns.mouseenter(function () {
                    anime.excu(btns.index(this));
                });

            }


            ///
            if (btnBox !== undefined) {

                buildHtml();
                excu();

                this.changle = changle;

            }
            else {
                this.changle = function () { };
            }
        }

        function arrowsHandle() {

            if (arrows === undefined) return;

            arrows.click(function () {
                var index = activeIndex;
                if (arrows.index(this)) {

                    index++;

                    if (index > count - 1) index = 0;

                }
                else {
                    index--;

                    if (index < 0) index = count - 1;
                }

                anime.excu(index);
            });


        }

        function opacityAnime() {

            function cssIni() {
                items.css({
                    position: 'absolute',
                    top: 0,
                    left: 0

                }).hide().first().show();
            };

            function excu(index) {

                var nowItem = items.eq(index),
                    nowImg;

                if (activeIndex !== undefined) {
                    if (activeIndex === index) return;

                    items.eq(activeIndex).css('zIndex', 1).fadeOut(400, function () {
                        $(this).css('zIndex', 0);
                    });
                }

                nowImg = nowItem.fadeIn(400).find('img')[0];
                if (!nowImg.src) nowImg.src = nowItem.attr('data-src');

                btnHandle.changle(index);

                changeCallBack(activeIndex, index);

                activeIndex = index;
            }

            ///
            cssIni();
            excu(0);

            this.excu = excu;
        }

        function moveAnime() {

            var width = box.width();


            function cssIni() {

                conBox.width(count * width).css({

                    width: count * width

                });

                items.css({
                    float: 'left'
                });

            };

            function excu(index) {
                conBox.stop().animate({ marginLeft: -index * width });

                btnHandle.changle(index);

                changeCallBack(activeIndex, index);

                activeIndex = index;
            }


            ///
            cssIni();
            excu(0);


            this.excu = excu;
        }

        //没有项，或者只有1项
        function noOrOnlyItem() {
            if (count <= 1) {
                if (count) {

                    var curImg = items.find('img')[0];

                    if (!curImg.src) curImg.src = items.attr('data-src');
                }

                if (arrows !== undefined) {
                    arrows.hide();
                }

                return true;
            }
        }

        //定时器
        function timer() {

            var timer = new common.bannerTimer({
                //time: 1000,
                timeFunc: function () {
                    var index = activeIndex + 1;

                    if (index > count - 1) index = 0;

                    anime.excu(index);
                }
            });

            box.hover(function () {
                timer.stop();
            }, function () {
                timer.start();
            });
        }

        /// 初始

        if (noOrOnlyItem()) return;

        btnHandle = new btnHandle();

        arrowsHandle();

        switch (animeMode) {

            case 'opacity':

                anime = new opacityAnime();

                break;

            case 'move': default:

                anime = new moveAnime();

                break;

        }

        timer();

    }

    //#endregion

    /*
    关于jBox的标签属性
    data-anime-mode  可选 默认fade 渐变方式。其它值 [blind,move,down]
    data-anime-type  可选 只属于blind动画 的格式，row,40  col,40  1,80,80。默认值，1,100,100
    data-timer-date  可选 默认没有定时器，定时器间隔时间
    data-has-btn     可选 默认有按钮，false 表示没有按钮

    common.banner({
        jBox: jBox,
        jItems: jItems,
        itemW: itemW,
        itemH: itemH,
        btnNum:true //可选 默认为false。没有按钮数字
    });
    */
    function banner(params) {

        function colRowHandle() {
            var colW, rowH, cg;

            cg = animeType.split(',');

            if (cg.length === 3) {
                colW = cg[1] * 1;
                rowH = cg[2] * 1;
            }
            else if (cg[0] === 'row') {
                rowH = cg[1];
            }
            else {
                colW = cg[1];
            }

            common.banner_v2({
                jBox: jBox,
                jArrows: jArrows,
                type: 'colRow',

                //可以不带，必带一项。col 不带。只有横的百叶窗。反之 只有纵的百叶窗
                colW: colW,
                rowH: rowH,

                //可以不带。不带将程序去取，某些情况可能不准确
                boxW: itemW,
                boxH: itemH,

                hasBtn: hasBtn,
                hasNum: btnNum,
                callBack: callBack,

                time: timerDate
            });
        }

        var jBox = params.jBox,
            jMove = params.jMove,
            jHoverBox = params.jHoverBox,
            jItems = params.jItems,
            jArrows = params.jArrows,
            itemW = params.itemW,
            itemH = params.itemH,
            btnNum = params.btnNum,
            callBack = params.callBack,
            curCorrectImg = params.correctImg,

            animeMode = jBox.attr('data-anime-mode'),
            animeType = jBox.attr('data-anime-type'),
            timerDate = jBox.attr('data-timer-date'),
            hasBtn = jBox.attr('data-has-btn');

        hasBtn = hasBtn === 'false' ? false : true;
        timerDate = timerDate === '' ? undefined : timerDate;

        jBox.removeClass('loading');

        switch (animeMode) {
            case 'blind':
                colRowHandle();
                break;
            case 'move':

                common.banner_v2({
                    jBox: jBox,
                    jMove: jMove,
                    jItems: jItems,
                    jHoverBox: jHoverBox,
                    jArrows: jArrows,

                    boxW: itemW,
                    boxH: itemH,

                    hasBtn: hasBtn,
                    hasNum: btnNum,
                    time: timerDate,
                    //callBack: callBack,

                    type: 'move'//可不带，默认就是这种方式
                });

                break;
            case 'down':

                common.banner_v2({
                    jBox: jBox,
                    jMove: jMove,
                    jItems: jItems,
                    jHoverBox: jHoverBox,
                    jArrows: jArrows,
                    boxH: itemH,
                    hasBtn: hasBtn,
                    hasNum: btnNum,
                    time: timerDate,
                    //anime: callBack,

                    type: 'down'//可不带，默认就是这种方式
                });
                break;
            default:
                common.banner_v2({
                    jBox: jBox,
                    jMove: jMove,
                    jItems: jItems,
                    jHoverBox: jHoverBox,
                    jArrows: jArrows,


                    boxW: itemW,
                    boxH: itemH,

                    hasBtn: hasBtn,
                    hasNum: btnNum,
                    time: timerDate
                    //callBack: callBack

                });

        }
    }

    return {
        bannerTimer: bannerTimer,
        bannerTimeIni: bannerTimeIni,
        bannerAnime: bannerAnime,
        bannerAnime_v1: bannerAnime_v1,
        banner: banner
    };

})());

common.banner_v2 = (function () {

    function btnFn(params) {
        function change(index) {
            if (curIndex === index) return;

            onChange(index);
        }

        function changeActive(index) {
            jBtns.eq(curIndex).removeClass('active');
            jBtns.eq(index).addClass('active');

            curIndex = index;
        }

        function changeByItem(jItem) {

            change(jItem.attr('data-index') * 1);
        }

        var
            jBox = params.jBox,
            count = params.count,
            hasNum = params.hasNum,
            onChange = params.onChange,

            jBtns,

            curIndex,

            html = '<div class="b_btn">',

            delayExcu = new core.delayExcu();;

        for (var i = 0; i < count; i++) {
            html += '<a href="javascript:;" data-index="' + i + '">' + (hasNum ? (i + 1) : '') + '</a>';
        }

        html += '</div>';

        jBtns = $(html).appendTo(jBox).children().on({
            click: function () {
                changeByItem($(this));
            }
        }).hover(function () {
            var jThis = $(this);
            delayExcu.excu(function () {
                changeByItem(jThis);
            });
        }, function () {
            delayExcu.clear();
        });;

        this.changeActive = changeActive;

    }

    function arrowFn(params) {
        var
            jArrows = params.jArrows,
            onChange = params.onChange,

            validLoad = new core.validExcu();

        jArrows.on({
            click: function () {
                var eThis = this;
                validLoad.excu(function () {
                    onChange(jArrows.index(eThis));
                });
            }
        });

    }

    function colRowParams(params) {
        var boxW = params.boxW,
            boxH = params.boxH,
            colW = params.colW === undefined ? boxW : params.colW,
            rowH = params.rowH === undefined ? boxH : params.rowH,

            callback = params.callback,

            colNum = Math.round(boxW / colW),
            rowNum = Math.round(boxH / rowH),

            blockW = Math.round(boxW / colNum),
            blockH = Math.round(boxH / rowNum);

        function getW(c) {
            if (c === colNum - 1) {
                return boxW - blockW * (colNum - 1);
            } else {
                return blockW;
            }
        }

        function getH(r) {
            if (r === rowNum) {
                return boxH - blockH * rowNum;
            } else {
                return blockH;
            }
        }

        function each(i) {

            var
                c = i % colNum,
                r = Math.floor(i / colNum),
                w = getW(c),
                h = getH(r);

            callback(i, c, r, w, h, c * blockW, r * blockH, colNum, rowNum);

        }
        for (var i = 0; i < colNum * rowNum; i++) {

            each(i);
        }
    }

    function getColRowData(params) {
        var boxW = params.boxW,
            boxH = params.boxH,
            curSrc = params.curSrc === undefined ? '' : ' src="' + params.curSrc + '"',
            src = ' src="' + params.src + '"',
            colW = params.colW,
            rowH = params.rowH,
            html = '',
            config = [];

        colRowParams({
            boxW: boxW,
            boxH: boxH,
            colW: colW,
            rowH: rowH,
            callback: function (i, c, r, w, h, l, t) {
                var css = 'position:absolute;top:' + t + 'px;left:' + l + 'px;overflow: hidden;width:0px;height:0px;',
                    imgcss = 'position:absolute;top:-' + t + 'px;left:-' + l + 'px;';

                html += '<div style="' + css + '"><img' + src + ' style="' + imgcss + '"/></div>';

                config.push({
                    colIndex: c,
                    rowIndex: r,
                    width: w,
                    height: h,
                    left: l,
                    top: t
                });
            }
        });

        html = '<div class="b_anime" style="position:absolute;top:0;left:0;z-index:1;width:' + boxW + 'px;height:' + boxH + 'px;background:#fff;"><img' + curSrc + '/><div class="b_a_list">' + html + '</div></div>';

        return {
            html: html,
            config: config
        };
    }
    function colRowAnimeSize(params) {

        function each(i, jThis) {
            var d = dataConfig[i];
            setTimeout(function () {
                jThis.animate({
                    width: d.width,
                    height: d.height
                }, 600, function () {
                    if (i === count - 1) jAnimeBox.fadeOut(200, function () { jAnimeBox.remove(); });
                });
            }, i * 10);
        }

        function leftEach(i, jThis) {
            var d = dataConfig[i];
            setTimeout(function () {
                jThis.css({
                    left: d.left + d.width,
                    top: d.top + d.height
                }).animate({
                    left: d.left,
                    top: d.top,
                    width: d.width,
                    height: d.height
                }, 600, function () {
                    if (i === 0) jAnimeBox.fadeOut(200, function () { jAnimeBox.remove(); });
                }).children().css({
                    left: -d.left - d.width,
                    top: -d.top - d.height

                }).animate({
                    left: -d.left,
                    top: -d.top
                }, 600);
            }, (count - 1 - i) * 20);
        }

        var jBox = params.jBox,
            boxW = params.boxW,
            boxH = params.boxH,
            colW = params.colW,
            rowH = params.rowH,
            curSrc = params.curSrc,
            src = params.src,
            isRight = params.isRight,

            data,
            dataHtml,
            dataConfig,
            count,

            jAnimeBox,
            jAnimeItems;

        data = getColRowData({
            boxW: boxW,
            boxH: boxH,
            curSrc: curSrc,
            src: src,
            colW: colW,
            rowH: rowH
        });

        dataHtml = data.html;
        dataConfig = data.config;
        count = dataConfig.length;

        jAnimeBox = $(dataHtml).prependTo(jBox);

        jAnimeItems = jAnimeBox.children('.b_a_list').children();

        jAnimeItems.each(function (i) {
            if (isRight) {
                each(i, $(this));
            }
            else {
                leftEach(i, $(this));
            }
        });
        return jAnimeBox;
    }

    function getColRowData3DBlock(params) {
        var boxW = params.boxW,
            boxH = params.boxH,
            curSrc = params.curSrc === undefined ? '' : params.curSrc,
            src = params.src,
            colW = params.colW,
            rowH = params.rowH,
            html = '',
            config = [];

        colRowParams({
            boxW: boxW,
            boxH: boxH,
            colW: colW,
            rowH: rowH,
            callback: function (i, c, r, w, h, l, t, cNum, rNum) {

                function getZIndex(c, r, cNum, rNum) {
                    var cm = Math.floor(cNum / 2),
                        rm = Math.floor(rNum / 2),
                        ci = cm - Math.abs(c - cm),
                            ri = rm - Math.abs(r - rm);

                    return ci + ri;
                }

                var
                    bg = 'background:#000 url(' + src + ') -' + l + 'px -' + t + 'px;',

                    boxCss = 'position:absolute;top:' + t + 'px;left:' + l + 'px;width:' + w + 'px;height:' + h + 'px;z-index:' + getZIndex(c, r, cNum, rNum) + ';' + core.cssPrefix + 'transform: translateZ(-' + h / 2 + 'px);',
                    curCss = 'position:absolute;top:0;left:0;width:' + w + 'px;height:' + h + 'px;' + core.cssPrefix + 'transform: translateZ(' + h / 2 + 'px);background:url(' + curSrc + ') -' + l + 'px -' + t + 'px;',
                    topCss = 'position:absolute;top:0;left:0;width:' + w + 'px;height:' + h + 'px;' + core.cssPrefix + 'transform: rotateX(90deg) translateZ(' + h / 2 + 'px);' + bg,
                    leftCss = 'position:absolute;top:0;left:0;width:' + h + 'px;height:' + h + 'px;' + core.cssPrefix + 'transform: rotateY(-90deg) translateZ(' + h / 2 + 'px);background:#000;',
                    rightCss = 'position:absolute;top:0;left:0;width:' + h + 'px;height:' + h + 'px;' + core.cssPrefix + 'transform: rotateY(90deg) translateZ(' + (w - h / 2) + 'px);background:#000;',
                    backCss = 'position:absolute;top:0;left:0;width:' + w + 'px;height:' + h + 'px;' + core.cssPrefix + 'transform: translateZ(-' + h / 2 + 'px);background:#000;',
                    bottomCss = 'position:absolute;top:0;left:0;width:' + w + 'px;height:' + h + 'px;' + core.cssPrefix + 'transform: rotate3d(-1,0,0,90deg) translateZ(' + h / 2 + 'px);' + bg;


                html += '<div class="box" style="' + boxCss + '"><div class="top" style="' + topCss + '"></div>\
<div class="cur" style="' + curCss + '"></div>\
<div style="' + leftCss + '" class="left"></div><div style="' + rightCss + '" class="right"></div><div style="' + backCss + '" class="back"></div><div style="' + bottomCss + '" class="bottom"></div></div>';

                config.push({
                    colIndex: c,
                    rowIndex: r,
                    width: w,
                    height: h,
                    left: l,
                    top: t
                });
            }
        });

        html = '<div class="anime_3d" style="position:absolute;top:0;left:0;z-index:1;width:' + boxW + 'px;height:' + boxH + 'px;background:#fff;">' + html + '</div>';

        return {
            html: html,
            config: config
        };
    }
    function colRowAnime3DBlock(params) {

        function each(i, jThis) {
            var d = dataConfig[i];
            setTimeout(function () {
                jThis.css({
                    transform: 'rotateX(-90deg) translateZ(0) translateY(' + d.height / 2 + 'px)'
                });
                if (i === count - 1) {
                    setTimeout(function () {
                        jAnimeBox.remove();
                    }, 600);
                }
            }, i * 100);
        }

        function leftEach(i, jThis) {
            var d = dataConfig[i];
            setTimeout(function () {
                jThis.css({
                    transform: 'rotateX(90deg) translateZ(0) translateY(-' + d.height / 2 + 'px)'
                });

                if (i === 0) {
                    setTimeout(function () {
                        jAnimeBox.remove();
                    }, 600);
                }

            }, (count - 1 - i) * 100);
        }

        var jBox = params.jBox,
            boxW = params.boxW,
            boxH = params.boxH,
            colW = params.colW,
            rowH = params.rowH,
            curSrc = params.curSrc,
            src = params.src,
            isRight = params.isRight,

            data,
            dataHtml,
            dataConfig,
            count,

            jAnimeBox,
            jAnimeItems;

        data = getColRowData3DBlock({
            boxW: boxW,
            boxH: boxH,
            curSrc: curSrc,
            src: src,
            colW: colW,
            rowH: rowH
        });

        dataHtml = data.html;
        dataConfig = data.config;
        count = dataConfig.length;

        jAnimeBox = $(dataHtml).prependTo(jBox);

        jAnimeItems = jAnimeBox.children();

        jAnimeItems.each(function (i) {
            if (isRight) each(i, $(this));
            else leftEach(i, $(this));
        });
        return jAnimeBox;
    }

    var anime = {
        fade: function (params) {
            var jItems = params.jItems;

            this.excu = function (params) {
                var curIndex = params.curIndex,
                    index = params.index;

                jItems.eq(curIndex).fadeOut();
                jItems.eq(index).fadeIn();
            };

            this.ini = function () { };
        },

        move: function (params) {
            var
                jBox = params.jBox,
                jItems = params.jItems,
                jMove = params.jMove,
                count = params.count,
                boxW = params.boxW === undefined ? jBox.width() : params.boxW;

            this.excu = function (params) {
                jMove.animate({
                    marginLeft: -params.index * boxW
                }, {
                    queue: false
                });
            };

            this.ini = function () {
                jBox.css({
                    overflow: 'hidden'
                });
                jItems.css({
                    position: 'relative',
                    float: 'left',
                    width: boxW,
                    display: 'block'
                });
                jMove.hide().fadeIn().width(boxW * count);

            };
        },

        //垂直 移动
        down: function (params) {
            var
                jBox = params.jBox,
                jItems = params.jItems,
                jMove = params.jMove,
                boxH = params.boxH === undefined ? jBox.height() : params.boxH;

            this.excu = function (params) {
                jMove.animate({
                    marginTop: -params.index * boxH
                }, {
                    queue: false
                });
            };

            this.ini = function () {
                jBox.css({
                    overflow: 'hidden'
                });
                jItems.css({
                    position: 'relative',
                    height: boxH,
                    display: 'block'
                });
                jMove.hide().fadeIn();

            };
        },

        //纵横百叶窗
        colRow: function (params) {
            /*
            实现核心：
            真正的切换是没有任何效果的。本质早就已经见效了
            盖在真正切换上面。实施动画效果
            
            */

            var
                jBox = params.jBox,
                jMove = params.jMove,
                jItems = params.jItems,
                colW = params.colW,
                rowH = params.rowH,
                boxW = params.boxW === undefined ? jBox.width() : params.boxW,
                boxH = params.boxH === undefined ? jBox.height() : params.boxH,
                colRowAnime = params.colRowAnime === undefined ? colRowAnimeSize : params.colRowAnime,

                jCurAnimeBox;

            this.excu = function (params) {
                var curIndex = params.curIndex,
                    index = params.index,
                    curSrc,
                    src;

                curSrc = jItems.eq(curIndex).hide().attr('data-src');
                src = jItems.eq(index).show().attr('data-src');

                if (curIndex !== undefined) {
                    if (jCurAnimeBox) jCurAnimeBox.fadeOut(50);

                    jCurAnimeBox = colRowAnime({
                        jBox: jBox,
                        boxW: boxW,
                        boxH: boxH,
                        colW: colW,
                        rowH: rowH,
                        curSrc: curSrc,
                        src: src,
                        isRight: index > curIndex
                    });
                }
            };

            this.ini = function () {
                jMove.hide().fadeIn();
            };

        },
        colRow3DBlock: function (params) {

            if (!core.isIE && !core.is360) params.colRowAnime = colRowAnime3DBlock;
            else params.rowH = params.colW;


            return new anime.colRow(params);
        }

    };

    function itemShow(params) {
        var
            jBox = params.jBox,
            jMove = params.jMove,
            jItems = params.jItems,
            boxW = params.boxW,
            boxH = params.boxH,

            count = params.count,
            type = params.type,
            onChange = params.onChange,
            delayLoadImg = params.delayLoadImg,

            colW = params.colW,
            rowH = params.rowH,

            animeParams = {
                jBox: jBox,
                jMove: jMove,
                jItems: jItems,
                count: count,
                colW: colW,
                rowH: rowH,
                boxW: boxW,
                boxH: boxH
            },
            curAnime = params.anime === undefined ? new anime[type](animeParams) : new params.anime(animeParams),

            curIndex,

            loadImgData = [];

        function loadImg(index) {
            var src, jItem;
            if (loadImgData[index] === undefined) {
                jItem = jItems.eq(index);
                src = jItem.attr('data-src');
                jItem.find('img')[0].src = src;
                loadImgData[index] = 1;
            }
        }

        function change(index) {
            if (curIndex === index) return;

            curAnime.excu({
                curIndex: curIndex,
                index: index
            });

            if (delayLoadImg) loadImg(index);

            onChange(index);

            curIndex = index;
        }

        function arrowChange(add) {
            var index = curIndex;

            if (add) {
                index++;

                if (index >= count) index = 0;
            } else {
                index--;
                if (index < 0) index = count - 1;
            }

            change(index);

        }

        this.change = change;
        this.arrowChange = arrowChange;

        curAnime.ini();
    }

    function onlyFirst(jItem) {
        jItem.fadeIn();

        jItem.find('img')[0].src = jItem.attr('data-src');
    }

    function bannerTimer(params) {

        var timerId, time, timeFunc;

        function timerExcu() {

            timeFunc();

            timerId = null;

            start();
        }

        function start() {
            if (timerId === null) timerId = setTimeout(timerExcu, time);
        };

        timerId = null;
        time = params.time || 3000;
        timeFunc = params.timeFunc;

        this.start = start;

        this.stop = function () {
            if (timerId !== null) {
                clearTimeout(timerId);
                timerId = null;
            }
        };

        //初始执行
        start();

    }

    function bannerTimeIni(jBox, fn, time) {

        var timer = new bannerTimer({
            timeFunc: fn,
            time: time
        });
        jBox.hover(function () {
            timer.stop();
        }, function () {
            timer.start();
        });
    }

    /**
     *  
     *  @param (jq) jBox 
     *  @param (jq) jArrows 可不带，不带则 默认 jBox.children('.b_arrows')
     *  @param (jq) jHoverBox 移入移出停止定时元素。可不带，不带则 默认 jBox
     
     *  @param (string) type 动画类型。fade、move、down、colRow。可不带，默认fade

     colRow类型情况参数：两者都带方格动画。只带colW只有列动画。只带rowH只有行动画。
     *  @param (number) colW 列宽
     *  @param (number) rowH 行高

     动画容器 高宽。可以不带。不带将程序去取，某些情况可能不准确
     move 情况可带w，fade 都不需要。colRow都可带
     *  @param (number) boxW 
     *  @param (number) boxH

     *  @param (number) time //可不带，不带则没定时器
 
     *  @param (boolean) hasBtn 是否有按钮 。可不带。默认true，则有
     *  @param (boolean) hasNum 是否有按钮数字。可不带。默认false，则没有

     *  @param (function) anime 动画接口，自带的已经无法满足情况

     *  @param (boolean) delayLoadImg //是否浏览到才加载图片。 可不带，默认true

     *  @return (u) un
     */
    return function (params) {
        var
            jBox = params.jBox,
            jMove = params.jMove === undefined ? jBox.children('.b_list') : params.jMove,
            jItems = params.jItems === undefined ? jMove.children() : params.jItems,
            jHoverBox = params.jHoverBox === undefined ? jBox : params.jHoverBox,
            jArrows = params.jArrows === undefined ? jBox.children('.b_arrows') : params.jArrows,

            hasNum = params.hasNum,
            type = params.type === undefined ? 'fade' : params.type,
            hasBtn = params.hasBtn === undefined ? true : params.hasBtn,
            time = params.time,
            delayLoadImg = params.delayLoadImg === undefined ? true : params.delayLoadImg,

            boxW = params.boxW,
            boxH = params.boxH,

            colW = params.colW,
            rowH = params.rowH,

            anime = params.anime,

            count = jItems.length,

            curBtnFn,
            show;

        jBox.removeClass('loading');

        if (count > 1) {

            show = new itemShow({
                jBox: jBox,
                jMove: jMove,
                jItems: jItems,
                boxW: boxW,
                boxH: boxH,
                count: count,
                type: type,
                colW: colW,
                rowH: rowH,
                anime: anime,
                delayLoadImg: delayLoadImg,
                onChange: function (index) {
                    curBtnFn.changeActive(index);
                }
            });

            curBtnFn = hasBtn ? new btnFn({
                jBox: jBox,
                count: count,
                hasNum: hasNum,
                hasBtn: hasBtn,
                onChange: function (index) {
                    show.change(index);
                }
            }) : {
                changeActive: function () { }
            };

            if (jArrows && jArrows.length) arrowFn({
                jArrows: jArrows,
                onChange: function (add) {
                    show.arrowChange(add);
                }
            });

            //初始第一个
            show.change(0);

            if (time) bannerTimeIni(jHoverBox, function () { show.arrowChange(1); }, time);

        } else if (count === 1) {
            onlyFirst(jItems);
        }
    };
})();

//#endregion

//#region 放大核心


/*
放大核心
-- 只有移上去才会加载大图

使用例子
enlarge({
    enlargeBox: $('.enlarge_box'),
    smallSrc: 'images/a_.jpg',
    bigSrc: "images/a.jpg"
});

@param object params 参数组
--@param jq enlargeBox 一下结构的enlarge_box jq对象
    <div class="enlarge_box">
        <div class="e_original">
            <img src="images/a_.jpg">
        </div>
        <div class="e_move"></div>
        <div class="e_show">
            <div class="e_big">
                <img src="images/a.jpg">
            </div>
        </div>
    </div>

--@param string bigSrc 大图链接地址
*/
core.extend(common, 'enlarge', function (params) {

    var
        enlargeBox = params.enlargeBox,
        smallSrc = params.smallSrc,
        bigSrc = params.bigSrc,

        enlargeBoxOri,
        enlargeBoxMove,
        enlargeBoxShow,
        enlargeBoxBig,
        enlargeBoxOther,

        enlargeBoxW,
        enlargeBoxH,

        multiple,

        enlargeBoxXY,
        enlargeBoxMoveW,
        enlargeBoxMoveH,

        smallImgWHXY,


        eve;

    //移入初始。只进行一次。此时才开始加载大图 和 比例初始化
    function moveIni() {
        var _bimgw, _bimgh;
        if (moveIni.data_loading) return;

        if (enlargeBoxBig.children().length === 0) {
            moveIni.data_loading = true;

            core.imageSizeExcu(smallSrc, function (d) {

                var _imgW = d.w,
                    _imgH = d.h;

                smallImgWHXY = common.imgCenterByBox_v1({
                    boxWidth: enlargeBoxW, boxHeight: enlargeBoxH, width: _imgW, height: _imgH
                });

                smallImgWHXY.paddingLeft = smallImgWHXY.left;
                smallImgWHXY.paddingTop = smallImgWHXY.top;

                enlargeBoxOri.css(smallImgWHXY).html('').append(d.img);

                core.imageSizeExcu(bigSrc, function (d) {

                    multiple = d.w / smallImgWHXY.width;

                    if (multiple > 1.2) {

                        enlargeBox.css('cursor', 'none');

                        enlargeBoxMoveW = enlargeBoxShowW / multiple;
                        enlargeBoxMoveH = enlargeBoxShowH / multiple;

                        enlargeBoxMove.css({
                            width: enlargeBoxMoveW,
                            height: enlargeBoxMoveW
                        });

                        enlargeBoxBig.append(d.img);

                        eventExcu();

                        moveIni.data_hasEnlarge = true;

                        enlargeBoxOther.show();
                    }
                    else {
                        enlargeBox.css('cursor', 'default');
                    }
                });
            });
        }
    }

    function eventExcu() {
        //光标相对 于 浏览器内容窗口 坐标
        var pageX = eve.pageX ? eve.pageX : document.documentElement.scrollLeft + eve.clientX,
            pageY = eve.pageY ? eve.pageY : document.documentElement.scrollTop + eve.clientY,

            x = pageX - enlargeBoxXY.left - enlargeBoxMoveW / 2,
            y = pageY - enlargeBoxXY.top - enlargeBoxMoveH / 2;

        if (x < 0) x = 0;
        if (y < 0) y = 0;

        if (x > enlargeBoxW - enlargeBoxMoveW) x = enlargeBoxW - enlargeBoxMoveW;
        if (y > enlargeBoxH - enlargeBoxMoveH) y = enlargeBoxH - enlargeBoxMoveH;

        enlargeBoxMove.css({ left: x, top: y });
        enlargeBoxBig.css({ left: (smallImgWHXY.left - x) * multiple, top: (smallImgWHXY.top - y) * multiple });
    }

    (function () {

        var _chils = enlargeBox.children();

        enlargeBoxOri = _chils.eq(0);
        enlargeBoxMove = _chils.eq(1);
        enlargeBoxShow = _chils.eq(2);

        enlargeBoxBig = enlargeBoxShow.children();
        enlargeBoxOther = enlargeBoxMove.add(enlargeBoxShow);

        enlargeBoxW = enlargeBox.width();
        enlargeBoxH = enlargeBox.height();

        enlargeBoxShowW = enlargeBoxShow.width();
        enlargeBoxShowH = enlargeBoxShow.height();

        enlargeBoxXY = enlargeBox.offset();

        enlargeBox.mousemove(function (e) {
            eve = e;
            if (multiple !== undefined) eventExcu();
        }).hover(function (e) {
            eve = e;
            moveIni();
            if (moveIni.data_hasEnlarge === true) enlargeBoxOther.show();
        }, function () {
            enlargeBoxOther.hide();
        });


    })();

});
//#endregion

//#region 放大绑定 img

/*

放大绑定 img

使用例子
enlargeExcu({
    jImg: $('img'),
    bigSrc: 'images/1__.jpg'
});

*/
core.extend(common, 'enlargeExcu', function (params) {

    var jImg = params.jImg,

        bigSrc = params.bigSrc;

    function coreIni() {

        var html = '<div class="enlarge_box">'
            + '    <div class="e_original"></div>'
            + '    <div class="e_move"></div>'
            + '    <div class="e_show">'
            + '        <div class="e_big"></div>'
            + '    </div>'
            + '</div>',

            jBox = $(html),
            enlargeBoxOriginal = jBox.children().eq(0);

        jImg.replaceWith(jBox);
        enlargeBoxOriginal.append(jImg);

        common.enlarge({
            enlargeBox: jBox,
            smallSrc: jImg[0].src,
            bigSrc: bigSrc
        });
    }

    coreIni();
});
//#endregion

//#region 拖动原型

common.drag = function (elem, onMove, onDowm, onUp) {
    var isIE678 = !-[1, ];

    function getPageXY(e) {
        var pageX = e.pageX === undefined ? document.documentElement.scrollLeft + e.clientX : e.pageX,
            pageY = e.pageY === undefined ? document.documentElement.scrollTop + e.clientY : e.pageY;

        return { x: pageX, y: pageY };
    }

    function mousedown(e) {
        e = e || window.event;

        var downPageXY = getPageXY(e);

        if (onDowm) onDowm(e);

        //IE678 执行捕捉 来 避免 图片默认选择事件
        if (isIE678) elem.setCapture();

        document.onmousemove = function (eve) {
            eve = eve || window.event;

            //光标相对 于 浏览器内容窗口 坐标
            var pageXY = getPageXY(eve);

            onMove({ left: pageXY.x - downPageXY.x, top: pageXY.y - downPageXY.y, event: eve });
        };

        //注册松开事件
        document.onmouseup = function () {

            if (onUp) onUp();

            if (isIE678) elem.releaseCapture();

            this.onmousemove = this.onmouseup = null;//解除所有事件
        };

        //阻止冒泡
        if (e.stopPropagation) e.stopPropagation();
        else e.cancelBubble = true;

        return false;
    }

    elem.onmousedown = mousedown;
};

/*
function drag() {
    var curX = 0,
        x;
    common.drag_v2(jBar, function (xy) {
        curX=x + xy.left;
        jBar.css('marginLeft',curX);
    }, function () {
        x = curX;
    });
}

*/
common.drag_v2 = function (jElem, onMove, onDown, onUp) {
    var isIE678 = !-[1, ],
        jDom = $(document);

    function down(e) {
        if (onDown) onDown(e);

        //IE678 执行捕捉 来 避免 图片文字等默认选择事件
        if (isIE678) jElem[0].setCapture();

        var eveFn = {
            mousemove: function (eve) {
                onMove({ left: eve.pageX - e.pageX, top: eve.pageY - e.pageY, event: eve });
            },
            mouseup: function () {
                if (onUp) onUp();

                if (isIE678) jElem[0].releaseCapture();

                jDom.off(eveFn);//解除所有事件
            }

        };

        jDom.on(eveFn);

        return false;
    }

    jElem.on({
        mousedown: down
    });
};
//#endregion

//#region 拖动实现-窗口拖动
common.dragWin = (function () {
    function stripingReduce() {
        var stopId;
        this.start = function (to, fn) {
            var times = 20,
            vel = to;
            stopId = setTimeout(function () {

                vel = parseFloat((vel * .9).toFixed(4));

                fn(vel);

                if (Math.abs(vel) > 0.009) stopId = setTimeout(arguments.callee, times);

            }, times);
        }

        this.stop = function () {
            clearTimeout(stopId);
        };
    }

    return function (params) {



        function move(xy) {
            var x = xy.left,
                y = xy.top,

                maxX = winWH.width - bindElemWidth,
                maxY = winWH.height - bindElemHeight;

            if (x !== undefined) {
                if (x < minX) x = minX;
                if (x > maxX) x = maxX;
                jMoveElem.css('left', x);
            }

            if (y !== undefined) {
                if (y < minY) y = minY;
                if (y > maxY) y = maxY;
                jMoveElem.css('top', y);
            }
        }

        function stop() {
            stripingReduceX.stop();
            stripingReduceY.stop();
        }

        var
            jBindElem = params.jBindElem,
            jMoveElem = params.jMoveElem,

            bindElemWidth = params.bindElemWidth,
            bindElemHeight = params.bindElemHeight,

            minX = params.minX === undefined ? 0 : params.minX,
            minY = params.minY === undefined ? 0 : params.minY,

            curBarXY,

            tempXY,

            isDrag = false,

            xyVel = { x: new core.velocity(), y: new core.velocity() },
            stripingReduceX = new stripingReduce(),
            stripingReduceY = new stripingReduce();


        common.drag_v2(jBindElem, function (xy) {
            xyVel.x.change(xy.left);
            xyVel.y.change(xy.top);

            curBarXY = {
                left: tempXY.left + xy.left,
                top: tempXY.top + xy.top
            };

            move(curBarXY);

            isDrag = Math.abs(xy.left) > 6 || Math.abs(xy.top) > 6;

        }, function () {
            stop();

            xyVel.x.start();
            xyVel.y.start();

            curBarXY = tempXY = {
                left: parseFloat(jMoveElem.css('left')),
                top: parseFloat(jMoveElem.css('top'))
            };

            isDrag = false;
        }, function () {

            stripingReduceX.start(xyVel.x.end() / 70, function (v) {
                curBarXY.left += v;
                move({ left: curBarXY.left });
            });
            stripingReduceY.start(xyVel.y.end() / 70, function (v) {
                curBarXY.top += v;
                move({ top: curBarXY.top });
            });
        });

        this.getStatus = function () {
            return isDrag;
        };

        this.stop = stop;

    }
})();
//#endregion

//#region 拖动切换

core.extend(common, 'dragChange', function () {

    var
        count = 1,
        curIndex = 0,
        toIndex = 0,

        onChange,
        onDown = function () { }, onUp = function () { },

        _tempIndex;

    function imgChange(x) {

        imgIndexUpdate(x);

        if (toIndex === curIndex) return;

        curIndex = toIndex;

        onChange(toIndex);
    }

    //坐标值转 图片索引。更新 toIndex
    function imgIndexUpdate(x) {

        var i = ~~(x / Math.ceil(360 / count));

        toIndex = (_tempIndex + i) % count;

        if (toIndex < 0) toIndex = count + toIndex;

    }

    function setChange(fn) { onChange = fn; }
    function setDown(fn) { onDown = fn; }
    function setUp(fn) { onUp = fn; }

    function setCurIndex(i) {
        curIndex = i;
    }

    function setCount(num) {
        count = num;
    }

    function getCount() {
        return count;
    }

    function getCurIndex() {
        return curIndex;
    }

    return {
        move: function (xy) { imgChange(xy.left); },
        down: function () { _tempIndex = curIndex; onDown(); },
        up: function () { onUp(); },
        setCount: setCount,
        getCount: getCount,
        setCurIndex: setCurIndex,
        getCurIndex: getCurIndex,
        setChange: setChange,
        setDown: setDown,
        setUp: setUp
    };
});
//#endregion

//#region 移动切换
core.extend(common, 'moveChange', function () {

    var
        count = 1,

        width = 0,

        onChange;

    function imgChange(x) {

        var toIndex = ~~(x / width * count);

        if (toIndex < 0) toIndex = count + toIndex;

        onChange(toIndex);
    }

    function move(xy) {
        imgChange(xy.left);
    }

    function onIn() {

    }

    function onLeave() {

    }

    ///属性
    function setWidth(v) {
        width = v;
    }
    function setCount(v) {
        count = v;
    }
    function setChange(fn) {
        onChange = fn;
    }

    ///###
    this.move = move;
    this.onIn = onIn;
    this.onLeave = onLeave;
    this.setWidth = setWidth;
    this.setCount = setCount;
    this.setChange = setChange;



});


//#endregion

//#region 百度地图key
core.extend(common, 'bdMapKey', 'ewIOIfcEa7sxACcND4kzLXEv');
//core.extend(common, 'bdMapKey', 'IW9wkmFI01NEvdq1kGRgZb8Z');
//#endregion

//#region 自动3d旋转
/*
绑定按钮

*/
core.extend(common, 'autoPlay', function (jBtn, onStart, onStop, onChange) {

    var isExcu = false,
        stopId,
        time = 16;//循环间隔

    function stop() {
        if (stopId) clearTimeout(stopId);
        stopId = null;
        isExcu = false;
        onStop.call(jBtn);
    }

    function play() {

        onChange();

        stopId = setTimeout(play, time);
    }

    //设置循环间隔
    function setTime(t) {
        time = t;
    }


    //状态接口
    function getStatus() { return isExcu; }

    jBtn.click(function () {
        if (isExcu) {
            stop();
        }
        else {
            isExcu = true;
            play();
            onStart.call(jBtn);
        }
    });

    return { stop: stop, setTime: setTime, getStatus: getStatus };
});

/*

@time：指定毫秒内 转完360度。假如是4000，则4秒内转完360度

@使用示例：
common.autoPlay3D({
    jBtn: $imgShowBox.children('.p_rotate'),
    getCount: function () { return jItems.length; },
    getCurIndex: dragHandle.getCurIndex,
    setCurIndex: dragHandle.setCurIndex,
    onChange: imgChange,
    startCallBack: function () { },//可选
    stopCallBack: function () { },//可选
    hasText: false //可选。默认为true
});
*/

core.extend(common, 'autoPlay3D', function (params) {

    var jBtn = params.jBtn,
        time = params.time === undefined ? 4000 : params.time,
        getCount = params.getCount,
        getCurIndex = params.getCurIndex,
        setCurIndex = params.setCurIndex,
        onChange = params.onChange,
        stopCallBack = params.stopCallBack === undefined ? function () { } : params.stopCallBack,
        startCallBack = params.startCallBack === undefined ? function () { } : params.startCallBack,
        hasText = params.hasText === undefined ? true : false,

        isExcu = false,
        stopId;

    var autoPlay = common.autoPlay(jBtn, function () {
        if (hasText) jBtn.html('停止');
        startCallBack();
    }, function () {
        if (hasText) jBtn.html('自动播放');
        stopCallBack();
    }, function () {
        var
            count = getCount(),
            curIndex = getCurIndex();

        autoPlay.setTime(~~(time / count));

        curIndex++;

        if (curIndex >= count) curIndex = 0;

        setCurIndex(curIndex);

        onChange(curIndex);
    });

    return { stop: autoPlay.stop, getStatus: autoPlay.getStatus };
});


//#endregion

//#region 按键监听-jq

jQuery.fn.extend({

    /*
    回车监听
    绑定文本框。表单自带回车监听，但也只对文本框有效
    jTxt.ENTER(function () {
        //回车执行
    });
    */
    ENTER: function (fn) {
        return this.keyup(function (e) {
            if (e.keyCode === 13) fn.call(this);
        });
    },

    /*
    esc监听
    绑定文本框。表单自带回车监听，但也只对文本框有效
    jTxt.ENTER(function () {
        //回车执行
    });
    */
    ESC: function (fn) {

        this.attr('tabindex', -1);
        return this.keyup(function (e) {
            if (e.keyCode === 27) fn();
        });
    }
});

//#endregion

//#region 标题框 切换效果-jq
/*
标题框 切换效果

使用举例
$('.d1').boxTitleAnime('.tit');
$('.d2').titleAnime('.tit');

*/
jQuery.fn.extend({
    boxTitleAnime: function (moveCssName) {
        return this.titleAnime(moveCssName, 1);
    },

    titleAnime: function (moveCssName, is) {
        var outFn,
            delayExcu = new core.delayExcu(),
            curBox;

        function getDir(a, b) {
            var c = a.width(),
                d = a.height(),
                e = (b.x - a.offset().left - c / 2) * (c > d ? d / c : 1),
                f = (b.y - a.offset().top - d / 2) * (d > c ? c / d : 1),
                g = Math.round((Math.atan2(f, e) * (180 / Math.PI) + 180) / 90 + 3) % 4;
            return g;
        }

        function titleAnimeCore() {
            var
                jBox = $(this),
                jMove = jBox.find(moveCssName),

                moveW = jMove.innerWidth(),
                moveH = jMove.innerHeight();

            function anime(a, b) {

                var over,
                    out;

                switch (a) {
                    case 0:
                        over = { top: 0 };
                        out = { left: 0, top: -moveH };
                        break;
                    case 1:
                        over = { left: 0 };
                        out = { left: moveW, top: 0 };
                        break;
                    case 2:
                        over = { top: 0 };
                        out = { left: 0, top: moveH };
                        break;
                    default:
                        over = { left: 0 };
                        out = { top: 0, left: -moveW };
                }

                if (b) {
                    jMove.stop().animate(out, 200);
                }
                else {
                    jMove.stop().css(out).animate(over, 200);
                }
            }

            //jMove.css('position') === 'static' ? 'relative' :
            $('<div></div>').insertAfter(jMove).append(jMove).css({
                width: moveW,
                height: moveH,
                position: jMove.css('position'),
                //left: jMove.css('left'),
                //top: jMove.css('top'),
                //right: jMove.css('right'),
                bottom: 0,
                overflow: 'hidden'
            });
            jMove.css({ top: moveH });

            jBox.hover(function (e) {

                if (is) {
                    anime(getDir(jBox, {
                        x: e.pageX,
                        y: e.pageY
                    }), 0);
                }
                else {
                    delayExcu.clear();

                    if (outFn && curBox !== this) {
                        outFn();
                        anime(getDir(jBox, {
                            x: e.pageX,
                            y: e.pageY
                        }), 0);
                    }
                    else {
                        jMove.stop().animate({ left: 0, top: 0 }, 200);
                    }
                }

            }, function (e) {
                if (is) {
                    anime(getDir(jBox, {
                        x: e.pageX,
                        y: e.pageY
                    }), 1);
                }
                else {
                    curBox = this;

                    outFn = function () {
                        anime(getDir($(curBox), {
                            x: e.pageX,
                            y: e.pageY
                        }), 1);
                    };

                    delayExcu.excu(function () {
                        jMove.stop().animate({ left: 0, top: moveH }, 200);
                        outFn = un;
                    });
                }
            });
        }

        return this.each(titleAnimeCore);
    }
});
//#endregion

//#region 对联广告
common.coupletAd = function (minHeight) {
    var
           jAds = $('.couplet_ad'),
           jClose = jAds.find('i'),

           adH = 0,

           bodyWidth = 1300,
           adWidth = 120,

           excu = common.changeAnime(function (v) {
               jAds.css('top', v);
           }),

           //记录状态
           state = false;//true 表示显示

    minHeight = minHeight === un ? 192 : minHeight;

    function isNoToDel() {
        jAds.each(function () {
            if ($(this).find('img').attr('src') === '') $(this).remove();
        });
        jAds = $('.couplet_ad');
    }

    function sizeHandle() {

        core.imageSizeExcu(jAds.find('img')[0].src, function (size) {
            adH = size.h;
            jAds.height(adH);
            move();
        });
    }

    function move() {
        var wH = wJq.height(),
            wST = wJq.scrollTop(),
            top;
        top = wST + (wH - adH) / 4;

        if (top < minHeight || wJq.width() < bodyWidth + adWidth * 2) {
            change(false); return;
        }

        if (top < wST) top = wST;

        change(true);

        excu(top);
    }

    function change(st) {
        if (st !== state) {
            if (st) jAds.stop(true, true).show(200);
            else jAds.stop(true, true).hide(200);
            state = st;
        }
    }

    if (jAds.length === 0) return;

    isNoToDel();
    sizeHandle();
    wJq.scroll(move).resize(move);

    jClose.click(function () {
        $(this).closest('.couplet_ad').hide(200, function () {
            $(this).remove();
            if ($(document.body).children('.couplet_ad').length === 0) wJq.unbind('scroll', move).unbind('resize', move);
        });
    });

};

//#endregion

//#region 图片展示 部分 核心
common.pictureShowCore = {

    /*
    ** 图片播放居中算法 v3
            
    [列表图]根据[选中项]实现[ul居中]算法
    根据索引而来

    参数介绍：
        index：当前选择项的索引，也是当前项前面有几个 兄弟项
        itemNum：当前显示容器 可放的最大项数
        itemW：项宽
    */
    moveCenter: function (index, itemNum, itemW) {
        //得到 ul 的位移
        return (~~(itemNum / 2) - index) * itemW;
    },
    /*
     ** 根据索引 循环当前显示项
     根据当前显示项的个数来循环

     @param index 当前显示项索引
     @param itemNum 最多显示的个数
     @param count 项的总个数
     @param callBack 显示项的个数来循环的函数，传入当前显示 的索引

    */
    loopShowItemByIndex: function (index, itemNum, count, callBack) {

        var i, l, num = ~~(itemNum / 2), itemNum = count < itemNum ? count : itemNum;

        if (index < num) {
            for (i = 0; i < itemNum; i++) {

                callBack(i);
            }
        }
        else if (count - index - 1 < num) {
            for (i = 0; i < itemNum; i++) {
                callBack(count - i - 1);
            }
        }
        else {
            for (i = 0; i < itemNum; i++) {
                callBack(index - num + i);
            }
        }

    }
}
//#endregion

//#region 动画效果 可 自由配置

/*
使用举例：
var dom = $('div'),
    go = new easingBuild();

//excu的参数说明: 反复执行的函数，起始位置，目标位置，用时(毫秒)(可选，默认400)，缓动算法(可选，默认swing)，到达目标位置时回调(可选)
go.excu(function (v) {
    dom.css('-webkit-transform', 'rotateZ(' + v + 'deg)');
    dom.css('left', v);
}, 0, 1000, 1000, 'easeInOutQuint');

*/
common.easingBuild = function () {

    var stopId;

    //params: 反复执行的函数，起始位置，目标位置，用时(毫秒)，缓动算法，到达目标位置时回调
    function excu(excu, start, end, speed, easing, callBack) {

        var
            speed = (speed === un ? 400 : speed),

            t = 0,//当前起始次数
            time = 20,//帧间隔
            d = speed / time,//总次数

            length = end - start; //要走的总长度

        if (stopId !== un) stop();

        function run() {
            if (t < d) {
                t++;

                excu(Math.ceil(jQuery.easing[easing ? easing : 'swing'](un, t, start, length, d)));

                stopId = setTimeout(run, time);
            }
            else {
                excu(end);

                stopId = un;

                callBack && callBack();
            }
        }

        run();
    }

    function stop() {
        clearTimeout(stopId);
        stopId = un;
    }

    this.excu = excu;
    this.stop = stop;
};


//#endregion

//#region 浏览器窗口滚动条动画

/*
调用举例：

//动画
$(window).scrollRun(1000);
$(window).scrollRun(1000, 2000);
$(window).scrollRun(1000, 2000, un, un, 'Top');
$(window).scrollRun(1000, 2000, un, un, 'Left');
$(window).scrollRun(1000,600,'easeOutQuint',function(){}, 'Top');

//停止
$(window).scrollStop();

*/

jQuery.fn.extend((function () {
    var go, goLeft;

    function scrollRun(end, speed, easing, callBack, way) {
        var
            speed = speed === un ? 400 : speed,
            way = way === un ? 'Top' : way,
            wJq = this,
            g;

        if (way === 'Top') {
            if (go === un) go = new common.easingBuild();
            g = go;
        }
        else {
            if (goLeft === un) goLeft = new common.easingBuild();

            g = goLeft;
        }

        g.excu(function (v) {
            wJq['scroll' + way](v);
        }, wJq['scroll' + way](), end, speed, easing, callBack);
    }

    function scrollStop() {
        go && go.stop();
        goLeft && goLeft.stop();
    }

    //滚轮事件情况 停止 滚动条动画
    $(function () {
        core.mouseWheel(window.document.body, function (e) {
            wJq.scrollStop();
        });
    });


    return {
        scrollRun: scrollRun,
        scrollStop: scrollStop
    };
})());

//#endregion

//#region ie6789 文本框输入提示 兼容

common.promptIn = function () {

    //if (!core.isIE6789) return;

    jQuery.fn.extend({

        promptIn: function () {

            return this.each(function () {
                var $in, inBorderTopW, inBorderLeftW, inPaddingTop, inPaddingLeft, placeholder, $hintTxt, hintTxtCss;

                $in = $(this);
                placeholder = $in.attr('placeholder');

                if (!placeholder) return;

                $in.removeAttr('placeholder');

                inBorderTopW = parseFloat($in.css('border-top-width'));
                inBorderLeftW = parseFloat($in.css('border-left-width'));
                inPaddingTop = parseFloat($in.css('padding-top'));
                inPaddingLeft = parseFloat($in.css('padding-left'));

                hintTxtCss = {
                    position: 'absolute',
                    left: inBorderLeftW + inPaddingLeft,
                    top: inBorderTopW + inPaddingTop + 1,
                    'font-size': $in.css('font-size'),
                    'font-family': $in.css('font-family'),
                    'line-height': $in.css('line-height'),
                    'text-indent': $in.css('text-indent'),
                    'text-align': $in.css('text-align'),
                    color: '#aaa',
                    display: 'none'
                };

                $hintTxt = $('<span>' + placeholder + '</span>');

                $in.wrap($('<span></span>').css({
                    position: 'relative',
                    display: $in.css('display') === 'block' ? 'block' : 'inline-block',
                    margin: $in.css('margin'),
                    float: $in.css('float')
                })).css('margin', 0).after($hintTxt);

                $hintTxt.css(hintTxtCss);

                $hintTxt.mouseup(function () { $in.focus(); });

                function check() {
                    if ($in.val().length) $hintTxt.hide();
                    else $hintTxt.show();
                }

                function hCheck() {
                    setTimeout(function () { check(); }, 1);
                }

                function ie6789() {
                    if (document.documentMode && document.documentMode == 9) {
                        $in.on({
                            keydown: hCheck,
                            mouseup: hCheck
                        });
                        hCheck();
                    }
                    else {
                        this.attachEvent("onpropertychange", check);
                        check();
                    }
                }

                function allNew() {
                    $in.on({
                        focus: function () {
                            $hintTxt.hide()
                        },
                        blur: check,
                        change: check
                    });

                    //if (core.isIE) $in[0].onpropertychange = check;
                    //else $in[0].onchange= check;

                    check();
                }

                allNew();

            });
        }
    });

    $('input[type=text],input[type=password],textarea').promptIn();
};
//#endregion

//#region 侧边 回到顶部 等
common.sideBox = function () {

    function ini() {

        function getHtml() {

            return '<div class="right_slide ">'
                + '<a class="r_i bt" href="javascript:wJq.scrollRun(0);"></a>'
                + '<div class="r_i app">'
                + '<div class="t"><img src="/images/slide_wx.jpg"/><p>扫描二维码关注汉家新石器</p></div>'
                + '</div>'
                + (collectId === undefined ? '' : '<a class="r_i c" href="javascript:;"></a>')
                + '</div>';
        }

        ///
        jBox = $(getHtml()).appendTo(bJq);
        jFooter = $('.footer,.footer_s1');

        itemFn();
    }

    function itemFn() {

        //验证码 显示隐藏处理
        function code(jElem) {

            function show() {
                jCode.fadeIn();
            }

            function hide() {
                jCode.fadeOut();
            }

            ///
            var jCode = jElem.children();
            jElem.hover(show, hide);

        }

        //收藏 显示隐藏处理
        function collect(jElem) {


            jElem.click(function () {
                if (CONFIG.member === undefined) {
                    common.popLogin({
                        onJsLoaded: function (d) {
                            location.href = d.returnUrl;
                        }
                    }).show();
                    return;
                }
                if (collectId) {
                    if (collectModule.getStatus()) {
                        collectModule.hide();
                    }
                    else {
                        collectModule.show();
                    }
                }
            });
        }

        ///
        var jItems = jBox.children().each(function () {
            var _jThis = $(this);
            if (_jThis.hasClass('bt')) {

            }
            else if (_jThis.hasClass('app')) {
                code(_jThis);
            }
            else if (_jThis.hasClass('c')) {
                collect(_jThis);
            }
        });

    }

    function posHandle() {

        function show() {
            jBox.fadeIn();
        }

        function hide() {

            jBox.fadeOut();
        }

        function posUpdate() {
            winST = wJq.scrollTop();
            winH = wJq.height();


            if (winST < 180) {
                if (isShow) {
                    isShow = false;
                    hide();
                }
            }
            else {
                if (isShow === false) {
                    isShow = true;
                    show();
                }

            }

            bottomChange();
            //avoidFooter();
        }

        function update() {
            var
                ft = jFooter.offset().top,
                bt = jBox.offset().top,
                v = winST + wJq.height() - ft,
                    v2 = 165;

            if (v < 0) v = 0;

            return (window.collectModule && collectModule.getStatus() && v < v2 ? v2 : v + 20);
        }

        function bottomChange() {

            jBox.css('bottom', update());
        }

        ///
        var isShow = false,
            winST,
            winH;
        wJq.on({
            resize: bottomChange,
            scroll: posUpdate
        });

        posUpdate();

        setInterval(bottomChange, 1000);

        this.update = update;
    }

    this.change = function () {

        jBox.animate({ bottom: posHandle.update() }, { queue: false });
    };

    ///
    var collectId,
        boxBottom = 10,
        jBox,
        jFooter;

    if (core.determinePage('talent/search/graver')) {
        collectId = 1;
    }
    else if (core.determinePage('talent/search/work')) {
        collectId = 2;
    }
    else if (core.determinePage('enterprise/company/list')) {
        collectId = 3;
    }
    else if (core.determinePage('enterprise/product/list')) {
        collectId = 4;
    }

    ini();

    posHandle = new posHandle();

};
//#endregion

//#region 导航-自由
/*
var navFreed =new common.navFreed();
navFreed.go([1, 1]);
*/
common.navFreed = function () {

    var jBox,
        jFirst,
        curTo;

    function go(to, noUp) {

        var first = to[0],
            second = to[1],
            jCur = jFirst.eq(first), jNext, jNextChils, h;

        if (jCur.hasClass('none')) return;


        if (curTo && to[0] == curTo[0]) {

            if (noUp === un) {
                up(curTo);
            }
            else if (to[1] != curTo[1]) {
                ///更换选项
                jCur[0].d_nextChils.eq(curTo[1]).removeClass('active');
                jCur[0].d_nextChils.eq(to[1]).addClass('active');
                curTo[1] = to[1];
            }
            return;
        }


        jNext = jCur[0].d_next;
        jNextChils = jCur[0].d_nextChils;
        h = jCur[0].d_height;

        if (curTo) { up(curTo); }

        jCur.addClass('down');
        jNext.stop().animate({ height: h }, 600, 'easeOutCubic');
        jNextChils.eq(second).addClass('active');

        curTo = [first, second];
    }

    function up(to) {
        if (curTo === un) return;

        var first = to[0],
            second = to[1] === un ? 0 : to[1],

            jCur = jFirst.eq(first),
            jNext = jCur[0].d_next,
            jNextChils = jCur[0].d_nextChils;

        jCur.removeClass('down');
        jNext.stop().animate({ height: 0 }, 600, 'easeOutCubic');
        jNextChils.eq(second).removeClass('active');

        curTo = un;
    }

    function domIni() {
        var html = '<div class="nav_freed ff_wryh">'
              + '    <dl>'
              + '        <dt class="none dt_h"><a href="/">首页</a><i></i></dt>'
              + '    </dl>'
              + '    <dl>'
              + '        <dt class="dt_t"><a href="javascript:;">人才库</a><i></i></dt>'
              + '        <dd>'
              + '            <div class="n_i"><a href="/talent">人才库首页</a></div>'
              + '            <div class="n_i"><a href="/talent/search/graver">雕刻家</a></div>'
              + '            <div class="n_i"><a href="/talent/interview/list">作品</a></div>'
              + '            <div class="n_i"><a href="/talent/interview/list">名家访谈</a></div>'
              + '            <div class="n_i"><a href="/talent/video/list">视频</a></div>'
              + '        </dd>'
              + '    </dl>'
              + '    <dl>'
              + '        <dt class="dt_e"><a href="javascript:;">玉石名企</a><i></i></dt>'
              + '        <dd>'
              + '            <div class="n_i"><a href="/enterprise">玉石名企首页</a></div>'
              + '            <div class="n_i"><a href="/enterprise/company/list">企业名录</a></div>'
              + '            <div class="n_i"><a href="/enterprise/product/list">产品精选</a></div>'
              + '            <div class="n_i"><a href="/enterprise/company/companyMap">地图导航</a></div>'
              + '            <div class="n_i"><a href="/enterprise/companyHot/index">企业热点</a></div>'
              + '        </dd>'
              + '    </dl>'
              + '    <dl>'
              + '        <dt class="dt_news"><a href="javascript:;">资讯</a><i></i></dt>'
              + '        <dd>'
              + '            <div class="n_i"><a href="/news">资讯首页</a></div>'
              + '            <div class="n_i"><a href="/news/category/list/id/14">市场行情</a></div>'
              + '            <div class="n_i"><a href="/news/category/list/id/6">业界资讯</a></div>'
              + '            <div class="n_i"><a href="/news/category/list/id/15">艺术风情</a></div>'
              + '            <div class="n_i"><a href=/news/category/list/id/18">专访</a></div>'
              + '            <div class="n_i"><a href="/news/exhibition/list">行业展会</a></div>'
              + '            <div class="n_i"><a href="/news/video/list">视频</a></div>'
              + '        </dd>'
              + '    </dl>'
              + '</div>';

        jBox = $(html).appendTo(bJq);//.hide().fadeIn();

        jFirst = jBox.find('dt');

        jFirst.each(function () {
            var jNext = $(this).next(),
                jNextChils = jNext.children();

            this.d_next = jNext;
            this.d_nextChils = jNextChils;
            this.d_height = jNext.css('height', 'auto').height();

            jNext.height(0);


        }).click(function () {

            go([jFirst.index(this)]);
        });

        jBox.hide();
    }

    function fixed() {
        var minTop = 230,

            state = 0;

        if (core.determinePage('talent', 1)) minTop = 570;
        else if (core.determinePage('news/special')) minTop = 40;

        function fn() {
            var x,
                winW = wJq.width();

            x = winW / 2 + 1000 / 2 + 10;

            jBox.css('left', x);

            sFn();

        }

        function sFn() {
            var
                winH = wJq.height(),
                bdH = bJq.height(),
                winST = wJq.scrollTop(),
                to = 0;

            if (winST > minTop) {

                to = 1;
            }
            if (205 > bdH - winH - winST) {
                to = 0;
            }

            if (to === state) return;

            if (to) jBox.stop(true, true).fadeIn();
            else jBox.stop(true, true).fadeOut();

            state = to;
        }


        wJq.resize(fn);

        wJq.scroll(sFn);

        fn();

        sFn();
    }



    ///
    domIni();

    fixed();

    this.go = go;
    this.getNavVal = function () {

        return curTo;

    };
    this.close = function () {
        up(curTo);
    };
};




//#endregion

//#region 箭头居中

common.arrowCenter = function (params) {
    function update() {
        var
            st = wJq.scrollTop(),
            to,
            btnH = 105,
            _v;

        if (st < boxTop) {
            _v = bh + boxTop - st;
            if (_v > winH) _v = winH;
            to = _v - boxTop + st
            to = (to - btnH) / 2;
        }
        else {
            to = bh + boxTop - st;

            if (to > winH) to = winH;

            to = (to - 72) / 2 + st - boxTop;
        }
        if (to < 0) { to = 0; }
        else if (to > bh - btnH) { to = bh - btnH; }

        jArrows.css('top', to);
    }

    ///
    var
        jArrows = params.jArrows,
        boxTop = params.boxTop,
        winH = wJq.height(),
        bh;

    wJq.resize(function () {
        winH = wJq.height();

        update();
    });
    wJq.scroll(update);

    this.update = function (h) {
        bh = parseFloat(h);
        update();
    };
};

//#endregion

//#region 放大处理
common.zoomHandle = function (jBox) {
    var zoomWH = 210,
        zoomBoxBorderW = 2;

    var zoomBox = $('<div>').appendTo(jBox).css({
        position: 'absolute',
        zIndex: 1,
        background: '#fff',
        width: zoomWH,
        height: zoomWH,
        overflow: 'hidden',
        border: zoomBoxBorderW + 'px solid #ddd',
        'border-radius': core.is360 ? 'none' : '50%',
        'box-shadow': '3px 6px 16px rgba(0, 0, 0, 0.6)',
        display: 'none',
        cursor: 'none'
    }).append('<img/><div style="position: absolute;width: 100%;height: 100%;border-radius: ' + (core.is360 ? 'none' : '50%') + ';box-shadow: rgb(0, 0, 0) 0 0 8px inset;"></div>'),
        bigImg = zoomBox.children('img').css({ position: 'absolute' }),
        oZoomCore = new zoomCore({
            box: jBox,
            zoomBox: zoomBox,
            bigImg: bigImg
        });

    //放大核心
    function zoomCore(params) {
        var
            //直接给参
            w = 1000,
            h = 667,
            zoomWH = 240,
            multiple = 2,
            boxBorderW = 10,
            zoomBoxBorderW = 10,

            //dom
            box = params.box,
            zoomBox = params.zoomBox,
            bigImg = params.bigImg,

            //*公共
            boxXY = box.offset(),
            zoomBoxWHHalf,
            zoomBoxEntityWHHalf,
            noExcu = false,//是否要执行
            isTransparent = false
        ;

        wJq.resize(function () { boxXY = box.offset(); });

        this.update = function (params) {

            w = params.w;
            h = params.h;
            zoomWH = params.zoomWH;
            multiple = params.multiple;
            boxBorderW = params.boxBorderW;
            zoomBoxBorderW = params.zoomBoxBorderW;

            zoomBoxEntityWHHalf = (zoomWH + zoomBoxBorderW * 2) / 2;
            zoomBoxWHHalf = zoomWH / 2;

            bigImg.width(w * multiple).height(h * multiple);

            noExcu = false;
        };

        this.stop = function () {
            noExcu = true;
            overflowHandle(true);
        };

        //超出界限 处理
        var overflowHandle = (function () {
            var zoomBoxState = false;//false 表示 隐藏

            return function (isOverflow) {
                if (isOverflow && zoomBoxState) {
                    zoomBox.hide();
                    zoomBoxState = false;
                }
                else if (!isOverflow && !zoomBoxState) {
                    zoomBox.show();
                    zoomBoxState = true;
                }
            };
        })();

        box.mousemove(function (eve) {

            if (noExcu) return;

            toTransparent();

            var x, y, pageX, pageY, isOverflow = false;

            eve = eve || window.event;

            //光标相对 于 浏览器内容窗口 坐标
            pageX = eve.pageX ? eve.pageX : document.documentElement.scrollLeft + eve.clientX;
            pageY = eve.pageY ? eve.pageY : document.documentElement.scrollTop + eve.clientY;

            //光标相对于 被放大块 的坐标
            x = pageX - boxXY.left - boxBorderW;
            y = pageY - boxXY.top - boxBorderW;

            if (x < 0) {
                x = 0;
                isOverflow = true;
            }
            else if (x > w) {
                x = w;
                isOverflow = true;
            }
            if (y < 0) {
                y = 0;
                isOverflow = true;
            }
            else if (y > h) {
                y = h;
                isOverflow = true;
            }

            overflowHandle(isOverflow);

            zoomBox.css({ left: x - zoomBoxEntityWHHalf, top: y - zoomBoxEntityWHHalf });
            bigImg.css({ left: -x * multiple + zoomBoxWHHalf, top: -y * multiple + zoomBoxWHHalf });
        });

        box.hover(function () {
            noExcu || toTransparent();
        }, function () {
            noExcu || box.children('img').animate({ opacity: 1 }, { queue: false });
            isTransparent = false;
        });

        function toTransparent() {
            if (isTransparent === false) {
                box.children('img').animate({ opacity: .8 }, { queue: false });
                isTransparent = true;
            }
        }
    }

    function load(isZoom, params) {
        if (isZoom) {
            bigImg[0].src = params.src;

            oZoomCore.update({
                w: params.boxW,
                h: params.boxH,
                zoomWH: zoomWH,
                multiple: params.multiple,
                boxBorderW: 0,
                zoomBoxBorderW: zoomBoxBorderW
            });
        } else {
            oZoomCore.stop();
        }
    }

    load(false);

    return load;
};

//#endregion

//#region 分享
common.share = function () {
    window._bd_share_config = {
        share: [{ "bdCustomStyle": "/css/blank.css" }]
    };
    core.addScript('http://bdimg.share.baidu.com/static/api/js/share.js');
};
//#endregion

//#region 滚动条处理
/*
sb = new scrollBar({
    jBox: jBox,
    jCon: jMove,
    jBarBox: jBarBox,
    jBar: jBar,
    type: 'left'
});
sb.update({
    boxS: boxW,
    conS: conW - 16,
    barBoxS: boxW
});
*/
common.scrollBar = function (params) {
    var jBox = params.jBox,
        jCon = params.jCon,
        jBarBox = params.jBarBox,
        jBar = params.jBar,
        type = params.type === undefined ? 'top' : 'left',

        boxS,
        conS,

        barMinS = 30,
        barMoveLen, conMoveLen,
        moveR,
        barS = barMinS,
        barBoxS = 0,

        curBarO = 0,
        curConO = 0,

        conAnime = new common.changeAnime_v2(function (v) {
            jCon.css('margin-' + type, v);
        });


    function drag() {
        var o;
        common.drag_v2(jBar, function (xy) {
            moveByBar(o + xy[type]);
        }, function () {
            o = curBarO;
        });
    }

    function conDrag() {
        var o,
             oVel = new core.velocity(),
            isDrag = false;

        function stripingReduce() {
            var stopId;
            this.start = function (to, fn) {
                var times = 20,
                vel = to;
                stopId = setTimeout(function () {

                    vel = parseFloat((vel * .9).toFixed(4));

                    fn(vel);

                    if (Math.abs(vel) > 0.009) stopId = setTimeout(arguments.callee, times);

                }, times);
            }

            this.stop = function () {
                clearTimeout(stopId);
            };
        }

        common.drag_v2(jCon, function (xy) {
            oVel.change(xy[type]);

            moveByCon(o + xy[type]);

            isDrag = Math.abs(xy[type]) > 6;
        }, function () {
            oVel.start();
            o = curConO;
            stripingReduce.stop();

            isDrag = false;
        }, function () {

            stripingReduce.start(oVel.end() / 70, function (o) {
                moveByCon(curConO + o);
            });
        });

        stripingReduce = new stripingReduce();

        jCon.click(function () {
            return isDrag === false;
        });
    }

    function barUpdate() {

        var r = conS / boxS;


        if (r <= 1) jBarBox.hide();
        else jBarBox.show();

        barS = barBoxS / r;

        if (barS < barMinS) barS = 30;

        jBar[type === 'left' ? 'width' : 'height'](barS);

    }

    function update(params) {

        boxS = params.boxS;
        conS = params.conS;
        barBoxS = params.barBoxS;

        barUpdate();

        barMoveLen = barBoxS - barS;
        conMoveLen = conS - boxS;

        moveR = (conS - boxS) / barMoveLen;

        moveByCon(curConO);
    }

    function moveByBar(o) {

        if (o > barMoveLen) o = barMoveLen;
        if (o < 0) o = 0;

        var conO = -o * moveR;


        conAnime.start(conO);
        jBar.css('margin-' + type, o);
        //jCon.css('margin-' + type, conO);

        curBarO = o;
        curConO = conO;
    }

    function moveByCon(o) {
        var isScroll;//true表示 可滚动

        if (o < -conMoveLen) o = -conMoveLen;
        if (o > 0) o = 0;

        var barO = -o / moveR;
        //jCon.css('margin-' + type, o);
        jBar.css('margin-' + type, barO);

        conAnime.start(o);

        isScroll = o !== curConO;

        curBarO = barO;
        curConO = o;

        return isScroll || type === 'left';
    }

    function barBoxClick() {

        jBarBox.mousedown(function (e) {
            var o;
            if ((type === 'left' ? e.pageX : e.pageY) < jBar.offset()[type]) {
                o = curConO + boxS;
            }
            else {
                o = curConO - boxS;
            }

            moveByCon(o);
            curConO = o;

            return false;
        });
    }

    function mouseWheel() {
        core.mouseWheel(jBox[0], function (e) {
            var pre, o = curConO, to = boxS / 4,
                isScroll;
            if (e.wheelDelta) //前120 ，后-120
                pre = e.wheelDelta > 0;
            else //firefox
                pre = e.detail < 0;

            if (pre) {
                //*往上滚
                o += to;
            } else {
                //*往下滚
                o -= to;
            }

            isScroll = moveByCon(o);

            //阻止滚动条滚动
            if (e.cancelable && isScroll) e.preventDefault();
            return !isScroll;
        });
    }

    ///
    drag = new drag();
    conDrag();

    this.update = update;
    this.moveByCon = moveByCon;
    this.getCurConO = function () { return curConO; };

    barBoxClick();
    mouseWheel();
};
//#endregion

//#region 收藏关注

common.collectModule = function (params) {

    function getItemHtml(d) {
        var url = config[d.index].url;

        if (typeof url === 'string') {
            url = url + d.id;
        }
        else {
            url = url(d);
        }

        return '<div class="i_b"><a href="' + url + '"><img src="' + d.thumb + '" /></a>'
                + '<div class="t"><a href="">' + d.name + '</a></div>'
                + '<b data-id="' + d.id + '" class="c"></b><div class="m"></div></div>';
    }

    //项删除绑定
    function itemDelBind(jItems) {
        jItems.each(function () {
            var jBtn = $(this).find('.c');

            jBtn.click(function () {

                common.confirm_v1({
                    title: '确定取消？',
                    describe: '',
                    onBtns: [function () {
                        request({
                            index: curIndex,
                            id: jBtn.attr('data-id'),
                            mode: 'del'
                        });

                        common.popWin_v1.close();
                    }, function () {
                        common.popWin_v1.close();
                    }],
                    closeBtnFn: function () { common.popWin_v1.close(); }
                });

            });
        });
    }

    function request(params) {

        var index = params.index,

            id = params.id,
            name = params.name,
            thumb = params.thumb,

            mode = params.mode === undefined ? 'add' : 'del',

            curConfig = config[index],

            delStart = curConfig.delCallBack.start,
            addStart = curConfig.addCallBack.start,

            curItem;

        if (mode === 'add') {

            display.show();

            tabHandle.changeItem(index);

            curItem = htmlHandle.add(params);

            if (addStart) addStart(params);
        }
        else {
            curItem = $('#' + getItemIdName(params));

            if (delStart) delStart(params);

        }

        curItem.addClass('loading');
        curConfig[mode]({
            id: id,
            name: name,
            thumb: thumb,
            complete: function (d) {
                curItem.removeClass('loading');
                if (mode === 'del') {
                    curConfig.delCallBack.complete(params, d);

                }
                else {
                    curConfig.addCallBack.complete(params, d);
                }

                if (d.status) {

                    if (mode === 'del') {
                        htmlHandle.del(params);
                    }
                }
                else {

                    if (mode === 'add') {
                        htmlHandle.del(params);
                    }
                }

                common.msg(d);
            }
        });
    }

    function dataIni(params) {

        var index = params.index,
            curConfig = config[index];

        if (curConfig.isIni === undefined) {
            curConfig.isIni = true;


            curConfig.dataIni({
                succeed: function (d) {
                    var html = '';
                    $.each(d, function (i, n) {
                        if ($('#' + curConfig.typeName + n.id).length === 0) {
                            params = n;
                            params.index = index;
                            htmlHandle.iniAdd(params);
                        }
                    });
                }
            });
        }


    }

    function go(jBtn, jImg) {

        var iniCss = jBtn.offset();

        iniCss.width = 50;
        iniCss.height = 50;
        iniCss.position = 'absolute';
        iniCss.top += 50;
        iniCss.zIndex = 9;

        jImg = jImg.clone().appendTo(bJq).css(iniCss);

        jImg.animate({
            left: 160,
            top: wJq.scrollTop() + wJq.height() - 100
        }, function () {
            jImg.remove();
        });
    }

    function display() {
        var isShow = false;

        function show() {
            ini.excu();

            if (isShow === false) {
                jMainBox.animate({ bottom: 0 }, { queue: false });
                jTit.animate({ top: -41 }, { queue: false });

                isShow = true;

                common.sideBox.change();
            }

            tabHandle.changeItem(config.defaultIndex);

        }

        function hide() {
            if (isShow) {

                jMainBox.animate({ bottom: -156 }, { queue: false });
                jTit.animate({ top: 0 }, { queue: false });

                isShow = false;

                common.sideBox.change();
            }
        }


        this.show = show;
        this.hide = hide;
        this.getStatus = function () { return isShow; };
    }

    function noCon(n) {
        var jNoCon,
            curConfig = config[curIndex];
        if (n) {

            if (curConfig.jNoCon) {
                curConfig.jNoCon.hide();
            }
        }
        else {

            jNoCon = $('#' + curConfig.typeName + 'NoCon');

            if (jNoCon.length === 0) {
                jNoCon = $('<div id="' + curConfig.typeName + 'NoCon" class="c_no">暂无</div>').prependTo(jTypeBoxs.eq(curIndex));

            }
            jNoCon.show();

            curConfig.jNoCon = jNoCon;
        }
    }

    function scrollBarHandle() {
        var
            jBox,
            jBarBox,
            jBar,
            jMove,
            sb,
            boxW,
            itemCount;
        function update() {
            itemCount = jMove.children().length;

            noCon(itemCount);
            resize();
        }

        function resize() {
            var conW = itemW * itemCount;

            boxW = wJq.width() - 166;
            jMove.width(conW);

            sb.update({
                boxS: boxW,
                conS: conW - 16,
                barBoxS: boxW
            });
        }

        function ini(params) {
            jBox = params.jBox;
            jMove = params.jMove;
            jBarBox = params.jBarBox;
            jBar = jBarBox.children();

            sb = new common.scrollBar({
                jBox: jBox,
                jCon: jMove,
                jBarBox: jBarBox,
                jBar: jBar,
                type: 'left'
            });

            wJq.resize(resize);

        }

        this.go = function () {
            sb.moveByCon(0);
        };


        this.update = update;
        this.ini = ini;
    }

    function ini() {
        var isIni = false;

        function getMainHtml() {
            var tabHtml = '',
                boxHtml = '';

            for (var i = 0, len = config.length; i < len; i++) {
                tabHtml += '<li class="css_arrow r" data-index="' + i + '">' + config[i].tabName + '</li>';
                boxHtml += '<div id="collectBox_' + i + '" style="display:none;"><ul></ul><div class="sb"><b></b></div></div>';
                config[i].sb = new scrollBarHandle();
            }

            return '<div class="collect_box"><b class="r_c"></b>\
                        <div class="tit">我的收藏</div>\
                        <div class="layout1">\
                            <div class="ly_l">\
                                <ul>' + tabHtml + '</ul>\
                            </div>\
                            <div class="ly_bd">' + boxHtml + '</div>\
                        </div>\
                    </div>';
        }

        function excu() {
            if (isIni) return;
            isIni = true;

            jMainBox = $(getMainHtml()).appendTo(bJq).css({ bottom: -155 });
            jTypeBoxs = jMainBox.find('.ly_bd').children();
            jTypeUls = jTypeBoxs.children('ul');
            jTit = jMainBox.children('.tit');

            for (var i = 0, len = config.length; i < len; i++) {

                config[i].sb = new scrollBarHandle();

                config[i].sb.ini({
                    jBox: jTypeBoxs.eq(i),
                    jBarBox: jTypeBoxs.eq(i).children('.sb'),
                    jMove: jTypeUls.eq(i)
                });
            }

            jMainBox.find('.r_c').click(display.hide);

            tabHandle = new tabHandle();
        }

        this.excu = excu;
    }

    function tabHandle() {
        var jBtns = jMainBox.find('.ly_l li');

        function changeItem(index) {

            if (index === curIndex) return;
            jBtns.eq(curIndex).removeClass('active');
            jBtns.eq(index).addClass('active');
            jTypeBoxs.eq(curIndex).hide();
            jTypeBoxs.eq(index).show();
            dataIni({ index: index });
            curIndex = index;
        }

        jBtns.click(function () {
            changeItem(parseInt($(this).attr('data-index')));

        });
        this.changeItem = changeItem;
    }

    function getItemIdName(params) {
        var
            index = params.index,
            id = params.id;

        return config[index].typeName + id;
    }

    function htmlHandle() {

        function add(params) {
            var
                index = params.index,

                id = params.id,
                name = params.name,
                thumb = params.thumb,
                curItem = $('<li id="' + getItemIdName(params) + '"></li>').prependTo(jTypeUls.eq(index)).width(0);

            curItem.animate({ width: itemW }, function () {

                curItem.html(getItemHtml({
                    index: index,
                    id: id,
                    name: name,
                    thumb: thumb
                })).children().hide().fadeIn();

                itemDelBind(curItem);

            });

            config[index].sb.update();
            config[index].sb.go();

            return curItem;
        }

        function del(params) {

            var curItem = $('#' + getItemIdName(params));

            curItem.animate({ width: 0 }, 200, function () {
                curItem.remove();
                config[params.index].sb.update();
            });
        }

        function iniAdd(params) {
            var
                index = params.index,

                id = params.id,
                name = params.name,
                thumb = params.thumb,

                curItem = $('<li id="' + getItemIdName(params) + '"></li>').html(getItemHtml({
                    index: index,
                    id: id,
                    name: name,
                    thumb: thumb
                }));

            jTypeUls.eq(index).append(curItem);
            itemDelBind(curItem);
            config[params.index].sb.update();
        }

        this.add = add;
        this.iniAdd = iniAdd;
        this.del = del;
    }

    this.collectBtn = function (params) {
        var
            jBtn = params.jBtn,
            jImg = params.jImg,
            type = params.type;

        jBtn.click(function () {
            var data;

            if (CONFIG.member === undefined) {
                common.popLogin({
                    onJsLoaded: function (d) {
                        location.href = d.returnUrl;
                    }
                }).show();
                return;
            }

            if (jBtn.hasClass('loading')) return;

            jBtn.addClass('loading');

            data = jBtn.attr('data-d').split(',');

            if (jBtn.hasClass('fin')) {
                request({
                    mode: 'del',
                    index: type,
                    id: data[0]
                });
            }
            else {
                //动画
                go(jBtn, jImg);

                request({

                    index: type,
                    id: data[0],
                    name: decodeURIComponent(data[1]),
                    thumb: jImg[0].src
                });

            }
        });
    };

    var
        itemW = 116,

        config = params,

        curIndex,

        jMainBox,
        jTit,
        jTypeBoxs,
        jTypeUls;

    ini = new ini();
    display = new display();
    htmlHandle = new htmlHandle();

    this.request = request;
    this.go = go;
    this.getStatus = display.getStatus;
    this.show = display.show;
    this.hide = display.hide;

};

//#endregion

//#region 整站搜索
/*
/enterprise/company/list/keyword/asd
/talent/search/graver/k/
/news/index.php?m=search&c=index&a=init&typeid=63&siteid=1&q=asdasd
/video/default/index/k/asdasd
*/
common.search = function () {
    var jBox = $('.h_search'),
        jGo = $('.h_b', jBox),
        jIn = $('.h_t', jBox),
        jTabs = $('li', jBox),
        jCurTab = jTabs.eq(0),
        tabs = (function () {
            var obj = {};

            jTabs.each(function () {
                var jThis = $(this);
                obj[$(this).attr('data-type')] = $(this);
            });

            return obj;
        })();



    function go() {
        var url,
            val = $.trim(jIn.val());

        switch (jCurTab.attr('data-type')) {

            case 'e':
                url = '/enterprise/company/list/keyword/';
                break;
            case 't':
                url = '/talent/search/graver/k/';
                break;
            case 'n':
                url = '/news/search/index?m=search&c=index&a=init&type=1&siteid=1&q=';
                break;
            case 'v':
                url = '/video/default/index/k/';

                break;
        }

        if (val) location.href = url + val;
    }

    function change(jTab) {
        jCurTab.removeClass('active');
        jCurTab = jTab.addClass('active');

    }

    function ini() {
        var
            isEnterprise = core.determinePage('enterprise/company/list/keyword'),
            isTalent = core.determinePage('talent/search/graver/k'),
            isVideo = core.determinePage('video/default/index/k'),
            isNews = location.href.indexOf('news/search/index?m=search') > -1,
            v,
            jNowTab;

        if (isEnterprise) {
            v = location.pathname.match(/\/keyword\/([^\/]*)/);
            jNowTab = tabs.e;
        }
        else if (isTalent || isVideo) {
            v = location.pathname.match(/\/k\/([^\/]*)/);
            if (isTalent) jNowTab = tabs.t;
            else jNowTab = tabs.v;
        }
        else if (isNews) {
            v = location.href.match(/q=([^&]*)/);

            jNowTab = tabs.n;
        }


        if (v) jIn.val(decodeURIComponent(v[1]));

        if (jNowTab) {

            jCurTab.removeClass('active');

            jCurTab = jNowTab.addClass('active');

        }
    }

    jTabs.click(function () {
        change($(this));

    });

    jGo.click(go);

    jIn.ENTER(go);

    ini();
};


//#endregion

//#region 评论
common.comment = function (jCommentBox) {
    if (jCommentBox.length === 0) return;

    function ini() {
        var isIni;

        function getHtml(d) {

            isGuest = d.id_user ? false : true;

            return '<div class="tit">评论(<b>' + d.count_participant + '</b>人参与，<b>' + d.count_item + '</b>条评论)</div>\
    <div class="in_box">\
        <div class="u_info">\
            <a href="javascript:;" class="s a_type3" title="换名字?"></a>\
        </div>\
        <div class="ava"><img alt="' + d.name_user + '" src="' + d.avatar + '"/></div>\
        <div class="r_m">\
            <div class="in">\
                <div class="in_t"><textarea placeholder="来说两句吧..."></textarea></div>\
                <div class="ope">\
                    <a href="javascript:;" class="ex"></a>\
                    <a href="javascript:;" class="i hide"></a>\
                    <input class="to" type="button" value="发&nbsp;布"/>\
                </div>\
            </div>\
            <div class="log_w' + (d.id_user ? ' hide' : '') + '">\
                <a href="javascript:;" class="l">新石器登录</a>'
                //<a target="_blank" href="https://graph.qq.com/oauth2.0/authorize?client_id=100554394&redirect_uri='+encodeURI('http://www.newshiqi.com/member/account/qqLogin')+'&response_type=code&state=d3d9446802a44259755d38e6d163e820" class="qq">QQ 登录</a>\
                + '<a href="javascript:;" class="g">游客登录</a>\
            </div>\
        </div>\
    </div>\
    <div class="c_tit">最新评论</div>\
    <div class="con_box"></div>';
        }

        function excu(d) {

            if (isIni === undefined) {
                isIni = true;

                jCommentBox.show().removeClass('loading').html(getHtml(d));

                domIni();

                releaseIni = new releaseIni();

                guestHandle = new guestHandle();

                localLogo({
                    jMain: $('.popup_login.local'),
                    jLogoBox: jCommentBox.find('.log_w')

                });
            }
        }

        function err(d) {
            //$('<a href="javascript:;">点击重试</a>').appendTo(jCommentBox.removeClass('loading').html(''))
            //    .on('click', function () {
            //        getData.excu(1);
            //    });
            //if (d.data.enabled===false) {
            //    //评论关闭情况
            //}
            jCommentBox.remove();
        }

        function domIni() {
            jConBox = jCommentBox.find('.con_box');
        }

        this.excu = excu;
        this.err = err;
    }

    function getData() {
        var curPage, xhr,
            firstData,
            curData;
        function excu(params) {
            var page, succeed, isRoll;
            if (typeof params === 'object') {
                page = params.page;
                succeed = params.succeed === undefined ? function () { } : params.succeed;
                isRoll = params.isRoll === undefined ? true : params.isRoll;
            }
            else {
                page = params;
                succeed = function () { };
                isRoll = true;
            }


            pageLoad.show();
            if (xhr) xhr.abort();
            xhr = $.get('/comment/default/view', {
                type_module: curPagams.type_module,
                id_reference: curPagams.id_reference,
                page: page
            }, function (d) {
                var data;
                if (d.status) {

                    curPage = page;

                    data = d.data;

                    if (page == 1) firstData = data;
                    curData = data;

                    ini.excu(data);

                    conHtmlCreate.excu(data);
                    pageHandle.excu(data);

                    if (data.count_item == 0) {
                        jCommentBox.addClass('no_con');
                        jConBox.html('还没有评论，快来抢沙发吧!!');
                    }

                    itemFn.ini();

                    goTop.go(isRoll);

                    curPagams.id_user = data.id_user;

                    succeed(data);
                }
                else {
                    ini.err(d);
                }

            }, 'json');
        }

        this.excu = excu;
        this.getPage = function () { return curPage; };
        this.setPage = function (page) { curPage = page; };
        this.getFirst = function () { return firstData; };
        this.getCurData = function () { return curData; };
    }

    function conHtmlCreate() {

        function boxHtml(itemData, listUser, html, relationship) {

            var userData = listUser[itemData.id_author],
                isG = itemData.id_author == 0,
                username = (isG ? itemData.name_author + '【游客】' : userData.username),
                attrData = ' data-d="{id:\'' + itemData.id_author + '\',username:\'' + encodeURIComponent(username) + '\',avatar:\'' + encodeURIComponent(userData.avatar) + '\'}"';

            relationship = relationship.substr(1);

            return '<div class="c_item">\
            <div class="i_ava"><a href="javascript:;"'+ attrData + '><img alt="' + username + '" src="' + userData.avatar + '"/></a></div>\
            <div class="r_con">\
                <div class="info"><a href="javascript:;"'+ attrData + '><span class="name">' + username + '</span></a><span class="addr hide">[广东省广州市网友]</span></div>' + html + '\
                <div class="text">' + expression.convert(itemData.content) + '</div>\
                <span class="time">' + itemData.time_created + ' 发表</span>\
                <div class="oper">\
                    <div class="fr">\
                        <a href="javascript:;" class="su' + (itemData.count_like > 0 ? ' active' : '') + '" data-d="{id:\'' + relationship.match(/[\d]+$/) + '\'}">' + itemData.count_like + '</a>\
                        <a href="javascript:;" class="op" style="display:none;"></a>\
                        <a href="javascript:;" class="re" data-d="{id_receiver:\'' + itemData.id_author + '\',relationship:\'' + relationship + '\'}">回复</a>\
                        <a href="javascript:;" class="sh" style="display:none;">分享</a>\
                    </div>\
                </div>\
            </div>\
        </div>';
        }

        function itemHtml(itemData, userData, html, floorNum, relationship) {
            var isG = itemData.id_author == 0,
                username = (isG ? itemData.name_author + '【游客】' : userData.username),
                attrData = ' data-d="{id:\'' + itemData.id_author + '\',username:\'' + encodeURIComponent(username) + '\',avatar:\'' + encodeURIComponent(userData.avatar) + '\'}"';
            relationship = relationship.substr(1);

            return '<div class="box">' + html + '<div class="con">\
                    <div class="info"><a href="javascript:;"'+ attrData + '><span class="name">' + username + '</span></a><span class="num">' + floorNum + '</span><span class="addr hide">[广东省广州市网友]</span></div>\
                    <div class="text">' + expression.convert(itemData.content) + '</div>\
                </div>\
                <div class="oper">\
                    <div class="fr">\
                        <a href="javascript:;" class="su' + (itemData.count_like > 0 ? ' active' : '') + '" data-d="{id:\'' + relationship.match(/[\d]+$/) + '\'}">' + itemData.count_like + '</a>\
                        <a href="javascript:;" class="op" style="display:none;"></a>\
                        <a href="javascript:;" class="re" data-d="{id_receiver:\'' + itemData.id_author + '\',relationship:\'' + relationship + '\'}">回复</a>\
                        <a href="javascript:;" class="sh" style="display:none;">分享</a>\
                    </div>\
                </div></div>';

        }

        function excu(d) {
            var
                listItem = d.list_item,
                listRel = d.list_rel,
                listUser = d.list_user,
                html = '';

            $.each(listRel, function (i, n) {

                var h = '', floorNum = 0, relationship = '', firstId = n[0];
                for (var j = 1, len = n.length, itemData, userData, id; j < len; j++) {

                    id = n[j];//评论id
                    itemData = listItem[id];

                    if (itemData) {
                        userData = listUser[itemData.id_author];

                        relationship = relationship + ',' + id;

                        floorNum++;

                        h = itemHtml(itemData, userData, h, floorNum, relationship);
                    }
                }

                relationship = relationship + ',' + firstId;

                html += boxHtml(listItem[firstId], listUser, h, relationship);
            });

            replyInHandle.hide();

            jConBox.html(html);
        }

        this.excu = excu;
    }

    function pageHandle() {
        function excu(data) {

            var jPageBox = $('<div class="page2"></div>').appendTo(jConBox);

            common.pager.callCommon_v3(jPageBox, {
                page: getData.getPage(),
                pageSize: pageSize,
                total: data.count_item
            }, getData.excu);
        }

        this.excu = excu;
    }

    //翻页\初始 加载
    function pageLoad() {

        function show() {
            var jLoad;
            if (jConBox) {
                jLoad = $('<div class="pinterest_loading_top"></div>').prependTo(jConBox);
                if (wJq.scrollTop() > 446) $('<div class="bottom_loading loading"><span>loading...</span></div>').appendTo(jConBox);
                jLoad.show();
            }
        }

        this.show = show;
    }

    //评论\回复 
    function commentCreat() {

        /*
        {
        relationship:'2,3,4'//楼
        id_receiver:'2227'//评论的人的id
        content:'',
        complete:,
        succeed:
        }
        */
        function to(params) {
            var
                //curPagams
                type_module = curPagams.type_module,
                id_reference = curPagams.id_reference,
                relationship = params.relationship === undefined ? '' : params.relationship,
                id_receiver = params.id_receiver === undefined ? '' : params.id_receiver,
                content = params.content,
                complete = params.complete,
                succeed = params.succeed,

                toParams = {
                    'Comment[type_module]': type_module,
                    'Comment[id_reference]': id_reference,//页面
                    'Comment[relationship]': relationship,//楼
                    'Comment[id_receiver]': id_receiver === null ? 0 : id_receiver,//评论的人
                    'Comment[content]': content
                };

            if (isGuest) toParams.name_author = this.guestName;

            /*
            {
                'Comment[type_module]': 'v',
                'Comment[id_reference]': '',//页面
                'Comment[relationship]': '2,3,4',//楼
                'Comment[id_receiver]': '',//评论的人
                'Comment[content]': '',
            }
            */

            $.post('/comment/default/create', toParams, function (d) {

                complete();
                if (d.status) {
                    jCommentBox.removeClass('no_con');
                    common.msg({
                        status: true,
                        msg: '评论成功'
                    });
                    toParams.id = d.data.id_item;
                    succeed(toParams);
                }
                else {
                    common.msg(d);
                }

            }, 'json');
        }

        function reply() {

        }

        /*
        id,
        content,
        rel
        */
        function firstDataUpdate(d) {

            function setFirstByCur() {
                if (getData.getPage() == 1) return;
                var curData = getData.getCurData(),
                    list_item = curData.list_item,
                    list_user = curData.list_user,
                        _item;
                for (var i = 1, len = rel.length; i < len; i++) {
                    _item = list_item[rel[i]];

                    firstData.list_item[rel[i]] = _item;
                    firstData.list_user[_item.id_author] = list_user[_item.id_author];
                }
            }

            var
                page = getData.getPage(),
                firstData = getData.getFirst(),

                id = d.id,//评论id
                content = d.content,
                id_user = firstData.id_user,
                rel = d.rel === undefined ? [id] : (id + ',' + d.rel).split(',');

            firstData.list_item[id] = {
                id_author: id_user,
                content: content,
                count_like: '0',
                time_created: '刚刚'
            };
            if (isGuest) firstData.list_item[id].name_author = this.guestName;

            firstData.list_user[id_user] = {
                avatar: firstData.avatar,
                username: firstData.name_user
            };

            //list_rel 处理
            setFirstByCur();
            firstData.list_rel.unshift(rel);
            if (firstData.list_rel.length > pageSize) firstData.list_rel.length = pageSize;

            firstData.count_item = firstData.count_item * 1 + 1;
            getData.setPage(1);
            conHtmlCreate.excu(firstData);
            pageHandle.excu(firstData);
            itemFn.ini();

            goTop.go();
        }

        this.ini = ini;
        this.to = to;
        this.firstDataUpdate = firstDataUpdate;
        this.guestName;

        var that = this;
    }

    //发布功能
    function releaseIni() {

        function expIni() {
            var jInBox = jToBox.find('.in'),
                jIn = jInBox.find('textarea'),
                jBtn = jInBox.find('.ex');

            expression.bind({
                jInBox: jInBox,
                jBtn: jBtn,
                jIn: jIn
            });

        }

        function release() {
            isLoading = true;
            jTo.addClass('loading');
            commentCreat.to({
                content: jIn.val(),
                complete: function () {
                    isLoading = false;
                    jTo.removeClass('loading');
                },
                succeed: function (d) {
                    jIn.val('');
                    commentCreat.firstDataUpdate({
                        id: d.id,
                        content: d['Comment[content]']
                    });
                }
            });
        }

        var jToBox = jCommentBox.children('.in_box'),
               jIn = jToBox.find('.in_t textarea'),
               jTo = jToBox.find('.to'),
                   isLoading = false;

        jTo.on('click', function () {
            if (isLoading) return;
            var content = jIn.val();
            if ($.trim(content) === '') {
                common.msg({ msg: '不能为空' });
                jIn.focus();
            }
            else {

                if (guestHandle.to() === false) return;

                release();
            }
        });

        expIni();

        this.release = release;
        this.getJToBox = function () { return jToBox; };
    }

    //回复功能
    function replyInHandle() {
        function release() {
            isLoading = true;
            jTo.addClass('loading');

            /*
            {
            relationship:'2,3,4'//楼
            id_receiver:'2227'//评论的人的id
            content:'',
            complete:,
            succeed:
            }
            */
            commentCreat.to({
                id_receiver: postParams.id_receiver,
                relationship: postParams.relationship,
                content: jIn.val(),
                complete: function () {
                    isLoading = false;
                    jTo.removeClass('loading');
                },
                succeed: function (d) {
                    jIn.val('');
                    commentCreat.firstDataUpdate({
                        id: d.id,
                        content: d['Comment[content]'],
                        rel: postParams.relationship
                    });
                }
            });
        }

        var jInBox = $('<div class="in">\
            <div class="in_t"><textarea placeholder="来说两句吧..."></textarea></div>\
            <div class="ope">\
            <a href="javascript:;" class="ex"></a>\
            <a href="javascript:;" class="i hide"></a>\
            <input class="to" type="button" value="发&nbsp;布">\
            </div>\
            </div>'),
            jTo = jInBox.find('.to'),
            jIn = jInBox.find('textarea'),
            isLoading = false,
            postParams;

        jTo.click(function () {

            if (isLoading) return;
            var content = jIn.val();
            if ($.trim(content) === '') {
                common.msg({ msg: '不能为空' });
                jIn.focus();
            }
            else {

                if (guestHandle.to(1) === false) return;

                release();
            }
        });

        expression.bind({
            jInBox: jInBox,
            jBtn: jInBox.find('.ex'),
            jIn: jIn
        });

        this.getBoxDom = function () { return jInBox; };
        this.setParams = function (v) { postParams = v; };
        this.hide = function () {
            jCommentBox.append(jInBox.hide());
        };
        this.release = release;
    }

    //每项评论 的其它功能
    function itemFn() {

        function itemInifn(jBox, jOper) {

            jBox.on({
                mouseover: function () {
                    jOper.css({ visibility: 'visible ' });

                    return false;
                },
                mouseout: function () {
                    jOper.css({ visibility: 'hidden ' });

                    return false;
                }
            });

            operFn(jOper);

        }

        function commentExamine() {

            function getHtml() {

                return '<div class="popup_comment">\
    <div class="top">\
        <div class="ava">\
            <img src="' + decodeURIComponent(toData.avatar) + '" alt="' + decodeURIComponent(toData.username) + '">\
        </div>\
        <div class="name">' + decodeURIComponent(toData.username) + '</div>\
        <div class="r">\
            <div class="num_b f">\
                <div class="num">0</div>\
                <div class="n">评论</div>\
            </div>\
            <div class="num_b">\
                <div class="num">0</div>\
                <div class="n">回复</div>\
            </div>\
        </div>\
        <b class="c_btn"></b>\
    </div>\
    <div class="ma">\
        <div class="c_tab">\
            <ul>\
                <li class="active">发出评论</li>\
                <li>收到的回复</li>\
            </ul>\
        </div>\
        <div class="con_show c_b">\
            <ul></ul>\
        </div>\
        <div class="con_show r_b hide">\
            <ul></ul>\
        </div>\
    </div>\
    <div class="bo"></div>\
</div>';
            }

            function getItemTo(d) {

                return '<li><div class="con">' + d.content + '</div><div class="des">' + d.time_created + '</div></li>';
            }
            function getItemReceive(re, to, list_user) {
                var
                    tUser = to && list_user[to.id_author],
                    rUser = list_user[re.id_author];


                if (to && to.id_author == 0) {
                    tUser.username = to.name_author;
                }
                if (re.id_author == 0) {
                    rUser.username = re.name_author;
                }

                return '<li><div class="ava"><img src="' + rUser.avatar + '"></div><div class="r_m"><div class="n">' + rUser.username + '</div><div class="con">' + re.content + '</div>' + (to ? '<div class="des"><div class="d1">回复我的评论“' + to.content + '”</div><div class="d2 hide">来自</div></div>' : '') + '</div></li>';
            }

            function getDataTo(page, succeed) {


                if (toIsLoading) return;
                toIsLoading = true;
                $.get('/comment/default/sentcomment/page/' + page + '/id_author/' + toData.id, function (d) {

                    var data, html;

                    toIsLoading = false;

                    if (d.status) {



                        toPage = page;

                        data = d.data;

                        jNum.eq(0).html(data.count_item);

                        html = '';
                        $.each(data.list_item, function (i, n) {
                            html += getItemTo(n);
                        });

                        jToConBox.append(html);
                    }
                    else {
                        common.msg(d);
                    }

                    if (succeed) succeed(d);

                }, 'json');
            }

            function getDataReceive(page, succeed) {
                if (receiveIsLoading) return;
                receiveIsLoading = true;
                $.get('/comment/default/receivedcomment/page/' + page, function (d) {
                    var list_rel,
                        list_item,
                        html;

                    receiveIsLoading = false;
                    receivePage = page;

                    if (d.status) {
                        jNum.eq(1).html(d.data.count_item);

                        list_rel = d.data.list_rel;
                        list_item = d.data.list_item;
                        html = '';

                        $.each(d.data.list_rel, function (i, n) {
                            var re = list_item[n[0]];
                            if (re) html += getItemReceive(list_item[n[0]], list_item[n[1]], d.data.list_user);
                        });
                        jReceiveConBox.append(html);

                    }

                    if (succeed) succeed(d);
                }, 'json');
            }

            function ini() {

                if (toData.id != curPagams.id_user) {
                    jTabs.eq(0).removeClass('active').addClass('only');
                    jTabs.eq(1).remove();
                }
                else {
                    tabFn();
                }

                getDataTo(1);
                receiveIni();
            }
            function receiveIni() {
                if (receiveIsIni) return;
                receiveIsIni = true;
                getDataReceive(1);
            }

            function tabFn() {
                var curIndex = 0;
                jTabs.click(function () {
                    var index = jTabs.index(this);

                    if (index === curIndex) return;
                    jTabs.eq(curIndex).removeClass('active');
                    jTabs.eq(index).addClass('active');

                    jConShow.eq(curIndex).hide();
                    jConShow.eq(index).show();

                    //if (index) receiveIni();

                    curIndex = index;
                });
            }

            function pop() {
                if (toData.id == 0) {
                    common.msg({
                        msg: '游客评论无法查看'
                    });
                    return;
                }

                var jTop;

                jPopBox = $(getHtml()).appendTo(bJq);

                jConShow = jPopBox.find('.con_show'),
                jToConBox = jConShow.eq(0).children(),
                jReceiveConBox = jConShow.eq(1).children(),
                jTabs = jPopBox.find('.c_tab li');

                jTop = jPopBox.children('.top');
                jNum = jTop.find('.num');

                closeFn();

                ini();

                scrollGet();

                dragHandle = new common.dragWin({
                    jBindElem: jTop,
                    jMoveElem: jPopBox,
                    //minY: 40,
                    bindElemWidth: 500,
                    bindElemHeight: 114
                });

                centerHandle = new center();
            }

            function scrollGet() {
                var boxH = 338;
                jConShow.each(function (i) {

                    function off(page, d) {

                        if (d.status === false || page * 10 >= d.data.count_item) {
                            jThis.off('scroll', scrollFn);

                        }
                    }

                    function scrollFn() {
                        if (jThis.scrollTop() - jCon.height() + boxH > -100) {
                            if (i) {
                                getDataReceive(receivePage + 1, function (d) { off(receivePage, d); });
                            }
                            else {
                                getDataTo(toPage + 1, function (d) { off(toPage, d); });
                            }
                        }
                    }

                    var jThis = $(this),
                        jCon = jThis.children();

                    jThis.on({ scroll: scrollFn });

                });
            }

            function closeFn() {

                function close() {
                    centerHandle.off();
                    jPopBox.add(jMask).remove();
                }
                var jMask;

                jMask = $('<div class="mask"></div>').insertBefore(jPopBox).click(close);

                jPopBox.find('.top .c_btn').click(function () {
                    if (dragHandle.getStatus()) return;
                    dragHandle.stop();
                    close();
                });

                jPopBox.ESC(function () {
                    dragHandle.stop();
                    close();
                });

                jPopBox.focus();
            }

            function center() {
                var xy;
                function update() {
                    var
                        w = 500,
                        h = 487,
                        width = wJq.width(),
                        height = wJq.height(),

                        x = (width - w) / 2, y = (height - h) / 3;

                    if (x < 0) x = 0;
                    if (y < 40) y = 40;

                    xy = {
                        left: x,
                        top: y
                    };

                    jPopBox.css(xy);

                    dragHandle.stop();
                }

                wJq.on('resize', update);

                this.off = function () {
                    wJq.off('resize', update);
                };

                this.getXY = function () {
                    return xy;
                };

                update();
            }

            this.bind = function (jBox) {

                jBox.find('.i_ava a,.info a').click(function () {
                    toData = eval('(' + $(this).attr('data-d') + ')');
                    receiveIsIni = false;
                    pop();
                });
            };

            var jPopBox,
                jToConBox,
                jReceiveConBox,
                jTabs,
                jNum,

                centerHandle,
                dragHandle,

                receiveIsIni = false,

                toData,

                toPage,
                receivePage,
                toIsLoading = false,
                receiveIsLoading = false;
        }

        //操作区
        function operFn(jOper) {

            //回复
            replyBtn(jOper);

            praise(jOper);
        }

        //回复
        function replyBtn(jOper) {
            var jBtn = jOper.find('.re'), has = false, isShow = false;

            jBtn.click(function () {
                var _jInBox = jOper.next('.in');

                if (_jInBox.length) {
                    if (_jInBox.css('display') === 'none') {
                        jInBox.show();
                    }
                    else {
                        jInBox.hide();
                    }
                }
                else {
                    jOper.after(jInBox.show());
                }
                replyInHandle.setParams(eval('(' + $(this).attr('data-d') + ')'));
            });
        }

        //赞
        function praise(jOper) {
            var jBtn = jOper.find('.su'),
                id = eval('(' + jBtn.attr('data-d') + ')').id,
                isLoading = false,
                    isTrue = false;

            function succeed() {
                var _temp, _v;

                _temp = getData.getCurData().list_item[id];

                jBtn.html(_temp.count_like = _temp.count_like * 1 + 1);
            }

            jBtn.click(function () {
                if (isTrue) {
                    common.msg({ msg: '您已经赞过了..' });
                    return;
                }
                if (isLoading) {
                    common.msg({ msg: '卖力处理中..' });
                    return;
                }
                isLoading = true;
                $.post('/comment/default/like', { id: id }, function (d) {
                    isLoading = false;
                    if (d.status) {

                        isTrue = true;
                        succeed();
                        jBtn.addClass('active');
                    }
                    else {
                        common.msg(d);
                    }
                }, 'json');
            });
        }

        function ini() {
            jConBox.children('.c_item').each(function () {

                var jThis = $(this);

                operFn(jThis.children('.r_con').children('.oper'));

                jThis.find('.box').each(function () {
                    var jThis = $(this),
                        jOper = jThis.children('.oper');

                    itemInifn(jThis, jOper);
                });

                commentExamine.bind(jThis);
            });

        }

        ///
        var jInBox = replyInHandle.getBoxDom(),
            commentExamine = new commentExamine();

        this.ini = ini;
    }

    //表情
    function expression() {
        function domCreateIni() {
            var html = '<div class="expression_box"><ul>';

            $.each(data, function (k, v) {
                html += '<li><img src="' + v + '" alt="' + k + '" title="' + k + '"></li>';
            });

            html += '</ul></div>';

            jExpressionBox = $(html);
        }

        function bind(params) {
            var jInBox = params.jInBox,
                jBtn = params.jBtn,
                jIn = params.jIn;

            jBtn.on({
                'click': function () {
                    ini.excu();
                    jCurIn = jIn;
                    if (this === curShowBtn) {
                        if (isShow) {
                            hide();
                        }
                        else {
                            $(this).addClass('active');
                            jExpressionBox.appendTo(jInBox).show();
                            isShow = true;
                        }
                    }
                    else {
                        $(curShowBtn).removeClass('active');
                        $(this).addClass('active');
                        jExpressionBox.appendTo(jInBox).show();
                        isShow = true;
                    }
                    curShowBtn = this;

                }
            });

            focusHandle(jBtn);

            if (core.isIE6789) jIn.data('input_ie', new input_ie(jIn));
        }

        function hide() {
            if (isShow === false) return;
            $(curShowBtn).removeClass('active');
            curShowBtn = undefined;
            isShow = false;
            jExpressionBox.hide().appendTo(bJq);

            bJq.off('click', hide);
        }

        function focusHandle(jElem) {
            jElem.hover(function () {
                bJq.off('click', hide);
            }, function () {
                bJq.on('click', hide);
            });

        }

        function expSel() {

            jExpressionBox.on({
                'click': function (e) {
                    var elem, jElem, eName, eIn;

                    jElem = $(e.target).closest('li');

                    if (jElem.length) {

                        elem = jElem[0];

                        eName = '[' + elem.children[0].title + ']';

                        eIn = jCurIn[0];

                        if (core.isIE6789) {
                            var r = jCurIn.data('input_ie').getRange();

                            r.text = eName;

                            r.select();
                        }
                        else { //高级浏览器
                            var v = eIn.value,
                                curStart = eIn.selectionStart;

                            eIn.value = v.substring(0, eIn.selectionStart) + eName + v.substring(eIn.selectionEnd, v.length);

                            eIn.selectionStart = eIn.selectionEnd = curStart + eName.length;

                            eIn.focus();
                        }

                        hide();
                    }
                }
            });

        }

        function convert(str) {
            var arr = str.match(/\[[^\[\]]+\]/g);

            if (arr) $.each(arr, function (i, n) {
                var v = n.replace(/[\[\]]/g, '');
                str = str.replace(n, '<img alt="' + v + '" title="' + v + '" src="' + data[v] + '"/>');
            });
            return str;
        }

        function input_ie(jIn) {
            var range;

            function saveRange() {
                range = document.selection.createRange();
            }

            jIn.mouseup(saveRange).keyup(saveRange);

            this.getRange = function () {
                if (range === undefined) {
                    jIn.focus();
                    saveRange();
                }
                return range;
            };
        }

        function ini() {
            var isIni = false;

            this.excu = function () {
                if (isIni) return;
                isIni = true;
                domCreateIni();
                focusHandle(jExpressionBox);
                expSel();
            };
        }

        var curShowBtn,
            jCurIn,
            jExpressionBox,
            isShow = false,//表情窗口 是否显示
            data = {
                '微笑': '/images/expression/1.gif',
                '撇嘴': '/images/expression/2.gif',
                '色': '/images/expression/3.gif',
                '流泪': '/images/expression/4.gif',
                '尴尬': '/images/expression/5.gif',
                '发怒': '/images/expression/6.gif',
                '呲牙': '/images/expression/7.gif',
                '抓狂': '/images/expression/8.gif',
                '偷笑': '/images/expression/9.gif',
                '惊恐': '/images/expression/10.gif',
                '流汗': '/images/expression/11.gif',
                '奋斗': '/images/expression/12.gif',
                '咒骂': '/images/expression/13.gif',
                '疑问': '/images/expression/14.gif',
                '敲打': '/images/expression/15.gif',
                '再见': '/images/expression/16.gif',
                '擦汗': '/images/expression/17.gif',
                '玫瑰': '/images/expression/18.gif',
                '凋谢': '/images/expression/19.gif',
                '示爱': '/images/expression/20.gif',
                '爱心': '/images/expression/21.gif',
                '心碎': '/images/expression/22.gif',
                '拥抱': '/images/expression/23.gif',
                '强': '/images/expression/24.gif',
                '弱': '/images/expression/25.gif',
                '握手': '/images/expression/26.gif',
                '胜利': '/images/expression/27.gif',
                '抱拳': '/images/expression/28.gif'
            };


        this.bind = bind;
        this.hide = hide;
        this.convert = convert;

        ini = new ini();
    }

    function goTop() {
        var isFirsh = true,
            jElem;

        function go(isRoll) {

            if (isFirsh || isRoll === false) {
                isFirsh = false;
                return;
            }
            if (jElem === undefined) jElem = jCommentBox.children('.c_tit');
            wJq.scrollRun(jElem.offset().top - 40);
        }

        this.go = go;
    }

    function popHandle(params) {
        function showHide() {
            function close() {
                if (isShow === false) return;
                isShow = false;
                jMain.fadeOut();
                closeCallBack();
                jMask.remove();
            }

            function show() {
                if (isShow) return;
                isShow = true;

                jMain.fadeIn();

                positionHandle.update();

                showCallBack();

                jMask = $('<div class="mask"></div>').insertBefore(jMain).click(close);

                jMain.focus();
            }

            this.close = close;
            this.show = show;

            var isShow = false;
        }

        //居中
        function positionHandle() {

            function update() {
                var
                    boxHeight = jMain.height(),
                    width = winWH.width,
                    height = winWH.height;

                jMain.css({
                    left: (width - 402) / 2,
                    top: (height - boxHeight) / 2
                });
            }

            ///
            this.update = update;
            wJq.on({
                resize: update
            });
        }

        function ini() {
            jPopBtn.click(function () {
                showHide.show();
            });

            dragHandle = new common.dragWin({
                jBindElem: jMain.children('.top'),
                jMoveElem: jMain,
                //minY: 40,
                bindElemWidth: 400,
                bindElemHeight: 45
            });

            jMain.find('.top b').on({
                click: function () {
                    showHide.close();
                }
            });
        }

        var jMain = params.jMain,
            jPopBtn = params.jPopBtn,
            closeCallBack = params.closeCallBack === undefined ? function () { } : params.closeCallBack,
            showCallBack = params.showCallBack === undefined ? function () { } : params.showCallBack,

            jMask,

            showHide = new showHide(),
            positionHandle = new positionHandle();

        ini();

        jMain.ESC(function () {
            showHide.close();
        });

        this.close = showHide.close;
        this.show = showHide.show;

    }

    //游客 登录
    function guestHandle() {

        function checkNameAllow(params) {
            var
                onStart = params.onStart === undefined ? function () { } : params.onStart,
                 onSucceed = params.onSucceed === undefined ? function () { } : params.onSucceed,
                 onComplete = params.onComplete === undefined ? function () { } : params.onComplete;

            onStart();
            $.get('/comment/default/CheckNameAllow/name/' + params.name + '/code/' + params.code, function (d) {
                onComplete();
                if (d.status) {
                    onSucceed(d);
                }
                else {
                    common.msg(d);
                }
            }, 'json');
        }

        function fnBind() {

            function go() {
                var v = $.trim(jIn.val()),
                    vCode = $.trim(jInCode.val());

                if (v === '' || vCode === '') {
                    common.msg({ msg: '不能为空' });
                }
                else {

                    checkNameAllow({
                        name: v,
                        code: vCode,
                        onStart: function () {
                            jTo.addClass('loading');
                        },
                        onSucceed: function () {
                            commentCreat.guestName = v;

                            jGuestName.html(v);

                            nPopHandle.close();

                            jLogoBox.hide();

                            if (isGo) {
                                if (isReply) {
                                    replyInHandle.release();
                                }
                                else {
                                    releaseIni.release();
                                }
                            }
                        },
                        onComplete: function () {
                            jTo.removeClass('loading');
                        }
                    });


                }
            }

            var
                jClose = jMain.find('.top b'),
                jTo = jMain.find('.button'),
                jGuestName = jCommentBox.find('.u_info a');

            jClose.click(function () {
                if (dragHandle.getStatus()) return;
                nPopHandle.close();
            });

            jTo.click(go);

            jIn.add(jInCode).ENTER(go);

            jGuestName.click(function () {
                isGo = false;
                nPopHandle.show();
            });

            dragHandle = new common.dragWin({
                jBindElem: jMain.children('.top'),
                jMoveElem: jMain,
                minY: 40,
                bindElemWidth: 400,
                bindElemHeight: 45
            });
        }

        function getNameHandle() {
            var isLoading = false;

            this.excu = function () {
                if (isLoading) return;
                isLoading = true;
                $.get('/comment/default/getname', function (d) {
                    isLoading = false;
                    if (d.status) {
                        if ($.trim(jIn.val()) === '') {
                            jIn.val(d.data);
                        }
                    }
                }, 'json');
            };

        }

        //发布或回复 情况执行。如果是 游客 则弹窗 
        this.to = function (_isReply) {
            if (isGuest && (!commentCreat.guestName)) {
                isReply = _isReply;
                nPopHandle.show();
                isGo = true;
                return false;
            }

        };

        var
            jLogoBox = jCommentBox.find('.log_w'),
            jPopBtn = jLogoBox.children('.g'),
            jMain = $('.popup_login.guest'),
            jIn = jMain.find('.name'),
            jInCode = jMain.find('.code'),

            nPopHandle = new popHandle({
                jMain: jMain,
                jPopBtn: jPopBtn,
                closeCallBack: function () {

                },
                showCallBack: function () {

                    jIn.val('');

                    getName.excu();
                }
            }),

            isGo = false,
            isReply,//是发布 还是 回复。true 表示 回复
            dragHandle,

            getName = new getNameHandle();

        jPopBtn.click(function () {
            isGo = false;
        });

        fnBind();



        this.close = nPopHandle.close;
    }

    //新石器 登录
    function localLogo(params) {
        function commentHandle() {
            var jUserAva = releaseIni.getJToBox().find('.ava img');

            this.ini = function () {
                isGuest = false;

                getData.excu({
                    page: 1,
                    succeed: function (d) {
                        jUserAva.attr({
                            alt: d.name_user,
                            src: d.avatar
                        });
                    },
                    isRoll: false
                });
            };
        }
        var
            jMain = params.jMain,
            jLogoBox = params.jLogoBox;

        commentHandle = new commentHandle();

        common.popLoginBindBtn({
            jPopBtn: jLogoBox.children('.l'),
            onSucceed: function (d) {
                commentHandle.ini();

                jLogoBox.hide();
            }
        });
    }

    ///
    var jConBox,
        pageSize = 10,
        curPagams = eval('(' + jCommentBox.attr('data-d') + ')'),
        isGuest;

    (function () {
        var _v = location.href.match(/\/id\/([\d]+)/);

        if (_v === null) _v = location.href.match(/id=([\d]+)/);

        if (_v) curPagams.id_reference = _v[1];
    })();

    ini = new ini();

    expression = new expression();

    replyInHandle = new replyInHandle();

    getData = new getData();

    conHtmlCreate = new conHtmlCreate();

    pageHandle = new pageHandle();

    pageLoad = new pageLoad();

    commentCreat = new commentCreat();

    itemFn = new itemFn();

    goTop = new goTop();

    getData.excu(1);


};
//#endregion

//#region 加密
var Base64 = {

    // private property
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    // public method for encoding
    encode: function (input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;

        input = Base64._utf8_encode(input);

        while (i < input.length) {

            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }

            output = output +
                    this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
                    this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);

        }

        return output;
    },

    // public method for decoding
    decode: function (input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;

        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        while (i < input.length) {

            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output = output + String.fromCharCode(chr1);

            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }

        }

        output = Base64._utf8_decode(output);

        return output;

    },

    // private method for UTF-8 encoding
    _utf8_encode: function (string) {
        string = string.replace(/\r\n/g, "\n");
        var utftext = "";

        for (var n = 0; n < string.length; n++) {

            var c = string.charCodeAt(n);

            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }

        }

        return utftext;
    },

    // private method for UTF-8 decoding
    _utf8_decode: function (utftext) {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;

        while (i < utftext.length) {

            c = utftext.charCodeAt(i);

            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            }
            else if ((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i + 1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            }
            else {
                c2 = utftext.charCodeAt(i + 1);
                c3 = utftext.charCodeAt(i + 2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }

        }

        return string;
    }

}
//#endregion

//#region 登录\登出

//script 加载。 全部加载完后再执行
common.loadScriptAll = (function () {
    function addScript(src, callback) {

        var script = document.createElement('script');
        script.src = src;

        if ('onload' in script) {
            script.onload = function () {
                if (callback) callback();
            };
            script.onerror = function () {
                if (callback) callback();
            };
        }
        else {
            script.attachEvent("onreadystatechange", function () {

                if (script.readyState === "complete" || script.readyState === "loaded") {
                    if (callback) callback();
                }
            });
        }

        document.getElementsByTagName('head')[0].appendChild(script);

        return script;
    }

    return function (jScript, callback) {
        var i = 0;

        function excu() {

            var script = jScript[i];

            if (script === undefined) {
                callback();
                return;
            }

            addScript(jScript[i].src, function () {
                excu();
            });

            i++;
        }

        excu();
    };
})();

//登录
common.login = function (params) {

    var
        jName = params.jName,
        jPassword = params.jPassword,
        jRememberMe = params.jRememberMe,
        jGo = params.jGo,

        jHead = $('head'),

        onStart = params.onStart === undefined ? function () { } : params.onStart,
        onSucceed = params.onSucceed === undefined ? function () { } : params.onSucceed,
        onJsLoaded = params.onJsLoaded === undefined ? function () { } : params.onJsLoaded,
        onComplete = params.onComplete === undefined ? function () { } : params.onComplete,
        onFinish = params.onFinish === undefined ? function () { } : params.onFinish,
        onErr = params.onErr === undefined ? function () { } : params.onErr,
        xhr,
        isLoading = false;

    function finish() {
        isLoading = false;
        onFinish();
    }

    function go() {
        if (isLoading || jGo.hasClass('loading')) return;
        var name = jName.val(),
            password = jPassword.val();

        if (name === '') {
            common.msg({ msg: '用户名不能为空' });
            jName.focus();

            return;
        }
        else if (password === '') {
            common.msg({ msg: '密码不能为空' });
            jPassword.focus();
            return;
        }

        if (onStart() === false) return;

        isLoading = true;

        xhr = $.post('/member/account/login', {
            'LoginForm[username]': name,
            'LoginForm[password]': Base64.encode(password),
            'LoginForm[rememberMe]': jRememberMe.prop('checked') ? '1' : '0'
        }, function (d) {
            var loadScript;

            onComplete();

            if (d.status) {
                d.data.name = name;

                onSucceed(d.data);
                try {
                    common.loadScriptAll($(d.data.ucsynlogin), function () {
                        onJsLoaded(d.data);
                        finish();
                    });
                }
                catch (e) {
                    onJsLoaded(d.data);
                    finish();
                }

            }
            else {
                common.msg(d);
                onErr();
                finish();
            }

        }, 'json');
    }

    jGo.click(go);

    jName.add(jPassword).ENTER(go);

    this.abort = function () {
        xhr && xhr.abort();
    };

}

//退出
common.loginOut = function (params) {
    params = params || {};
    var
        jBtn = params.jBtn,
        onStart,
        onSucceed,
        onComplete,
        loadingCallback,
        jHead,
        isLoading;

    if (jBtn.length === 0) return;

    onStart = params.onStart === undefined ? function () { } : params.onStart;
    onSucceed = params.onSucceed === undefined ? function () { } : params.onSucceed;
    onComplete = params.onComplete === undefined ? function () { } : params.onComplete;
    loadingCallback = params.loadingCallback === undefined ? function () { } : params.loadingCallback;
    jHead = $('head');
    isLoading = false;

    function finish() {
        isLoading = false;
    }

    function succeed(data) {
        onSucceed(data);
        common.msg(0, '退出成功');
    }

    function onJsLoaded(data) {
        location.href = data.returnUrl;
    }

    function loadTextShow() {

        var showData = ['.', '..', '...'],
            length = showData.length,
            stopId,
            i = 2;

        function excu(callback) {

            callback(i, showData[i]);
            i++;
            if (i >= length) i = 0;
            stopId = setTimeout(function () {
                excu(callback);
            }, 400);
        }

        this.excu = excu;
        this.stop = function () {
            clearTimeout(stopId);
        };
    }

    loadTextShow = new loadTextShow();

    jBtn.on({
        click: function () {
            if (isLoading) return;
            onStart();
            isLoading = true;

            loadTextShow.excu(function (i, str) {
                loadingCallback(i, str);
            });
            xhr = $.post('/member/account/logout', function (d) {

                onComplete();

                if (d.status) {

                    succeed(d.data);

                    try {
                        common.loadScriptAll($(d.data.ucsynlogout), function () {
                            onJsLoaded(d.data);
                            finish();
                        });
                    }
                    catch (e) {
                        onJsLoaded(d.data);
                        finish();
                    }
                }
                else {
                    common.msg(d);
                    finish();
                }

            }, 'json');

            return false;
        }
    });
};

//ajax 登录弹出框
common.popLogin = (function () {

    //居中
    function positionHandle(jMain) {

        function update() {
            var
                boxHeight = jMain.height(),
                width = winWH.width,
                height = winWH.height;

            jMain.css({
                left: (width - 402) / 2,
                top: (height - boxHeight) / 2
            });
        }

        ///
        this.update = update;


        this.off = function () {
            wJq.off({
                resize: update
            });
        };

        wJq.on({
            resize: update
        });
    }

    function popHandle(params) {

        function fnIni() {
            var dragHandle = new common.dragWin({
                jBindElem: jMain.children('.top'),
                jMoveElem: jMain,
                //minY: 40,
                bindElemWidth: 400,
                bindElemHeight: 45
            });

            jMain.find('.top b').add(jMask).on({
                click: close
            });

            jMain.ESC(function () {
                close();
            });
        }

        function close() {

            //chrome bug
            jMain.focus().blur();

            jMain.add(jMask).fadeOut(function () {
                jMain.add(jMask).remove();
            });
            positionFn.off();

            onClose();
        }

        var html = params.html,
            onShow = params.onShow === undefined ? function () { } : params.onShow,
            onClose = params.onClose === undefined ? function () { } : params.onClose,
            jMain,
            jMask,

            positionFn;

        this.show = function () {
            jMask = $('<div class="mask"></div>').appendTo(bJq).hide().fadeIn();

            jMain = $(html).appendTo(bJq).fadeIn();

            fnIni();

            jMain.focus();

            onShow(jMain);

            positionFn = new positionHandle(jMain);
            positionFn.update();
        };


        this.close = close;


    }

    function eTopHandle() {
        var jTop = $('.header .h_l');


        this.ini = function (params) {
            var name = params.name;

            jTop.html('<ul class="h_l">\
                <li class="h_hello"><i></i> <em>欢迎您,' + name + '</em></li>\
                <li class="active h_quit"><i></i><a href="javascript:;">退出</a></li>\
                <li class="h_member"><i></i><a href="/member/default/index">会员中心</a></li>\
                </ul>');

            common.loginOut({ jBtn: jTop.find('.h_quit') });
        };
    }

    return function (params) {
        params = params || {};
        var
            onSucceed = params.onSucceed === undefined ? function () { } : params.onSucceed,
            onJsLoaded = params.onJsLoaded,

            eTopFn = new eTopHandle(),

            logoHandle,

            popFn = new popHandle({
                html: '<div class="popup_login local hide">\
    <div class="top">\
        <span>新石器登录</span>\
        <b></b>\
    </div>\
    <div class="m">\
        <div class="row n">\
            <div class="t_l">帐号</div>\
            <div class="r_op">\
                <input class="name" type="text" name="username"/>\
            </div>\
        </div>\
        <div class="row p">\
            <div class="t_l">密码</div>\
            <div class="r_op">\
                <input class="password" type="password" name="password"/>\
            </div>\
        </div>\
        <div class="row r">\
            <div class="t_l"></div>\
            <div class="r_op">\
                <input id="rememberMe" type="checkbox" checked="checked">\
                <label for="rememberMe">记住我</label>\
                <a class="fgwp a_type3" href="/member/account/forgetPassword">忘记密码？</a>\
            </div>\
        </div>\
        <div class="row l">\
            <div class="t_l"></div>\
            <div class="r_op">\
                <input class="button" type="button" value="确 定">\
            </div>\
        </div>\
    </div>\
</div>',
                onShow: function (jMain) {
                    var
                        jName = jMain.find('.name'),
                        jPassword = jMain.find('.password'),
                        jRememberMe = $('#rememberMe'),
                        jGo = jMain.find('.button');

                    logoHandle = new common.login({

                        jName: jName,
                        jPassword: jPassword,
                        jRememberMe: jRememberMe,
                        jGo: jGo,
                        onStart: function () {
                            jGo.addClass('loading');

                        },
                        onComplete: function () {

                        },
                        onFinish: function () {
                            jGo.removeClass('loading');
                        },
                        onSucceed: function (d) {
                            popFn.close();

                            onSucceed(d);

                            eTopFn.ini(d);

                            common.msg(0, '登录成功');
                        },
                        onJsLoaded: onJsLoaded
                    });

                    jName.focus();
                },
                onClose: function () {

                    logoHandle.abort();
                }
            });

        return popFn;
    };
})();
common.popLoginBindBtn = function (params) {
    var
        jPopBtn = params.jPopBtn,
        onSucceed = params.onSucceed,

        popFn = common.popLogin({
            onSucceed: onSucceed
        });
    jPopBtn.on({
        click: function () {
            popFn.show();

            return false;
        }
    });
};
//#endregion

//#region 密码强度
common.passwordStrength = function (str) {

    /*
    中
     两种字符 总长度 x >= 6 
     两种字符 各自>=1

     三种字符 总长度 6 < x < 8
     三种字符 各自>=1

    强
     三种字符 总长度 >=8
     三种字符 各自>=1

     四种字符 总长度  >= 6 
     四种字符 各自>=1

    */

    var level = 1,
        symbol = getLen(/[\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/g),
        figure = getLen(/[0-9]/g),
        letter = getLen(/[a-z]/g),
        capital = getLen(/[A-Z]/g),
        total = str.length,
        len = 0;

    function getLen(reg) {
        var v = str.match(reg);

        return v === null ? 0 : v.length;
    }

    if (symbol >= 1) {
        len++;
    }

    if (figure >= 1) {
        len++;
    }

    if (letter >= 1) {
        len++;
    }
    if (capital >= 1) {
        len++;
    }
    if (len >= 3) {
        if (total >= 6) level = 3;
    }

    if (len === 2) {
        if (total >= 6) level = 2
    }
    else if (len === 3) {
        if (total >= 8) level = 3;
        else if (total >= 6) level = 2;

    }
    else if (len >= 3) {
        if (total >= 6) level = 3;
    }

    return level;
};

//#endregion

//全局调用
$(function () {

    //部分全局
    if (window.wJq === undefined) window.wJq = $(window);
    if (window.bJq === undefined) window.bJq = $(document.body);
    (function () {
        function setWinWH() {
            window.winWH = {
                width: wJq.width(),
                height: wJq.height()
            }

        }
        wJq.on({ resize: setWinWH });

        setWinWH();
    })();


});