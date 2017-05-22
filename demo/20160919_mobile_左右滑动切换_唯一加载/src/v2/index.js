/**
 * Created by cql on 2017/04/15.
 *
 *
 */

import SliderOneLoad from 'slider-one-load-v2';


// let eBox=document.querySelector('.ques-test');
let xhr;
let sliderOneLoad=new SliderOneLoad({
    eBox:document.querySelector('.slide-loader'),
    count:10,
    // 加载完成后必须执行 complete。
    onLoad(page,complete){

        clearTimeout(xhr);

        xhr=setTimeout(() => {

            sliderOneLoad.eItems[sliderOneLoad.itemsSyncIndex[1]].querySelector('.ques-test').innerHTML=`<p>当前加载页数 <b>${page+1}</b></p>
这几天出差，白天开完会，晚上跟朋友们出门喝酒。都是些工作狂，台上乐队开始唱嗓音低沉浑厚的民谣时，我们在讨论怎么保持一天产出一篇文章，以及如何在此同时身体健好，不被掏空，可持续发展。

讨论的都是些很琐碎又很无奈的业务，有人滑出口一句“上个月只收入了五万”，隔壁桌有人翻来白眼，可我们这桌，满是见惯不惊的表情。在周围乌烟瘴气的闲聊中， 我们几个人听上去，满是成功人士的金钱腐朽味。

喝完酒后大家吃火锅，已近凌晨两点，众人嘴边的话题，才终于开始泛苦。

“看着身边的朋友，一个一个比自己红了。”

“有人不仅自己争气，老公也牛X，人家去创业，搭得上的人脉，你一辈子都攀不到。”

“一年挣两百万有什么用，两百万在北京，什么都买不了。”
            `;
            complete();

        }, 200);
    }
});



sliderOneLoad.load(9);
