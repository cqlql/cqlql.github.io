"use strict";

//为什么复杂，因为没有独立


function bannerFade(params) {
    var eBox = document.getElementById('fadeDemo')
        ,eListBox=eBox.children[0]
        , eItems = eListBox.children

        // 接受三种值：不给(0索引)、false(不进行初始显示)、索引值
        , isInitShow =params.isInitShow === undefined ? 0 : params.isInitShow 

        , currindex;
    
    
    if (isInitShow !== false) initShow(isInitShow);

    this.toChange = toChange;
    this.initShow = initShow;

    function toChange(index) {

    }

    function initShow(index) {


    }



}


bannerFade({});