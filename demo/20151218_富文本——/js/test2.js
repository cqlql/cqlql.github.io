

(function () {

    var eIframe = document.getElementById('editIframe'),
        eTool = document.getElementById('toolBox'),

        iWindow = eIframe.contentWindow,
        iDocument = iWindow.document;

    iDocument.designMode = "on";

    iDocument.body.innerHTML = '&#8203;';

    eTool.onclick = function (e) {

        var set = tool[e.target.getAttribute('type')];
        if (set) {
            iWindow.focus();

            set();
        }

    };


    iDocument.body.className = 'rich-edit';

    iDocument.body.change = function (e) {


    };

    var range;
    var selection;
    var tool = {
        // 设置粗体
        bold: function () {

        }

        // 删除线
        , strikeThrough: function () {

        }
        // 删除
        , delete: function () {

        }
        // 链接
        , a: function () {

        }
        // 撤销
        , undo: function () {

        }

        // 重点1
        , 'em-red': function () {

        }

        // code-javascript
        , "code-javascript": function () {

        }

        , insertHxModule: function (text) {

        }
        , h1: function () {

        }
        , h2: function () {

        }
        , h3: function () {

        }
        , h4: function () {

        }
        , h5: function () {

        }

        // 删除标题模块
        , delHx: function () {

            var
                selection = iDocument.getSelection(),
                elem = selection.anchorNode.parentElement;

            fn();

            function fn() {
                if (elem.tagName === 'SECTION') {
                    c.removeElement(elem);
                }
                else {
                    elem = elem.parentElement;
                    fn();
                }
            }
        }

        // 小标题1
        , minh1: function () {
            var selection = iWindow.getSelection(),
                range;

            if (selection.isCollapsed === false) {
                range = selection.getRangeAt(0);
                range.surroundContents(c.htmlToElems('<span class="h1"></span>')[0]);

                selection.removeAllRanges();
                selection.addRange(range);
            }

        }

        // 测试
        , test: function () {
            iWindow.document.body.innerHTML = data[1][0];
            iWindow.getSelection().removeAllRanges();
            iWindow.getSelection().addRange(data[1][1]);
            console.log(data[1][1]);
            return;
            selection = iWindow.getSelection();
            var r =document.createRange();;

            var tNode = document.createTextNode('xxxxxxxxxx');

            r.insertNode(tNode);

            range = r.cloneRange();

            selection.addRange(r);


            //console.log(range);

            //console.log(range.toString());

        }
        // 测试
        , test2: function () {
            //console.log(range);
            //iWindow.getSelection().removeAllRanges();
            //iWindow.getSelection().addRange(range);


            console.log(data);
        }
    };




    var data = [], excuFrequency = new ExcuFrequency();
    iWindow.onkeydown = function () {
        excuFrequency.excu(function () {
            console.log(iWindow.getSelection().getRangeAt(0));
            data.push([iWindow.document.body.innerHTML, iWindow.getSelection()]);
        });
    };

    editInit();

    function ExcuFrequency() {
        var status = 0;
        this.excu = function (fn, time) {
            if (status) return;
            status = 1;
            setTimeout(function () {
                fn();
                status = 0;
            }, time === undefined ? 600 : time);
        }
    }

    function excuSelect() {
        var
         selection = iWindow.getSelection(),
         range = iDocument.createRange();


        range.setStart(iDocument.body.childNodes[0], 4);
        range.setEnd(iDocument.body.childNodes[0], 5);

        selection.removeAllRanges();
        selection.addRange(range);

    }

    function editInit() {
        var selection = iWindow.getSelection(),
            range,
            eFirst;

        // 避免某些情况因为必须使用createRange而出错，保证能使用getRangeAt
        if (!selection.rangeCount) {
            eFirst = iDocument.body.childNodes[0];
            console.log(eFirst);
            range = iDocument.createRange();

            range.setStartBefore(eFirst);
            range.setEndBefore(eFirst);

            selection.removeAllRanges();
            selection.addRange(range);
        }

    }

    function addCssLink(src) {
        var cssLink = document.createElement('link');
        cssLink.rel = "stylesheet";
        cssLink.href = src;
        iDocument.head.appendChild(cssLink);
    }
})();
