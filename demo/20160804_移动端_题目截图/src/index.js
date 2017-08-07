import 'css-base/dist/base.css'
import 'ques-picture-clip/dist/ques-picture-clip.css'
// import 'msg-mobile/dist/msg-mobile.css'
import 'popup/dist/full-page-popup.css'
import './index.css'

// import {simpleMsg} from 'msg-mobile'
import QuesPictureClip from 'ques-picture-clip'

import {popup} from 'popup';


let pictureClip = new QuesPictureClip()

popupBtn.onclick = function () {
    pictureClip.show('../imgs/1.jpg', {1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1});
}

popupCloseBtn.onclick=function () {
    pictureClip.hide&&pictureClip.hide();
}

getDataBtn.onclick=function () {

    if (pictureClip.getSelectData){
        let popup1 = popup({
            hasTopBar:false,
            content: JSON.stringify(pictureClip.getSelectData()),
        });
    }
}
