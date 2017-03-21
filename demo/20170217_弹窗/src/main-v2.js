/**
 * Created by cql on 2017/3/20.
 */

// import click from 'dom/click';
import Popup, {popup, confirmPopup} from 'popup';
import {} from 'prism/prism';

/// demo
let newPopup = new Popup({
    title: 'test标题',
    content: '<p style="padding:10px">基础弹窗，多实例，可复用</p>',
});

baseNew.addEventListener('click', function () {

    newPopup.show();

});

disposable.addEventListener('click', function () {
    popup({
        // outsideClose: false,
        title: 'test标题',
        content: '<p style="padding:10px">test 内容。一次性弹窗</p>',
        beforeClose(){
            console.log(123);

        }
    });
});


let id = 0;
confirmbtn.addEventListener('click', function () {
    confirmPopup({
        title: '删除',
        des: '确认删除？' + id++,
        confirm() {
            console.log('confirm');
        }
    });
});

