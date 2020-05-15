"use strict";

/* 插件 */
//jQuery Easing v1.3
jQuery.easing.jswing=jQuery.easing.swing;jQuery.extend(jQuery.easing,{def:"easeOutQuad",swing:function(e,f,a,h,g){return jQuery.easing[jQuery.easing.def](e,f,a,h,g)},easeInQuad:function(e,f,a,h,g){return h*(f/=g)*f+a},easeOutQuad:function(e,f,a,h,g){return -h*(f/=g)*(f-2)+a},easeInOutQuad:function(e,f,a,h,g){if((f/=g/2)<1){return h/2*f*f+a}return -h/2*((--f)*(f-2)-1)+a},easeInCubic:function(e,f,a,h,g){return h*(f/=g)*f*f+a},easeOutCubic:function(e,f,a,h,g){return h*((f=f/g-1)*f*f+1)+a},easeInOutCubic:function(e,f,a,h,g){if((f/=g/2)<1){return h/2*f*f*f+a}return h/2*((f-=2)*f*f+2)+a},easeInQuart:function(e,f,a,h,g){return h*(f/=g)*f*f*f+a},easeOutQuart:function(e,f,a,h,g){return -h*((f=f/g-1)*f*f*f-1)+a},easeInOutQuart:function(e,f,a,h,g){if((f/=g/2)<1){return h/2*f*f*f*f+a}return -h/2*((f-=2)*f*f*f-2)+a},easeInQuint:function(e,f,a,h,g){return h*(f/=g)*f*f*f*f+a},easeOutQuint:function(e,f,a,h,g){return h*((f=f/g-1)*f*f*f*f+1)+a},easeInOutQuint:function(e,f,a,h,g){if((f/=g/2)<1){return h/2*f*f*f*f*f+a}return h/2*((f-=2)*f*f*f*f+2)+a},easeInSine:function(e,f,a,h,g){return -h*Math.cos(f/g*(Math.PI/2))+h+a},easeOutSine:function(e,f,a,h,g){return h*Math.sin(f/g*(Math.PI/2))+a},easeInOutSine:function(e,f,a,h,g){return -h/2*(Math.cos(Math.PI*f/g)-1)+a},easeInExpo:function(e,f,a,h,g){return(f==0)?a:h*Math.pow(2,10*(f/g-1))+a},easeOutExpo:function(e,f,a,h,g){return(f==g)?a+h:h*(-Math.pow(2,-10*f/g)+1)+a},easeInOutExpo:function(e,f,a,h,g){if(f==0){return a}if(f==g){return a+h}if((f/=g/2)<1){return h/2*Math.pow(2,10*(f-1))+a}return h/2*(-Math.pow(2,-10*--f)+2)+a},easeInCirc:function(e,f,a,h,g){return -h*(Math.sqrt(1-(f/=g)*f)-1)+a},easeOutCirc:function(e,f,a,h,g){return h*Math.sqrt(1-(f=f/g-1)*f)+a},easeInOutCirc:function(e,f,a,h,g){if((f/=g/2)<1){return -h/2*(Math.sqrt(1-f*f)-1)+a}return h/2*(Math.sqrt(1-(f-=2)*f)+1)+a},easeInElastic:function(f,h,e,l,k){var i=1.70158;var j=0;var g=l;if(h==0){return e}if((h/=k)==1){return e+l}if(!j){j=k*0.3}if(g<Math.abs(l)){g=l;var i=j/4}else{var i=j/(2*Math.PI)*Math.asin(l/g)}return -(g*Math.pow(2,10*(h-=1))*Math.sin((h*k-i)*(2*Math.PI)/j))+e},easeOutElastic:function(f,h,e,l,k){var i=1.70158;var j=0;var g=l;if(h==0){return e}if((h/=k)==1){return e+l}if(!j){j=k*0.3}if(g<Math.abs(l)){g=l;var i=j/4}else{var i=j/(2*Math.PI)*Math.asin(l/g)}return g*Math.pow(2,-10*h)*Math.sin((h*k-i)*(2*Math.PI)/j)+l+e},easeInOutElastic:function(f,h,e,l,k){var i=1.70158;var j=0;var g=l;if(h==0){return e}if((h/=k/2)==2){return e+l}if(!j){j=k*(0.3*1.5)}if(g<Math.abs(l)){g=l;var i=j/4}else{var i=j/(2*Math.PI)*Math.asin(l/g)}if(h<1){return -0.5*(g*Math.pow(2,10*(h-=1))*Math.sin((h*k-i)*(2*Math.PI)/j))+e}return g*Math.pow(2,-10*(h-=1))*Math.sin((h*k-i)*(2*Math.PI)/j)*0.5+l+e},easeInBack:function(e,f,a,i,h,g){if(g==undefined){g=1.70158}return i*(f/=h)*f*((g+1)*f-g)+a},easeOutBack:function(e,f,a,i,h,g){if(g==undefined){g=1.70158}return i*((f=f/h-1)*f*((g+1)*f+g)+1)+a},easeInOutBack:function(e,f,a,i,h,g){if(g==undefined){g=1.70158}if((f/=h/2)<1){return i/2*(f*f*(((g*=(1.525))+1)*f-g))+a}return i/2*((f-=2)*f*(((g*=(1.525))+1)*f+g)+2)+a},easeInBounce:function(e,f,a,h,g){return h-jQuery.easing.easeOutBounce(e,g-f,0,h,g)+a},easeOutBounce:function(e,f,a,h,g){if((f/=g)<(1/2.75)){return h*(7.5625*f*f)+a}else{if(f<(2/2.75)){return h*(7.5625*(f-=(1.5/2.75))*f+0.75)+a}else{if(f<(2.5/2.75)){return h*(7.5625*(f-=(2.25/2.75))*f+0.9375)+a}else{return h*(7.5625*(f-=(2.625/2.75))*f+0.984375)+a}}}},easeInOutBounce:function(e,f,a,h,g){if(f<g/2){return jQuery.easing.easeInBounce(e,f*2,0,h,g)*0.5+a}return jQuery.easing.easeOutBounce(e,f*2-g,0,h,g)*0.5+h*0.5+a}});

// 标签插件
// jQuery Tags Input Plugin 1.0
$.fn.extend((function () {

    function tagsInput(params) {
        params = params || {};
        var
			width = common.paramUn(params.width, 'auto')
			, height = common.paramUn(params.height, 'auto')
			, onChange = common.paramUn(params.onChange, function () { })
            , delayExcu = new common.delayExcu()

			, jThis = $(this).hide()
			, jBox = $('<div class="tags-input"><input class="in" type="text" placeholder="添加一个标签"/></div>').insertAfter(jThis)
			, jIn = jBox.children()
			, tagData = {}
			, keyData = {}
			, time = 0;

        jBox.css({
            width: width,
            height: height
        });

        jBox.on({
            click: function (e) {
                var eTarget = e.target;

                if (jIn.hasClass('not_valid')) {
                    jIn.focus();
                    return;
                }

                if (eTarget.tagName === 'I') {

                    removeTagByElem($(eTarget));

                    onChange();

                    return;
                }

                if (eTarget.tagName === 'SPAN' && !eTarget.className) {
                    editHandle(eTarget);
                    return;
                }

                if (eTarget.tagName === 'INPUT') {

                    return;
                }

                jIn.focus();

            }
        });

        jIn.on({
            keydown: function (e) {

                if (e.keyCode === 13) {
                    if (addTag(jIn.val())) {
                        onChange();
                    }
                }
                else {
                    if (e.keyCode === 8) {
                        if (jIn.val().length === 0) {
                            removeTagByElem(jIn.prev().children('i'));
                        }
                        delWarn();
                    }
                }
                
            },
            blur: function () {
                if (addTag(jIn.val())) {
                    onChange();
                }
            }
        });

        importTags(jThis.val());

        function editHandle(eTxt) {
            var
                jTxt = $(eTxt),
                jEditIn = jTxt.data('jEditIn'),
                currentV,
                id = jTxt.attr('data-id');

            if (!jEditIn) {
                jEditIn = $('<input style="border:0;margin-top:-4px;line-height:14px;" value="' + jTxt.html() + '"/>');

                jTxt.after(jEditIn).data('jEditIn', jEditIn);

                jEditIn.on({
                    blur: function () {
                        var v = jEditIn.val();

                        if (currentV!==v&&(v.length===0||keyData[v] !== undefined)) {
                            jEditIn.addClass('not_valid').focus();
                            return;
                        }
                        jEditIn.hide();
                        jTxt.html(v).show();
                        delete keyData[currentV];
                        tagData[id] = v;
                        keyData[v] = id;
                    },
                    input: function () {
                        jEditIn.removeClass('not_valid').width(jTxt.html(jEditIn.val()).innerWidth());

                    }
                });
            }

            currentV = jEditIn.val();

            jEditIn.show().width(jTxt.width()).focus();

            jTxt.hide();

         
        }

        function delWarn() {
            if (jIn.hasClass('not_valid')) {
                jIn.removeClass('not_valid');
            }
        }

        function addTag(v) {
            v = $.trim(v);

            if (v.length === 0) return;

            // 重复情况
            if (keyData[v] !== undefined) {
                jIn.addClass('not_valid');
                return;
            }
            else {
                delWarn();
            }

            tagData[time] = v;
            keyData[v] = time;

            $('<span class="tag"><span data-id="' + time + '">' + v + '</span><i data-id="' + time + '">x</i></span>').insertBefore(jIn);

            jIn.val('');

            time++;

            return true;
        }

        function removeTagByElem(jElem) {
            if (jElem.length === 0) return;

            var id = jElem.attr('data-id'),
				v = tagData[id];

            delete tagData[id];
            delete keyData[v];

            jElem.parent().remove();

        }

        function importTags(tagNames) {
            importTabGroups(tagNames.split(','));
        }

        function importTabGroups(tags) {
            jIn.prevAll().remove();

            tagData = {};
            keyData = {};

            $.each(tags, function (i, n) {
                addTag(n);
            });

            delWarn();
        }

        jThis.data({
            importTags: importTags
            , importTabGroups: importTabGroups
			, removeTag: function () {

			}
			, addTag: addTag
			, getTagNames: function () {
			    var s = '';
			    for (var k in tagData) {
			        s += ',' + tagData[k];
			    };

			    s = s.substr(1);

			    return s;
			}
        });
    }

    function importTags(tagNames) {
        this.data('importTags')(tagNames);
        return this;
    }

    function importTabGroups(tags) {
        this.data('importTabGroups')(tags);
        return this;
    }


    function removeTag() {

    }

    function addTag(v) {
        this.data('addTag')(v);
        return this;
    }
    function getTagNames() {
        return this.data('getTagNames')();
    }
    return {
        tagsInput: tagsInput,
        importTags: importTags,
        importTabGroups: importTabGroups,
        addTag: addTag,
        removeTag: removeTag,
        getTagNames: getTagNames
    };
})());

var common = (function () {

    var c = {},
        wJq, bJq, winWH, once;

    function winWHInit() {
        var wJq = c.wJq;

        wJq.on({ resize: setWinWH });

        setWinWH();

        function setWinWH() {
            c.winWH = winWH = {
                width: wJq.width(),
                height: wJq.height()
            }
        }
    }

    //项目全局。方便控制项目公共
    c.ready = function (fn) {
        $(function () {
            if (once === undefined) {
                window.requestAnimFrame = (function () {
                    return window.requestAnimationFrame ||
                        window.webkitRequestAnimationFrame ||
                        window.mozRequestAnimationFrame ||
                        window.oRequestAnimationFrame ||
                        window.msRequestAnimationFrame ||
                        function (callback, element) {
                            window.setTimeout(callback, 15);
                        };
                })();

                c.wJq = wJq = $(window);
                c.bJq = bJq = $(document.body);

                winWHInit();
                once = 1;
            }

            fn();
        });
    }

    //非空\未定义 情况 默认值 处理
    c.paramUn = function (value, def) {
        return value === undefined ? def : value;
    };

    // script 加载
    c.addScript = function (src, callback,handle) {

        var script = document.createElement('script');
        script.src = src;

        handle = handle || function () {};

        handle(script);

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
    };

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

    //#region test
    c.testBtn = (function () {
        var index;
        return function (onclick, btnTxt) {

            if (index === undefined) {
                index = 0;
            }

            var eTest = document.createElement('div'),
                eTestA;

            eTest.innerHTML = '<button style="font-size:12px;position:fixed;left:0;top:' + (index * 20) + 'px;z-index:99">' + (btnTxt ? btnTxt : 'test') + '</button>';

            eTestA = eTest.children[0];

            document.body.appendChild(eTestA);

            eTestA.onclick = onclick;

            index++;
        };
    })();
    //#endregion

    //#region 取字符串长度 [字节大小]
    /*
    中文字符两个字节，英文字符一个
    */

    c.stringSize = function (s) {

        return s.length + (s.match(/[^\x00-\xff]/g) || '').length;
    }
    //#endregion

    //#region 延时 有效执行

    /*
    指定时间后执行
    可终止计时。
    实现在指定时间内另外情况不需要执行，手动终止计时

    指定时间内再次调用。将重新计时
    实现 快速更新 情况 实现在 在最后结束后再更新

    # 初始
    @@ common.delayExcu
    @example
        var delayExcu = new common.delayExcu();
    # method
    @@ delayExcu.excu 不会发生重复调用。重复调用会删除之前的，最新的生效
    @param fn [function] 延迟执行的函数
    @param * time [number] 延迟的毫秒数。默认200
    @example
        delayExcu.excu(function () {alert('');});

    @@ delayExcu.clear 终止
    @return [bool] true表示fn没有执行，清除成功。false，表示fn已经执行，没进行清除
    @example
        delayExcu.clear();

    # 常调用：
    delayExcu.excu(function () {jBox.addClass('imgFullShowMove');});
    if(delayExcu.clear()===false) jBox.removeClass('imgFullShowMove');

    */
    c.delayExcu = function () {
        var timeId = null;

        function clear() {
            if (timeId !== null) {

                clearTimeout(timeId);

                timeId = null;

                return true;
            }
            return false;
        }

        this.excu = function (callBack, time) {
            clear();

            if (time === 0) {
                callBack();
            }
            else {
                timeId = setTimeout(function () {
                    timeId = null;
                    callBack();
                }, time || 200);
            }
        };

        this.clear = clear;

    };

    //#endregion

    //#region 频率执行
    // 实现按指定间隔执行
    c.ExcuFrequency = function () {
        var status = 0;
        this.excu = function (fn,time) {
            if (status) return;
            status = 1;
            setTimeout(function () {
                fn();
                status = 0;
            }, time === undefined ? 600 : time);
        }
    };
    //#endregion   
    
    //#region 不断循环 尝试取

    /*
    不断循环 尝试取
    @param (function) tryFn 不断循环执行的函数，返回false 则停止循环
    */
    c.LoopTry = function () {

        var stopId;
        this.excu = function (tryFn, time) {

            time = time === undefined ? 100 : time
            function fn() {
                if (tryFn() !== false) {
                    stopId = setTimeout(fn, time);
                }
            }
            stopId = setTimeout(fn, time);
        };

        this.stop = function () {
            clearTimeout(stopId);
        };

    };

    //#endregion

    //#region 速率计算

    c.velocity = function () {

        var startTime,
            moveTimesArr = [],
            target = this;

        function getSustainTimes() {
            return (new Date()).getTime() - startTime;
        }

        //速率计时
        this.start = function () {
            moveTimesArr = [[0, 0]];
            startTime = (new Date()).getTime();
        };
        this.end = function () {
            var lastIndex = moveTimesArr.length - 1;

            if (lastIndex < 1) return 0;

            //间隔时间
            var intervalTime = getSustainTimes() - moveTimesArr[lastIndex][0];

            //有惯性情况。间隔时间
            if (intervalTime < 200) {
                // 滑动情况一般不会超过50毫秒。如果不够敏感，不应调节这里。条件end 返回的值，往小里调

                return (moveTimesArr[0][1] - moveTimesArr[lastIndex][1]) / intervalTime * 1000;
            }
                //无惯性
            else {
                return 0;
            }
        };

        this.change = function (val) {

            moveTimesArr.unshift([getSustainTimes(), val]);

            if (moveTimesArr.length > 4) moveTimesArr.length = 4;
        };
    };

    //#endregion

    //#region 减动画核心

    c.StripingReduce = function () {
        var stopId;
        this.start = function (to, fn) {
            var times = 20,
            vel = to;

            function back() {
                vel = parseFloat((vel * .8).toFixed(2));

                fn(vel);

                if (Math.abs(vel) > 0.1) stopId = setTimeout(back, times);
            }

            stopId = setTimeout(back, times);
        }

        this.stop = function () {
            clearTimeout(stopId);
        };
    };

    //#endregion

    //#region 滚轮
    /*
    core.mouseWheel(jMainBox[0], function (e) {
        var pre;
        if (e.wheelDelta) //前120 ，后-120
            pre = e.wheelDelta > 0;
        else //firefox
            pre = e.detail < 0;
    
        if (pre) {
            //*往上滚
    
        } else {
            //*往下滚
    
        }
    
        //阻止滚动条滚动
        if (e.cancelable) e.preventDefault();
        return false;
    });
    */
    c.mouseWheel = function (dom, f) {
        if (dom.addEventListener) {
            if (dom.onmousewheel === undefined) dom.addEventListener('DOMMouseScroll', f, false);//firefox
            else dom.addEventListener('mousewheel', f, false);
        } else {
            dom.attachEvent('onmousewheel', f);//ie678
        }
    };
    c.removeMouseWheel = function (dom, f) {
        if (dom.addEventListener) {
            if (dom.onmousewheel === undefined) dom.removeEventListener('DOMMouseScroll', f, false);//firefox
            else dom.removeEventListener('mousewheel', f, false);
        } else {
            dom.detachEvent('onmousewheel', f);//ie678
        }
    };
    //#endregion

    //#region jq Ajax 错误
    c.jQAjaxErrorMsg = function (XMLHttpRequest, textStatus, errorThrown) {
        switch (textStatus) {
            case 'error': case 'notmodified': case 'parsererror':
                common.msg(1, '错误：' + XMLHttpRequest.status + '，' + errorThrown + '。请联系管理员');
                break;
            case 'timeout':
                common.msg(1, '请求超时：' + errorThrown);
                break;
            case 'abort':
                //common.msg('用户取消');
                break;
            default:
                common.msg(1, '未知错误：' + errorThrown + '。请联系管理员');
                break;
        }
    };
    //#endregion

    //#region 文件选择
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
    c.fileSel = function (param) {

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
    };

    c.fileDialog = (function () {

        function FileDialog() {
            var once, eFile = null;

            function init() {
                if (once) return;
                once = 1;

                //eFile = document.createElement('input');
                //eFile.type = 'file';
                //eFile.style.display = 'none';
                //document.body.appendChild(eFile);
            }

            function removeNode(node) {
                if (node.remove) node.remove();
                else node.parentNode.removeChild(node);
            }

            function show(params) {
                init();

                var
                    // 单选 false 多选 true 
                    multiple = c.paramUn(params.multiple, true),
                    // 文件类型
                    accept = params.accept,
                    // 选择文件后回调
                    onSuccess = c.paramUn(params.onSuccess, function () { });

                if (eFile === null) {
                    eFile = document.createElement('input');
                    eFile.type = 'file';
                    eFile.style.display = 'none';
                    document.body.appendChild(eFile);
                }

                eFile.multiple = multiple;
                if (accept) eFile.accept = accept;

                eFile.onchange = function () {
                    onSuccess(eFile.files);

                    removeNode(eFile);

                    eFile.onchange = null;
                    eFile = null;
                };

                // 弹窗
                eFile.click();

            }

            this.show = show;

        }

        return (new FileDialog()).show;
    })();
    //#endregion

    //#region 执行上传
    /*
      执行上传，单个文件上传
      单进程多个，回调中在次调用即可
      多进程，同时执行即可

      html5
      @param (file)  js 文件对象。单个文件
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
    c.startUpload = function (param) {

        function uploadProgress(e) {
            if (e.lengthComputable) {
                proress(e.loaded, e.total);
            }
        }

        function uploadSuccess(e) {

            if (xhr.readyState === 4) {

                if (xhr.status === 200) {
                    success(xhr.responseText);
                }
                else {
                    error();
                }

                complete();
            }
        }

        function uploadError() {
            error();
            complete();
        }

        var
            url = param.url,
            file = param.file,

            success = param.success,
            error = c.paramUn(param.error, function () { }),
            complete = c.paramUn(param.complete, function () { }),
            proress = c.paramUn(param.proress, function () { }),
            formData = param.formData,

            xhr,
            vfd,

            _k;

        xhr = new XMLHttpRequest();
        vfd = new FormData();

        vfd.append("file", file);

        if (formData) {
            for (_k in formData) {
                vfd.append(_k, formData[_k]);
            }
        }

        xhr.upload.addEventListener('progress', uploadProgress, false);
        xhr.addEventListener('error', uploadError, false);
        xhr.addEventListener('readystatechange', uploadSuccess, false);

        xhr.open("post", url);

        xhr.send(vfd);

        return xhr;

    };

    //#endregion

    //#region 拖动原型

    c.drag = function (jElem, onMove, onDown, onUp) {
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

        jElem.on({ mousedown: down });
    };

    //#endregion

    //#region 拖动实现 - 窗口惯性拖动

    /*
    
    # 初始
        @example
            dragHandle = new c.dragWin({
                jBindElem: jTop,
                jMoveElem: jPopBox,
                minY: 40,
                bindElemWidth: 500,
                bindElemHeight: 114
            });
        @param jBindElem 拖动事件触发对象
        @param jMoveElem 移动对象
        @param boxWidth 移动窗口 宽度
        @param boxHeight 移动窗口 高度
        @param * minX 最小X坐标，默认为0
        @param * minY 最小y坐标，默认为0
    # method
        getStatus 是否是拖动动作
        @example
            dragHandle.getStatus();
        @return [bool] true是拖动，false点击
    
        
        stop 终止惯性动作
        @example
            dragHandle.stop();
    
    */
    c.dragWin = function (params) {

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

            xyVel = { x: new c.velocity(), y: new c.velocity() },
            stripingReduceX = new c.StripingReduce(),
            stripingReduceY = new c.StripingReduce();

        c.drag(jBindElem, function (xy) {
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

    };
    //#endregion

    //#region 弹窗


    /*
    弹窗

    实例化时 就会 初始架子

    初始架子 只会执行一次

    del后 将重置，又可初始架子。！！此处有问题
        删除没有意义，this.jConBox等成员没被重新赋值

    也可手动初始架子
    */

    c.Popup = function (params) {
        var
            //标题
            title,
            width,

            jBox,
            jWinBox,
            jConBox,
            jTop,
            jTitle,
            jCloseBtn,
            //jHtml,

            onec,
            isShow = 0,
            loadingH = 140,

            onEsc = function () { },
            onClickBg = function () { },

            //dragMove,// 是否绑定拖动。默认true
            dragHandle,
            that = this;

        //参数处理
        if (params !== undefined) {

            if (typeof params === 'string') {
                //# 标题情况

                title = params;
            }
            else {

                title = c.paramUn(params.title, '');
                width = c.paramUn(params.width, 430);
                //dragMove = c.paramUn(params.dragMove, true);
            }
        }

        //一般显示
        this.show = show;

        //关闭按钮事件。默认直接调用close
        this.onClose = undefined;

        //填充内容
        this.loadContent = loadContent;

        //异步加载情况 显示
        this.loadingShow = loadingShow;

        //有内容后调用
        this.loadingEnd = loadingEnd;

        //隐藏。参数：不给只会隐藏；给1删掉整个弹窗元素，需重新加载元素
        this.close = close;

        this.setTitle = setTitle;

        this.center = center;
        this.animateCenter = animateCenter;

        initBox();

        this.jBox = jBox;
        this.jConBox = jConBox;
        this.jWinBox = jWinBox;

        // 外部接口
        this.onEsc = function (fn) {
            onEsc = fn;
        };
        this.onClickBg = function (fn) {
            onClickBg = fn;
        };

        function setTitle(tit) {

            tit = tit || title;

            jTitle.html(tit);
        }

        function center() {
            var left = (jBox.width() - jWinBox.width()) / 2,
                top = (jBox.height() - jWinBox.height()) / 3;

            if (top < 0) top = 0;

            dragHandle.stop();

            jWinBox.css({
                left: left,
                top: top
            });
        }

        function animateCenter(winBoxH) {

            var top = (jBox.height() - winBoxH) / 3;

            if (top < 0) top = 0;

            dragHandle.stop();

            jWinBox.animate({ top: top });
        }

        function getBoxHtml() {

            return '<div class="popup" tabindex="-1"><div class="bg"></div><div class="win">\
            <div class="con"><div class="top"><div class="top_m"><span class="tit"></span><b></b></div></div><div class="fn"></div></div></div></div>';
        }

        function loadingShow() {

            jBox.addClass('loading');

            show();

            jConBox.children().hide();
        }

        function loadingEnd() {
            var toH,
                winToH,
                jFn = jConBox.children();

            jFn.show();
            toH = jConBox.height();
            winToH = jWinBox.height();
            jFn.hide();

            jConBox.height(loadingH);
            jConBox.animate({ height: toH }, 200);
            jFn.fadeIn();
            jBox.removeClass('loading');

            animateCenter(winToH);

        }

        function show() {

            if (isShow === 0) {

                // 显示并获焦
                // 获焦是为了实现esc关闭
                jBox.fadeIn().focus();

                //jHtml.css('overflow', 'hidden');

                center();

                isShow = 1;


            }
        }

        function close(isDel) {

            if (isShow === 1) {

                jBox.fadeOut(function () {

                    if (isDel) {
                        del();
                    }
                });

                //jHtml.css('overflow', 'auto');

                isShow = 0;
            }
        }

        function del() {
            jBox.remove();
        }

        //初始 框
        function initBox() {

            if (onec === undefined) {
                var jCon;

                jBox = $(getBoxHtml()).appendTo(bJq);

                jWinBox = jBox.children('.win').width(width);

                jCon = jWinBox.children();

                jTop = jCon.children('.top');

                jTitle = jTop.find('.tit');

                jCloseBtn = jTop.find('b');

                jConBox = jCon.children('.fn');

                //jHtml = $(document.documentElement);

                //if (dragMove) {

                    dragHandle = new c.dragWin({
                        jBindElem: jTop,
                        jMoveElem: jWinBox,
                        bindElemWidth: jTop.innerWidth(),
                        bindElemHeight: jTop.innerHeight()
                    });
                //}

                jCloseBtn.click(function () {
                    if (that.onClose === undefined) {
                        close();
                    }
                    else {
                        that.onClose();
                    }
                });

                setTitle();

                jBox.hide();

                jBox.on('keydown', function (e) {

                    if (e.keyCode === 27) {
                        onEsc();
                    }
                });

                jBox.children('.bg').click(function () {
                    onClickBg();
                });

                onec = 1;
            }
        }

        function loadContent(fn) {

            fn(jConBox);
        }

    };

    //#endregion

    //#region 弹窗 - 单实例

    /*
    弹窗
        页面中只有唯一一个
        只是弹出一个壳，可以自定义内容
        关闭按钮，有默认功能，也可自定义(方便扩展)
        绑定拖动 

    
    使用方法 见 module 中的预览
    */
    c.popup = (function () {

        function popup() {
            var
                popup = null,
                _this = this;

            function close() {
                
                if (popup) {
                    popup.close(1);
                    popup = null;

                    //return true;
                } else if ($(".popup").length == 1) {
                    $(".popup").remove();
                }
            }

            this.show = function (params) {

                var
                    title = params.title,
                    width = params.width,
                    content = params.content,

                    // 关窗 执行，点击关闭后，可能应动画原因 窗口还在半透明状态，已考虑这种情况，保证只会执行一次
                    //onClose = c.paramUn(params.onClose, function () { }),

                    //替换关闭按钮
                    onCloseBtn = c.paramUn(params.onClose, close),
                    onShowBefore = c.paramUn(params.onShowBefore, function () { });

                _this.base = popup = new c.Popup({
                    title: title,
                    width: width
                });

                popup.onClose = onCloseBtn;

                popup.jConBox.append(content);

                onShowBefore(popup);

                popup.show();

                popup.onEsc(close);
                popup.onClickBg(close);
            };

            this.close = close;


        }
        return new popup();
    })();



    //#endregion

    //#region 确认窗

    /*
    确认窗

    # method
        @@ 
        @example
            common.confirm({
                title: '相册删除',
                description: '确认要删除？',
                //btnsHTML:'',
                //onCloseBtn:function(){},//替换关闭按钮
                onBtns: [function () {

                }]
            })
        @param onBtns [arr,function] 
            至少有一个。一个将配置第一个确认按钮。第二个按钮默认关闭窗口
            多个将依次给按钮配置指定事件
        @param description [string] 描述
        @parma * hasCloseBtn [bool]
        @parma * onCloseBtn [function]

        @@ common.popup.close 关闭
        @example
            common.popup.close();
    */

    c.confirm = (function (params) {

        var popup;

        function show(params) {
            var title = params.title,
                description = params.description,
                btnsHTML = params.btnsHTML,
                onBtns = params.onBtns,
                onSuccess =c.paramUn( params.onSuccess,function(){}),
                hasCloseBtn = params.hasCloseBtn,
                onCloseBtn = c.paramUn(params.onCloseBtn, close),
                jBtns;

            if (popup !== undefined) {
                close();
            }

            popup = new c.Popup();

            btnsHTML = c.paramUn(btnsHTML, '<a class="button" href="javascript:;">确认</a><a class="button red" href="javascript:;">取消</a>');

            popup.setTitle(title);

            popup.jConBox.append('<div class="confirm_box"><div class="des"><i></i>' + description + '</div>\
                    <div class="btns">' + btnsHTML + '</div></div>');

            popup.onClose = onCloseBtn;

            jBtns = popup.jConBox.children().children('.btns').children();

            if (onBtns.length === 1) {
                jBtns.eq(0).on({
                    click: onBtns[0]
                });
                jBtns.eq(1).on({
                    click: function () {
                        close();
                    }
                });
            }
            else {
                jBtns.each(function (i) {
                    $(this).click(onBtns[i]);
                });
            }

            popup.show();

            onSuccess({
                jBtns: jBtns,
                jConBox: popup.jConBox
            });

            show.jBtns = jBtns;
            show.popup = popup;

        }

        function close() {
            popup.close(1);
            popup = undefined;

            show.jBtns = show.popup = undefined;
        }

        show.close = close;

        return show;
    })();

    //c.confirmAjax({
    //    title: '相册删除',
    //    description: '确认要删除？',
    //    ajaxOptions: {
    //        url: '',
    //        type: 'post',
    //        data: { 'name': '' },
    //        dataType: 'json',
    //        contentType: 'application/json',
    //        success: function (d) {
    //            console.log(d);
    //        },
    //        complete: function () {
    //            //请求完成 执行。不论成功或各种错误 。在 success或 error 之后执行

    //        }
    //    }
    //});
    c.confirmAjax = (function () {

        var ajax = (function () {
            var xhr = null;

            function abort() {
                if (xhr) {
                    xhr.abort();
                    xhr = null;
                }
            }

            function ajax(options, jElem) {
                var complete = c.paramUn(options.complete, function () { });
                options.error = c.paramUn(options.error, common.jQAjaxErrorMsg);
                options.complete = function () {
                    xhr = null;
                    complete();
                    jElem.removeClass('loading');
                };

                xhr = $.ajax(options);
            }

            ajax.abort = abort;

            return ajax;

        })();

        function onclose() {
            ajax.abort();
            c.confirm.close();
        }

        function confirm(params) {
            function ok(jBtn) {
                if (confirm.status) return;

                confirm.status = 1;

                jBtn.addClass('loading');

                ajax(ajaxOptions, jBtn);
            }

            var title = params.title,
                description = params.description,
                ajaxOptions = params.ajaxOptions,
                    
                jPopupBox;

            confirm.status = 0;
            c.confirm({
                title: title,
                description: description,
                onCloseBtn: onclose,//替换关闭按钮
                onBtns: [function () {

                    ok($(this));

                }, onclose]
            });

            /// 获焦点
            jPopupBox = c.confirm.popup.jWinBox.parent().attr('tabindex', -1).focus();
            //绑定回车
            jPopupBox.ENTER(function () {
                ok(c.confirm.jBtns.eq(0));
            });
        }

        confirm.close = onclose;
        confirm.status = 0;

        return confirm;
    })();
    //#endregion
    
    //#region 消息窗
    /*
    *** 消息窗
    
    common.msg(0,'正确消息')
    common.msg(1,'错误消息')
    common.msg('一般消息')
    common.msg({msg:'错误消息'})
    common.msg({status:true, msg:'正确消息'})
    
    */

    c.msg = (function () {

        var jBox, jMain,
            boxIsHide = true,//是否已经 隐藏
            itemH = 50,
            queue = [],
            unnecessary = 0,
            count = 0;

        function itemShow(jItem) {

            count++;

            jItem.height(0).animate({
                height: itemH
            });

            jItem.css({
                left: -jItem.outerWidth() / 2
            });

            boxYUpdate();
            
            setTimeout(function () {
                jItem.animate({
                    height: 0
                }, function () {
                    jItem.remove();
                });

                count--;

                boxYUpdate();

            }, arguments.length > 1 ? arguments[1]: 2000);
        }

        function boxYUpdate() {
            jBox.animate({
                bottom: (common.winWH.height - count * itemH) / 2
            }, { queue: false });
        }

        function boxShow() {
            if (boxIsHide) {
                boxIsHide = false;
                jBox.show();
            }
        }

        function boxHide() {
            boxIsHide = true;
            //delAll();
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

            jItem = $('<li class="' + cssVal + '"><div class="m_txt">' + msg + '</div><i class="m_c" title="关闭"></i></li>').appendTo(jMain);
            var msgTimeOut = arguments.length > 2 ? arguments[2] : 2000;//方法分析时间
            itemShow(jItem, msgTimeOut);
        };
    })();

    //通过cookie。成功提醒。实现刷新页面提醒
    c.succMsg = {
        show: function () {
            var msg = c.getCookie('succmsg');

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

    //#region 全屏弹窗
    // 全屏弹窗 关闭只是隐藏，没有删除元素
    c.FullPopup = function (params) {
        var
            content = params.content,
            onSureBtn = params.onSureBtn,
            onCloseBtn = params.onCloseBtn,

            jBox, jMainCon,
            eBox,
            jConBox,
            jTopBar,
            jTitle,
            jBtns,
            jCloseBtn,
                
            _this=this;

        function close() {
            $(document.documentElement).css('overflow', 'auto');

            jBox.removeClass('show');

        }

        function init() {

            jBox = $('<div class="full_popup"><div class="f_main">\
    <div class="top"><span class="tit"></span><b></b></div>\
    <div class="full_popup_con"></div>\
    <div class="bottom">\
        <a class="button" href="javascript:;">保&nbsp;&nbsp;&nbsp;存</a>\
        <a class="button red" href="javascript:;">取&nbsp;&nbsp;&nbsp;消</a>\
    </div></div>\
</div>').appendTo(c.bJq);

            jMainCon = jBox.children();

            jConBox = jMainCon.children('.full_popup_con');

            jBtns = jMainCon.children('.bottom').children();

            jTopBar = jMainCon.children('.top'),

            jCloseBtn = jTopBar.children('b');

            jTitle = jTopBar.children('.tit');

            jCloseBtn.add(jBtns.eq(1)).click(onCloseBtn);

            jBtns.eq(0).click(onSureBtn);

            jConBox.append(content);

            eBox = jBox[0];

            _this.jBox = jBox;
            _this.jConBox = jConBox;
            _this.jBtns = jBtns;

        }

        this.show = function (params) {

            $(document.documentElement).css('overflow', 'hidden');

            //jBox.show();
            setTimeout(function () {
                jBox.addClass('show');
            }, 1);

        };

        this.close = close;

        this.setTitle = function (name) {
            jTitle.html(name);
        };

        init();
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

    //#region 动态动画效果
    /*
    **动态动画效果
    目标位置 随便都可以改变的动画效果
    

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
    c.changeAnime = function (change, rate) {

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

    //#region 动画效果 可 自由配置

    /*
       var a = new common.easingBuild();
    
        a.curParams = {
            w: 100
        };
        a.excu({
            x: 600,
            y: 90,
            w: 600
        }, {
            go: function (to) {
    
                //div1.style.left = to.x + 'px';
                //div1.style.top = to.y + 'px';
                div1.style.width = to.w + 'px';
            },
            speed: 600
        });
    
    */
    c.easingBuild = function (params) {
        var
            that = this,

            curParams = {},

            stopId = null;

        function excu(params, options) {

            var
                go = options.go,

                speed = options.speed === undefined ? 400 : options.speed,
                easing = options.easing === undefined ? 'swing' : options.easing,
                callBack = options.callBack === undefined ? function () { } : options.callBack,

                start = {},

                t = 0,//当前起始次数
                time = 17,//帧间隔
                d = speed / time;//总次数

            stop();

            for (var name in params) {

                if (curParams[name] === undefined) {
                    curParams[name] = 0;
                }

                start[name] = curParams[name];
            }

            function run() {
                var to = {},
                    cur;

                if (t < d) {
                    t++;

                    for (var name in params) {
                        cur = start[name];

                        to[name] = jQuery.easing[easing](null, t, cur, params[name] - cur, d);
                    }

                    curParams = to;

                    go(to);

                    stopId = setTimeout(run, time);
                }
                else {
                    go(params);

                    curParams = params;

                    stopId = null;

                    callBack();
                }
            }

            run();
        }

        function setCurParams(params) {

            for (var name in params) {
                curParams[name] = params[name];
            }
        }

        function stop() {
            if (stopId !== null) {
                clearTimeout(stopId);
                stopId = null;
            }
        }

        this.excu = excu;
        this.setCurParams = setCurParams;
        this.stop = stop;

        //setCurParams(params);
    };
    //#endregion

    //#region 浏览器窗口滚动条动画 - jq

    /*
    # 基础

    调用举例：
    
    //动画
    $(window).scrollRun(1000);
    $(window).scrollRun(1000, 2000);
    $(window).scrollRun(1000, 2000, undefined, undefined, 'Top');
    $(window).scrollRun(1000, 2000, undefined, undefined, 'Left');
    $(window).scrollRun(1000,600,'easeOutQuint',function(){}, 'Top');
    
    //停止
    $(window).scrollStop();
    
    */
    jQuery.fn.extend((function () {
        var go, goLeft;

        function scrollRun(end, speed, easing, callBack, way) {
            var
                speed = speed === undefined ? 400 : speed,
                way = way === undefined ? 'Top' : way,
                wJq = this,
                g;

            if (way === 'Top') {
                if (go === undefined) go = new common.easingBuild();
                g = go;
            }
            else {
                if (goLeft === undefined) goLeft = new common.easingBuild();

                g = goLeft;
            }

            g.setCurParams({ to: wJq['scroll' + way]() });

            g.excu({
                to: end
            }, {
                go: function (goParams) {
                    wJq['scroll' + way](goParams.to);
                },
                speed: speed,
                easing: easing,
                callBack: callBack

            });

        }

        function scrollStop() {
            go && go.stop();
            goLeft && goLeft.stop();
        }

        //滚轮事件情况 停止 滚动条动画
        c.ready(function () {

            //c.mouseWheel(window.document.body, function (e) {
            //    //wJq.scrollStop();
            //});
        });


        return {
            scrollRun: scrollRun,
            scrollStop: scrollStop
        };
    })());

    // # 扩展
    //多次调用，只取第一次情况。
    //适用于页面中，从上往下验证错误，多个报错情况，滚到第一个报错位置
    //c.scrollMoreToFirst.data=[]; //一组(包含多次)调用前 进行手动清0
    //go [number] 到达的位置
    c.scrollMoreToFirst = function (go) {

        var t = c.scrollMoreToFirst;

        t.data = c.paramUn(t.data, []);

        t.data.push(go);

        setTimeout(function () {
            c.wJq.scrollRun(t.data[0]);
        }, 1);
    }

    //#endregion

    //#region 加载中
    c.Load = function (jElem) {
        var DelayExcu = new common.delayExcu();

        jElem = jElem || $();

        this.status = 0;//1 加载中

        this.start = function () {
            this.status = 1;
            DelayExcu.excu(function () {
                jElem.addClass('loading');
            });
        };

        this.end = function () {
            this.status = 0;

            DelayExcu.clear();
            //if (DelayExcu.clear() === false) {
            //    jElem.removeClass('loading');
            //}

            jElem.removeClass('loading');
        };
    };
    //#endregion

    //#region 按键监听 - jq

    jQuery.fn.extend({

        /*
        回车监听
        绑定文本框。表单自带回车监听，但也只对文本框有效
        jTxt.ENTER(function () {
            //回车执行
        });
        */
        ENTER: function (fn) {
            return this.keydown(function (e) {
                if (e.keyCode === 13) {
                    return fn.call(this, e);
                }
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


    // 双键绑定
    c.doubleKey = function (params) {
        var firstCode = params.firstCode,
            jBox = params.jBox,
            downExcu = params.downExcu,
            firstDown = false;

        jBox.on({
            keydown: function (e) {
                var kc = e.keyCode;

                if (kc === firstCode) {
                    firstDown = true;
                    return false;
                }

                if (firstDown) {
                    return downExcu(kc);
                }
            },
            keyup: function (e) {
                if (e.keyCode === firstCode) {
                    firstDown = false;
                }
            },
            blur: function () {
                firstDown = false;
            }
        });
    };

    //#endregion

    //#region 闪烁 - jq

    /*
    jElem.flicker();
    jElem.flicker({
        toBc: '#ff9'
    });
    */
    jQuery.fn.flicker = function (params) {
        function flicker(params) {

            var jElem = params.jElem,
                eElem = jElem[0],

                bc = eElem.data_bc,
                toBc = c.paramUn(params.toBc, '#ff9'),
                status = 0,
                time = 6;

            if (bc === undefined) {
                bc = eElem.data_bc = jElem.css('background-color');
            }

            if (eElem.data_flickerTimeId !== undefined) {
                clearTimeout(eElem.data_flickerTimeId);
                eElem.data_flickerTimeId = undefined;
            }

            function excu() {

                eElem.data_flickerTimeId = setTimeout(function () {

                    if (status) {
                        jElem.css('background-color', bc);
                        status = 0;
                    }
                    else {
                        jElem.css('background-color', toBc);
                        status = 1;
                    }

                    if (time > 1) {
                        excu();
                    }

                    time--;
                }, 300);
            }

            excu();
        }

        function isTransparent(str) {
            var vStr = 'rgba(0, 0, 0, 0)|transparent';

            return vStr.indexOf(str) > -1;

        }

        params = params || {};

        return this.each(function () {
            flicker({
                jElem: $(this),
                toBc: params.toBc
            });
        });


    };
    //#endregion

    //#region url 处理
    c.createUrl = function (str) {
        return str;
    };
    //#endregion

    //#region 全屏覆盖加载
    c.pageLoading = (function () {
        function PageLoading() {
            var jBox,
                jContent,
                delayExcu;

            this.show = function (params) {
                params = c.paramUn(params, {});

                var html = params.html,
                    delayTime = params.delayTime,
                    callback =c.paramUn( params.callback, function () { });

                if (!jBox) {
                    delayExcu = new c.delayExcu();

                    jBox = $('<div class="page_loading"><div class="info">处理中</div></div>').appendTo(bJq).hide();

                    jContent = jBox.children();
                }

                jBox.removeClass('err');

                delayExcu.excu(function () {
                    jBox.show();
                    jContent.html(html);
                    callback(jContent);
                }, delayTime);
            };

            this.close = function () {
                if (delayExcu.clear() === false) jBox.hide();;
            };

            this.err = function (params) {
                this.show(params);
                jBox.addClass('err');
            };
        }

        return new PageLoading();

    }());
    //#endregion

    //#region 索引 转换 字母(大写)
        
    // index [number] 索引从0 开始
    c.getLetter = function (index) {
        index *= 1;
        return String.fromCharCode(65 + index)
    };
    //#endregion

    //#region 时间格式化
    // time 毫秒数
    c.formatTime = function (time) {
        function patch(num) {
            return num.toString().length === 1 ? '0' + num : num;
        }

        var
			nowDate = new Date(),
			s = Math.floor((nowDate.getTime() - time) / 1000),
			m, h, nD,
			date, tY, tMon, tD, tH, tM,
            tStr;

        if (s <= 60) {

            return '刚刚';

        }
        m = Math.floor(s / 60);

        if (m < 60) {

            return m + '分钟前';
        }

        h = Math.floor(m / 60);

        if (h <= 1) {

            return h + '小时前';
        }

        date = new Date(time*1);

        tY = date.getFullYear();
        tMon = date.getMonth();
        tD = date.getDate();
        tH = date.getHours();
        tM = date.getMinutes();

        nD = nowDate.getDate();

        if (nowDate.getFullYear() !== tY) {

            return tY + '-' + patch(tMon + 1) + '-' + patch(tD) + ' ' + patch(tH) + ':' + patch(tM);
        }

        if (nowDate.getMonth() !== tMon) {

            return patch(tMon + 1) + '-' + patch(tD) + ' ' + patch(tH) + ':' + patch(tM);
        }

        if (nowDate.getDate() !== tD) {
            switch (nD - tD) {
                case 1:
                    tStr = '昨天';
                    break;
                case 2:
                    tStr = '前天';
                    break;
                default:
                    tStr = patch(tMon + 1) + '-' + patch(tD);
            }

            return tStr + ' ' + patch(tH) + ':' + patch(tM);
        }

        return patch(tH) + ':' + patch(tM);
    };
    //#endregion

    //#region 自定义下拉 失焦关闭 实现

    /*
    自定义下拉 失焦关闭 实现
    
    # 初始
    
        @example
            downMenuBlurClose = new c.DownMenuBlurClose({
                jHover: jSelectBox,
                jShowBtn: jShowBtn,
                jShowBox: jShowBox,
                onShow: function () { },
                onClose: function () { }
            });
        @param jHover [jq] 获焦 范围元素
        @param jShowBtn [jq] 触发显示隐藏的按钮元素
        @param * jShowBox [jq] 要显示隐藏的元素
        @param * onShow [jq] 显示后执行
        @param * onClose [jq] 关闭后执行
    # method
        @@ downMenuBlurClose.close 手动关闭
        @example
            downMenuBlurClose.close();
    
    */
    c.DownMenuBlurClose = function (params) {
        var
            jHover = params.jHover,
            jShowBtn = params.jShowBtn,
            jShowBox = params.jShowBox === undefined ? $() : params.jShowBox,
            onClose = params.onClose === undefined ? function () { } : params.onClose,
            onShowBefore = params.onShowBefore === undefined ? function () { } : params.onShowBefore,
            onShow = params.onShow === undefined ? function () { } : params.onShow,
            dJq = $(document),
            isShow = false;

        function close() {
            jShowBox.hide();

            dJq.off({ mousedown: close });

            isShow = false;

            onClose();

        }

        jHover.hover(function () {
            dJq.off({ mousedown: close });
        }, function () {
            if (jShowBox.css('display') !== 'none') dJq.on({ mousedown: close });
        });

        jShowBtn.click(function () {
            if (isShow) {
                close();
            }
            else {
                if (onShowBefore() !== false) {
                    isShow = true;
                    jShowBox.show();
                    onShow();
                }
            }
        });

        this.close = close;
    };

    //#endregion

    //#region 全选功能
    c.checkAll = function (allCheckBox, otherCheckBox) {

        if (!allCheckBox.length) return;

        allCheckBox[0].checked = false;

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

    //#region 可拖动看图_自定义滚动条

    /*
    
    可不带滚动条
    
    sb = new scrollBar({
        jBox: jBox,
        jCon: jMove,
        jBarBox: jBarBox, // 可不带
        jBar: jBar, // 可不带
        type: 'left' // 可不带。默认top
    });
    sb.update({
        boxS: boxW,
        conS: conW - 16,
        barBoxS: boxW // 可不带
    });

    /// 关于 click 与拖动
    // 拖动情况下不执行。此click绑定了 jCon
    sb.click=function(e){}
    // jCon 内的的a元素 href与拖动的关系 无需另外处理
    
    */
    c.scrollBar = function (params) {
        var
            that = this,
            jBox = params.jBox,// 显示窗口
            jCon = params.jCon,// 内容窗口
            jBarBox = params.jBarBox === undefined ? $() : params.jBarBox,
            jBar = params.jBar === undefined ? $() : params.jBar,
            type = params.type === undefined ? 'top' : 'left',

            boxS, // 显示窗口
            conS, // 内容

            barMinS = 30,
            barMoveLen, conMoveLen,
            moveR,
            barS = barMinS,
            barBoxS = 0,

            curBarO = 0,
            curConO = 0,

            conAnime = new common.changeAnime(function (v) {
                jCon.css('margin-' + type, v);
            });

        function drag() {
            var o;
            common.drag(jBar, function (xy) {
                moveByBar(o + xy[type]);
            }, function () {
                o = curBarO;
            });
        }

        function conDrag() {
            var o,
                 oVel = new c.velocity(),
                 stripingReduce,
                isDrag = false;

            common.drag(jCon, function (xy) {
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

            stripingReduce = new c.StripingReduce();

            jCon.click(function (e) {

                if (isDrag === false) {
                    that.click(e);
                }
                else {
                    return false;
                }
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
            barBoxS = params.barBoxS === undefined ? 1 : params.barBoxS;

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

            if (o === curBarO && conO === curConO) return;

            conAnime.start(conO);
            jBar.css('margin-' + type, o);
            //jCon.css('margin-' + type, conO);

            curBarO = o;
            curConO = conO;

            that.change(curConO);
        }

        function moveByCon(o) {
            var isScroll;//true表示 自定义的滚动条可 滚动，系统的不能滚动

            if (o < -conMoveLen) o = -conMoveLen;
            if (o > 0) o = 0;

            var barO = -o / moveR;

           

            if (barO === curBarO && o === curConO) return false;//系统可以滚动

            //jCon.css('margin-' + type, o);
            jBar.css('margin-' + type, barO);

            conAnime.start(o);

            isScroll = o !== curConO;

            curBarO = barO;
            curConO = o;

            that.change(curConO);

            return  isScroll;
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
            c.mouseWheel(jBox[0], function (e) {
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
           
                //没有滚动条 固定不阻止
                if (boxS-conS > 1) {
                    return true;
                }

                //阻止滚动条滚动，left 情况固定阻止系统
                if (type === 'left') {
                    if (e.cancelable) e.preventDefault();
                    return false;
                }

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
        this.change = function () { };
        this.click = function () { };

        barBoxClick();
        mouseWheel();
    };
    //#endregion

    //#region 限制输入，只能输入数字
    // keyup 将 清空非数字字符
    $.fn.onlyNumInput = function () {
        var jIns = this;
        jIns.on({
            keyup: function () {
                var
                    jIn=$(this),
                    v = jIn.val();

                if (/[^\d]/.test(v)) {
                    jIn.val(v.replace(/[^\d]/g, ''));
                }
            }
        });

        return this;
    };

    //#endregion

    //#region 数字 转 中国小写数字
    c.cnNumConvert = function (num) {
        var
            numLen,
              targetNum = '',
              i, len,
              t1;

        var a = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'],
            a2 = ['十', '百', '千', '万', '十万', '百万', '千万', '亿', '十亿', '百亿', '千亿'];

        num = num + '';

        numLen = num.length;

        for (i = 0, len = numLen - 1; i < len; i++) {
            t1 = num.charAt(i) - 1;

            if (t1 < 0) {
                targetNum += '零';
            }
            else {
                targetNum += a[t1] + a2[len - i - 1];
            }

        };

        t1 = num[numLen - 1] - 1;

        if (t1 < 0) {
            targetNum += '零';
        }
        else {
            targetNum += a[t1];
        }

        // 多个零替换成一个零
        targetNum = targetNum.replace(/[零]+/g, "零");

        // 去掉末尾的 零
        t1 = targetNum.length - 1;
        if (targetNum.charAt(t1) === '零') {
            targetNum = targetNum.substr(0, t1);
        }

        targetNum = targetNum.split('万');
        for (i = 0, len = targetNum.length - 1; i < len; i++) {
            if (i === len - 1) {
                targetNum[i] += '万';
            }
        }
        targetNum = targetNum.join('');

        targetNum = targetNum.split('亿');
        for (i = 0, len = targetNum.length - 1; i < len; i++) {
            if (i === len - 1) {
                targetNum[i] += '亿';
            }
        }
        targetNum = targetNum.join('');

        return targetNum;
    };

    //#endregion

    //#region 表示全局唯一标识符 (GUID)。  

    //初始化 Guid 类的一个新实例。  
    c.NewGuid = function () {
        var g = "";
        var i = 32;
        while (i--) {
            g += Math.floor(Math.random() * 16.0).toString(16);
        }
        return new function (g) {
            var arr = new Array(); //存放32位数值的数组  
            if (typeof (g) == "string") { //如果构造函数的参数为字符串  
                InitByString(arr, g);
            }
            else {
                InitByOther(arr);
            }

            //返回一个值，该值指示 Guid 的两个实例是否表示同一个值。  
            this.Equals = function (o) {
                if (o && o.IsGuid) {
                    return this.ToString() == o.ToString();
                }
                else {
                    return false;
                }
            }
            //Guid对象的标记  
            this.IsGuid = function () { }
            //返回 Guid 类的此实例值的 String 表示形式。  
            this.ToString = function (format) {
                if (typeof (format) == "string") {
                    if (format == "N" || format == "D" || format == "B" || format == "P") {
                        return ToStringWithFormat(arr, format);
                    }
                    else {
                        return ToStringWithFormat(arr, "D");
                    }
                }
                else {
                    return ToStringWithFormat(arr, "D");
                }
            }
            //由字符串加载  
            function InitByString(arr, g) {
                g = g.replace(/\{|||\}|-/g, "");
                g = g.toLowerCase();
                if (g.length != 32 || g.search(/[^0-9,a-f]/i) != -1) {
                    InitByOther(arr);
                }
                else {
                    for (var i = 0; i < g.length; i++) {
                        arr.push(g[i]);
                    }
                }
            }
            //由其他类型加载  
            function InitByOther(arr) {
                var i = 32;
                while (i--) {
                    arr.push("0");
                }
            }
            /*  
            根据所提供的格式说明符，返回此 Guid 实例值的 String 表示形式。  
            N  32 位： xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  
            D  由连字符分隔的 32 位数字 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  
            B  括在大括号中、由连字符分隔的 32 位数字：{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}  
            P  括在圆括号中、由连字符分隔的 32 位数字：(xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)  
            */
            function ToStringWithFormat(arr, format) {
                switch (format) {
                    case "N":
                        return arr.toString().replace(/,/g, "");
                    case "D":
                        var str = arr.slice(0, 8) + "-" + arr.slice(8, 12) + "-" + arr.slice(12, 16) + "-" + arr.slice(16, 20) + "-" + arr.slice(20, 32);
                        str = str.replace(/,/g, "");
                        return str;
                    case "B":
                        var str = ToStringWithFormat(arr, "D");
                        str = "{" + str + "}";
                        return str;
                    case "P":
                        var str = ToStringWithFormat(arr, "D");
                        str = "(" + str + ")";
                        return str;
                    default:
                        return new Guid();
                }
            }
        }(g);
    };
    //#endregion

    //#region domain 全局
    c.getDomain = function () {
        if (/\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}/.test(location.hostname)) {
            return location.hostname;
        }
        else {
            return location.hostname.substr(location.hostname.indexOf('.') + 1);
        }
    };
    //#endregion

    //#region 数组循环
    // 支持有length，并且能根据索引取到的 集合
    c.each = function (arr, fn) {
        for (var i = 0, len = arr.length; i < len; i++) {
            fn(i, arr[i]);
        }
    };
    //#endregion

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

    //#region 图片预览 带放大
    c.pictureViewer = function (src) {

        var
            //src = elem.src,
            img = new Image(),
            jImg = $(img),
            enlarge = Enlarge(),
            boxW, boxH,
            imgX, imgY,
                imgW, imgH;

        var jBox = $('<div class="img-view loading" tabindex="-1"><div class="bg"></div><div class="img"></div></div>');

        document.body.appendChild(jBox[0]);

        jBox.fadeIn();

        img.onload = function () {
            jBox.removeClass('loading');

            var xywh = center({
                boxWidth: jBox.width(),
                boxHeight: jBox.height(),
                width: img.width,
                height: img.height
            });

            imgX = xywh.left;
            imgY = xywh.top;
            imgW = xywh.width;
            imgH = xywh.height;

            jImg.css(xywh).fadeIn();

            drag();

            enlarge.ini();
        };

        img.src = src;

        jBox.append(img);

        // 关闭
        jBox.children('.bg').click(close);

        jBox.focus().keydown(function (e) {
            if (e.keyCode === 27) close();
        });

        function close() {
            jBox.finish().fadeOut(function () {
                jBox.remove();
            });
        }

        function center(params) {

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

            whxy = { width: width ? width : 0, height: height ? height : 0 };

            whxy[PR + 'left'] = left ? left : 0;
            whxy[PR + 'top'] = top ? top : 0;

            return whxy;
        }

        function drag() {
            var x, y;
            c.drag(jImg, function (xy) {

                imgX = xy.left + x;
                imgY = xy.top + y;
                jImg.css({
                    left: imgX,
                    top: imgY
                })
            }, function () {
                x = imgX;
                y = imgY;
            }, function () {

            });
        }
        
        //缩小放大
        function Enlarge() {

            var mouseOffsetXY, lastWHXY;

            function getLastWHXY() { return lastWHXY; }

            //根据光标所在元素位置，取当前增加 高宽 对象增加的 xy
            function getAddXY(toW, toH) {
                return {
                    x: mouseOffsetXY.x / lastWHXY.width * Math.abs(toW - lastWHXY.width),
                    y: mouseOffsetXY.y / lastWHXY.height * Math.abs(toH - lastWHXY.height)
                }
            }

            function excu(isUp, e, er) {
                var

                    //每放大阶段值。宽度根据高宽比 得到
                    valH = imgH * (er || .2),
                    valW = valH / imgH * imgW,

                    toW = imgW,
                    toH = imgH,
                    toX = imgX,
                    toY = imgY,

                    lenXY;

                mouseOffsetXY = getMouseOffset(e);

                lastWHXY = {
                    width: imgW,
                    height: imgH,
                    left: imgX,
                    top: imgY
                };

                if (isUp) {
                    toW += valW;
                    toH += valH;
                }
                else {
                    toW -= valW;
                    toH -= valH;
                }

                //根据增加的高宽 得 要加的 坐标
                lenXY = getAddXY(toW, toH);

                if (isUp) {
                    toX -= lenXY.x;
                    toY -= lenXY.y;
                }
                else {
                    toX += lenXY.x;
                    toY += lenXY.y;
                }

                imgW = toW;
                imgH = toH;
                imgX = toX;
                imgY = toY;
                jImg.animate({
                    width: toW,
                    height: toH,
                    left: toX,
                    top: toY
                }, { queue: false, speed: 1000 });
            }

            /*
            元素 范围判断
            */
            function domRange(elem) {
                return true;
            }

            //取 鼠标位置。放大依据
            function getMouseOffset(e) {
                var mouseOffsetX, mouseOffsetY;
                if (domRange(e.target || e.srcElement)) {
                    var

                        pageX = e.pageX === undefined ? document.documentElement.scrollLeft + e.clientX : e.pageX,
                        pageY = e.pageY === undefined ? document.documentElement.scrollTop + e.clientY : e.pageY;

                    mouseOffsetX = pageX - imgX;
                    mouseOffsetY = pageY - imgY;

                }
                else {
                    mouseOffsetX = imgW / 2;
                    mouseOffsetY = imgH / 2;
                }

                return { x: mouseOffsetX, y: mouseOffsetY - wJq.scrollTop() };
            }

            //
            function ini() {

                c.mouseWheel(jImg[0], function (e) {
                    ////IE/Opera/Chrome  向上正数，向下负数 
                    //fox 向下正数，向上负数

                    e = e || window.event;

                    var isUp = false;

                    if (e.wheelDelta) {//IE/Opera/Chrome 
                        if (e.wheelDelta > 0) isUp = true;
                    }
                    else if (e.detail) {//Firefox 
                        if (e.detail < 0) isUp = true;
                    }

                    excu(isUp, e);

                    if (e.cancelable) e.preventDefault();
                    return false;
                });

                //双击放大
                jImg.dblclick(function (e) {
                    excu(true, e.originalEvent, .6);
                });
            }

            return { ini: ini, getAddXY: getAddXY, getLastWHXY: getLastWHXY };
        }
    };
    //#endregion
    

    return c;
})();

var c = common;
