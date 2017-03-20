/**
 * Created by cql on 2017/3/20.
 */


import click from 'click';
import Popup from 'popup';


function confirmPopup({title, des, confirm=()=>{}, cancel=()=>{}}) {

    let popup,
        eTitle,
        eDes,
        gConfirm = confirm,
        gCancel = cancel;
    confirmPopup = function ({title, des,confirm=()=>{}, cancel=()=>{}}) {
        gConfirm = confirm;
        gCancel = cancel;

        eTitle.textContent = title;
        eDes.textContent = des;

        popup.show();

    };
    popup = Popup.show({
        cache: true,
        title: title,
        content: `<div class="confirm-box">
<div class="des">${des}</div>
<div class="btns">
    <a class="button sure-btn" href="javascript:;">确认</a>
    <a class="button cancel-btn" href="javascript:;">取消</a>
</div>
</div>`,
        beforeShow: function (rootElem) {
            eTitle = document.querySelector('.tit');
            eDes = document.querySelector('.des');

            click(rootElem.querySelector('.btns'), function (e) {


                let classList = e.target.classList;
                if (classList.contains('sure-btn')) {
                    gConfirm();
                }
                else if (classList.contains('cancel-btn')) {
                    popup.close();
                    // gCancel();
                }
            });
        }

        // confirm:function () {
        //
        // },
        // cancel:function () {
        //
        // }
    })
}


/// demo

sole.addEventListener('click', function () {
    Popup.show({
        // outsideClose: false,
        title: 'test1',
        content: '<p style="padding:10px">test 内容。全局弹窗</p>',
        beforeClose(){
            console.log(123);

        }
    })
});

let popup1;
alone.addEventListener('click', function () {

    if (popup1) {
        popup1.show();
    }
    else {
        popup1 = Popup.show({
            cache: true,
            title: 'test2',
            // outsideClose:false,
            content: '<p style="padding:10px">test 内容。新实例弹窗</p>',
            beforeClose(){
                console.log(123);
                // return false;
            }
        });
    }

});

let id=0;
confirmbtn.addEventListener('click', function () {
    confirmPopup({
        title: '删除',
        des: '确认删除？'+id++,
        confirm() {
            console.log('confirm');
        }
    });
});
