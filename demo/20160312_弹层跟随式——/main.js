
var msg = document.querySelector('.msg-box-t1');

outsideClose(document.getElementById('test').children[0],msg,show,close);


function show() {
    msg.style.opacity = 1;
}
function close() {
    msg.style.opacity = 0;
}

// 点外面关闭实现
function outsideClose(eBtn, ePopup, show, close) {
    var inside = false;
    eBtn
    .addEventListener('click', function () {
        inside = true;
        show();
    });

    ePopup
    .addEventListener('click', function () {
        inside = true;
    });

    document.addEventListener('click', function () {
        if (inside) {
            inside = false;
        }
        else {
            close();
        }
    });
}