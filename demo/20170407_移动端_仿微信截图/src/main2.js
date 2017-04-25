/**
 * Created by cql on 2017/4/12.
 */

function ZoomPicture() {

    function zoom(toX, toY, toW, toH, toScale) {

    }

    function zoomStart(t1, t2) {
        startDataXY = getDoubleToucheXY(t1, t2);
    }

    function zoomMove(t1,t2) {
        let moveDateXY = getDataXY(t1, t2);

        var
            centerX=moveDateXY.centerX,
            centerY=moveDateXY.centerY,
            moveX=moveDateXY.centerX - startDataXY.centerX,
            moveY=moveDateXY.centerX - startDataXY.centerX,
            scale = moveDateXY.diameter / startDataXY.diameter;

        toScale = currScale * scale;

        if (toScale < minScale) {
            toScale = minScale;
            scale = toScale / currScale;
        }

        //# x y
        var offsetX = centerX - currX,
            offsetY = centerY - currY;
        toW = oWidth * toScale;
        toH = oHeight * toScale;
        var offsetXS = offsetX / toW,
            offsetYS = offsetY / toH;
        // 缩放了多少长度
        var zoomW = toW * (1 - scale),
            zoomH = toH * (1 - scale);

        //
        toX = offsetXS * zoomW + moveX * scale + currX;
        toY = offsetYS * zoomH + moveY * scale + currY;

        //// 限制
        // 基本偏移
        if (toX < oWinW - toW - selectX) {
            toX = oWinW - toW - selectX;
        }
        if (toX > selectX) {
            toX = maxX - oWidth * (toScale - minScale ) / 2;
            if (toX < selectX) toX = selectX;
        }
        if (toY < oWinH - toH - selectY) {
            toY = oWinH - toH - selectY;
        }
        if (toY > selectY) {
            toY = maxY - oHeight * (toScale - minScale ) / 2;
            if (toY < selectY) toY = selectY;
        }

        zoom(toX, toY, toW, toH, toScale);

    }

    function zoomEnd() {
        currX = toX;
        currY = toY;
        currScale = toScale;
    }

    let startDataXY
        , startX, startY // 单指记录开始坐标

        , currX = 0, currY = 0 // 当前坐标
        , toX, toY // 临时

        // , winW, winH // 当前容器高宽
        , oWinW, oWinH// 容器高宽
        , oWidth, oHeight// 图片原始高宽
        , toW, toH // 临时

        , currScale = 1
        , toScale // 临时

        , minScale, maxX, maxY, minW, minH

        // 裁图选择框
        ,selectW, selectH, selectX, selectY

        , that = this;

    let isStart=0,
        eBox=document.querySelector('main');

    eBox.addEventListener('touchstart', function (e) {
        var touche = e.touches;

        if (touche.length === 2) {
            isStart = 1;
            zoomStart(touche[0], touche[1]);
        }
        else if (isStart) {
            isStart = 0;
            zoomEnd();
        }

    });

    eBox.addEventListener('touchmove', function (e) {
        if (isStart) {
            var touche = e.touches;
            zoomMove(touche[0], touche[1]);

            e.preventDefault();
        }
    });

    eBox.addEventListener('touchend', function (e) {
        var touche = e.touches;

        if (touche.length === 2) {
            isStart = 1;
            zoomStart(touche[0], touche[1]);
        }
        else {
            isStart = 0;
            zoomEnd();
        }
    });
}

ZoomPicture.prototype.resize=function () {
    // selectW, selectH, selectX, selectY

};

function ZoomBase() {

    // 双点坐标
// 获取的是相对于浏览器内容窗口。如果是以偏离浏览器窗口的div为窗口实现效果，且有滚动条情况下，centerXY需加上div滚动条卷去距离
   this.getDoubleToucheXY= function (touche1, touche2) {
        var
            xLen, yLen, centerX, centerY;

        xLen = Math.abs(touche1.pageX - touche2.pageX);
        yLen = Math.abs(touche1.pageY - touche2.pageY);

        if (touche1.pageX < touche2.pageX) {
            centerX = touche1.pageX + xLen / 2;
        } else {
            centerX = touche2.pageX + xLen / 2;
        }

        if (touche1.pageY < touche2.pageY) {
            centerY = touche1.pageY + yLen / 2;
        } else {
            centerY = touche2.pageY + yLen / 2;
        }

        return {
            centerX: centerX,
            centerY: centerY,

            // 两点连线长度
            diameter: Math.sqrt(Math.pow(xLen, 2) + Math.pow(yLen, 2))
        }
    }
}

function PinchZoom({
    // 图片容器，触摸事件触发元素。
    // 当然，也可以图片触发触摸事件，此情况目前不考虑
    eBox,

    onzoom=()=>{}
                     }) {

    function zoomStart(t1, t2) {
        startDataXY = that.getDoubleToucheXY(t1, t2);
    }

    function zoomMove(t1,t2) {
        let moveDateXY = that.getDoubleToucheXY(t1, t2);

        var
            centerX=moveDateXY.centerX,
            centerY=moveDateXY.centerY,
            moveX=moveDateXY.centerX - startDataXY.centerX,
            moveY=moveDateXY.centerX - startDataXY.centerX,
            scale = moveDateXY.diameter / startDataXY.diameter;

        toScale = currScale * scale;

        if (toScale < minScale) {
            toScale = minScale;
            scale = toScale / currScale;
        }

        //# x y
        var offsetX = centerX - currX,
            offsetY = centerY - currY;
        toW = oWidth * toScale;
        toH = oHeight * toScale;
        var offsetXS = offsetX / toW,
            offsetYS = offsetY / toH;
        // 缩放了多少长度
        var zoomW = toW * (1 - scale),
            zoomH = toH * (1 - scale);

        //
        toX = offsetXS * zoomW + moveX * scale + currX;
        toY = offsetYS * zoomH + moveY * scale + currY;

        //// 限制
        // 基本偏移
        if (toX < oWinW - toW - selectX) {
            toX = oWinW - toW - selectX;
        }
        if (toX > selectX) {
            toX = maxX - oWidth * (toScale - minScale ) / 2;
            if (toX < selectX) toX = selectX;
        }
        if (toY < oWinH - toH - selectY) {
            toY = oWinH - toH - selectY;
        }
        if (toY > selectY) {
            toY = maxY - oHeight * (toScale - minScale ) / 2;
            if (toY < selectY) toY = selectY;
        }

        onzoom(toX, toY, toW, toH, toScale);

    }

    function zoomEnd() {
        currX = toX;
        currY = toY;
        currScale = toScale;
    }

    let startDataXY
        , startX, startY // 单指记录开始坐标

        , currX = 0, currY = 0 // 当前坐标
        , toX, toY // 临时

        // , winW, winH // 当前容器高宽
        , oWinW, oWinH// 容器高宽
        , oWidth, oHeight// 图片原始高宽
        , toW, toH // 临时

        , currScale = 1
        , toScale // 临时

        , minScale, maxX, maxY, minW, minH

        // 裁图选择框
        ,selectW, selectH, selectX, selectY

        , that = this;

    let isStart=0;

    eBox.addEventListener('touchstart', function (e) {
        var touche = e.touches;

        if (touche.length === 2) {
            isStart = 1;
            zoomStart(touche[0], touche[1]);
        }
        else if (isStart) {
            isStart = 0;
            zoomEnd();
        }

    });

    eBox.addEventListener('touchmove', function (e) {
        if (isStart) {
            var touche = e.touches;
            zoomMove(touche[0], touche[1]);

            e.preventDefault();
        }
    });

    eBox.addEventListener('touchend', function (e) {
        var touche = e.touches;

        if (touche.length === 2) {
            isStart = 1;
            zoomStart(touche[0], touche[1]);
        }
        else {
            isStart = 0;
            zoomEnd();
        }
    });


}

PinchZoom.prototype=new ZoomBase;


let eBox=document.querySelector('main');

new PinchZoom({
    eBox,
    onzoom(toX, toY, toW, toH, toScale){

    }
});