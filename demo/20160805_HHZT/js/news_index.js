/**
 * Created by CQL on 2016/8/8.
 */


(function () {

    var eBox = document.getElementById('newsIndexBanner'),
        // eBtnBox = eBox.children[1],
        // eBtns = eBtnBox.children,
        eTit, eDes,
        arrow = new ArrowHandle;

    c.queryElements(eBox, '.tit,.intro', function (elems) {
        eTit = elems[0];
        eDes = elems[1];
    });

    if (c.isMobile) {
        slider = new slider({
            eBox: eBox,
            each: function (i) {
                // 拼接按钮
                // btnHtml += '<li' + (i ? '' : ' class="active"') + '></li>';
            },
            onchange: change
        });
    }
    else{
        slider=new pcSlider({
            eBox: eBox,
            onchange: change
        });
        
    }

    arrow.go = function (isLeft) {
        if (isLeft) slider.swipeRight();
        else slider.swipeLeft();
    };

    function change(eItem, prevIndex, index) {
            // eBtns[prevIndex].classList.remove('active');
            // eBtns[index].classList.add('active');
            // 按需加载
            if (!eItem._data_isComplete) {
                var img = eItem.children[0],
                    imgUrl = img.dataset.src;
                if (imgUrl) img.src = imgUrl;
                eItem._data_isComplete = 1;
            }
            var eImg = eItem.getElementsByTagName('img')[0];
            textShow(eImg.getAttribute('data-des'), eImg.getAttribute('data-link'));
        }

    function textShow(txt, link) {
        if (txt) {
            txt = txt.split(',');
        }
        else {
            link = 'javascript:;';
            txt = ['', ''];
        }

        eTit.innerHTML = '<a href="' + link + '">' + txt[0] + '</a>';
        eDes.innerHTML = txt[1];
    }

    function slider(params) {
        var eBox = params.eBox,
            each = params.each,
            onchange = params.onchange,
            eMove = eBox.children[0],
            eItems = eMove.children,
            count = eItems.length,

            boxW = eBox.clientWidth,

            transform = c.getRightCssName('transform')[1],
            transition = c.getRightCssName('transition')[1],

            // 拖动的长度
            moveLength = 0,

            // 拖动情况 松开时 是否进行滑动的最大偏移值
            offset = boxW / 3,

            isRun = false,// 是否动画进行中

            // 当前显示项索引
            index = 0;

        for (var i = 0, btnHtml = ''; i < count; i++) {
            // 初始化项的位置
            eItems[i].style[transform] = 'translateX(' + (i * 100) + '%)';

            each(i);
        }

        c.swipeXScroll({
            eBox: eBox,
            swipeLeft: swipeLeft,
            swipeRight: swipeRight,
            swipeNot: function () {
                // 未发生，但有移动;

                // 超过一般情况 滑动
                if (Math.abs(moveLength) > offset) {

                    if (moveLength > 0) {
                        swipeRight();
                    }
                    else {
                        swipeLeft();
                    }
                }
                else {
                    // 复位
                    reset();
                }
            },
            onstart: function () {
                if (isRun) return false;
                moveLength = 0;
                eMove.style[transition] = '0s';
            },
            onmove: function (to) {
                moveLength += to;
                eMove.style[transform] = 'translate3d(' + ((-index * boxW) + moveLength ) + 'px,0,0)';
            }
        });

        eBox.addEventListener("webkitTransitionEnd", transitionend);
        eBox.addEventListener("transitionend", transitionend);

        this.swipeLeft = swipeLeft;
        this.swipeRight = swipeRight;

        function transitionend() {
            isRun = false;
        }

        function swipeLeft() {
            var i = index;
            i++;
            if (i >= count) {
                i = count - 1;
            }
            else {
                change(i);
            }
            anime();
        }

        function swipeRight() {
            var i = index;
            i--;
            if (i < 0) {
                i = 0;
            }
            else {
                change(i);
            }
            anime();
        }

        function reset() {
            anime();
        }

        function change(i) {
            onchange(eItems[i], index, i);
            index = i;
        }

        function anime() {
            isRun = true; // 将开启 只有动画结束后才能进行下一步操作
            eMove.style[transition] = '.3s';
            eMove.style[transform] = 'translate3d(' + (-index * boxW) + 'px,0,0)';
        }


    }
    
    function pcSlider(params) {
        var eBox = params.eBox,
            onchange = params.onchange,
            eMove = eBox.children[0],
            eItems = eMove.children,
            count = eItems.length,

            boxW = eBox.clientWidth,

            // 当前显示项索引
            index = 0;

        for (var i = 0, btnHtml = ''; i < count; i++) {
            // 初始化项的位置
            eItems[i].style.left = i * 100 + '%';
        }

        this.swipeLeft = swipeLeft;
        this.swipeRight = swipeRight;

        function swipeLeft() {
            var i = index;
            i++;
            if (i >= count) {
                i = count - 1;
            }
            else {
                change(i);
            }
            anime();
        }

        function swipeRight() {
            var i = index;
            i--;
            if (i < 0) {
                i = 0;
            }
            else {
                change(i);
            }
            anime();
        }

        function change(i) {
            onchange(eItems[i], index, i);
            index = i;
        }

        function anime() {
            $(eMove).animate({left:-index * 100+'%'})

        }
    }

    function ArrowHandle() {

        var jBtns = $(eBox).children('.aw'),
            that = this;


        jBtns.click(function () {
            excu(this);
        });

        // this.go=go;
        //
        // function go(is) {
        //
        // };

        function excu(eBtn) {
            that.go(jBtns[0] === eBtn);
        }
    }

})();