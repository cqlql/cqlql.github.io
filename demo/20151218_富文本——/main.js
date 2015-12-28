


var eIframe = document.getElementById('editIframe'),
    eTool = document.getElementById('toolBox'),

    iWindow = eIframe.contentWindow,
    iDocument = iWindow.document;

iDocument.body.innerHTML = '<section class="note"><h1>title1</h1><div class="content"><p>\
审查制度是任人打扮的小姑娘，从来就不是双重标准，而是没有标准。你不配合的往死里卡，你识相懂规矩，大佬又投了钱自然是按自己人的标准来。\
</p><p><br/></p></div>\</section>';

iDocument.body.innerHTML +='<p>审查制度是任人打扮的小姑娘，从来就不是双重标准，而是没有标准。你不配合的往死里卡，你识相懂规矩，大佬又投了钱自然是按自己人的标准来。</p><p><br></p><p>function fn() {</p><p>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; if (elem.tagName === \'SECTION\') {</p><p>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; c.removeElement(elem);</p><p>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; }</p><p>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; else {</p><p>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; elem = elem.parentElement;</p><p>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; fn();</p><p>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; }</p><p>&nbsp; &nbsp; &nbsp; &nbsp; }</p><p><br></p>';

iDocument.designMode = "on";

eTool.onclick = function (e) {

    var set = tool[e.target.getAttribute('type')];
    if (set) {
        iWindow.focus();

        set();
    }

};

addCssLink('../../css/base.css');
addCssLink('note.css');
addCssLink('iframe.css');

iDocument.body.className = 'rich-edit';

iDocument.body.change = function (e) {

    console.log(1);
};


var tool = {
    // 设置粗体
    bold: function () {
        iDocument.execCommand("Bold");
    }
    
    // 删除线
    , strikeThrough: function () {
        iDocument.execCommand("strikeThrough");
    }
    // 删除
    , delete: function () {
        iDocument.execCommand("delete");
    }
    // 链接
    , a: function () {
        iDocument.execCommand("createLink", false, "//baidu.com");
    }
    // 撤销
    , undo: function () {
        iDocument.execCommand("undo");
    }

    // 重点1
    , 'em-red': function () {

    }

    // code-javascript
    , "code-javascript": function () {
        iDocument.execCommand("formatBlock", true, 'pre');
        //iDocument.execCommand('insertHTML', false, '<pre class="code" type="code-javascript">&#8203;</pre>');

    }


    // 插入标题模块文本
    // 这种方式不能撤销重做
    //, insertHxModule: function (text) {
    //    var selection = iWindow.getSelection(),
    //       range = selection.getRangeAt(0);

    //    var tagString = text;

    //    var newNode = c.htmlToElems(tagString)[0];

    //    range.deleteContents();

    //    range.insertNode(newNode);

    //    // 确保增加到div.content之下
    //    fn();

    //    range.selectNode(newNode.children[0].childNodes[0]);
    //    selection.removeAllRanges();
    //    selection.addRange(range);
    //    function fn() {
    //        var parent = newNode.parentElement;
    //        if (c.hasClass(parent, 'content') === false) {
    //            c.insertAfter(parent, newNode);
    //            fn();
    //        }
    //    }
    //}
    , insertHxModule: function (text) {
        iDocument.execCommand('insertHTML', false, text);
    }
    , h1: function () {
        tool.insertHxModule('<section class="note"><h1>title1</h1><div class="content"><p>content</p><p><br/></p></div>\</section>');
    }
    , h2: function () {
        tool.insertHxModule('<section><h2>title2</h2><div class="content"><p>content</p><p><br/></div>\</section>');
    }
    , h3: function () {
        tool.insertHxModule('<section><h3>title3</h3><div class="content"><p>content</p><p><br/></div>\</section>');
    }
    , h4: function () {
        tool.insertHxModule('<section><h4>title4</h4><div class="content"><p>content</p><p><br/></div>\</section>');
    }
    , h5: function () {
        tool.insertHxModule('<section><h4>title5</h4><div class="content"><p>content</p><p><br/></div>\</section>');
    }
    
    // 删除标题模块
    , delHx: function () {

        var
            selection=iDocument.getSelection(),
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

        if (selection.isCollapsed===false) {
            range = selection.getRangeAt(0);
            range.surroundContents(c.htmlToElems('<span class="h1"></span>')[0]);

            selection.removeAllRanges();
            selection.addRange(range);
        }

    }

    // 测试
    , test: function () {
        //var selection = iDocument.getSelection(),
        //    text = iDocument.getSelection().toString();
        //iDocument.execCommand('insertHTML', false, '');
        //iDocument.execCommand('insertHTML', false, '<span class="em-red">' + text + '&#8203;</span>');
        //selection.selectAllChildren(selection.anchorNode.parentNode);

        //iDocument.execCommand("fontSize", true, '18');

        console.log(iWindow.history);
    }
};
//iWindow.focus();

//excuSelect();

editInit();

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