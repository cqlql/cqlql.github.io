"use strict";


(function () {

    var placetable = new Placetable;

    window.reset = function (data) {
        data = data.data;

        placetable.reset(data);

        // setTimeout(function () {
        // placetable.print();
        // },1000)

    };

    function Placetable() {

        var
            c = commonInit(),
            eListCont = document.getElementById('listCont'),
            eItems,

            baseData,

            transformName = c.getRightCssName('transform'),
            cssTransform = transformName[0],

            columnCount,
            rowCount,
            count,

            itemW = 108,
            itemH = 44,
            paramRange = {
                left: 10,
                top: 10,
                right: 10,
                bottom: 10
            },
            listContW,

            userInfoData,

            avatarUrl = 'css/imgs/avatar/',

            eStyle,
            drag,


            // 新增直接移动整行整列
            eStudentItems,// 避免命名冲突，与eItems相同
            colControl, rowControl,
            // 记录每一行列的所有项
            // 以列数、行数为键，每一行列再以 eItems数组 的索引为值
            columnData,
            rowData;


        this.reset = reset;

        this.print = function () {

            var data = baseData;

            var iframe = document.createElement('iframe');

            iframe.style.border = 0;
            iframe.style.width = '880px';
            iframe.style.height = 0;

            document.body.appendChild(iframe);

            var iWin = iframe.contentWindow,
                iBd = iWin.document.body,
                iStyle = document.createElement('style'),
                eListCont, eItems,
                listContW;

            iWin.document.title = '座位表';

            var eLink = document.createElement('link');
            eLink.rel = 'stylesheet';
            eLink.href = 'css/placetable_example.css';

            iWin.document.head.appendChild(eLink);
            iWin.document.head.appendChild(iStyle);

            iBd.innerHTML = '<div class="placetable placetable-plus">\
                <div id="listCont" class="list"></div>\
                <div class="platform">讲 台</div></div>';

            eListCont = iWin.document.getElementById('listCont');

            this.print = function (data) {

                overflowHandle();

                var html = '';
                for (var i = 0, y; i < rowCount; i++) {
                    y = ((itemH + paramRange.top + paramRange.bottom) * i + paramRange.left);
                    for (var j = 0; j < columnCount; j++) {
                        var index = i * columnCount + j;
                        html += '<dl class="item" data-index="' + index + '" style="' + cssTransform + ':translate3d(' + ((itemW + paramRange.left + paramRange.right) * j + paramRange.left) + 'px,' + y + 'px,0)' + '"></dl>';

                    }
                }

                eListCont.innerHTML = html;
                eListCont.style.width = listContW + 'px';
                eListCont.style.height = rowCount * (itemH + paramRange.top + paramRange.bottom) + 'px';

                eItems = eListCont.children;

                /// 将学生 指定到座位
                c.each(userInfoData, function (i, n) {

                    var
                        seatDetail = n.seat_detail,
                        index = (seatDetail.row_no - 1) * columnCount + (seatDetail.column_no - 1),
                        eItem = eItems[getIndex(index)];
                    if (n.id !== '0') {
                        eItem.innerHTML = '<dt><img src="' + (n.avatar ? n.avatar : (avatarUrl + (~~(Math.random() * 20) + 1) + '.png')) + '" /></dt><dd>' + n.name + '</dd>';
                    }
                });

                setTimeout(function () {
                    iWin.print();
                }, 0);

            };

            this.print(data);

            function overflowHandle() {
                var maxWidth = eListCont.parentElement.clientWidth - 20,
                    w,
                    r;

                w = Math.floor(maxWidth / (columnCount + 1));

                r = Math.floor(w * .078);

                itemW = w - r * 2;
                itemH = Math.floor(itemW * 0.36);

                paramRange = {
                    left: r,
                    top: r,
                    right: r,
                    bottom: r
                };

                listContW = columnCount * (itemW + paramRange.left + paramRange.right);

                iStyle.textContent = '.placetable .platform{border:1px solid #ddd}body{margin:0;background:#f0f0f0;}.placetable{padding:0;background:#f0f0f0;}.placetable .item{outline:1px solid #ddd;width: ' + itemW + 'px;height:' + (itemH) + 'px}\
.placetable dd{margin-left:' + (itemH + 2) + 'px;font-size:' + (itemW / 108 * 12) + 'px;height:' + (itemH - 8) + 'px}';

            }
        };

        function init() {
            drag = new DragHandle({
                eBox: eListCont
            });
            colControl = new ColControl;
            rowControl = new RowControl;

            init = function () {
            };
        }

        function reset(data) {
            baseData = data;

            init();

            var seatInfo = data.seat_info;
            userInfoData = data.user_info;

            columnCount = seatInfo.column_count * 1;
            rowCount = seatInfo.row_count * 1;
            count = columnCount * rowCount;

            overflowHandle();


            columnData = {};
            rowData = {};

            var html = '';
            for (var i = 0, y; i < rowCount; i++) {
                y = ((itemH + paramRange.top + paramRange.bottom) * i + paramRange.left);
                rowData[i] = [];
                for (var j = 0; j < columnCount; j++) {
                    var index = i * columnCount + j;
                    html += '<dl class="item" data-index="' + index + '" style="' + cssTransform + ':translate3d(' + ((itemW + paramRange.left + paramRange.right) * j + paramRange.left) + 'px,' + y + 'px,0)' + '"></dl>';

                    rowData[i][j] = index;

                    if (!columnData[j]) {
                        columnData[j] = [];
                    }
                    columnData[j][i] = index;

                }
            }

            eListCont.innerHTML = html;
            eListCont.style.width = listContW + 'px';
            eListCont.style.height = rowCount * (itemH + paramRange.top + paramRange.bottom) + 'px';

            eStudentItems = eItems = [].slice.call(eListCont.children, 0);

            /// 将学生 指定到座位
            c.each(userInfoData, function (i, n) {

                var
                    seatDetail = n.seat_detail,
                    index = (seatDetail.row_no - 1) * columnCount + (seatDetail.column_no - 1),
                    eItem = eItems[getIndex(index)];
                if (n.id !== '0') {
                    eItem.innerHTML = '<dt><img src="' + (n.avatar ? n.avatar : (avatarUrl + (~~(Math.random() * 20) + 1) + '.png')) + '" /></dt><dd>' + n.name + '</dd>';
                }


                eItem.setAttribute('data-id', i);
            });

            drag.reset({
                itemW: itemW + paramRange.left + paramRange.right,
                itemH: itemH + paramRange.top + paramRange.bottom
            });

            colControl.update({
                itemW: itemW + paramRange.left + paramRange.right,
                itemH: itemH + paramRange.top + paramRange.bottom,
                paramRange: paramRange
            });
            rowControl.update({
                itemW: itemW + paramRange.left + paramRange.right,
                itemH: itemH + paramRange.top + paramRange.bottom,
                paramRange: paramRange
            });
        }

        function overflowHandle() {
            var maxWidth = eListCont.parentElement.clientWidth - 20,
                w,
                r;

            w = Math.floor(maxWidth / (columnCount + 1));

            r = Math.floor(w * .078);

            itemW = w - r * 2;
            itemH = Math.floor(itemW * 0.36);

            paramRange = {
                left: r,
                top: r,
                right: r,
                bottom: r
            };

            listContW = columnCount * (itemW + paramRange.left + paramRange.right);

            eStyle = c.addCssTxt('.placetable-plus .ctr-col,.placetable-plus .ctr-row{font-size:' + (itemW / 108 * 16) + 'px;line-height:' + (itemH - 8) / (itemW / 108 * 16) + ';}.placetable-plus .ctr-col{margin-top:' + paramRange.top + 'px;margin-left:' + (itemW + paramRange.left * 2) + 'px;height:' + (itemH + paramRange.bottom) + 'px}.placetable-plus .ctr-row{margin-left:' + paramRange.left + 'px}.placetable-plus .list{margin-left:' + (itemW + paramRange.left * 2) + 'px}.placetable .item,.placetable-plus .ctr-col li,.placetable-plus .ctr-row li{width: ' + itemW + 'px;height:' + (itemH) + 'px}\
.placetable dd{margin-left:' + (itemH + 2) + 'px;font-size:' + (itemW / 108 * 12) + 'px;height:' + (itemH - 8) + 'px}', eStyle);

        }

        // 拖动
        function DragHandle(params) {

            var
                eBox = params.eBox,
                paramRange = params.paramRange || {
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0
                    },
                // 此高宽包括外边距范围
                itemW = params.itemW + paramRange.left + paramRange.right,
                itemH = params.itemH + paramRange.top + paramRange.bottom,

                moveControl = params.moveControl || function () {
                    },
                callback = params.callback || function () {
                    },

                cssTransform = transformName[1],

                eMoveItem,

                //count,

                boxPageXY,

                currIndex,
                moveCurrIndex,// 松开前记录 操作项到了哪个索引位置。防止重复触发

                curMoveX, curMoveY, lenMoveX, lenMoveY,

                curBoxY,

                getPosition,

                // 拖动开启关闭状态。true表示关闭
                close = false,

                isMove = false,
                noMove = false;

            var scroll = new Scroll();

            c.drag(eBox, function (e) {

                if (close) return;

                if (noMove) return;

                var toX = e.x,
                    toY = e.y,

                    i, eItem, position;

                lenMoveX += toX;
                lenMoveY += toY;

                if (Math.abs(lenMoveX) > 2 || Math.abs(lenMoveY) > 2) {

                    if (isMove === false) {

                        eItem = getAncestorElement(e.event.target);
                        if (eItem) {

                            if (moveControl(eItem) === false) {
                                noMove = true;
                                return;
                            }

                            getPosition = itemIndexByMouse({
                                itemW: itemW,
                                itemH: itemH,
                                boxW: listContW,
                                count: count
                            }, paramRange);
                            boxPageXY = c.relativeXY(eBox, document.body);

                            position = getXY(eItem);

                            curMoveX = position.x;
                            curMoveY = position.y;
                            moveCurrIndex = currIndex = eItem.getAttribute('data-index') * 1;

                            eMoveItem = c.htmlToElem(eItem.outerHTML).children[0];

                            eBox.classList.add('drag');
                            eItem.classList.add('drag');
                            eMoveItem.classList.add('move');
                            eBox.appendChild(eMoveItem);

                            isMove = true;
                        }
                    }
                }

                if (isMove) {
                    curMoveX += toX;
                    curMoveY += toY;

                    itemMove();

                    i = getPosition(e.event.pageX - boxPageXY.x, e.event.pageY - boxPageXY.y, true).index;

                    if (i > -1) {

                        if (i !== moveCurrIndex) {
                            rechange();
                        }

                        if (i !== moveCurrIndex) {
                            exchange(i);
                            moveCurrIndex = i;
                        }

                    }
                    else {
                        rechange();
                    }

                    e.event.preventDefault();
                }
            }, function () {
                lenMoveX = 0;
                lenMoveY = 0;
                noMove = false;

            }, function () {
                if (isMove) {
                    var eItem = eItems[currIndex],
                        eChangeItem = eItems[moveCurrIndex];

                    if (moveCurrIndex !== currIndex) {

                        eChangeItem.setAttribute('data-index', moveCurrIndex);
                        eItem.setAttribute('data-index', currIndex);

                        exchangeData(eItem, eChangeItem, currIndex, moveCurrIndex);

                        currIndex = moveCurrIndex;
                    }

                    eChangeItem.classList.remove('drag');
                    eBox.classList.remove('drag');
                    eMoveItem.remove();
                    callback(currIndex);
                    isMove = false;

                    scroll.stop();
                }
            });

            this.close = function () {
                close = true;
            };
            this.open = function () {
                close = false;
            };

            this.reset = function (params) {
                // 此高宽包括外边距范围
                itemW = params.itemW;
                itemH = params.itemH;
            };

            // 取元素 transform xy值
            function getXY(elem) {
                var v = elem.style.getPropertyValue(cssTransform).match(/([\d]+)/g);

                return {
                    x: v[1] * 1,
                    y: v[2] * 1
                };
            }

            // 交换数据
            function exchangeData(eItem, eChangeItem, index, changeIndex) {

                var id = eItem.getAttribute('data-id'),
                    changeId = eChangeItem.getAttribute('data-id'),
                    data = userInfoData[id],
                    changeData = userInfoData[changeId];

                var row = Math.ceil((getIndex(index) + 1) / columnCount);
                var column = (getIndex(index) % columnCount) + 1;
                var changeRow = Math.ceil((getIndex(changeIndex) + 1) / columnCount);
                var changeColumn = (getIndex(changeIndex) % columnCount) + 1;

                var seatDetail = data.seat_detail,
                    changeSeatDetail = changeData.seat_detail;

                changeSeatDetail.row_no = changeRow + '';
                changeSeatDetail.column_no = changeColumn + '';
                seatDetail.row_no = row + '';
                seatDetail.column_no = column + '';
            }

            // 交换
            function exchange(i) {

                var eCurrItem = eItems[currIndex],
                    eChangeItem = eItems[i],
                    xy = getXY(eChangeItem),
                    curxy = getXY(eCurrItem);

                eChangeItem.style[cssTransform] = 'translate3d(' + curxy.x + 'px,' + curxy.y + 'px,0px)';
                eCurrItem.style[cssTransform] = 'translate3d(' + xy.x + 'px,' + xy.y + 'px,0px)';

                eItems[currIndex] = eChangeItem;
                eItems[i] = eCurrItem;
            }

            // 还原交换
            function rechange() {

                if (currIndex === moveCurrIndex) return;

                var eCurrItem = eItems[moveCurrIndex],
                    eChangeItem = eItems[currIndex],
                    xy = getXY(eChangeItem),
                    curxy = getXY(eCurrItem);

                eChangeItem.style[cssTransform] = 'translate3d(' + curxy.x + 'px,' + curxy.y + 'px,0px)';
                eCurrItem.style[cssTransform] = 'translate3d(' + xy.x + 'px,' + xy.y + 'px,0px)';

                eItems[moveCurrIndex] = eChangeItem;
                eItems[currIndex] = eCurrItem;

                moveCurrIndex = currIndex;
            }

            function itemIndexByMouse(param, paramRange) {
                var
                    itemW = param.itemW,
                    itemH = param.itemH,
                    boxW = param.boxW,
                    count = param.count,

                    //每行 个数
                    num = ~~(boxW / itemW),

                    //最大行
                    maxLine = Math.ceil(count / num);

                //控制范围
                function range(x, y, curRow, curLine) {

                    var
                        left = paramRange.left,
                        top = paramRange.top,
                        right = paramRange.right,
                        bottom = paramRange.bottom,

                        _x = x - curRow * itemW,
                        _y = y - curLine * itemH;

                    //左边范围处理
                    if (_x < left) return -1;
                    if (_y < top) return -1;
                    if (_x > itemW - right) return -1;
                    if (_y > itemH - bottom) return -1;

                    return 1;
                }

                /*
                 取当前 光标所在方格

                 @参数3
                 是否执行范围控制。可选。默认undefined，即不进行范围控制。超出范围返回-1

                 @返回值
                 没找到情况 返回-1
                 */

                function getIndex(x, y, r) {
                    var
                        //当前光标所在列。0表示第一列
                        curRow = ~~(x / itemW),
                        //当前光标所处 行。0表示第一行
                        curLine = ~~(y / itemH),

                        index;

                    function getPosition() {

                        var _x = x - curRow * itemW,
                            _y = y - curLine * itemH,
                            directionX, directionY;

                        if (_x < itemW / 2) directionX = 'left';
                        else directionX = 'right';

                        if (_y < itemH / 2) directionY = 'top';
                        else directionY = 'bottom';

                        return {directionX: directionX, directionY: directionY}
                    }

                    if (r && paramRange && range(x, y, curRow, curLine) === -1) {
                        return -1;
                    }
                    else {
                        index = curLine * num + curRow;

                        if (x < 0) return -1;
                        if (y < 0) return -1;

                        //超出列情况
                        if (curRow >= num) return -1;

                        //超出行情况
                        if (curLine >= maxLine) return -1;

                        //最大行情况
                        if (maxLine - 1 === curLine && index >= count) return -1;

                        //return index;

                        return {index: index, row: curRow, line: curLine};
                    }
                }

                return getIndex;
            }

            function itemMove() {
                eMoveItem.style[cssTransform] = 'translate3d(' + curMoveX + 'px,' + curMoveY + 'px,0px)';

                if (window.innerHeight - curMoveY - boxPageXY.y + window.pageYOffset < itemH) {
                    scroll.go();
                }
                else if (curMoveY + boxPageXY.y - window.pageYOffset < 0) {
                    scroll.go(1);
                }
                else {
                    scroll.stop();
                }
            }

            function getAncestorElement(eventElem) {
                var eElem;
                cb(eventElem);

                return eElem;

                function cb(that) {
                    if (that === eBox) {
                        return;
                    }
                    if (that.classList.contains('item')) {
                        // do something
                        eElem = that;
                        return;
                    }
                    cb(that.parentElement);
                }
            }

            function Scroll() {
                var stopId,
                    v;

                function go() {

                    window.scrollBy(0, v);

                    stopId = requestAnimationFrame(go);
                }

                this.go = function (is) {
                    this.stop();

                    if (is) v = -itemH / 10;
                    else v = itemH / 10;

                    stopId = requestAnimationFrame(go);
                };

                this.stop = function () {
                    cancelAnimationFrame(stopId);
                };
            }
        }

        // 列改变处理
        function ColControl() {

            var
                eBox = document.getElementById('ctrCol'),

                paramRange = {
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0
                },
                // 此高宽包括外边距范围
                itemW,
                itemH,


                moveControl = function () {
                },
                callback = function () {
                },

                cssTransform = transformName[1],

                eItems,
                eMoveItem,

                //count,

                boxPageXY,

                currIndex,
                moveCurrIndex,// 松开前记录 操作项到了哪个索引位置。防止重复触发

                curMoveX, curMoveY, lenMoveX, lenMoveY,

                curBoxY,

                getPosition,

                // 拖动开启关闭状态。true表示关闭
                close = false,

                isMove = false,
                noMove = false;

            var scroll = new Scroll();

            c.drag(eBox, function (e) {

                if (close) return;

                if (noMove) return;

                var toX = e.x,
                    toY = e.y,

                    i, eItem, position;

                lenMoveX += toX;
                lenMoveY += toY;

                if (Math.abs(lenMoveX) > 2 || Math.abs(lenMoveY) > 2) {

                    if (isMove === false) {

                        eItem = getAncestorElement(e.event.target);

                        if (eItem) {

                            if (moveControl(eItem) === false) {
                                noMove = true;
                                return;
                            }

                            getPosition = itemIndexByMouse({
                                itemW: itemW,
                                itemH: itemH,
                                boxW: listContW,
                                count: columnCount
                            }, paramRange);
                            boxPageXY = c.relativeXY(eBox, document.body);

                            position = getXY(eItem);

                            curMoveX = position.x;
                            curMoveY = position.y;
                            moveCurrIndex = currIndex = eItem.getAttribute('data-index') * 1;

                            eMoveItem = c.htmlToElem(eItem.outerHTML).children[0];

                            eBox.classList.add('drag');
                            eItem.classList.add('drag');
                            eMoveItem.classList.add('move');
                            eBox.appendChild(eMoveItem);

                            isMove = true;
                        }
                    }
                }

                if (isMove) {
                    curMoveX += toX;
                    curMoveY += toY;

                    itemMove();

                    i = getPosition(e.event.pageX - boxPageXY.x, 0, true).index;

                    if (i > -1) {

                        if (i !== moveCurrIndex) {
                            rechange();
                        }

                        if (i !== moveCurrIndex) {
                            exchange(i);
                            moveCurrIndex = i;
                        }

                    }
                    else {
                        rechange();
                    }

                    e.event.preventDefault();
                }
            }, function () {
                lenMoveX = 0;
                lenMoveY = 0;
                noMove = false;

            }, function () {
                if (isMove) {
                    var eItem = eItems[currIndex],
                        eChangeItem = eItems[moveCurrIndex];

                    if (moveCurrIndex !== currIndex) {

                        eChangeItem.setAttribute('data-index', moveCurrIndex);
                        eItem.setAttribute('data-index', currIndex);

                        exchangeData(eItem, eChangeItem, currIndex, moveCurrIndex);

                        currIndex = moveCurrIndex;
                    }

                    eChangeItem.classList.remove('drag');
                    eBox.classList.remove('drag');
                    eMoveItem.remove();
                    callback(currIndex);
                    isMove = false;

                    scroll.stop();
                }
            });

            this.update = update;
            function update(params) {

                // 此高宽包括外边距范围
                itemW = params.itemW;
                itemH = params.itemH;

                var pRange = params.paramRange;

                var html = '';

                for (var i = 0; i < columnCount; i++) {
                    html += '<li data-index="' + i + '" class="item" style="' + cssTransform + ':translate3d(' + (itemW * i + pRange.left) + 'px,0,0)' + '"><span>列' + (i + 1) + '</span></li>';
                }
                eBox.innerHTML = html;

                eItems = [].slice.call(eBox.children, 0);

            }

            // 交换数据
            // index 为按下索引
            function exchangeData(eItem, eChangeItem, index, changeIndex) {

                // 名称还原
                var name = eItem.innerHTML;

                eItem.innerHTML = eChangeItem.innerHTML;
                eChangeItem.innerHTML = name;

                var changeColumn = columnData[changeIndex];

                columnData[index].forEach(function (seatIndex, i) {
                    var changeSeatIndex = changeColumn[i];
                    seatChange(changeSeatIndex, seatIndex);
                });

            }

            // 座位交换 currIndex 为按下索引
            function seatChange(i, currIndex) {
                var eCurrItem = eStudentItems[currIndex],
                    eChangeItem = eStudentItems[i],
                    xy = getXY(eChangeItem),
                    curxy = getXY(eCurrItem);

                eChangeItem.style[cssTransform] = 'translate3d(' + curxy.x + 'px,' + curxy.y + 'px,0px)';
                eCurrItem.style[cssTransform] = 'translate3d(' + xy.x + 'px,' + xy.y + 'px,0px)';

                eCurrItem.setAttribute('data-index', i);
                eChangeItem.setAttribute('data-index', currIndex);

                eStudentItems[currIndex] = eChangeItem;
                eStudentItems[i] = eCurrItem;

                // 交换数据 这里changeIndex 为按下索引。。。
                var index = i,
                    changeIndex = currIndex;
                var id = eCurrItem.getAttribute('data-id'),
                    changeId = eChangeItem.getAttribute('data-id'),
                    data = userInfoData[id],
                    changeData = userInfoData[changeId];

                var row = Math.ceil((getIndex(index) + 1) / columnCount);
                var column = (getIndex(index) % columnCount) + 1;
                var changeRow = Math.ceil((getIndex(changeIndex) + 1) / columnCount);
                var changeColumn = (getIndex(changeIndex) % columnCount) + 1;

                var seatDetail = data.seat_detail,
                    changeSeatDetail = changeData.seat_detail;

                changeSeatDetail.row_no = changeRow + '';
                changeSeatDetail.column_no = changeColumn + '';
                seatDetail.row_no = row + '';
                seatDetail.column_no = column + '';

            }

            // 交换
            function exchange(i) {

                var eCurrItem = eItems[currIndex],
                    eChangeItem = eItems[i],
                    xy = getXY(eChangeItem),
                    curxy = getXY(eCurrItem);

                eChangeItem.style[cssTransform] = 'translate3d(' + curxy.x + 'px,' + curxy.y + 'px,0px)';
                eCurrItem.style[cssTransform] = 'translate3d(' + xy.x + 'px,' + xy.y + 'px,0px)';

                eItems[currIndex] = eChangeItem;
                eItems[i] = eCurrItem;
            }

            // 还原交换
            function rechange() {

                if (currIndex === moveCurrIndex) return;

                var eCurrItem = eItems[moveCurrIndex],
                    eChangeItem = eItems[currIndex],
                    xy = getXY(eChangeItem),
                    curxy = getXY(eCurrItem);

                eChangeItem.style[cssTransform] = 'translate3d(' + curxy.x + 'px,' + curxy.y + 'px,0px)';
                eCurrItem.style[cssTransform] = 'translate3d(' + xy.x + 'px,' + xy.y + 'px,0px)';

                eItems[moveCurrIndex] = eChangeItem;
                eItems[currIndex] = eCurrItem;

                moveCurrIndex = currIndex;
            }

            // 取元素 transform xy值
            function getXY(elem) {
                var v = elem.style.getPropertyValue(cssTransform).match(/([\d]+)/g);

                return {
                    x: v[1] * 1,
                    y: v[2] * 1
                };
            }

            function itemIndexByMouse(param, paramRange) {
                var
                    itemW = param.itemW,
                    itemH = param.itemH,
                    boxW = param.boxW,
                    count = param.count,

                    //每行 个数
                    num = ~~(boxW / itemW),

                    //最大行
                    maxLine = Math.ceil(count / num);

                //控制范围
                function range(x, y, curRow, curLine) {

                    var
                        left = paramRange.left,
                        top = paramRange.top,
                        right = paramRange.right,
                        bottom = paramRange.bottom,

                        _x = x - curRow * itemW,
                        _y = y - curLine * itemH;

                    //左边范围处理
                    if (_x < left) return -1;
                    if (_y < top) return -1;
                    if (_x > itemW - right) return -1;
                    if (_y > itemH - bottom) return -1;

                    return 1;
                }

                /*
                 取当前 光标所在方格

                 @参数3
                 是否执行范围控制。可选。默认undefined，即不进行范围控制。超出范围返回-1

                 @返回值
                 没找到情况 返回-1
                 */

                function getIndex(x, y, r) {
                    var
                        //当前光标所在列。0表示第一列
                        curRow = ~~(x / itemW),
                        //当前光标所处 行。0表示第一行
                        curLine = ~~(y / itemH),

                        index;

                    function getPosition() {

                        var _x = x - curRow * itemW,
                            _y = y - curLine * itemH,
                            directionX, directionY;

                        if (_x < itemW / 2) directionX = 'left';
                        else directionX = 'right';

                        if (_y < itemH / 2) directionY = 'top';
                        else directionY = 'bottom';

                        return {directionX: directionX, directionY: directionY}
                    }

                    if (r && paramRange && range(x, y, curRow, curLine) === -1) {
                        return -1;
                    }
                    else {
                        index = curLine * num + curRow;

                        if (x < 0) return -1;
                        if (y < 0) return -1;

                        //超出列情况
                        if (curRow >= num) return -1;

                        //超出行情况
                        if (curLine >= maxLine) return -1;

                        //最大行情况
                        if (maxLine - 1 === curLine && index >= count) return -1;

                        //return index;

                        return {index: index, row: curRow, line: curLine};
                    }
                }

                return getIndex;
            }

            function itemMove() {
                eMoveItem.style[cssTransform] = 'translate3d(' + curMoveX + 'px,0px,0px)';

                if (window.innerHeight - curMoveY - boxPageXY.y + window.pageYOffset < itemH) {
                    scroll.go();
                }
                else if (curMoveY + boxPageXY.y - window.pageYOffset < 0) {
                    scroll.go(1);
                }
                else {
                    scroll.stop();
                }
            }

            function getAncestorElement(eventElem) {
                var eElem;
                cb(eventElem);

                return eElem;

                function cb(that) {
                    if (that === eBox) {
                        return;
                    }
                    if (that.classList.contains('item')) {
                        // do something
                        eElem = that;
                        return;
                    }
                    cb(that.parentElement);
                }
            }

            function Scroll() {
                var stopId,
                    v;

                function go() {

                    window.scrollBy(0, v);

                    stopId = requestAnimationFrame(go);
                }

                this.go = function (is) {
                    this.stop();

                    if (is) v = -itemH / 10;
                    else v = itemH / 10;

                    stopId = requestAnimationFrame(go);
                };

                this.stop = function () {
                    cancelAnimationFrame(stopId);
                };
            }
        }

        // 行改变处理
        function RowControl() {

            var
                eBox = document.getElementById('ctrRow'),

                paramRange = {
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0
                },
                // 此高宽包括外边距范围
                itemW,
                itemH,


                moveControl = function () {
                },
                callback = function () {
                },

                cssTransform = transformName[1],

                eItems,
                eMoveItem,

                //count,

                boxPageXY,

                currIndex,
                moveCurrIndex,// 松开前记录 操作项到了哪个索引位置。防止重复触发

                curMoveX, curMoveY, lenMoveX, lenMoveY,

                curBoxY,

                getPosition,

                // 拖动开启关闭状态。true表示关闭
                close = false,

                isMove = false,
                noMove = false;

            var scroll = new Scroll();

            c.drag(eBox, function (e) {

                if (close) return;

                if (noMove) return;

                var toX = e.x,
                    toY = e.y,

                    i, eItem, position;

                lenMoveX += toX;
                lenMoveY += toY;

                if (Math.abs(lenMoveX) > 2 || Math.abs(lenMoveY) > 2) {

                    if (isMove === false) {

                        eItem = getAncestorElement(e.event.target);

                        if (eItem) {

                            if (moveControl(eItem) === false) {
                                noMove = true;
                                return;
                            }

                            getPosition = itemIndexByMouse({
                                itemW: itemW,
                                itemH: itemH,
                                boxW: itemW,
                                count: rowCount
                            }, paramRange);
                            boxPageXY = c.relativeXY(eBox, document.body);

                            position = getXY(eItem);

                            curMoveX = position.x;
                            curMoveY = position.y;
                            moveCurrIndex = currIndex = eItem.getAttribute('data-index') * 1;

                            eMoveItem = c.htmlToElem(eItem.outerHTML).children[0];

                            eBox.classList.add('drag');
                            eItem.classList.add('drag');
                            eMoveItem.classList.add('move');
                            eBox.appendChild(eMoveItem);

                            isMove = true;
                        }
                    }
                }

                if (isMove) {
                    curMoveX += toX;
                    curMoveY += toY;

                    itemMove();

                    i = getPosition(0, e.event.pageY - boxPageXY.y, true).index;

                    if (i > -1) {

                        if (i !== moveCurrIndex) {
                            rechange();
                        }

                        if (i !== moveCurrIndex) {
                            exchange(i);
                            moveCurrIndex = i;
                        }

                    }
                    else {
                        rechange();
                    }

                    e.event.preventDefault();
                }
            }, function () {
                lenMoveX = 0;
                lenMoveY = 0;
                noMove = false;

            }, function () {
                if (isMove) {
                    var eItem = eItems[currIndex],
                        eChangeItem = eItems[moveCurrIndex];

                    if (moveCurrIndex !== currIndex) {

                        eChangeItem.setAttribute('data-index', moveCurrIndex);
                        eItem.setAttribute('data-index', currIndex);

                        exchangeData(eItem, eChangeItem, currIndex, moveCurrIndex);

                        currIndex = moveCurrIndex;
                    }

                    eChangeItem.classList.remove('drag');
                    eBox.classList.remove('drag');
                    eMoveItem.remove();
                    callback(currIndex);
                    isMove = false;

                    scroll.stop();
                }
            });

            this.update = update;
            function update(params) {

                // 此高宽包括外边距范围
                itemW = params.itemW;
                itemH = params.itemH;

                var pRange = params.paramRange;

                var html = '';

                for (var i = 0; i < rowCount; i++) {
                    html += '<li data-index="' + i + '" class="item" style="' + cssTransform + ':translate3d(0,' + (itemH * i + pRange.top) + 'px,0)' + '"><span>行' + (i + 1) + '</span></li>';
                }
                eBox.innerHTML = html;

                eItems = [].slice.call(eBox.children, 0);

            }

            // 交换数据
            // index 为按下索引
            function exchangeData(eItem, eChangeItem, index, changeIndex) {

                // 名称还原
                var name = eItem.innerHTML;

                eItem.innerHTML = eChangeItem.innerHTML;
                eChangeItem.innerHTML = name;

                var changeRow = rowData[changeIndex];

                rowData[index].forEach(function (seatIndex, i) {
                    var changeSeatIndex = changeRow[i];
                    seatChange(changeSeatIndex, seatIndex);
                });

            }

            // 座位交换 currIndex 为按下索引
            function seatChange(i, currIndex) {
                var eCurrItem = eStudentItems[currIndex],
                    eChangeItem = eStudentItems[i],
                    xy = getXY(eChangeItem),
                    curxy = getXY(eCurrItem);

                eChangeItem.style[cssTransform] = 'translate3d(' + curxy.x + 'px,' + curxy.y + 'px,0px)';
                eCurrItem.style[cssTransform] = 'translate3d(' + xy.x + 'px,' + xy.y + 'px,0px)';

                eCurrItem.setAttribute('data-index', i);
                eChangeItem.setAttribute('data-index', currIndex);

                eStudentItems[currIndex] = eChangeItem;
                eStudentItems[i] = eCurrItem;

                // 交换数据 这里changeIndex 为按下索引。。。
                var index = i,
                    changeIndex = currIndex;
                var id = eCurrItem.getAttribute('data-id'),
                    changeId = eChangeItem.getAttribute('data-id'),
                    data = userInfoData[id],
                    changeData = userInfoData[changeId];

                var row = Math.ceil((getIndex(index) + 1) / columnCount);
                var column = (getIndex(index) % columnCount) + 1;
                var changeRow = Math.ceil((getIndex(changeIndex) + 1) / columnCount);
                var changeColumn = (getIndex(changeIndex) % columnCount) + 1;

                var seatDetail = data.seat_detail,
                    changeSeatDetail = changeData.seat_detail;

                changeSeatDetail.row_no = changeRow + '';
                changeSeatDetail.column_no = changeColumn + '';
                seatDetail.row_no = row + '';
                seatDetail.column_no = column + '';

            }

            // 交换
            function exchange(i) {

                var eCurrItem = eItems[currIndex],
                    eChangeItem = eItems[i],
                    xy = getXY(eChangeItem),
                    curxy = getXY(eCurrItem);

                eChangeItem.style[cssTransform] = 'translate3d(' + curxy.x + 'px,' + curxy.y + 'px,0px)';
                eCurrItem.style[cssTransform] = 'translate3d(' + xy.x + 'px,' + xy.y + 'px,0px)';

                eItems[currIndex] = eChangeItem;
                eItems[i] = eCurrItem;
            }

            // 还原交换
            function rechange() {

                if (currIndex === moveCurrIndex) return;

                var eCurrItem = eItems[moveCurrIndex],
                    eChangeItem = eItems[currIndex],
                    xy = getXY(eChangeItem),
                    curxy = getXY(eCurrItem);

                eChangeItem.style[cssTransform] = 'translate3d(' + curxy.x + 'px,' + curxy.y + 'px,0px)';
                eCurrItem.style[cssTransform] = 'translate3d(' + xy.x + 'px,' + xy.y + 'px,0px)';

                eItems[moveCurrIndex] = eChangeItem;
                eItems[currIndex] = eCurrItem;

                moveCurrIndex = currIndex;
            }

            // 取元素 transform xy值
            function getXY(elem) {
                var v = elem.style.getPropertyValue(cssTransform).match(/([\d]+)/g);

                return {
                    x: v[1] * 1,
                    y: v[2] * 1
                };
            }

            function itemIndexByMouse(param, paramRange) {
                var
                    itemW = param.itemW,
                    itemH = param.itemH,
                    boxW = param.boxW,
                    count = param.count,

                    //每行 个数
                    num = ~~(boxW / itemW),

                    //最大行
                    maxLine = Math.ceil(count / num);

                //控制范围
                function range(x, y, curRow, curLine) {

                    var
                        left = paramRange.left,
                        top = paramRange.top,
                        right = paramRange.right,
                        bottom = paramRange.bottom,

                        _x = x - curRow * itemW,
                        _y = y - curLine * itemH;

                    //左边范围处理
                    if (_x < left) return -1;
                    if (_y < top) return -1;
                    if (_x > itemW - right) return -1;
                    if (_y > itemH - bottom) return -1;

                    return 1;
                }

                /*
                 取当前 光标所在方格

                 @参数3
                 是否执行范围控制。可选。默认undefined，即不进行范围控制。超出范围返回-1

                 @返回值
                 没找到情况 返回-1
                 */

                function getIndex(x, y, r) {
                    var
                        //当前光标所在列。0表示第一列
                        curRow = ~~(x / itemW),
                        //当前光标所处 行。0表示第一行
                        curLine = ~~(y / itemH),

                        index;

                    function getPosition() {

                        var _x = x - curRow * itemW,
                            _y = y - curLine * itemH,
                            directionX, directionY;

                        if (_x < itemW / 2) directionX = 'left';
                        else directionX = 'right';

                        if (_y < itemH / 2) directionY = 'top';
                        else directionY = 'bottom';

                        return {directionX: directionX, directionY: directionY}
                    }

                    if (r && paramRange && range(x, y, curRow, curLine) === -1) {
                        return -1;
                    }
                    else {

                        index = curLine * num + curRow;

                        if (x < 0) return -1;
                        if (y < 0) return -1;

                        //超出列情况
                        if (curRow >= num) return -1;

                        //超出行情况
                        if (curLine >= maxLine) return -1;

                        //最大行情况
                        if (maxLine - 1 === curLine && index >= count) return -1;

                        //return index;

                        return {index: index, row: curRow, line: curLine};
                    }
                }

                return getIndex;
            }

            function itemMove() {
                eMoveItem.style[cssTransform] = 'translate3d(0px,' + curMoveY + 'px,0px)';

                if (window.innerHeight - curMoveY - boxPageXY.y + window.pageYOffset < itemH) {
                    scroll.go();
                }
                else if (curMoveY + boxPageXY.y - window.pageYOffset < 0) {
                    scroll.go(1);
                }
                else {
                    scroll.stop();
                }
            }

            function getAncestorElement(eventElem) {
                var eElem;
                cb(eventElem);

                return eElem;

                function cb(that) {
                    if (that === eBox) {
                        return;
                    }
                    if (that.classList.contains('item')) {
                        // do something
                        eElem = that;
                        return;
                    }
                    cb(that.parentElement);
                }
            }

            function Scroll() {
                var stopId,
                    v;

                function go() {

                    window.scrollBy(0, v);

                    stopId = requestAnimationFrame(go);
                }

                this.go = function (is) {
                    this.stop();

                    if (is) v = -itemH / 10;
                    else v = itemH / 10;

                    stopId = requestAnimationFrame(go);
                };

                this.stop = function () {
                    cancelAnimationFrame(stopId);
                };
            }
        }

        // 座位排列
        function getIndex(i) {
            // return count - 1 - i;// 讲台在下
            // return i;// 讲台在上

            // 讲台在下。左边开始
            var newIndex = count - 1 - i,
                colIndex = newIndex % columnCount;
            return newIndex - colIndex * 2 + columnCount - 1;
        }

        function commonInit() {
            var c = {};
            c.addCssTxt = function (txt, eStyle) {
                if ('textContent' in document.createElement('style')) {
                    c.addCssTxt = function (txt, eStyle) {
                        eStyle = eStyle || document.createElement('style');
                        eStyle.textContent = txt;
                        document.body.appendChild(eStyle);
                        return eStyle;
                    };
                }
                else {
                    // ie678
                    c.addCssTxt = function (txt, eStyle) {
                        eStyle = eStyle || document.createElement('style');
                        eStyle.setAttribute("type", "text/css");
                        eStyle.styleSheet.cssText = txt;
                        document.body.appendChild(eStyle);
                        return eStyle;
                    };
                }
                return c.addCssTxt(txt, eStyle);
            };

            c.each = function (obj, fn) {
                var
                    key,
                    len = obj && obj.length;

                if (len === undefined) {
                    for (key in obj) {
                        if (fn(key, obj[key]) === false) {
                            break;
                        }
                    }
                }
                else {
                    for (key = 0; key < len; key++) {
                        if (fn(key, obj[key], len) === false) {
                            break;
                        }
                    }
                }
            };

            c.toStyleName = function (cssPropertyName) {
                return cssPropertyName.replace(/-\w/g, function (d) {
                    return d[1].toUpperCase();
                });
            };

            c.getRightCssName = function (cssPropertyName) {
                var
                    firstLetter = cssPropertyName[0],
                    firstLetterUpper = firstLetter.toUpperCase(),
                    cssPrefixes = ["ms" + firstLetterUpper, "Moz" + firstLetterUpper, "webkit" + firstLetterUpper, firstLetter],
                    cssPrefixesReal = ["-ms-", "-Moz-", "-webkit-", ''],
                    style = document.body.style,
                    name = c.toStyleName(cssPropertyName).substr(1);

                for (var i = cssPrefixes.length, newName; i--;) {
                    newName = cssPrefixes[i] + name;

                    if (newName in style) {
                        return [cssPrefixesReal[i] + cssPropertyName, newName];
                    }
                }
                return null;
            };

            c.drag = function (eDrag, onMove, onDown, onUp) {
                eDrag.addEventListener('mousedown', down);

                function down(e) {

                    if (onDown && onDown(e) === false) return;

                    var dragBase = new DragBase();
                    dragBase.start(e.pageX, e.pageY);

                    document.addEventListener('mousemove', mousemove);
                    document.addEventListener('mouseup', mouseup);

                    e.preventDefault();

                    function mousemove(moveEvent) {
                        dragBase.move(moveEvent.pageX, moveEvent.pageY, function (toX, toY) {
                            onMove({x: toX, y: toY, event: moveEvent});
                        });
                    }

                    function mouseup() {
                        if (onUp) onUp();

                        //解除所有事件
                        document.removeEventListener('mousemove', mousemove);
                        document.removeEventListener('mouseup', mouseup);

                    }
                }

                function DragBase() {
                    var
                        prevX, prevY,
                        toX, toY;

                    this.start = function (x, y) {
                        prevX = x;
                        prevY = y;
                        toX = 0;
                        toY = 0;
                    };

                    this.move = function (x, y, fn) {
                        toX = x - prevX;
                        toY = y - prevY;

                        fn(toX, toY);

                        prevX = x;
                        prevY = y;
                    };
                }
            };

            c.relativeXY = function (initial, target) {

                var x = 0, y = 0, _target = initial;

                while (_target !== target) {
                    x += _target.offsetLeft;
                    y += _target.offsetTop;

                    _target = _target.offsetParent;
                }

                return {x: x, y: y};
            };

            c.htmlToElem = function (html) {
                var eTemp = document.createElement('div');
                eTemp.innerHTML = html;
                return eTemp;
            };

            c.removeNode = function (node) {
                if ('remove' in node) {
                    node.remove();
                } else {
                    node.parentNode.removeChild(node);
                }
            };

            /**
             * 扩展原型
             * Element.remove
             *
             * @兼容性
             * ie67不支持直接访问Element
             * 解决ie8，Android4.2以下
             *
             * */
            if (!('remove' in document.body)) {
                Element.prototype.remove = function () {
                    this.parentNode.removeChild(this);
                };
            }


            return c;
        }
    }


})();
