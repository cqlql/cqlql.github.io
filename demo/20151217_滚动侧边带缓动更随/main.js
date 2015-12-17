"use strict";

var
    eBox=document.getElementById('test'),
    anime = new c.ChangeAnime(function (v) {
        eBox.style.top = v + 'px';
},.1);

c.eventBind(window,'scroll', function () {

    anime.start(c.getWindowScrollTop() + 100);

});
