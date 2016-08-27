
/*

# 一些功能性模块

这里只做备份参考。不供调用

*/


// html 格式化
// 对于一些word转换的html进行标准化正确化，以便被正确转为图片
function refactorHtml(callback) {
    var bd = document.body;

    var html = '<style>' + cssHandle() + '</style>' + '<div style="background-color:#fff;overflow:hidden"><div class="bd ' + bd.className + '" style="' + (bd.getAttribute('style') || '') + '">' + bd.innerHTML + '</div></div>';

    bd.removeAttribute('class');
    bd.removeAttribute('style');
    bd.style.margin = 0;

    bd.innerHTML = html;

    save();

    function save() {
        addScript(html2canvasUrl, function () {
            html2canvas(bd.children[1]).then(function (cvs) {
                bd.innerHTML = '';
                document.body.appendChild(cvs);
                callback(cvs);
            });
        });
    }

    function getStyleContent(style) {

        var txt = style.textContent;

        // 去空格
        txt = txt.replace(/[\s\n\r]+/g, ' ');
        txt = txt.replace(/[\s\n\r]([;}])/g, '$1');
        txt = txt.replace(/([;{])[\s\n\r]/g, '$1');

        // 加单位
        txt = txt.replace(/([\d]+)([;}])/g, '$1px$2');

        // 转移body{}
        txt = (' ' + txt).replace(/([^\.#])body/g, '$1.bd');

        // in 转像素
        // txt=txt.replace(/([\d.]+)in/g,function () {
        // 	return arguments[1]*96+'px';
        // });

        return txt;
    }

    function cssHandle() {
        var cssTxt = '';
        c.each(document.querySelectorAll('style'), function (i, style) {

            cssTxt += getStyleContent(style);

            c.removeElement(style);

        });

        return cssTxt;
    }

}

function getText(html) {
    var elem = document.createElement('div');
    elem.innerHTML = html;
    return elem.textContent;
}

// 随机取数组
// 使用模运算实现界限
function shuffle(arr, cb) {
    var data = arr,
        total = data.length,
        len = (total + '').length,
        digit = (1 + (new Array(len)).join('0') + '0');

    for (var i = total; i--;) {
        var index = ~~(Math.random() * digit) % data.length;
        cb(data.splice(index, 1)[0]);
    }
}
// 随机取数组 - 新
// 使用新的界限实现
function shuffle(data, cb) {
    for (var i = data.length; i--;) {
        cb(data.splice(~~(Math.random()*(i+1)), 1)[0]);
    }
}
// 洗牌。打乱数组顺序。网上代码
function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

// 显示窗口居中
function setXY(boxW, boxH) {
    var winW = document.documentElement.clientWidth,
        winH = document.documentElement.clientHeight,
        x, y;

    x = (winW - boxW) / 2;
    y = (winH - boxH) / 2;

    eLayer.style.left = x + 'px';
    eLayer.style.top = y + 'px';

}

/**
 * 达到指定数量后执行
 * @param {number,string} key 将根据此键值找到传入的数据
 * */
// function excu(d, key) {
//     var
//         count = 2,
//         i = 0,
//         allData = {};
//
//     count=count||2;
//
//     excu = function (d, key) {
//         i++;
//         allData[key] = d;
//
//         if (i === count)init(allData);
//     };
//     excu(d, key);
// }
// function init(allData) {
//
// }
