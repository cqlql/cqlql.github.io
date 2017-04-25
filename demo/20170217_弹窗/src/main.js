/**
 * Created by cql on 2017/3/20.
 */


import Popup, {popup, confirmPopup} from 'popup';
// import {} from 'prism/prism.css';
// import {} from 'prism/prism.js';

// demo1
let newPopup = new Popup({
    title: 'test标题',
    hasTopBar:false,
    width:100,
    content: '<p style="padding:10px">基础弹窗，多实例，可复用</p>',
    created(){
        console.log('初始化成功');
    }
});

// demo2
baseNew.addEventListener('click', function () {
    newPopup.show();
});

// demo3
disposable.addEventListener('click', function () {
    let popup1 = popup({
        title: '测试标题',
        content: '<p style="padding:10px">test 内容。一次性弹窗<a>再次弹窗</a></p>',
        beforeShow () {
            this.rootElem.querySelector('a').addEventListener('click', function () {

                popup({
                    title: '第二次标题',
                    content: '<p style="padding:10px">第二次弹窗<a>关闭第一次</a><p style="padding: 10px">多加点内容</p>',
                    beforeShow: function (rElem) {
                        rElem.querySelector('a').addEventListener('click', function () {

                            if (this.innerHTML === '关闭现在') {
                                popup.close();
                            }
                            else {
                                popup1.close();
                                this.innerHTML = '关闭现在';
                            }


                        });

                    }
                });

            });

        }
    });
});


let id = 0;
confirmbtn.addEventListener('click', function () {
    confirmPopup({
        title: '删除',
        des: '确认删除？(次数' + id++ + ')',
        confirm() {
            console.log('确认触发');
        }
    });
});

