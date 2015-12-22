


var eIframe = document.getElementById('editIframe'),
    eTool = document.getElementById('toolBox'),

    iWindow = eIframe.contentWindow,
    iDocument = iWindow.document;


iDocument.body.innerHTML = '就拿最近腾讯的MHOL来说，我和一个群里<span id="bgColor1" style="font-weight:bold;">十几个老猎人</span>玩了一段时间（不少于100小时，有的人咋看不懂字啊，不少于100小时只是在MHOL上）后\
，普遍的反映是此作在手感/游戏流程/风格上对MH往日作品的还原相当好，花钱刚需的地方也只有一开始的VIP排队（现在非VIP也已经很容易进入），\
我和朋友只花了一个月VIP的钱，装备一直在主流梯队，换句话说RMB玩家在这个游戏里并不能获得什么优势。\
但为什么微博和知乎上在MHOL的问题下都是清一色的+10086黄金太刀/没钱玩XXX/除了画面毫无特点/土豪玩家秒天秒地/看到腾讯我就呵呵之类的评价？\
在国内网络游戏这块，腾讯是明显的多用户少收费的模式，CF/DNF/LOL三巨头我都玩过，基本上都是不花钱或者花较少（500以内）就能体验到大部分游戏内容且游戏性相当不错的游戏。\
相对于土豪拉动消费，凌驾普通玩家之上，这难道不是比较良性的收费模式吗？为何玩家充斥着对腾讯的偏见，认为腾讯游戏非常花钱呢？'

iDocument.designMode = "on";


eTool.onclick = function (e) {

    var set = tool[e.target.getAttribute('type')];
    if (set) {
        //iWindow.focus();
        set();
    }
}


var tool = {
    // 设置粗体
    bold: function () {
        iDocument.execCommand("Bold");

    }
    // 删除线
    , unlink: function () {
        iDocument.execCommand("unlink");
    }
    // 删除
    , delete: function () {
        iDocument.execCommand("delete");
    }
    // 连接
    , a: function () {
        iDocument.execCommand("createLink", false, "//baidu.com");
    }
    // 测试
    , test: function () {

        var
            selection = iWindow.getSelection(),

            range2,
            range;


        //range = selection.getRangeAt(0);
        range = iDocument.createRange();
        range2 = iDocument.createRange();

        //range.setStart(iDocument.body.childNodes[0], 0);
        //range.setEnd(iDocument.body.childNodes[0], 20);

        range.selectNode(iDocument.body.childNodes[0]);



        selection.removeAllRanges();
        selection.addRange(range);


        iDocument.execCommand("createLink", false, "//baidu.com");
        //iDocument.getElementById("bgColor1").style.display = "none";


        //iWindow.focus();
    }
};


function 控制选区() {
    //iWindow.focus();


    //document.execCommand("backColor",false,'#000');
    var
        selection = iWindow.getSelection(),
        range = iDocument.createRange();
    //range = selection.getRangeAt(0);

    //

    range.setStart(iDocument.body.childNodes[0], 1);
    range.setEnd(iDocument.body.childNodes[0], 2);
    //range.setEnd(6);

    console.log(range);

    selection.removeAllRanges();
    selection.addRange(range);
}
