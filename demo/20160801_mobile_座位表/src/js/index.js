import defaultAvatarImgData from '../imgs/avatar/default_head.png'

(function () {
  var c = {};
  window.c = c;

  /**
   * 取css名称
   *
   * 此处只是加了缓存机制，核心还是 getRightCssName
   *
   * @param cssPropertyName {string} 减号方式的css名称
   * @return {Array} 数组中有两个值，第一个是 减号风格，第二个是驼峰。如果不支持此属性，返回null
   *
   * */
  c.autoPrefix = function (cssPropertyName) {
    // 如果有直接返回
    var propertyName = c.autoPrefix[cssPropertyName];
    if (propertyName !== undefined) return propertyName;

    var
      firstLetter = cssPropertyName[0],
      firstLetterUpper = firstLetter.toUpperCase(),
      cssPrefixes = ["ms" + firstLetterUpper, "Moz" + firstLetterUpper, "webkit" + firstLetterUpper, firstLetter],
      cssPrefixesReal = ["-ms-", "-Moz-", "-webkit-", ''],
      style = document.body.style,
      // css名称转换
      name = cssPropertyName.replace(/-\w/g, function (d) {
        return d[1].toUpperCase();
      }).substr(1);

    for (var i = cssPrefixes.length, newName; i--;) {
      newName = cssPrefixes[i] + name;

      if (newName in style) {
        propertyName = [cssPrefixesReal[i] + cssPropertyName, newName];
        break;
      }
    }

    propertyName = propertyName || null;

    c.autoPrefix[cssPropertyName] = propertyName;

    return propertyName;
  };

  c.addCssText = function (txt) {
    let eStyle = document.createElement('style');

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

  // 系统判断
  c.isIOS = navigator.appVersion.indexOf('Mac OS') > -1;

  // 经过优化的单指，多指无违和冲突。支持多浏览器
  c.drag = function (eDrag, onMove, onDown, onUp) {

    var startX, startY, identifier;

    eDrag.addEventListener('touchstart', function (e) {
      var touche = e.touches[0];

      startX = touche.pageX;
      startY = touche.pageY;

      onDown(e);
    });

    eDrag.addEventListener('touchmove', function (e) {

      var touche = e.touches[0],
        pageX = touche.pageX, pageY = touche.pageY,
        moveX, moveY;

      moveX = pageX - startX;
      moveY = pageY - startY;

      onMove({left: moveX, top: moveY, pageX: pageX, pageY: pageY, event: e});
    });

    eDrag.addEventListener('touchend', function (e) {

      if (e.touches.length > 0) {

        startX = e.touches[0].pageX;
        startY = e.touches[0].pageY;

      }

      onUp(e);
    });

  };

  // html -> elem
  /*
   html转对象，返回一个新div，html是此div对象的内容
   */
  c.htmlToElem = function (html) {
    var eTemp = document.createElement('div');
    eTemp.innerHTML = html;
    return eTemp;
  };

  /**
   起始元素到目标上级元素坐标
   @@ relativeXY
   @example
   var xy = c.relativeXY(initial, target);
   @param initial [element]  起始元素
   @param target [element] 目标元素，需是起始元素的上级，且必须为参照元素
   @return [obj] xy坐标
   @raise
   target必须为参照元素
   */

  c.relativeXY = function (initial, target) {

    var x = 0, y = 0, _target = initial;

    while (_target !== target) {
      x += _target.offsetLeft;
      y += _target.offsetTop;

      _target = _target.offsetParent;
    }

    return {x: x, y: y};
  };

  // click 重写。解决 1、4.4以下webview 原始click灰色；2、ios原始click问题
  c.click = function (elem, fn) {

    if (/Android|iPad|iPhone/.test(navigator.userAgent)) {
      c.click = function (elem, fn) {
        var touchcancel;
        elem.addEventListener('touchend', touchend);
        elem.addEventListener('touchstart', touchstart);
        elem.addEventListener('touchmove', touchmove);

        function touchend(e) {
          if (touchcancel) return;
          fn.call(this, e);
        }

        function touchstart() {
          touchcancel = false;
        }

        function touchmove() {
          touchcancel = true;
        }

        return function () {
          elem.removeEventListener('touchend', touchend);
          elem.removeEventListener('touchstart', touchstart);
          elem.removeEventListener('touchmove', touchmove);
        };
      };

    }
    else {
      c.click = function (elem, fn) {
        elem.addEventListener('click', fn);
        return function () {
          elem.removeEventListener('click', fn);
        };
      }
    }

    c.click(elem, fn);
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
})();
(function () {

  var isLogin = false;

  window.transmitData = function (data) {
    data = {
      details: data,
      column_count: data[0].column_count,
      row_count: data[0].row_count
    }

    update(data);
    update = init(data);// init 被清理，update被重写
  };

  window.transmitloginData = function (is) {
    isLogin = is === 'true'
  };

  function update(data) {

  }

  function init(data) {

    var
      managePage = 1,

      eListCont = document.getElementById('listCont'),
      eItems,

      columnCount,
      rowCount,
      count,

      cssTransform = c.autoPrefix('transform')[0],

      winH = document.documentElement.clientHeight,

      itemW = 108,
      itemH = 44,
      paramRange = {
        left: 10,
        top: 10,
        right: 10,
        bottom: 10
      },
      placetableData = {},

      listContW,

      btns = new Btns(),

      drag = {
        open: function () {
        }, close: function () {
        }
      },

      interfaceId = 'evaluatejs',

      // avatarUrl = c.isIOS ? 'default_head' : 'imgs/avatar/default_head';
      avatarUrl = 'default_head';

    placetableUpdate(data);

    if (managePage) {
      drag = new DragHandle({
        eBox: eListCont,
        itemW: itemW + paramRange.left + paramRange.right,
        itemH: itemH + paramRange.top + paramRange.bottom
        //paramRange: paramRange
      });

      btns.showDragSave();
      drag.open();// 开启拖动

      // 禁用此表扬批评
      HandleClick = function () {
        this.clearSelected = function () {
        };
        this.close = function () {
        };
        this.open = function () {
        };
      };
    }
    else {
      btns.deleteDragManage();
    }

    var handleClick = new HandleClick();

    // 考虑讲台。初始滚动底部
    // window.scrollBy(0, document.body.clientHeight);

    init = function () {
      return placetableUpdate;
    };
    return placetableUpdate;

    function placetableUpdate(data) {
      btns.showDrag();
      handleClick && handleClick.clearSelected();

      columnCount = data.column_count * 1;
      rowCount = data.row_count * 1;
      count = columnCount * rowCount;

      listContW = columnCount * (itemW + paramRange.left + paramRange.right);

// 超出处理。将更改 itemW、paramRange等
      overflowHandle();

      var html = '';
      for (var i = 0, y; i < rowCount; i++) {
        y = ((itemH + paramRange.top + paramRange.bottom) * i + paramRange.left);
        for (var j = 0; j < columnCount; j++) {
          html += '<dl class="item" data-index="' + (i * columnCount + j) + '" style="' + cssTransform + ':translate3d(' + ((itemW + paramRange.left + paramRange.right) * j + paramRange.left) + 'px,' + y + 'px,0)' + '"></dl>';
        }
      }

      eListCont.innerHTML = html;
      eListCont.style.width = listContW + 'px';
      eListCont.style.height = rowCount * (itemH + paramRange.top + paramRange.bottom) + 'px';

      eItems = [].slice.call(eListCont.children, 0);

      data.details.forEach(function (n, i) {

        var index = (n.row_no - 1) * columnCount + (n.column_no - 1),
          eItem = eItems[getIndex(index)];

        if (n.user_id !== '0') {
          var html = '<dt><img height="36" src="' + (n.avatar_url ? n.avatar_url : (avatarUrl + '.png')) + '" onerror="this.src=\'' + defaultAvatarImgData + '\'" /></dt><dd>' + n.user_name + '</dd>';

          if (n.evaluations) {
            if (n.total_score < 0) {
              html += '<i class="warn">' + n.total_score + '</i>';
            }
            else if (n.total_score >= 0) {
              html += '<i>' + n.total_score + '</i>';
            }
          }

          eItem.innerHTML = html;

        }

        eItem.setAttribute('data-id', i);

      });
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

        eMoveItem,

        //count,

        boxPageXY,

        currIndex,
        moveCurrIndex,// 松开前记录 操作项到了哪个索引位置。防止重复触发

        curMoveX, curMoveY, tempMoveX, tempMoveY,

        curBoxY,

        getPosition,

        // 拖动开启关闭状态。默认关闭
        close = true,

        isMove = false,
        noMove = false;

      var scroll = new Scroll();

      c.drag(eBox, function (e) {

        if (close) return;

        if (noMove) return;

        var x = e.left,
          y = e.top,

          i, eItem, position;

        if (Math.abs(y) > 2 || Math.abs(x) > 2) {

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

              tempMoveX = position.x;
              tempMoveY = position.y;
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
          curMoveX = tempMoveX + x;// - paramRange.left;
          curMoveY = tempMoveY + y;// - paramRange.top;
          //curMoveX = x;
          //curMoveY = y;

          itemMove();

          i = getPosition(e.pageX - boxPageXY.x, e.pageY - boxPageXY.y, true).index;

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

        noMove = false;

        return false;

      }, function () {
        if (isMove) {
          var eItem = eItems[currIndex],
            eChangeItem = eItems[moveCurrIndex];

          if (moveCurrIndex !== currIndex) {

            eChangeItem.setAttribute('data-index', moveCurrIndex);
            eItem.setAttribute('data-index', currIndex);

            recordPlacetableData(eItem, currIndex);
            recordPlacetableData(eChangeItem, moveCurrIndex);

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

      // 取元素 transform xy值
      function getXY(elem) {
        var v = elem.style.getPropertyValue(cssTransform).match(/([\d]+)/g);

        return {
          x: v[1] * 1,
          y: v[2] * 1
        };
      }

      // 记录更改数据
      function recordPlacetableData(eItem, index) {

        var id = eItem.getAttribute('data-id'), row, column, d;

        if (id) {

          d = data.details[id];

          row = Math.ceil((getIndex(index) + 1) / columnCount);
          column = (getIndex(index) % columnCount) + 1;

          d.row_no = row;
          d.column_no = column;

          placetableData[id] = {
            "user_id": d.user_id,
            "row_no": row + "",
            "column_no": column + ""
          };
        }

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

        if (winH - curMoveY - boxPageXY.y + window.pageYOffset < itemH) {
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

          if (is) v = -itemH / 4;
          else v = itemH / 4;

          stopId = requestAnimationFrame(go);
        };

        this.stop = function () {
          cancelAnimationFrame(stopId);
        };
      }
    }

    // 座位排列 反转
    function getIndex(i) {

      // 讲台在上，右边开始
      var colIndex = i % columnCount;
      return i - colIndex * 2 + columnCount - 1;

      // return count - 1 - i;// 讲台在下
      // return i;// 讲台在上
    }

    // 表扬批评点击
    function HandleClick() {

      // 记录选中
      var selectedData = {},
        close = false
      ;

      c.click(eListCont, function (e) {
        if (close === false) getAncestorElement(e.target);
      });

      this.clearSelected = function () {
        for (var k in selectedData) {
          selectedData[k][0].classList.remove('selected');
        }
        selectedData = {};
      };
      this.close = function () {
        close = true;
      };
      this.open = function () {
        close = false;
      };

      this.getSelectedDate = function () {
        var selectedDate = [];
        for (var k in selectedData) {
          selectedDate.push(selectedData[k][1]);
        }
        return selectedDate;
      };

      function getAncestorElement(eventElem) {
        cb(eventElem);

        function cb(that) {
          if (that === eListCont) {
            return;
          }
          if (that.classList.contains('item')) {
            // do something
            excu(that);
            return;
          }
          cb(that.parentElement);
        }
      }

      function excu(eItem) {
        var id = eItem.getAttribute('data-id');

        if (id) {

          var details = data.details[id];

          if (details.user_id === '0') return;

          if (isLogin) {
            if (eItem.classList.contains('selected')) {
              eItem.classList.remove('selected');
              delete selectedData[id];

              for (var k in selectedData) {
                return;
              }

              btns.showDrag();

              return;
            }

            eItem.classList.add('selected');

            selectedData[id] = [eItem, details[id]];

            btns.showClick();

            drag.close();
          }
          else {
            // c.deviceCallback(['evaluatejs', 'studentaction'], 'studentaction', JSON.stringify(details[id]));// 都带参
          }
        }
      }
    }

    function Btns() {
      var criticismBtn = document.getElementById('criticismBtn');
      var praiseBtn = document.getElementById('praiseBtn');
      var saveBtn = document.getElementById('saveBtn');
      var manageBtn = document.getElementById('manageBtn');
      var that = this;

      c.click(manageBtn, function () {
        that.showDragSave();

        drag.open();

        handleClick.clearSelected();
        handleClick.close();
      });

      c.click(saveBtn, function () {

        // that.showDrag();
        // drag.close();
        // handleClick.open();// 开启批评选中

        var submitData = [];

        for (var k in placetableData) {
          submitData.push(placetableData[k]);
        }

        if (submitData.length) {
          window[interfaceId].submit(JSON.stringify(data.details));
          // window[interfaceId].submit(JSON.stringify(submitData))
          placetableData = {};
        }
      });

      c.click(criticismBtn, function () {
        // c.deviceCallback([interfaceId, 'criticism'], 'criticism', JSON.stringify(handleClick.getSelectedDate()));
        handleClick.clearSelected();
        btns.showDrag();
      });

      c.click(praiseBtn, function () {
        // c.deviceCallback([interfaceId, 'praise'], 'praise', JSON.stringify(handleClick.getSelectedDate()));
        handleClick.clearSelected();
        btns.showDrag();
      });

      this.deleteDragManage = function () {
        manageBtn.remove();
      };

      this.showClick = function () {
        criticismBtn.style.display = 'block';
        praiseBtn.style.display = 'block';
        saveBtn.style.display = 'none';
        manageBtn.style.display = 'block';
      };

      this.showDrag = function () {
        criticismBtn.style.display = 'none';
        praiseBtn.style.display = 'none';
        saveBtn.style.display = 'none';
        manageBtn.style.display = 'block';
      };

      this.showDragSave = function () {
        criticismBtn.style.display = 'none';
        praiseBtn.style.display = 'none';
        saveBtn.style.display = 'block';
        manageBtn.style.display = 'none';
      };
    }

    function overflowHandle() {
      var maxWidth = eListCont.parentElement.clientWidth - 20,
        w,
        r;

      w = Math.floor(maxWidth / columnCount);

      if (w > 160) {
        w = 160;
      }

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
      //.placetable .item.drag{width: ' + (itemW - 10) + 'px;height: ' + (itemH - 10) + 'px}\
      c.addCssText('.placetable .item{width: ' + (itemW - 8) + 'px;height:' + (itemH - 8) + 'px}\
.placetable dt{width:' + (itemH - 2) + 'px;}.placetable dd{margin-left:' + (itemH + 2) + 'px;font-size:' + (itemW / 108 * 12) + 'px;height:' + (itemH - 8) + 'px}');

    }
  }
})();



